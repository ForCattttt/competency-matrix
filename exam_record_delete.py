"""Explicit, versioned administrator deletion of one static exam record.

The private archive is deliberately outside the public CRUD collections. The
exam and its current assignment-linked practical rows disappear together;
complete originals, score history, employee data and consumed attempts remain.
Nothing runs during startup, reads, registration or automatic duplicate cleanup.
"""
from __future__ import annotations

from contextlib import contextmanager
import hashlib
import json
from types import SimpleNamespace
import uuid

ARCHIVE_COLLECTION = 'exam_record_delete_archive'
POLICY_VERSION = 'admin-static-exam-delete-v1-20261027'
STATIC_STATUSES = frozenset(('assigned', 'completed', 'pending_review', 'voided'))
REFERENCE_COLLECTIONS = ('practical_scores', 'practical_history', 'reviews',
                         'direct_scores', 'direct_history')


def _core(value):
    return SimpleNamespace(**value) if isinstance(value, dict) else value


def _admin(core, user):
    if not isinstance(user, dict) or user.get('role') != 'admin':
        raise core.APIError('仅系统管理员可删除考试记录', 403)


def _eligible(core, assignment):
    if assignment.get('status') not in STATIC_STATUSES:
        raise core.APIError('进行中的考试不能删除，请等待考试结束', 409)
    if assignment.get('status') == 'assigned':
        details = assignment.get('details')
        if (not isinstance(details, dict) or assignment.get('started_at')
                or any(details.get(key) for key in ('answers', 'grades', 'exam_client_id',
                                                  'switch_events', 'screen_switch_events'))
                or any(key in details for key in ('draft_answers', 'draft_sync', 'late_submission_evidence'))
                or any(assignment.get(key) not in (None, '') for key in
                       ('submitted_at', 'completed_at', 'graded_at', 'terminated_at'))
                or any(assignment.get(key) is not None for key in ('score', 'percent'))):
            raise core.APIError('未开始记录已有作答痕迹，请先核查考试状态', 409)


def _rows(c, collection):
    return [dict(row) for row in c.execute(
        'SELECT collection,id,payload FROM documents WHERE collection=? ORDER BY id',
        (collection,))]


def _snapshot(c, core, assignment_id):
    assignment = core.get(c, 'assignments', assignment_id)
    _eligible(core, assignment)
    row = c.execute('SELECT collection,id,payload FROM documents WHERE collection=? AND id=?',
                    ('assignments', assignment_id)).fetchone()
    employee = core.get(c, 'employees', assignment.get('employee_id', ''))
    employee_row = c.execute('SELECT collection,id,payload FROM documents WHERE collection=? AND id=?',
                             ('employees', employee['id'])).fetchone()
    references = []
    for kind in REFERENCE_COLLECTIONS:
        for ref in _rows(c, kind):
            record = json.loads(ref['payload'])
            if any(record.get(field) == assignment_id for field in ('assignment_id', 'theory_assignment_id')):
                references.append(ref)
    state = {'policy_version': POLICY_VERSION, 'assignment': dict(row),
             'employee': dict(employee_row), 'references': references}
    version = hashlib.sha256(json.dumps(state, ensure_ascii=False, sort_keys=True,
                                       separators=(',', ':')).encode()).hexdigest()
    return state, version, assignment, employee


def preview(c, core, user, assignment_id):
    core = _core(core)
    _admin(core, user)
    state, version, assignment, employee = _snapshot(c, core, assignment_id)
    removed = [row for row in state['references'] if row['collection'] == 'practical_scores'
               and json.loads(row['payload']).get('assignment_id') == assignment_id]
    return {'version': version, 'policy_version': POLICY_VERSION,
            'assignment': {key: assignment.get(key) for key in
                           ('id', 'employee_id', 'plan_id', 'round_id', 'created_at',
                            'started_at', 'submitted_at', 'status', 'percent', 'plan_title')},
            'employee': {key: employee.get(key) for key in
                         ('id', 'name', 'employee_no', 'workshop_id', 'position_id')},
            'practical_score_count': len(removed),
            'archived_reference_count': len(state['references'])}


@contextmanager
def _atomic(c):
    if not c.in_transaction:
        c.execute('BEGIN')
    name = 'exam_delete_' + uuid.uuid4().hex
    c.execute('SAVEPOINT ' + name)
    try:
        yield
    except BaseException:
        c.execute('ROLLBACK TO SAVEPOINT ' + name)
        c.execute('RELEASE SAVEPOINT ' + name)
        raise
    c.execute('RELEASE SAVEPOINT ' + name)


def apply(c, core, user, assignment_id, body):
    core = _core(core)
    _admin(core, user)
    if not isinstance(body, dict) or body.get('confirm') is not True:
        raise core.APIError('请先核对并确认删除这条考试记录')
    expected = body.get('expected_version')
    if not isinstance(expected, str) or len(expected) != 64 or any(char not in '0123456789abcdef' for char in expected):
        raise core.APIError('请先读取删除影响，再确认删除')
    with _atomic(c):
        state, version, assignment, employee = _snapshot(c, core, assignment_id)
        if not core.hmac.compare_digest(expected, version):
            raise core.APIError('考试、员工或关联评分已变化，请重新打开删除确认', 409)
        removed = [row for row in state['references'] if row['collection'] == 'practical_scores'
                   and json.loads(row['payload']).get('assignment_id') == assignment_id]
        archive = {'id': core.uid(), 'assignment_id': assignment_id,
                   'original_assignment': assignment,
                   'original_assignment_payload': state['assignment']['payload'],
                   'original_employee': employee,
                   'linked_assessments': state['references'],
                   'removed_practical_score_ids': [row['id'] for row in removed],
                   'deleted_by': user['id'], 'deleted_by_name': user.get('name', ''),
                   'deleted_at': core.now(), 'preview_version': version,
                   'reason': 'administrator_single_record_delete', 'policy_version': POLICY_VERSION}
        core.put(c, ARCHIVE_COLLECTION, archive)
        for row in removed:
            cursor = c.execute('DELETE FROM documents WHERE collection=? AND id=? AND payload=?',
                               (row['collection'], row['id'], row['payload']))
            if cursor.rowcount != 1:
                raise core.APIError('关联评分已变化，请重新核查', 409)
        cursor = c.execute('DELETE FROM documents WHERE collection=? AND id=? AND payload=?',
                           ('assignments', assignment_id, state['assignment']['payload']))
        if cursor.rowcount != 1:
            raise core.APIError('考试记录已变化，请重新核查', 409)
    return {'ok': True, 'deleted_assignment_id': assignment_id,
            'deleted_practical_score_count': len(removed), 'archived': True}


def delete_unstarted(c, core, user, assignment):
    """Keep the original DELETE route restricted to its unstarted-only contract."""
    core = _core(core)
    _admin(core, user)
    if assignment.get('status') != 'assigned':
        raise core.APIError('请通过考试记录中的删除确认操作删除已结束考试', 409)
    state = preview(c, core, user, assignment['id'])
    return apply(c, core, user, assignment['id'],
                 {'confirm': True, 'expected_version': state['version']})
