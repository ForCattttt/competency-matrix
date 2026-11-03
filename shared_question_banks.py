"""Operation question banks shared within a position's workshop scope.

The explicit v2 maintenance split keeps original questions and makes traceable
copies for each position. Frozen assignments, scores and people never change.
"""
from __future__ import annotations

from collections import defaultdict
from copy import deepcopy
from types import SimpleNamespace
import json
import hashlib
import unicodedata
import uuid

LEGACY_VERSION = 'shared-question-banks-v1-20261021'
VERSION = 'position-question-banks-v2-20261026'
NAMESPACE = uuid.UUID('c8ca82e6-5b2d-4a6e-b866-4b18a326c003')
OBJECTIVE_TYPES = frozenset(('single', 'multiple', 'true_false'))


def _core(value):
    return SimpleNamespace(**value) if isinstance(value, dict) else value


def normalize(value):
    return ' '.join(unicodedata.normalize('NFKC', str(value or '')).casefold().split())


def _lookup(c, core, kind, ident):
    if hasattr(core, 'get'):
        return core.get(c, kind, ident, False)
    return next((record for record in core.all_docs(c, kind) if record['id'] == ident), None)


def _mode(item):
    return item.get('assessment_mode') or 'exam_practical'


def _scope(c, core, item):
    position = _lookup(c, core, 'positions', item.get('position_id', ''))
    if not position:
        return None
    major = position.get('major_workshop_id') or ''
    workshop = position.get('workshop_id') or ''
    # Only explicitly common positions use a major scope. A legacy position
    # bound to one numbered workshop must not gain a sibling workshop's pool
    # merely because both workshop records now carry the same major label.
    return (major, '') if major else ('', workshop)


def _expected_bank(c, core, item, *, legacy=False):
    core = _core(core)
    if _mode(item) != 'exam_practical':
        return None
    scope = _scope(c, core, item)
    name = normalize(item.get('name'))
    if scope is None or not any(scope) or not name:
        return None
    position_id = item.get('position_id', '')
    key = json.dumps([*scope, *([] if legacy else [position_id]), name, 'exam_practical'], ensure_ascii=False, separators=(',', ':'))
    translated = core.work_item_name_id(item) if hasattr(core, 'work_item_name_id') else str(item.get('name_id', '')).strip()
    result = {'id': str(uuid.uuid5(NAMESPACE, key)), 'major_workshop_id': scope[0],
            'workshop_id': scope[1], 'name': str(item.get('name', '')).strip(),
            'name_id': translated,
            'normalized_name': name, 'assessment_mode': 'exam_practical', 'version': LEGACY_VERSION if legacy else VERSION}
    if not legacy:
        result.update(position_id=position_id, sharing_scope='position')
    return result


def expected_bank(c, core, item):
    """A shared position, not its sibling positions, owns operation questions."""
    return _expected_bank(c, core, item)


def legacy_expected_bank(c, core, item):
    """Read-only v1 identity used exclusively by the controlled migration."""
    return _expected_bank(c, core, item, legacy=True)


def item_bank_id(c, core, item):
    if _mode(item) != 'exam_practical':
        return ''
    if item.get('question_bank_id'):
        return item['question_bank_id']
    expected = expected_bank(c, core, item)
    return expected['id'] if expected else ''


def question_bank_id(c, core, question, *, items=None):
    core = _core(core)
    if question.get('question_bank_id'):
        return question['question_bank_id']
    source = (items or {}).get(question.get('work_item_id')) if items is not None else core.get(c, 'work_items', question.get('work_item_id', ''), False)
    return item_bank_id(c, core, source) if source else ''


def _identity(question):
    options = sorted((normalize(option.get('key')), normalize(option.get('text_zh')),
                      normalize(option.get('text_id'))) for option in question.get('options', []))
    return json.dumps([question.get('type'), question.get('dimension', 'knowledge'),
                       normalize(question.get('title_zh')), normalize(question.get('title_id')),
                       options], ensure_ascii=False, separators=(',', ':'))


def identity(c, core, question):
    """Deduplication stays within this position-operation bank and axis."""
    return json.dumps([question_bank_id(c, core, question) or ('legacy:' + str(question.get('work_item_id'))),
                       _identity(question)], ensure_ascii=False, separators=(',', ':'))


