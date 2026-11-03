"""Public exam availability and equal-weight snapshots without changing banks.

The caller supplies the server module (or its ``globals()``) to avoid circular
imports. Availability is computed from explicitly opened rounds and bank data; it never
returns employee records, questions, answer keys, or examination capabilities.
"""
from __future__ import annotations

from exam_rounds import choose_open_round
from direct_assessments import assessment_mode
import shared_question_banks as shared_banks
from copy import deepcopy
from decimal import Decimal
import re
from types import SimpleNamespace


def _core(value):
    return SimpleNamespace(**value) if isinstance(value, dict) else value


def _required_count(core, value):
    count = core.EXAM_QUESTION_COUNT if value is None else value
    if type(count) is not int or not 1 <= count <= 1000:
        raise ValueError('question_count must be an integer between 1 and 1000')
    return count


def choose_active_plan(c, core, workshop_id, position_id, *, plans=None):
    """Use the same workshop-specific priority and stable order as enrollment."""
    core = _core(core)
    plans = core.all_docs(c, 'plans') if plans is None else plans
    candidates = [plan for plan in plans
                  if plan.get('position_id') == position_id
                  and plan.get('status') == 'active'
                  and (not plan.get('workshop_id') or plan['workshop_id'] == workshop_id)]
    specific = [plan for plan in candidates if plan.get('workshop_id') == workshop_id]
    candidates = specific or candidates
    if not candidates:
        return None
    return max(enumerate(candidates),
               key=lambda pair: (core.exam_time_key(pair[1], ('created_at',))[0], pair[0]))[1]


_POSITION_NAMES = {}
_MAJOR_NAMES = {}


def exam_titles(workshop, position):
    """Build a bilingual title from the selected workshop and role."""
    workshop_id = str(workshop.get('name_id') or 'Unit kerja').strip()
    position_id = str(position.get('name_id') or 'Posisi kerja').strip()
    return {
        'title_zh': f"{workshop.get('name', '车间')} · {position.get('name', '岗位')} · 标准作业能力考试",
        'title_id': f'{workshop_id} · {position_id} · Ujian Kompetensi Prosedur Kerja Standar',
    }


def readiness_for(c, core, workshop, position, *, question_count=None,
                  plans=None, rounds=None, work_items=None, questions=None):
    """Describe precisely why this workshop/position can or cannot start."""
    core = _core(core)
    count = _required_count(core, question_count)
    if not core.position_in_workshop(position, workshop):
        return None
    round_ = choose_open_round(c, core, workshop['id'], position['id'], rounds=rounds)
    work_items = core.all_docs(c, 'work_items') if work_items is None else work_items
    questions = core.all_docs(c, 'questions') if questions is None else questions
    pool = shared_banks.pool_data(c, core, position['id'], work_items=work_items, questions=questions)
    items, pools = pool['items'], {key: len(questions) for key, questions in pool['pools'].items()}
    total, empty = sum(pools.values()), sum(value == 0 for value in pools.values())
    reasons = []
    if round_ is None:
        reasons.append(('no_open_round', '尚未开放本轮考试', 'Putaran ujian belum dibuka'))
    if not items:
        reasons.append(('no_active_work_items', '尚未配置启用的作业项目', 'Belum ada pekerjaan aktif'))
    if pool['duplicate_bank_bindings']:
        reasons.append(('duplicate_bank_bindings', '同一岗位重复启用了同一个作业题库，请联系管理员处理',
                        'Bank soal yang sama ditautkan lebih dari sekali pada posisi ini; hubungi administrator'))
    if len(items) > count:
        reasons.append(('too_many_work_items', f'{count} 道题无法覆盖 {len(items)} 个作业项目',
                        f'{count} soal tidak dapat mencakup {len(items)} pekerjaan'))
    if total == 0:
        reasons.append(('no_active_questions', '尚无启用的有效题目，暂不能考试',
                        'Belum ada soal aktif yang valid; ujian belum tersedia'))
    if empty:
        reasons.append(('uncovered_work_items', f'{empty} 个作业项目尚无启用题目',
                        f'{empty} pekerjaan belum memiliki soal aktif'))
    primary = reasons[0] if reasons else ('ready', '开放考试', 'Ujian tersedia')
    return {
        'workshop_id': workshop['id'], 'position_id': position['id'],
        'round_id': round_['id'] if round_ else None,
        'round_number': round_.get('round_number') if round_ else None,
        'round_title': round_.get('title') if round_ else None,
        'round_title_id': round_.get('title_id') if round_ else None,
        'ready': not reasons, 'reason_code': primary[0],
        'reason_zh': primary[1], 'reason_id': primary[2],
        'reasons': [{'code': code, 'zh': zh, 'id': indonesian}
                    for code, zh, indonesian in reasons],
        'available_question_count': total, 'required_question_count': count,
        'exam_question_count': min(count, total),
        'points_per_question': 100 / min(count, total) if total else None,
        'total_points': 100,
        'active_work_item_count': len(items), 'empty_work_item_count': empty,
        **exam_titles(workshop, position),
    }


def exam_options(c, core, *, question_count=None):
    """Compatible public options plus an explicit readiness allowlist."""
    core = _core(core)
    count = _required_count(core, question_count)
    workshops, positions, rounds, items, questions = (
        core.all_docs(c, kind) for kind in
        ('workshops', 'positions', 'exam_rounds', 'work_items', 'questions'))
    readiness = []
    for workshop in workshops:
        for position in positions:
            result = readiness_for(c, core, workshop, position, question_count=count,
                                   rounds=rounds, work_items=items, questions=questions)
            if result is not None:
                readiness.append(result)
    return {
        'workshops': [{key: workshop.get(key, '') for key in
                       ('id', 'name', 'name_id', 'major_workshop_id')}
                      for workshop in workshops],
        'positions': [{key: position.get(key, '') for key in
                       ('id', 'name', 'name_id', 'major_workshop_id', 'workshop_id')}
                      for position in positions],
        'assessment_categories': [dict(item) for item in core.EXAM_ASSESSMENT_CATEGORIES],
        'question_count': count, 'readiness': readiness,
    }


def equal_points_snapshot(questions, *, total_points=100):
    """Freeze equal points on independent copies; retain original bank points.

    Each new exam uses up to 50 questions and shares 100 points equally.
    A smaller bank uses all available questions rather than duplicating any.
    This function must only be called when creating a NEW assignment: existing
    assignments retain their original frozen questions and grading rules.
    """
    if not isinstance(questions, list) or not questions:
        raise ValueError('questions must be a nonempty list')
    if isinstance(total_points, bool) or not isinstance(total_points, (int, float)):
        raise ValueError('total_points must be a positive finite number')
    total = Decimal(str(total_points))
    if not total.is_finite() or total <= 0:
        raise ValueError('total_points must be a positive finite number')
    if any(not isinstance(question, dict) for question in questions):
        raise ValueError('each question must be an object')
    points = float(total / len(questions))
    snapshot = deepcopy(questions)
    for question in snapshot:
        question.setdefault('source_points', question.get('points'))
        question['points'] = points
    return snapshot
