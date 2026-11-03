"""Read-only, evidence-backed individual skill development candidates.

The matrix is the authority for current, saved assessment results. Comparisons
never cross workshop, position, item, assessment mode or exam weighting rules.
Each employee is compared with *other* employees, and two peers are required.
No result or identity is repaired, merged, scored or otherwise written here.
"""
from __future__ import annotations

from collections import Counter, defaultdict
from datetime import datetime, timezone
import hashlib
import json
import math
from types import SimpleNamespace
import unicodedata

from direct_assessments import DIRECT_LEVELS, assessment_mode, skill_category, item_metadata


MINIMUM_COMPARABLE_EMPLOYEES = 3
EPSILON = 1e-9
SOURCE = 'capability_development'


def _core(value):
    return SimpleNamespace(**value) if isinstance(value, dict) else value


def _number(value, low, high):
    return type(value) in (int, float) and math.isfinite(value) and low <= value <= high


def _normalized(value):
    if not isinstance(value, str):
        return ''
    return ' '.join(unicodedata.normalize('NFKC', value).split()).casefold()


def _identifier(value):
    return isinstance(value, str) and bool(value)


def _query(core, query):
    result = {}
    for key in ('workshop_id', 'position_id', 'major_workshop_id', 'skill_category', 'only'):
        value = (query or {}).get(key, '')
        if isinstance(value, (tuple, list)):
            if len(value) != 1:
                raise core.APIError('培养筛选条件不能重复', 400)
            value = value[0]
        if not isinstance(value, str) or len(value) > 200:
            raise core.APIError('培养筛选条件不正确', 400)
        result[key] = value.strip()
    if result['skill_category'] == 'all':
        result['skill_category'] = ''
    if result['skill_category'] not in ('', 'operation', 'inspection', 'data'):
        raise core.APIError('技能分类不正确', 400)
    if not result['only']:
        result['only'] = 'all'
    if result['only'] not in ('all', 'below_average', 'priority', 'sample_insufficient'):
        raise core.APIError('培养名单筛选不正确', 400)
    return result


def _catalogue(core, c, user, kind):
    return {row['id']: row for row in core.all_docs(c, kind)
            if isinstance(row, dict) and _identifier(row.get('id'))
            and core.allowed(c, user, kind, row)}


def _labels(row):
    return {key: row.get(key, '') for key in ('id', 'name', 'name_id')}


def _cell_evidence(row, item, cell, employee, rules, direct_rules, core):
    """Return comparable value/criteria, or a concrete exclusion reason."""
    if not isinstance(cell, dict) or cell.get('work_item_id') != item['id']:
        return None, 'invalid_evidence'
    level, score = cell.get('level'), cell.get('practical_score')
    if type(level) is not int or not 0 <= level <= 4:
        return None, 'unassessed_or_invalid_level'
    if type(score) is not int or not 1 <= score <= 5:
        return None, 'unassessed_or_invalid_score'
    mode = assessment_mode(item)
    if assessment_mode(cell) != mode or cell.get('assessment_status') != 'completed':
        return None, 'incomplete_or_conflicting_mode'
    version = cell.get('rule_version')
    if not _identifier(version):
        return None, 'missing_or_conflicting_rules'
    criteria = {'workshop_id': employee['workshop_id'], 'position_id': employee['position_id'],
                'work_item_id': item['id'], 'assessment_mode': mode,
                'assessment_category': None, 'theory_weight': None, 'practical_weight': None,
                'rule_version': version}
    if mode == 'direct':
        if cell.get('assignment_id') or level != score - 1:
            return None, 'invalid_direct_evidence'
        if version != direct_rules.get('version'):
            return None, 'missing_or_conflicting_rules'
        direct_score = cell.get('direct_score')
        if direct_score is not None and (type(direct_score) is not int or direct_score != score):
            return None, 'invalid_direct_evidence'
        return {'value': score, 'unit': 'score', 'criteria': criteria}, None
    if mode != 'exam_practical':
        return None, 'incomplete_or_conflicting_mode'
    if (not _identifier(row.get('latest_assignment_id'))
            or cell.get('assignment_id') != row['latest_assignment_id']):
        return None, 'outdated_assignment'
    theory_item = cell.get('theory_item_percent')
    if theory_item is None:
        theory_item = cell.get('knowledge_percent')
    if (not all(_number(value, 0, 100) for value in
                (cell.get('theory_exam_percent'), theory_item, cell.get('final_percent')))
            or type(cell.get('question_count')) is not int or cell['question_count'] <= 0
            or cell.get('theory_status') != 'completed'):
        return None, 'incomplete_theory_evidence'
    category = employee.get('assessment_category')
    profiles = [profile for profile in rules.get('categories', [])
                if profile.get('key') == category]
    if (len(profiles) != 1 or row.get('assessment_category') != category
            or cell.get('assessment_category') != category or version != rules.get('version')):
        return None, 'missing_or_conflicting_rules'
    profile = profiles[0]
    weights = (cell.get('theory_weight'), cell.get('practical_weight'))
    if (not all(_number(weight, 0, 1) for weight in weights)
            or abs(math.fsum(weights) - 1) > EPSILON
            or any(not _number(profile.get(key), 0, 1)
                   or abs(cell[key] - profile[key]) > EPSILON
                   for key in ('theory_weight', 'practical_weight'))):
        return None, 'missing_or_conflicting_rules'
    # Detect impossible levels and composites instead of silently calling them
    # low ability. Current category overrides come from effective_employee.
    expected_level = core.level_for_percent(cell['final_percent'])
    expected_value = core.combined_percent(theory_item, score, category)
    if expected_level != level or expected_value is None or abs(expected_value - cell['final_percent']) > EPSILON:
        return None, 'inconsistent_composite'
    criteria.update(assessment_category=category, theory_weight=weights[0], practical_weight=weights[1])
    return {'value': cell['final_percent'], 'unit': 'percent', 'criteria': criteria}, None


