"""Explicit administrator cleanup of duplicate, entirely unstarted exams.

Nothing runs on exam reads or registration. Originals, receipts and settings
live in private collections, outside the browser bootstrap/CRUD catalogue.
Attempts and registration capabilities deliberately remain consumed.
"""
from __future__ import annotations

from collections import defaultdict
from contextlib import contextmanager
from copy import deepcopy
from datetime import datetime, timezone
import hashlib
import json
import sqlite3
from types import SimpleNamespace
import unicodedata
import uuid

RULE_VERSION = 'same-name-number-round-unstarted-only-v1-20261023'
SETTINGS_COLLECTION = 'duplicate_cleanup_settings'
ARCHIVE_COLLECTION = 'duplicate_cleanup_archive'
RECEIPT_COLLECTION = 'duplicate_cleanup_receipts'
SETTINGS_ID = 'policy'
REFERENCE_COLLECTIONS = ('practical_scores', 'practical_history', 'reviews',
                         'direct_scores', 'direct_history')


def _core(value):
    return SimpleNamespace(**value) if isinstance(value, dict) else value


def normalize(value):
    """Normalize spelling, never remove a prefix, leading zero or digit."""
    if not isinstance(value, str):
        return ''
    return ' '.join(unicodedata.normalize('NFKC', value).casefold().split())


def _dump(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':'))


def _hash(value):
    return hashlib.sha256(_dump(value).encode()).hexdigest()


def _admin(core, user):
    if not isinstance(user, dict) or user.get('role') != 'admin':
        raise core.APIError('仅系统管理员可检测、设置或清理重复考试记录', 403)


def _settings(c, core):
    old = core.get(c, SETTINGS_COLLECTION, SETTINGS_ID, False)
    return {'enabled': old.get('enabled') is True if old else False,
            'updated_by': old.get('updated_by', '') if old else '',
            'updated_at': old.get('updated_at', '') if old else '',
            'rule_version': RULE_VERSION}


def settings(c, core, user):
    core = _core(core)
    _admin(core, user)
    return _settings(c, core)


def _references(c, core):
    result = defaultdict(list)
    for kind in REFERENCE_COLLECTIONS:
        for record in core.all_docs(c, kind):
            # Direct skills normally have no exam link. A legacy explicit
            # association still protects its exam, regardless of collection.
            for field in ('assignment_id', 'theory_assignment_id'):
                ident = record.get(field)
                if ident:
                    result[ident].append({'collection': kind, 'record': record})
    return result


def _protected_reasons(record, references):
    reasons = []
    if record.get('status') != 'assigned':
        reasons.append('status_not_unstarted')
    for key in ('started_at', 'submitted_at', 'completed_at', 'graded_at', 'terminated_at', 'reviewed_at'):
        if record.get(key) not in (None, ''):
            reasons.append(key)
    for key in ('termination_reason', 'termination_event', 'submission_review_required', 'requires_review',
                'submission_review', 'submission_review_reason', 'submission_snapshot_source',
                'timed_out', 'snapshot_rejected'):
        if record.get(key):
            reasons.append(key)
    # A zero is a real result too; do not use truthiness for numeric scores.
    for key in ('score', 'percent'):
        if record.get(key) is not None:
            reasons.append(key)
    details = record.get('details')
    if not isinstance(details, dict):
        reasons.append('invalid_exam_details')
    else:
        for key in ('answers', 'grades', 'exam_client_id',
                    'switch_events', 'screen_switch_events'):
            if details.get(key):
                reasons.append(key)
        for key in ('draft_answers', 'draft_sync', 'late_submission_evidence'):
            if key in details:
                reasons.append(key)
    for key in ('draft_answers', 'draft_sync'):
        if key in record:
            reasons.append(key)
    for key in ('answers', 'grades', 'switch_count',
                'screen_switch_count', 'screen_switch_events'):
        if record.get(key):
            reasons.append(key)
    if references:
        reasons.append('associated_assessment')
    return sorted(set(reasons))


def _identity(record, employee):
    # Frozen exam names are preferred; a conflicting current name is unsafe.
    raw_name, raw_number = record.get('employee_name'), record.get('employee_no')
    name = normalize(employee.get('name') if raw_name in (None, '') else raw_name)
    number = normalize(employee.get('employee_no') if raw_number in (None, '') else raw_number)
    round_id = record.get('round_id')
    return (name, number, round_id) if name and number and isinstance(round_id, str) and round_id else None