def has_questions(c, core, item):
    core = _core(core)
    bank = item_bank_id(c, core, item)
    return any(question.get('work_item_id') == item['id'] or
               (bank and question_bank_id(c, core, question) == bank)
               for question in core.all_docs(c, 'questions'))


def bind_item(c, core, item, old=None):
    """Validate a CRUD skill binding and create its catalogue entry if needed."""
    core = _core(core)
    expected = expected_bank(c, core, item)
    previous = item_bank_id(c, core, old) if old else ''
    if old and previous and (not expected or expected['id'] != previous):
        # A source operation is an identity, not merely a display label. Keep
        # old coverage and grading links stable instead of silently moving it.
        raise core.APIError('该作业已关联共用题库，不能通过改名或切换类别更换题库；请新建作业并保留原记录', 409)
    if not expected:
        item.pop('question_bank_id', None)
        return item
    bank_id = expected['id']
    if item.get('active', False):
        for candidate in core.all_docs(c, 'work_items'):
            if candidate['id'] == item['id'] or not candidate.get('active'):
                continue
            if candidate.get('position_id') == item.get('position_id') and item_bank_id(c, core, candidate) == bank_id:
                raise core.APIError('同一岗位已启用此作业的共用题库，请使用已有作业，避免重复抽取同一道题', 409)
    if not core.get(c, 'question_banks', bank_id, False):
        core.put(c, 'question_banks', dict(expected, created_at=core.now()))
    item['question_bank_id'] = bank_id
    return item


def bind_question(c, core, question, body, old=None):
    """Allow a bank selection while retaining immutable legacy source IDs."""
    core = _core(core)
    requested = core.strval(question.get('question_bank_id', ''), '共用题库', 200)
    if old and question.get('work_item_id') != old.get('work_item_id'):
        raise core.APIError('已有题目的来源作业不能更改，请保留原记录或新增题目', 409)
    if not question.get('work_item_id') and requested:
        bank = core.get(c, 'question_banks', requested)
        catalogue = catalog(c, core, banks=[bank])
        if not catalogue:
            raise core.APIError('旧共用题库仅保留历史，请选择对应岗位题库', 409)
        question['work_item_id'] = catalogue[0]['canonical_work_item_id'] if catalogue else ''
    source = core.get(c, 'work_items', core.strval(question.get('work_item_id', ''), '作业项目', 200, True))
    requested_position = core.strval(body.get('position_id', ''), '岗位', 200)
    if requested_position and requested_position != source.get('position_id'):
        raise core.APIError('所选岗位与来源作业不一致，请重新选择', 409)
    if _mode(source) != 'exam_practical':
        raise core.APIError('点检、数据等直接评分技能无需题目，不能关联题库')
    source_bank = item_bank_id(c, core, source)
    expected = expected_bank(c, core, source)
    if expected and source_bank != expected['id']:
        raise core.APIError('岗位题库尚未完成独立迁移，请联系管理员', 409)
    if not source_bank:
        raise core.APIError('该作业尚未配置有效的共用题库，请联系管理员')
    if requested and requested != source_bank:
        raise core.APIError('所选题库与来源作业不一致，请重新选择', 409)
    previous = question_bank_id(c, core, old) if old else ''
    if previous and previous != source_bank:
        raise core.APIError('已有题目不能更换共用题库，请新增题目并归档原题', 409)
    if not core.get(c, 'question_banks', source_bank, False):
        expected = expected_bank(c, core, source)
        if not expected or expected['id'] != source_bank:
            raise core.APIError('该作业关联的共用题库不存在，请联系管理员', 409)
        core.put(c, 'question_banks', dict(expected, created_at=core.now()))
    question.update(question_bank_id=source_bank, source_work_item_id=source['id'])
    return source


def catalog(c, core, *, banks=None):
    core = _core(core)
    banks = core.all_docs(c, 'question_banks') if banks is None else banks
    items = core.all_docs(c, 'work_items')
    by_id = {item['id']: item for item in items}
    questions = core.all_docs(c, 'questions')
    result = []
    for bank in banks:
        bindings = [item for item in items if item_bank_id(c, core, item) == bank['id']]
        if not bindings:
            # Retain retired catalogue documents for audit, but never offer an
            # unbound v1 bank as an upload target after the controlled split.
            continue
        active = [item for item in bindings if item.get('active')]
        ordered = sorted(active or bindings, key=lambda item: (item.get('sort_order', 0), item.get('position_id', ''), item['id']))
        sources = [question for question in questions if question_bank_id(c, core, question, items=by_id) == bank['id'] and not question.get('merged_into_question_id')]
        result.append(dict(bank, work_item_ids=[item['id'] for item in bindings],
                           active_work_item_ids=[item['id'] for item in active],
                           position_ids=sorted({item['position_id'] for item in active}),
                           canonical_work_item_id=ordered[0]['id'] if ordered else '',
                           active=bool(active), question_count=len(sources),
                           active_question_count=sum(question.get('status') == 'active' and question.get('type') in OBJECTIVE_TYPES for question in sources)))
    return result


