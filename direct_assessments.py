"""Non-exam skills: five observed levels, independent from exam attempts.

This module never creates an assignment or converts an observed rating into a
percentage. The caller supplies its server namespace to keep the persistence and
authorization rules in one place without importing the server recursively.
"""
from __future__ import annotations
import hashlib
import shared_question_banks as shared_banks
from types import SimpleNamespace

DIRECT_RULE_VERSION = 'direct-five-level-v1-20261019'
MODE_LABELS = {'exam_practical': ('理论考试＋现场实操', 'Ujian teori + praktik lapangan'),
               'direct': ('直接评分', 'Penilaian langsung')}
CATEGORY_LABELS = {'operation': ('标准作业', 'Pekerjaan standar'),
                   'inspection': ('点检', 'Inspeksi'),
                   'data': ('数据', 'Data')}
DIRECT_LEVELS = (
    ('尚未掌握', 'Sama sekali tidak bisa'),
    ('需全程指导', 'Selesai dengan bimbingan orang lain'),
    ('需部分指导', 'Selesai dengan dipandu orang lain'),
    ('可独立完成', 'Bisa menyelesaikan sendiri'),
    ('可指导他人', 'Bisa mengajari orang lain'),
)


def _core(value):
    return SimpleNamespace(**value) if isinstance(value, dict) else value


def assessment_mode(item):
    return item.get('assessment_mode') or 'exam_practical'


def skill_category(item):
    return item.get('skill_category') or 'operation'


def item_metadata(item):
    mode, category = assessment_mode(item), skill_category(item)
    ml, mi = MODE_LABELS.get(mode, MODE_LABELS['exam_practical'])
    cl, ci = CATEGORY_LABELS.get(category, CATEGORY_LABELS['operation'])
    # A workshop-defined category is a display axis. The three base categories
    # and assessment mode remain authoritative for scoring and comparisons.
    custom = {key: item.get(key, '').strip() if isinstance(item.get(key, ''), str) else ''
              for key in ('work_category_id', 'work_category_name', 'work_category_name_id')}
    custom_name = custom['work_category_name']
    return {'assessment_mode': mode, 'skill_category': category,
            'assessment_mode_label': ml, 'assessment_mode_label_id': mi,
            'skill_category_label': cl, 'skill_category_label_id': ci,
            **custom, 'work_category_label': custom_name or cl,
            'work_category_label_id': (custom['work_category_name_id'] or custom_name) if custom_name else ci}


def direct_rules():
    return {'version': DIRECT_RULE_VERSION, 'min_score': 1, 'max_score': 5,
            'levels': [{'score': index + 1, 'level': index, 'label_zh': zh, 'label_id': indonesian}
                       for index, (zh, indonesian) in enumerate(DIRECT_LEVELS)]}


def record_id(employee_id, work_item_id):
    return hashlib.sha256(('direct:' + '\0'.join((employee_id, work_item_id))).encode()).hexdigest()


def validate_item_policy(c, core, item, old=None):
    core = _core(core)
    mode, category = item.get('assessment_mode', 'exam_practical'), item.get('skill_category', 'operation')
    if not isinstance(mode, str) or mode not in MODE_LABELS: raise core.APIError('考核方式不正确')
    if not isinstance(category, str) or category not in CATEGORY_LABELS: raise core.APIError('技能分类不正确')
    item.update(assessment_mode=mode, skill_category=category)
    if old and assessment_mode(old) != assessment_mode(item):
        ident = item['id']
        used = shared_banks.has_questions(c, core, old)
        used = used or any(any(q.get('work_item_id') == ident for q in a.get('details', {}).get('questions', []))
                           for a in core.all_docs(c, 'assignments'))
        used = used or any(r.get('work_item_id') == ident
                           for kind in ('practical_scores', 'practical_history', 'direct_scores', 'direct_history', 'reviews')
                           for r in core.all_docs(c, kind))
        if used: raise core.APIError('该技能已有题目或考核记录，不能更改考核方式；请新建技能以保留历史', 409)
    return item


def history(c, core, user, query):
    core = _core(core)
    eid = query.get('employee_id', [''])[0]
    iid = query.get('work_item_id', [''])[0]
    if eid: core.authorize(c, user, 'employees', core.get(c, 'employees', eid))
    if iid: core.authorize(c, user, 'work_items', core.get(c, 'work_items', iid))
    employees = {e['id'] for e in core.all_docs(c, 'employees') if core.allowed(c, user, 'employees', e)}
    rows = [r for r in core.all_docs(c, 'direct_history')
            if r['employee_id'] in employees and (not eid or r['employee_id'] == eid)
            and (not iid or r['work_item_id'] == iid)]
    rows.sort(key=lambda r: (r['reviewed_at'], r['id']))
    return {'history': rows}