def _scope(record, employee, workshops, positions, core):
    details = record.get('details') if isinstance(record.get('details'), dict) else {}
    workshop = record.get('workshop_id') or employee.get('workshop_id') or ''
    position = details.get('position_id') or record.get('position_id') or employee.get('position_id') or ''
    conflicts = []
    if not workshop or not position:
        conflicts.append('missing_scope')
    workshop_record, position_record = workshops.get(workshop), positions.get(position)
    if not workshop_record or not position_record:
        conflicts.append('missing_workshop_or_position')
    elif not core.position_in_workshop(position_record, workshop_record):
        conflicts.append('position_workshop_mismatch')
    if not normalize(employee.get('name')) or not normalize(employee.get('employee_no')):
        conflicts.append('invalid_employee_identity')
    if record.get('workshop_id') and employee.get('workshop_id') and record['workshop_id'] != employee['workshop_id']:
        conflicts.append('employee_workshop_changed')
    if employee.get('position_id') and position != employee['position_id']:
        conflicts.append('employee_position_changed')
    if record.get('employee_name') and employee.get('name') and normalize(record['employee_name']) != normalize(employee['name']):
        conflicts.append('employee_name_changed')
    if record.get('employee_no') and employee.get('employee_no') and normalize(record['employee_no']) != normalize(employee['employee_no']):
        conflicts.append('employee_number_changed')
    return (workshop, position), conflicts


def _oldest(record):
    try:
        value = datetime.fromisoformat(record.get('created_at', ''))
        stamp = (value if value.tzinfo else value.replace(tzinfo=timezone.utc)).timestamp()
    except (TypeError, ValueError, OverflowError):
        stamp = float('inf')
    return stamp, record['id']


def _preview(c, core):
    employees = {record['id']: record for record in core.all_docs(c, 'employees')}
    workshops = {record['id']: record for record in core.all_docs(c, 'workshops')}
    positions = {record['id']: record for record in core.all_docs(c, 'positions')}
    references = _references(c, core)
    candidates = defaultdict(list)
    for record in core.all_docs(c, 'assignments'):
        employee = employees.get(record.get('employee_id'), {})
        identity = _identity(record, employee)
        if identity:
            candidates[identity].append(record)
    groups, version_inputs = [], []
    for identity, records in sorted(candidates.items()):
        if len(records) < 2:
            continue
        records.sort(key=_oldest)
        scopes, conflicts, reasons = set(), [], {}
        for record in records:
            employee = employees.get(record.get('employee_id'), {})
            scope, problems = _scope(record, employee, workshops, positions, core)
            scopes.add(scope)
            conflicts.extend(problems)
            if not employee:
                conflicts.append('missing_employee')
            reasons[record['id']] = _protected_reasons(record, references[record['id']])
            version_inputs.append({'assignment': record, 'employee': employee,
                                   'workshop': workshops.get(scope[0]), 'position': positions.get(scope[1]),
                                   'references': references[record['id']]})
        if len(scopes) != 1:
            conflicts.append('different_workshop_or_position')
        protected = [record for record in records if reasons[record['id']]]
        keeper = protected[0] if protected else records[0]
        eligible = [] if conflicts else [record['id'] for record in records
                                        if record['id'] != keeper['id'] and not reasons[record['id']]]
        scope = next(iter(scopes)) if len(scopes) == 1 else ('', '')
        groups.append({'id': _hash(identity), 'employee_name': records[0].get('employee_name') or employees.get(records[0].get('employee_id'), {}).get('name', ''),
            'employee_no': employees.get(records[0].get('employee_id'), {}).get('employee_no', ''),
            'round_id': identity[2], 'round_title': records[0].get('round_title', ''),
            'workshop_id': scope[0], 'position_id': scope[1],
            'workshop_name': workshops.get(scope[0], {}).get('name', ''),
            'position_name': positions.get(scope[1], {}).get('name', ''),
            'record_count': len(records), 'keeper_id': keeper['id'],
            'eligible_ids': eligible, 'conflicts': sorted(set(conflicts)),
            'needs_review': bool(conflicts or len(protected) > 1),
            'records': [{'id': record['id'], 'employee_id': record.get('employee_id', ''),
                         'status': record.get('status', ''), 'started_at': record.get('started_at'),
                         'submitted_at': record.get('submitted_at'), 'created_at': record.get('created_at'),
                         'protected_reasons': reasons[record['id']],
                         'action': 'delete' if record['id'] in eligible else 'review' if conflicts or len(protected) > 1 else 'keep'}
                        for record in records]})
    policy = _settings(c, core)
    version = _hash({'rule_version': RULE_VERSION, 'settings': policy,
                     'groups': version_inputs})
    return {'version': version, 'settings': policy, 'groups': groups,
            'summary': {'duplicate_groups': len(groups),
                        'eligible_records': sum(len(group['eligible_ids']) for group in groups),
                        'protected_records': sum(bool(row['protected_reasons']) for group in groups for row in group['records']),
                        'review_groups': sum(group['needs_review'] for group in groups)}}


def preview(c, core, user):
    core = _core(core)
    _admin(core, user)
    return _preview(c, core)