def question_metadata(c, core, question, *, catalogue=None):
    core = _core(core)
    bank_id = question_bank_id(c, core, question)
    if catalogue is not None:
        bank = next((entry for entry in catalogue if entry['id'] == bank_id), {})
        return {'question_bank_id': bank_id, 'position_id': bank.get('position_id', ''), 'source_work_item_id': question.get('source_work_item_id') or question.get('work_item_id'),
                'applicable_work_item_ids': list(bank.get('active_work_item_ids', [])),
                'applicable_position_ids': list(bank.get('position_ids', []))}
    bindings = [item for item in core.all_docs(c, 'work_items')
                if item.get('active') and item_bank_id(c, core, item) == bank_id] if bank_id else []
    return {'question_bank_id': bank_id, 'position_id': bindings[0]['position_id'] if bindings else '', 'source_work_item_id': question.get('source_work_item_id') or question.get('work_item_id'),
            'applicable_work_item_ids': [item['id'] for item in bindings],
            'applicable_position_ids': sorted({item['position_id'] for item in bindings})}


def pool_data(c, core, position_id, *, work_items=None, questions=None):
    """One source for readiness, administrative counts, and future frozen draws.

    Returned questions are detached copies with the position's binding ID.
    Retired source bindings may still supply a bank used by another position.
    """
    core = _core(core)
    work_items = core.all_docs(c, 'work_items') if work_items is None else work_items
    questions = core.all_docs(c, 'questions') if questions is None else questions
    by_id = {item['id']: item for item in work_items}
    items = {item['id']: item for item in work_items if item.get('position_id') == position_id
             and item.get('active') and _mode(item) == 'exam_practical'}
    by_bank = defaultdict(list)
    for item in items.values():
        by_bank[item_bank_id(c, core, item) or ('legacy:' + item['id'])].append(item['id'])
    collisions = [ids for ids in by_bank.values() if len(ids) > 1]
    pools = {ident: [] for ident in items}
    seen = set()
    for question in questions:
        if question.get('status') != 'active' or question.get('type') not in OBJECTIVE_TYPES or question.get('merged_into_question_id'):
            continue
        bank = question_bank_id(c, core, question, items=by_id) or ('legacy:' + str(question.get('work_item_id')))
        bindings = by_bank.get(bank, [])
        # Invalid duplicate bindings never multiply the available question count.
        if len(bindings) != 1:
            continue
        # Imports are guarded and startup migrates persisted copies. Also keep
        # reads safe for legacy writers/fixtures that insert a source directly
        # after startup: identical content must not be drawn twice.
        fingerprint = (bank, _identity(question), tuple(sorted(question.get('correct_answer') or [])))
        if fingerprint in seen:
            continue
        seen.add(fingerprint)
        snapshot = deepcopy(question)
        snapshot.update(source_work_item_id=question.get('source_work_item_id') or question.get('work_item_id'),
                        question_bank_id=bank if not bank.startswith('legacy:') else '',
                        work_item_id=bindings[0])
        pools[bindings[0]].append(snapshot)
    return {'items': items, 'pools': pools, 'duplicate_bank_bindings': collisions}


