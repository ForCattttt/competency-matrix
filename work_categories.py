"""Scoped user-created work categories, separate from scoring and exam rules.

The three historic ``skill_category`` values remain the calculation/export
families. Custom category records supply display labels and an explicit family;
they never change an item's assessment mode or any saved assessment evidence.
The caller owns authentication, the surrounding transaction, and committing.
"""
from __future__ import annotations

from types import SimpleNamespace
import unicodedata


COLLECTION = 'work_categories'
BUILTINS = {
    'operation': ('标准作业', 'Pekerjaan standar'),
    'inspection': ('点检', 'Inspeksi'),
    'data': ('数据', 'Data'),
}
WRITE_ROLES = frozenset(('admin', 'workshop_admin', 'question_contributor'))
READ_ROLES = WRITE_ROLES | frozenset(('viewer', 'question_editor'))
PUBLIC_FIELDS = ('id', 'name', 'name_id', 'base_category', 'major_workshop_id',
                 'active', 'created_by', 'created_at')
CREATE_FIELDS = frozenset(('name', 'name_id', 'base_category', 'major_workshop_id'))


def _core(value):
    return SimpleNamespace(**value) if isinstance(value, dict) else value


def _text(core, value, label, limit, *, required=False):
    if not isinstance(value, str):
        raise core.APIError(f'{label}必须为文字')
    if any(unicodedata.category(char) in ('Cc', 'Cf', 'Cs') for char in value):
        raise core.APIError(f'{label}不能包含控制字符或隐藏格式字符')
    value = unicodedata.normalize('NFKC', value).strip()
    if required and not value:
        raise core.APIError(f'请填写{label}')
    if len(value) > limit:
        raise core.APIError(f'{label}不能超过{limit}个字符')
    return value


def _name_key(value):
    return ' '.join(unicodedata.normalize('NFKC', value).strip().casefold().split())


def _public(record):
    return {key: record.get(key, '') for key in PUBLIC_FIELDS}


def _major_ids(c, core, user, *, write=False):
    role = user.get('role')
    if role not in (WRITE_ROLES if write else READ_ROLES):
        raise core.APIError('此账号无权新增作业类别' if write else '无权查看作业类别', 403)
    majors = {row['id'] for row in core.all_docs(c, 'major_workshops')}
    if role == 'admin' or (not write and role in ('viewer', 'question_editor') and not user.get('workshop_id')):
        return majors
    workshop = core.get(c, 'workshops', user.get('workshop_id', ''), False)
    major = workshop.get('major_workshop_id', '') if workshop else ''
    return {major} if major in majors else set()


def catalog(c, core, user):
    """Read-only catalogue with builtins followed by authorized custom entries."""
    core = _core(core)
    scopes = _major_ids(c, core, user)
    builtins = [dict(id=key, name=labels[0], name_id=labels[1],
                     base_category=key, major_workshop_id='', active=True, builtin=True)
                for key, labels in BUILTINS.items()]
    custom = [_public(row) for row in core.all_docs(c, COLLECTION)
              if row.get('major_workshop_id') in scopes and row.get('active') is True
              and row.get('base_category') in BUILTINS]
    custom.sort(key=lambda row: (row['major_workshop_id'], _name_key(row['name']), row['id']))
    for row in custom:
        row['builtin'] = False
    return {'categories': builtins + custom,
            'can_create': user.get('role') in WRITE_ROLES and bool(scopes),
            'allowed_major_workshop_ids': sorted(scopes)}


def create(c, core, user, body):
    """Create one immutable category; never grants organization edit rights."""
    core = _core(core)
    scopes = _major_ids(c, core, user, write=True)
    if not isinstance(body, dict):
        raise core.APIError('作业类别格式不正确')
    if set(body) - CREATE_FIELDS:
        raise core.APIError('作业类别包含不允许的字段')
    name = _text(core, body.get('name', ''), '作业类别名称', 80, required=True)
    name_id = _text(core, body.get('name_id', ''), '作业类别名称（印尼文）', 120)
    base = body.get('base_category')
    if not isinstance(base, str) or base not in BUILTINS:
        raise core.APIError('请选择标准作业、点检或数据作为基础分类')
    supplied_major = body.get('major_workshop_id')
    if supplied_major is None and user.get('role') != 'admin' and len(scopes) == 1:
        supplied_major = next(iter(scopes))
    major = _text(core, supplied_major if supplied_major is not None else '', '大车间分类', 200, required=True)
    if major not in scopes:
        raise core.APIError('只能在有权限的大车间新增作业类别', 403)
    # Both display languages must remain unambiguous in the category selector.
    keys = {_name_key(value) for value in (name, name_id) if value}
    reserved = {_name_key(value) for key, labels in BUILTINS.items() for value in (key, *labels)}
    if keys & reserved:
        raise core.APIError('该名称为已有基础类别，请直接选择已有类别', 409)
    for existing in core.all_docs(c, COLLECTION):
        if existing.get('major_workshop_id') != major:
            continue
        existing_keys = {_name_key(value) for value in (existing.get('name', ''), existing.get('name_id', '')) if value}
        if keys & existing_keys:
            raise core.APIError('该大车间已有同名作业类别，请使用已有类别', 409)
    record = {'id': 'work-category-' + core.uid(), 'name': name, 'name_id': name_id,
              'base_category': base, 'major_workshop_id': major, 'active': True,
              'created_by': user['id'], 'created_at': core.now()}
    core.put(c, COLLECTION, record)
    return dict(_public(record), builtin=False)


def validate_binding(c, core, user, item, old=None):
    """Validate an item's custom category and freeze trusted display labels.

    Call before the existing ``validate_item_policy``; the resulting
    ``skill_category`` is always one of the original three values. This does
    not authorize creating/editing work items: that remains the caller's
    existing organization permission check. There are no database writes here.
    """
    core = _core(core)
    if not isinstance(item, dict):
        raise core.APIError('作业项目格式不正确')
    ident = _text(core, item.get('work_category_id', ''), '作业类别', 200)
    if not ident or ident in BUILTINS:
        if ident:
            item['skill_category'] = ident
        item['work_category_id'] = ''
        item.pop('work_category_name', None)
        item.pop('work_category_name_id', None)
        return item
    scopes = _major_ids(c, core, user)
    category = core.get(c, COLLECTION, ident, False)
    if not category or category.get('active') is not True or category.get('base_category') not in BUILTINS:
        raise core.APIError('该作业类别不存在或已停用', 409)
    position = core.get(c, 'positions', item.get('position_id', ''))
    major = position.get('major_workshop_id', '')
    if not major and position.get('workshop_id'):
        workshop = core.get(c, 'workshops', position['workshop_id'])
        major = workshop.get('major_workshop_id', '')
    if not major or major != category.get('major_workshop_id') or major not in scopes:
        raise core.APIError('作业类别与岗位必须属于同一有权限的大车间', 403)
    item.update(work_category_id=category['id'], work_category_name=category['name'],
                work_category_name_id=category.get('name_id', ''), skill_category=category['base_category'])
    return item