@contextmanager
def _atomic(c, core):
    started = not c.in_transaction
    savepoint = 'duplicate_cleanup_' + uuid.uuid4().hex
    try:
        if started:
            c.execute('BEGIN IMMEDIATE')
        c.execute('SAVEPOINT ' + savepoint)
        try:
            yield
        except Exception:
            c.execute('ROLLBACK TO SAVEPOINT ' + savepoint)
            c.execute('RELEASE SAVEPOINT ' + savepoint)
            if started:
                c.rollback()
            raise
        c.execute('RELEASE SAVEPOINT ' + savepoint)
    except sqlite3.OperationalError as error:
        if started and c.in_transaction:
            c.rollback()
        if 'locked' in str(error).lower() or 'busy' in str(error).lower():
            raise core.APIError('考试数据正在更新，请重新检测后清理', 409) from None
        raise


def _body(core, body):
    if not isinstance(body, dict):
        raise core.APIError('重复记录设置格式不正确')
    if not isinstance(body.get('expected_version'), str) or len(body['expected_version']) != 64:
        raise core.APIError('请先检测重复记录，再确认处理')
    if 'enabled' in body and type(body['enabled']) is not bool:
        raise core.APIError('启用设置必须为布尔值')


def _verify(core, body, state):
    if body['expected_version'] != state['version']:
        raise core.APIError('考试记录或关联评分已改变，请重新检测并核对后再处理', 409)


def _write_settings(c, core, user, enabled):
    old = _settings(c, core)
    if old['enabled'] == enabled:
        return old
    record = dict(old, id=SETTINGS_ID, enabled=enabled,
                  updated_by=user['id'], updated_at=core.now())
    core.put(c, SETTINGS_COLLECTION, record)
    return _settings(c, core)


def save_settings(c, core, user, body):
    core = _core(core)
    _admin(core, user)
    _body(core, body)
    if 'enabled' not in body:
        raise core.APIError('请提供是否启用重复记录清理')
    with _atomic(c, core):
        state = _preview(c, core)
        _verify(core, body, state)
        policy = _write_settings(c, core, user, body['enabled'])
    return {'settings': policy, 'deleted_count': 0}


def apply(c, core, user, body):
    """Caller commits. Version/permission checks and all deletions are atomic.

    Optional ``enabled: true`` enables the policy in this same operation.
    A stable optional request_key permits safe retry after a lost response.
    """
    core = _core(core)
    _admin(core, user)
    _body(core, body)
    key = body.get('request_key')
    if key is not None and (not isinstance(key, str) or not 8 <= len(key) <= 200 or
                            not key.isascii() or any(not (char.isalnum() or char in '-_') for char in key)):
        raise core.APIError('清理请求标识无效')
    receipt_id = _hash([user['id'], key]) if key else None
    request_hash = _hash({name: body[name] for name in ('expected_version', 'enabled') if name in body})
    with _atomic(c, core):
        old_receipt = core.get(c, RECEIPT_COLLECTION, receipt_id, False) if receipt_id else None
        if old_receipt:
            if old_receipt['request_hash'] != request_hash:
                raise core.APIError('该清理请求标识已用于另一操作，请重新检测', 409)
            return deepcopy(old_receipt['result'])
        state = _preview(c, core)
        _verify(core, body, state)
        enabled = body.get('enabled', state['settings']['enabled'])
        if not enabled:
            raise core.APIError('重复记录清理尚未启用，请先启用并核对检测结果', 409)
        policy = _write_settings(c, core, user, enabled)
        stamp = core.now()
        deleted = []
        for group in state['groups']:
            for ident in group['eligible_ids']:
                original = core.get(c, 'assignments', ident)
                # The transaction locked the version check and references. Keep
                # a second local assertion as an invariant near the deletion.
                if _protected_reasons(original, []):
                    raise core.APIError('记录已开始或存在作答内容，请重新检测', 409)
                archive = {'id': core.uid(), 'assignment_id': ident,
                           'original_assignment': deepcopy(original),
                           'deleted_by': user['id'], 'deleted_by_name': user.get('name', ''),
                           'deleted_at': stamp, 'reason': 'duplicate_unstarted_same_identity_round',
                           'keeper_id': group['keeper_id'], 'rule_version': RULE_VERSION,
                           'preview_version': state['version']}
                core.put(c, ARCHIVE_COLLECTION, archive)
                cursor = c.execute('DELETE FROM documents WHERE collection=? AND id=?', ('assignments', ident))
                if cursor.rowcount != 1:
                    raise core.APIError('记录已发生变化，请重新检测', 409)
                deleted.append(ident)
        result = {'deleted_count': len(deleted), 'deleted_ids': deleted,
                  'review_groups': state['summary']['review_groups'], 'settings': policy,
                  'processed_at': stamp, 'rule_version': RULE_VERSION}
        if receipt_id:
            core.put(c, RECEIPT_COLLECTION, {'id': receipt_id, 'request_hash': request_hash,
                     'created_at': stamp, 'created_by': user['id'], 'result': result})
    return result