def assert_position_banks_ready(c, core):
    """Read-only startup guard. Large migrations require explicit maintenance."""
    core = _core(core)
    items = {item['id']: item for item in core.all_docs(c, 'work_items')}
    banks = {bank['id']: bank for bank in core.all_docs(c, 'question_banks')}
    for item in items.values():
        expected = expected_bank(c, core, item)
        if expected is None:
            continue
        bank = banks.get(item.get('question_bank_id'))
        identity_fields = ('major_workshop_id', 'workshop_id', 'position_id', 'normalized_name', 'assessment_mode', 'sharing_scope')
        if (item.get('question_bank_id') != expected['id'] or not bank
                or any(bank.get(key) != expected.get(key) for key in identity_fields)):
            raise core.APIError('岗位题库尚未完成受控迁移；请先备份并运行岗位题库维护程序，启动未改写任何试题', 409)
    questions = {question['id']: question for question in core.all_docs(c, 'questions')}
    for question in questions.values():
        source = items.get(question.get('work_item_id'))
        expected = expected_bank(c, core, source) if source else None
        if expected is None:
            continue
        if question.get('question_bank_id') != expected['id']:
            raise core.APIError('题目与岗位题库绑定不一致；请运行受控迁移，启动未修改试题', 409)
        alias = question.get('merged_into_question_id')
        if alias and (alias not in questions or questions[alias].get('question_bank_id') != expected['id']):
            raise core.APIError('历史重复题关联了其他岗位题库；请核对受控迁移结果', 409)
    return {'version': VERSION, 'ready': True, 'automatic_migration': False,
            'bound_items': sum(bool(expected_bank(c, core, item)) for item in items.values())}


def migrate(c, core):
    """Compatibility entry point: startup validation never rewrites the banks."""
    return assert_position_banks_ready(c, core)


def _database_state(c):
    schema = tuple(tuple(row) for row in c.execute('SELECT type,name,tbl_name,sql FROM sqlite_master ORDER BY type,name'))
    rows = {}
    for (name,) in c.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"):
        quoted = '"' + name.replace('"', '""') + '"'
        rows[name] = tuple(sorted((tuple(row) for row in c.execute('SELECT * FROM ' + quoted)), key=repr))
    return {'schema': schema, 'rows': rows,
            'user_version': c.execute('PRAGMA user_version').fetchone()[0]}


def _state_fingerprint(state):
    return hashlib.sha256(repr(state).encode('utf-8')).hexdigest()


def _pool_signatures(c, core, items, questions):
    fields = ('type', 'dimension', 'title_zh', 'title_id', 'options', 'correct_answer',
              'reference_answer_zh', 'reference_answer_id', 'points', 'status')
    result = {}
    for position_id in sorted({item.get('position_id') for item in items if item.get('position_id')}):
        pool = pool_data(c, core, position_id, work_items=items, questions=questions)
        if pool['duplicate_bank_bindings']:
            raise core.APIError('同一岗位重复启用了同名作业绑定，请先处理重复作业后再迁移', 409)
        result[position_id] = {ident: tuple(sorted(json.dumps({key: question.get(key) for key in fields},
                    ensure_ascii=False, sort_keys=True, separators=(',', ':')) for question in values))
                    for ident, values in pool['pools'].items()}
    return result