def score(c, core, user, body):
    core = _core(core)
    if not core.capabilities(user)['score_practical']: raise core.APIError('此账号没有技能评分权限', 403)
    if not isinstance(body, dict): raise core.APIError('技能评分格式不正确')
    eid = core.strval(body.get('employee_id', ''), '员工', 200, True)
    iid = core.strval(body.get('work_item_id', ''), '技能', 200, True)
    employee, item = core.get(c, 'employees', eid), core.get(c, 'work_items', iid)
    core.authorize(c, user, 'employees', employee)
    core.authorize(c, user, 'work_items', item)
    if assessment_mode(item) != 'direct': raise core.APIError('该作业须按理论考试和现场实操评分，不能直接评分')
    if not employee.get('active', False): raise core.APIError('停用员工不能评分')
    if not item.get('active', False): raise core.APIError('停用技能不能评分')
    if employee['position_id'] != item['position_id']: raise core.APIError('员工与技能必须属于同一岗位')
    if body.get('assignment_id') not in (None, ''): raise core.APIError('直接评分技能不关联理论考试记录')
    value = body.get('score')
    if type(value) is not int or not 1 <= value <= 5: raise core.APIError('技能评分必须为1至5的整数')
    note = core.strval(body.get('note', ''), '评分备注', 5000)
    ident = record_id(eid, iid)
    old = core.get(c, 'direct_scores', ident, False)
    unchanged = bool(old and old['score'] == value and old.get('note', '') == note
                     and old.get('rule_version') == DIRECT_RULE_VERSION)
    # Direct assessment is a new API: every writer must identify the version
    # they read. Omitting the field must never become an unconditional update.
    expected = body.get('expected_reviewed_at')
    if not isinstance(expected, str): raise core.APIError('请提供技能评分版本，刷新页面后重新保存')
    if expected != (old.get('reviewed_at', '') if old else '') and not unchanged:
        raise core.APIError('该技能评分已被更新，请刷新核对后重新保存', 409)
    if unchanged:
        record = old
    else:
        timestamp = core.now()
        record = {'id': ident, 'employee_id': eid, 'work_item_id': iid, 'assignment_id': None,
                  'score': value, 'level': value - 1, 'note': note, 'source': 'direct',
                  'assessment_mode': 'direct', 'skill_category': skill_category(item),
                  'work_item_name': item['name'], 'work_item_name_id': core.work_item_name_id(item),
                  'position_id': employee['position_id'], 'workshop_id': employee['workshop_id'],
                  'reviewed_at': timestamp, 'reviewed_by': user['name'], 'reviewer_id': user['id'],
                  'created_at': old.get('created_at', timestamp) if old else timestamp,
                  'rule_version': DIRECT_RULE_VERSION, 'guidance_version': DIRECT_RULE_VERSION,
                  'practical_standard_zh': item.get('practical_standard_zh', ''),
                  'practical_standard_id': item.get('practical_standard_id', ''),
                  'level_label': DIRECT_LEVELS[value - 1][0], 'level_label_id': DIRECT_LEVELS[value - 1][1]}
        core.put(c, 'direct_scores', record)
        core.put(c, 'direct_history', dict(record, id=core.uid(), direct_id=ident))
    result = core.matrix(c, user, employee['position_id'], employee['workshop_id'])
    cell = next(cell for row in result['rows'] if row['employee']['id'] == eid
                for cell in row['cells'] if cell['work_item_id'] == iid)
    return {'direct': record, 'practical': record, 'assessment': cell, 'unchanged': unchanged}


def cell(employee, item, record, may_score):
    value = record.get('score') if record else None
    if type(value) is not int or not 1 <= value <= 5: value = None
    record = record if value is not None else None
    stamp = record.get('reviewed_at') if record else None
    reviewer = record.get('reviewed_by') if record else None
    status = 'completed' if record else 'pending_direct'
    can_score = bool(may_score and employee.get('active', False) and item.get('active', False))
    return {'work_item_id': item['id'], **item_metadata(item), 'source': 'direct',
            'direct_score': value, 'practical_score': value, 'level': value - 1 if value else None,
            'level_label': DIRECT_LEVELS[value - 1][0] if value else None,
            'level_label_id': DIRECT_LEVELS[value - 1][1] if value else None,
            'assessment_status': status, 'status': status,
            'assessment_message': '已按五档直接评分生成月亮图' if record else '无需理论考试，请车间直接按五档评分',
            'can_score_direct': can_score, 'can_score_practical': can_score, 'practical_eligible': can_score,
            'theory_status': 'not_required', 'question_count': 0, 'pending_question_count': 0,
            'dimension_scores': [], 'coverage': {'assessed_dimensions': [], 'dimension_count': 0,
                                                'required_dimensions': 0, 'complete': True},
            'knowledge_percent': None, 'theory_item_percent': None, 'theory_exam_percent': None,
            'theory_completed_at': None, 'practical_percent': None, 'final_percent': None,
            'composite_percent': None, 'assignment_id': None, 'assessment_category': None,
            'assessment_category_label': None, 'assessment_category_label_id': None,
            'theory_weight': None, 'practical_weight': None, 'practical_assessment_category': None,
            'practical_theory_weight': None, 'practical_practical_weight': None,
            'practical_note': record.get('note', '') if record else '',
            'note': record.get('note', '') if record else '', 'reviewed_at': stamp, 'rated_at': stamp,
            'reviewed_by': reviewer, 'practical_reviewed_at': stamp,
            'practical_reviewed_by': reviewer, 'practical_reviewed_by_name': reviewer,
            'practical_reviewer_id': record.get('reviewer_id') if record else None,
            'practical_reviewed_by_id': record.get('reviewer_id') if record else None,
            'practical_rule_version': record.get('rule_version') if record else None,
            'rule_version': DIRECT_RULE_VERSION}