def _evidence(cell):
    # Intentionally omit notes, answers, question text, tokens and other people.
    result = {key: cell.get(key) for key in (
        'theory_completed_at', 'practical_reviewed_at', 'rated_at', 'theory_exam_percent',
        'theory_item_percent', 'practical_score', 'direct_score', 'question_count',
        'rule_version', 'practical_rule_version', 'practical_assessment_category',
        'practical_theory_weight', 'practical_practical_weight')}
    coverage = cell.get('coverage')
    result['coverage'] = ({key: coverage.get(key) for key in
                           ('dimension_count', 'required_dimensions', 'complete')}
                          if isinstance(coverage, dict) else None)
    return result


def report(c, core, user, query=None):
    """Return current training candidates, with no database mutation.

    ``core`` accepts the server namespace or ``globals()``; query accepts either
    strings or parse_qs lists. ``compare_count`` always excludes the employee.
    The only-filter changes rows, not the underlying denominators or cohorts.
    """
    core = _core(core)
    if not isinstance(user, dict) or not user.get('id') or not user.get('role'):
        raise core.APIError('请先登录', 401)
    if not core.capabilities(user).get('view_results'):
        raise core.APIError('此账号没有能力培养查看权限', 403)
    scope = _query(core, query)
    wid, pid = scope['workshop_id'], scope['position_id']
    # Explicit scopes must pass the same object-level checks as matrix reads.
    for key, kind in (('workshop_id', 'workshops'), ('position_id', 'positions'),
                      ('major_workshop_id', 'major_workshops')):
        if scope[key]:
            core.authorize(c, user, kind, core.get(c, kind, scope[key]))
    workshops = _catalogue(core, c, user, 'workshops')
    positions = _catalogue(core, c, user, 'positions')
    if wid and pid and (wid not in workshops or pid not in positions
                       or not core.position_in_workshop(positions[pid], workshops[wid])):
        raise core.APIError('所选岗位不属于该车间', 400)
    if scope['major_workshop_id']:
        major = scope['major_workshop_id']
        if wid and workshops[wid].get('major_workshop_id') != major:
            raise core.APIError('所选车间不属于该大车间', 400)
        if pid and positions[pid].get('major_workshop_id') != major and not (
                positions[pid].get('workshop_id') in workshops
                and workshops[positions[pid]['workshop_id']].get('major_workshop_id') == major):
            raise core.APIError('所选岗位不属于该大车间', 400)
    matrix = core.matrix(c, user, pid, wid)
    rules, direct_rules = matrix.get('rating_rules', {}), matrix.get('direct_rating_rules', {})
    excluded = Counter()
    employees = {}
    for employee in core.all_docs(c, 'employees'):
        if not isinstance(employee, dict) or not core.allowed(c, user, 'employees', employee):
            continue
        if wid and employee.get('workshop_id') != wid or pid and employee.get('position_id') != pid:
            continue
        workshop = workshops.get(employee.get('workshop_id'))
        position = positions.get(employee.get('position_id'))
        if scope['major_workshop_id'] and (not workshop or workshop.get('major_workshop_id') != scope['major_workshop_id']):
            continue
        if not workshop or not position or not core.position_in_workshop(position, workshop):
            excluded['invalid_employee_relation'] += 1
            continue
        if employee.get('active') is not True:
            excluded['inactive_employee'] += 1
            continue
        if not _identifier(employee.get('id')) or not _normalized(employee.get('name')) or not _normalized(employee.get('employee_no')):
            excluded['missing_employee_identity'] += 1
            continue
        effective = getattr(core, 'effective_employee', None)
        employees[employee['id']] = effective(c, employee) if effective else dict(employee)
    active_employee_count = len(employees)
    identities = defaultdict(list)
    for employee in employees.values():
        identities[(employee['workshop_id'], employee['position_id'], _normalized(employee['name']),
                    _normalized(employee['employee_no']))].append(employee['id'])
    ambiguous = {eid for ids in identities.values() if len(ids) > 1 for eid in ids}
    excluded['ambiguous_identity_groups'] = sum(len(ids) > 1 for ids in identities.values())
    excluded['ambiguous_identity_profiles'] = len(ambiguous)
    for eid in ambiguous:
        del employees[eid]
    original_items = _catalogue(core, c, user, 'work_items')
    items, conflicting_items = {}, set()
    for item in matrix.get('items', []):
        if not isinstance(item, dict) or not _identifier(item.get('id')):
            excluded['invalid_item'] += 1
            continue
        ident = item['id']
        original = original_items.get(ident)
        if not original or item.get('position_id') != original.get('position_id'):
            excluded['invalid_item_relation'] += 1
            continue
        if original.get('active') is not True or item.get('active') is not True:
            excluded['inactive_item'] += 1
            continue
        if scope['skill_category'] and skill_category(item) != scope['skill_category']:
            continue
        if assessment_mode(item) not in ('direct', 'exam_practical') or skill_category(item) not in ('operation', 'inspection', 'data'):
            excluded['invalid_item_classification'] += 1
            continue
        if any(item.get(key, default) != original.get(key, default) for key, default in
               (('assessment_mode', 'exam_practical'), ('skill_category', 'operation'))):
            excluded['invalid_item_relation'] += 1
            continue
        if ident in items:
            excluded['duplicate_item_rows'] += 1
            if items[ident] != item:
                conflicting_items.add(ident)
            continue
        items[ident] = item
    for ident in conflicting_items:
        del items[ident]
        excluded['conflicting_item_rows'] += 1
    cohorts, seen_employees, assessed_employees = defaultdict(list), set(), set()
    for row in matrix.get('rows', []):
        if not isinstance(row, dict) or not isinstance(row.get('employee'), dict):
            excluded['invalid_matrix_row'] += 1
            continue
        eid = row['employee'].get('id')
        if eid in seen_employees:
            excluded['duplicate_employee_rows'] += 1
            continue
        seen_employees.add(eid)
        employee = employees.get(eid)
        if not employee:
            continue
        if any(row['employee'].get(key) != employee.get(key) for key in ('workshop_id', 'position_id')):
            excluded['invalid_matrix_employee_relation'] += 1
            continue
        cells, conflicting = {}, set()
        for cell in row.get('cells', []):
            if not isinstance(cell, dict):
                excluded['invalid_evidence'] += 1
                continue
            iid = cell.get('work_item_id')
            if iid in cells:
                excluded['duplicate_cell_rows'] += 1
                if cells[iid] != cell:
                    conflicting.add(iid)
            else:
                cells[iid] = cell
        for item in items.values():
            if item['position_id'] != employee['position_id']:
                continue
            if item['id'] in conflicting:
                excluded['conflicting_cell_rows'] += 1
                continue
            cell = cells.get(item['id'])
            if cell is None:
                excluded['missing_assessment'] += 1
                continue
            evidence, reason = _cell_evidence(row, item, cell, employee, rules, direct_rules, core)
            if reason:
                excluded[reason] += 1
                continue
            key = json.dumps(evidence['criteria'], sort_keys=True, ensure_ascii=False, separators=(',', ':'))
            record = {'employee': {key: employee.get(key, '') for key in
                                    ('id', 'name', 'employee_no', 'workshop_id', 'position_id')},
                      'work_item': {**_labels(item), **item_metadata(item)},
                      'workshop': _labels(workshops[employee['workshop_id']]),
                      'position': _labels(positions[employee['position_id']]),
                      **evidence, 'level': cell['level'],
                      'level_label': DIRECT_LEVELS[cell['level']][0],
                      'level_label_id': DIRECT_LEVELS[cell['level']][1],
                      'assessment_status': cell['assessment_status'], 'assignment_id': cell.get('assignment_id'),
                      'evidence': _evidence(cell)}
            cohorts[key].append(record)
            assessed_employees.add(eid)
    rows, summaries = [], []
    for key in sorted(cohorts):
        records = cohorts[key]
        count = len(records)
        total = math.fsum(record['value'] for record in records)
        cohort_id = hashlib.sha256(key.encode()).hexdigest()[:24]
        summaries.append({'id': cohort_id, **records[0]['criteria'],
                          'skill_category': records[0]['work_item']['skill_category'],
                          'count': count, 'mean': total / count, 'unit': records[0]['unit'],
                          'sample_insufficient': count < MINIMUM_COMPARABLE_EMPLOYEES})
        for record in records:
            compare_count = count - 1
            insufficient = count < MINIMUM_COMPARABLE_EMPLOYEES
            # Scores are bounded at 100. A compensated, unrounded total keeps
            # this linear in cohort size; display rounding never enters means.
            average = (math.fsum((total, -record['value'])) / compare_count
                       if not insufficient else None)
            below = average is not None and average - record['value'] > EPSILON
            priority = record['level'] < 3
            if not below and not priority:
                continue
            rows.append({**record, 'cohort_id': cohort_id, 'cohort_count': count,
                         'compare_count': compare_count, 'peer_average': average,
                         'gap': record['value'] - average if average is not None else None,
                         'below_average': below, 'priority': priority,
                         'sample_insufficient': insufficient,
                         'status': 'sample_insufficient' if insufficient else 'priority' if priority else 'below_average'})
    rows.sort(key=lambda row: (not row['priority'], not row['below_average'],
                              row['level'], row['gap'] if row['gap'] is not None else math.inf,
                              row['employee']['workshop_id'], row['employee']['position_id'],
                              _normalized(row['employee']['name']), row['employee']['employee_no'], row['work_item']['id']))
    counts = {'active_employees': active_employee_count, 'eligible_employees': len(employees),
              'assessed_employees': len(assessed_employees),
              'valid_assessments': sum(len(records) for records in cohorts.values()),
              'training_rows': len(rows), 'training_employees': len({r['employee']['id'] for r in rows}),
              'below_average_rows': sum(r['below_average'] for r in rows),
              'priority_rows': sum(r['priority'] for r in rows),
              'sample_insufficient_rows': sum(r['sample_insufficient'] for r in rows)}
    if scope['only'] != 'all':
        rows = [row for row in rows if row[scope['only']]]
    counts['filtered_rows'] = len(rows)
    counts['filtered_employees'] = len({row['employee']['id'] for row in rows})
    return {'source': SOURCE, 'generated_at': datetime.now(timezone.utc).isoformat(), 'scope': scope,
            'definitions': {'minimum_comparable_employees': MINIMUM_COMPARABLE_EMPLOYEES,
                            'minimum_peers': MINIMUM_COMPARABLE_EMPLOYEES - 1,
                            'comparison_unit': 'employee_work_item', 'peer_excludes_self': True,
                            'priority_level_lt': 3, 'below_average_epsilon': EPSILON,
                            'below_average_rule': 'value < mean(other comparable employees), without display rounding',
                            'cohort_fields': ['workshop_id', 'position_id', 'work_item_id', 'assessment_mode',
                                              'assessment_category', 'theory_weight', 'practical_weight', 'rule_version'],
                            'exam_value': 'current final_percent, 0..100', 'direct_value': 'saved score, 1..5',
                            'unassessed_is_zero': False, 'ambiguous_identity_policy': 'exclude_all_profiles',
                            'round_policy': 'latest completed assignment per employee; never pool historical attempts'},
            'counts': counts, 'exclusions': dict(sorted(excluded.items())), 'cohorts': summaries, 'rows': rows}