def _position_migration_plan(c, core):
    """Plan deterministic copies; no SQL writes, question deletion or promotion."""
    core = _core(core)
    state = _database_state(c)
    items = core.all_docs(c, 'work_items')
    questions = core.all_docs(c, 'questions')
    banks = {bank['id']: bank for bank in core.all_docs(c, 'question_banks')}
    by_item = {item['id']: item for item in items}
    by_question = {question['id']: question for question in questions}
    expected_by_item = {}
    old_bank_by_item = {}
    legacy_groups = defaultdict(dict)
    updates = {}
    migration_at = core.now()
    summary = {'version': VERSION, 'created_banks': 0, 'bound_items': 0,
               'bound_questions': 0, 'copied_questions': 0, 'relinked_aliases': 0,
               'unbound_question_ids': [], 'answer_conflicts': [], 'automatic_migration': False}

    def write(kind, obj):
        existing = core.get(c, kind, obj['id'], False)
        if existing != obj:
            updates[(kind, obj['id'])] = obj

    for item in items:
        expected = expected_bank(c, core, item)
        if expected is None:
            continue
        legacy = legacy_expected_bank(c, core, item)
        current = item.get('question_bank_id') or legacy['id']
        if current not in (legacy['id'], expected['id']):
            raise core.APIError('作业绑定了无法识别的题库身份，请先核对，迁移未执行', 409)
        expected_by_item[item['id']] = expected
        old_bank_by_item[item['id']] = current
        existing = banks.get(expected['id'])
        if existing and any(existing.get(key) != expected.get(key) for key in ('id', 'major_workshop_id', 'workshop_id', 'position_id', 'normalized_name', 'assessment_mode', 'sharing_scope')):
            raise core.APIError('目标岗位题库已有不一致的目录信息，请先核对', 409)
        if existing is None and ('question_banks', expected['id']) not in updates:
            write('question_banks', dict(expected, created_at=migration_at,
                                        migrated_from_bank_id=current if current != expected['id'] else ''))
            summary['created_banks'] += 1
        if item.get('question_bank_id') != expected['id']:
            write('work_items', dict(item, question_bank_id=expected['id']))
            summary['bound_items'] += 1
        if current != expected['id']:
            legacy_groups[current][expected['id']] = expected

    target_bindings = defaultdict(list)
    for item in items:
        if item['id'] in expected_by_item:
            target_bindings[expected_by_item[item['id']]['id']].append(item)
    canonical = {ident: min(values, key=lambda item: (not item.get('active'), item.get('sort_order', 0), item['id']))['id']
                 for ident, values in target_bindings.items()}
    grouped_questions = defaultdict(list)
    old_view = []
    for question in questions:
        source = by_item.get(question.get('work_item_id'))
        if source is None:
            summary['unbound_question_ids'].append(question['id'])
            if question.get('status') == 'active' and question.get('type') in OBJECTIVE_TYPES and not question.get('merged_into_question_id'):
                raise core.APIError('发现无来源作业的启用试题，请先核对后再迁移', 409)
            old_view.append(question)
            continue
        current = old_bank_by_item.get(source['id'])
        if not current:
            summary['unbound_question_ids'].append(question['id'])
            old_view.append(question)
            continue
        if question.get('question_bank_id') and question['question_bank_id'] != current:
            raise core.APIError('题目来源与已有题库不一致，请先核对后再迁移', 409)
        old_view.append(dict(question, question_bank_id=current))
        if current in legacy_groups:
            grouped_questions[current].append(question)
        elif question.get('question_bank_id') != current:
            write('questions', dict(question, question_bank_id=current))
            summary['bound_questions'] += 1

    # Readiness before the split uses the persisted v1 scope even for legacy
    # fixtures lacking an explicit bank field. Historical source IDs stay intact.
    old_items = [dict(item, question_bank_id=old_bank_by_item[item['id']]) if item['id'] in old_bank_by_item else item for item in items]
    before_pools = _pool_signatures(c, core, old_items, old_view)

    for old_bank, targets in legacy_groups.items():
        sources = grouped_questions[old_bank]
        masters = [question for question in sources if not question.get('merged_into_question_id')]
        copies = {}
        conflicts = defaultdict(lambda: defaultdict(list))
        for question in masters:
            conflicts[_identity(question)][tuple(sorted(question.get('correct_answer') or []))].append(question['id'])
            own_bank = expected_by_item[question['work_item_id']]['id']
            for bank_id in targets:
                ident = question['id'] if bank_id == own_bank else str(uuid.uuid5(NAMESPACE, 'position-split-v2:' + bank_id + ':' + question['id']))
                copies[(question['id'], bank_id)] = ident
                migrated = dict(question, id=ident, question_bank_id=bank_id,
                                bank_migration_version=VERSION, split_from_bank_id=old_bank,
                                split_migration_at=migration_at)
                if ident != question['id']:
                    migrated.update(work_item_id=canonical[bank_id], source_work_item_id=canonical[bank_id],
                                    split_from_question_id=question['id'], split_original_work_item_id=question['work_item_id'])
                    if core.get(c, 'questions', ident, False) is not None:
                        raise core.APIError('确定性副本编号已被已有题目占用，请先核对', 409)
                    summary['copied_questions'] += 1
                else:
                    summary['bound_questions'] += 1
                write('questions', migrated)
        for answers in conflicts.values():
            if len(answers) > 1:
                summary['answer_conflicts'].append({'question_bank_id': old_bank,
                    'question_ids': [ident for ids in answers.values() for ident in ids]})
        for question in sources:
            if not question.get('merged_into_question_id'):
                continue
            visited = {question['id']}
            master = question
            while master.get('merged_into_question_id'):
                ident = master['merged_into_question_id']
                if ident in visited or ident not in by_question:
                    raise core.APIError('历史归并题存在断链或循环，请先核对，迁移未执行', 409)
                visited.add(ident)
                master = by_question[ident]
                if old_bank_by_item.get(master.get('work_item_id')) != old_bank:
                    raise core.APIError('历史归并题跨越了不一致的原题库，请先核对', 409)
            bank_id = expected_by_item[question['work_item_id']]['id']
            target = copies.get((master['id'], bank_id))
            if target is None:
                raise core.APIError('历史归并题没有可追溯主题，请先核对', 409)
            migrated = dict(question, question_bank_id=bank_id, bank_migration_version=VERSION,
                            split_from_bank_id=old_bank, split_migration_at=migration_at)
            if target != question['merged_into_question_id']:
                migrated['split_original_merged_into_question_id'] = question['merged_into_question_id']
                migrated['merged_into_question_id'] = target
                summary['relinked_aliases'] += 1
            write('questions', migrated)
            summary['bound_questions'] += 1

    after_items = [updates.get(('work_items', item['id']), item) for item in items]
    after_questions = [updates.get(('questions', question['id']), question) for question in questions]
    after_questions.extend(value for (kind, ident), value in updates.items() if kind == 'questions' and ident not in by_question)
    if _pool_signatures(c, core, after_items, after_questions) != before_pools:
        raise core.APIError('拆分后的逐岗位可用题池与原题池不一致，请先核对，未执行迁移', 409)
    summary.update(preimage=_state_fingerprint(state), write_count=len(updates),
                   positions_verified=len(before_pools), pool_equivalence_verified=True)
    return {'state': state, 'updates': updates, 'summary': summary, 'before_pools': before_pools}


def preview_position_migration(c, core):
    """Read-only preview for a stopped-service deployment rehearsal."""
    c.execute('SAVEPOINT position_bank_preview_v2')
    try:
        return deepcopy(_position_migration_plan(c, core)['summary'])
    finally:
        c.execute('ROLLBACK TO SAVEPOINT position_bank_preview_v2')
        c.execute('RELEASE SAVEPOINT position_bank_preview_v2')


def migrate_position_scopes(c, core, *, maintenance=False, expected_preimage=None):
    """Explicit, versioned, idempotent maintenance; never commits the caller.

    The caller must stop admission, make an online SQLite backup and rehearse
    against that backup before calling inside its controlled write transaction.
    This routine checks every raw table/schema and refuses unrelated side effects.
    """
    core = _core(core)
    if maintenance is not True or not c.in_transaction or not isinstance(expected_preimage, str) or len(expected_preimage) != 64:
        raise core.APIError('岗位题库迁移只允许在显式备份维护流程中执行', 409)
    c.execute('SAVEPOINT position_bank_migration_v2')
    try:
        plan = _position_migration_plan(c, core)
        if plan['summary']['preimage'] != expected_preimage:
            raise core.APIError('题库迁移前像已变化，请重新预演；未执行迁移', 409)
        before = plan['state']
        for (kind, _), value in plan['updates'].items():
            core.put(c, kind, value)
        after = _database_state(c)
        if before['schema'] != after['schema'] or before['user_version'] != after['user_version'] or set(before['rows']) != set(after['rows']):
            raise core.APIError('迁移检测到意外结构变化，已回滚', 409)
        expected_documents = {(row[0], row[1]): row[2] for row in before['rows']['documents']}
        for key, value in plan['updates'].items():
            expected_documents[key] = core.dumps(value) if hasattr(core, 'dumps') else json.dumps(value, ensure_ascii=False, separators=(',', ':'))
        expected_rows = tuple(sorted(((kind, ident, payload) for (kind, ident), payload in expected_documents.items()), key=repr))
        if after['rows']['documents'] != expected_rows or any(after['rows'][table] != rows for table, rows in before['rows'].items() if table != 'documents'):
            raise core.APIError('迁移检测到原记录或非题库数据被意外修改，已回滚', 409)
        assert_position_banks_ready(c, core)
        if _pool_signatures(c, core, core.all_docs(c, 'work_items'), core.all_docs(c, 'questions')) != plan['before_pools']:
            raise core.APIError('迁移后题池复核不一致，已回滚', 409)
        c.execute('RELEASE SAVEPOINT position_bank_migration_v2')
        return dict(plan['summary'], protected_rows_unchanged=True, schema_unchanged=True)
    except BaseException:
        c.execute('ROLLBACK TO SAVEPOINT position_bank_migration_v2')
        c.execute('RELEASE SAVEPOINT position_bank_migration_v2')
        raise

