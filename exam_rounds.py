"""Explicit exam windows. Importing or initializing never opens an exam."""
from __future__ import annotations
import unicodedata
import uuid
from types import SimpleNamespace
from direct_assessments import assessment_mode


def _core(value):
    return SimpleNamespace(**value) if isinstance(value, dict) else value


def normalized_employee_no(value):
    return ''.join(unicodedata.normalize('NFKC', value).casefold().split())


def matches_scope(round_, workshop_id, position_id):
    return workshop_id in round_.get('workshop_ids', []) and position_id in round_.get('position_ids', [])


def choose_open_round(c, core, workshop_id, position_id, *, rounds=None):
    core = _core(core)
    candidates = [r for r in (core.all_docs(c, 'exam_rounds') if rounds is None else rounds)
                  if r.get('status') == 'open' and len(r.get('workshop_ids',[])) == 1 and matches_scope(r, workshop_id, position_id)]
    if len(candidates) > 1:
        raise core.APIError('考试轮次配置冲突，请联系管理员 / Putaran ujian tumpang tindih. Hubungi administrator.', 409)
    return candidates[0] if candidates else None


def chinese_round_number(value):
    digits='零一二三四五六七八九'
    if value==10000: return '一万'
    text=''; pending_zero=False
    for divisor,unit in ((1000,'千'),(100,'百'),(10,'十'),(1,'')):
        digit,value=divmod(value,divisor)
        if digit:
            if pending_zero: text+='零'
            text+=digits[digit]+unit; pending_zero=False
        elif text and value: pending_zero=True
    return text[1:] if text.startswith('一十') else text


def round_titles(workshop, number):
    return {'title':f"{workshop['name']}第{chinese_round_number(number)}轮次考试",
            'title_id':f"{workshop.get('name_id') or workshop['name']} · Ujian putaran {number}"}


def validate_round(c, core, body, old=None):
    core = _core(core)
    if not isinstance(body, dict): raise core.APIError('考试轮次内容必须为对象')
    # Shared historical windows are retained for their frozen papers. They can
    # only close; the deployment migration creates independent replacements.
    if old and len(old.get('workshop_ids',[]))!=1:
        if body.get('status')!='closed' or any(key!='status' and body[key]!=old.get(key) for key in body):
            raise core.APIError('历史共享轮次仅可关闭，不能编辑或重新开放，请使用独立小车间轮次',409)
        return dict(old,status='closed',closed_at=old.get('closed_at') or core.now())
    fields = ('title','title_id','round_number','major_workshop_id','workshop_ids','position_ids','duration_minutes','status')
    obj = dict(old or {'id':core.uid(), 'created_at':core.now()})
    obj.update({key:body[key] for key in fields if key in body})
    obj['round_number'] = core.number(obj.get('round_number',1),'考试轮次',1,10000,True)
    obj['major_workshop_id'] = core.strval(obj.get('major_workshop_id',''),'大车间',200,True)
    core.get(c,'major_workshops',obj['major_workshop_id'])
    for field,kind,label in [('workshop_ids','workshops','车间'),('position_ids','positions','岗位')]:
        ids=obj.get(field)
        if not isinstance(ids,list) or not ids or len(ids)>2000 or any(not isinstance(v,str) or not v for v in ids) or len(set(ids))!=len(ids):
            raise core.APIError(f'请选择不重复的{label}')
        if field=='workshop_ids' and len(ids)!=1: raise core.APIError('每个考试轮次只能选择一个小车间，请分别开放各车间考试')
        for ident in ids:
            item=core.get(c,kind,ident)
            major=core.major_of(c,kind,item)
            if kind=='positions' and not major and item.get('workshop_id'):
                major=core.get(c,'workshops',item['workshop_id']).get('major_workshop_id','')
            if major != obj['major_workshop_id']: raise core.APIError(f'{label}不属于所选大车间')
    workshop=core.get(c,'workshops',obj['workshop_ids'][0])
    for ident in obj['position_ids']:
        if not core.position_in_workshop(core.get(c,'positions',ident),workshop): raise core.APIError('岗位与所选车间不匹配')
    titles=round_titles(workshop,obj['round_number'])
    obj['title'] = core.strval(obj.get('title') or titles['title'],'考试名称',200,True)
    obj['title_id'] = core.strval(obj.get('title_id') or titles['title_id'],'考试名称（印尼文）',200,True)
    obj['duration_minutes']=core.number(obj.get('duration_minutes',30),'考试时长',1,480,True)
    obj['status']=obj.get('status','closed')
    if obj['status'] not in ('open','closed'): raise core.APIError('轮次状态仅支持开放或关闭')
    if old:
        scope_fields=('round_number','major_workshop_id','workshop_ids','position_ids')
        if any(obj.get(k)!=old.get(k) for k in scope_fields): raise core.APIError('轮次及适用范围不能修改，请新建下一轮')
    for other in core.all_docs(c,'exam_rounds'):
        if other['id']==obj['id'] or len(other.get('workshop_ids',[]))!=1: continue
        if other['workshop_ids']==obj['workshop_ids'] and other.get('round_number')==obj['round_number']:
            raise core.APIError('该小车间已有同编号考试轮次，请使用开放下一轮',409)
    if obj['status']=='open':
        for other in core.all_docs(c,'exam_rounds'):
            if other['id']==obj['id'] or other.get('status')!='open': continue
            if workshop['id'] in other.get('workshop_ids',[]):
                raise core.APIError('该小车间已有开放轮次，请先关闭或开放下一轮',409)
        if not old or old.get('status')!='open': obj['opened_at']=core.now()
        obj['closed_at']=None
    elif old and old.get('status')=='open': obj['closed_at']=core.now()
    return obj


def virtual_plan(round_, position_id, workshop, position):
    title=round_['title']
    if workshop['name'] not in title: title=f"{workshop['name']} · {title}"
    return {'id':'round:'+round_['id'],'position_id':position_id,'workshop_id':'','status':'active',
            'title':f"{title} · {position['name']}",
            'duration_minutes':round_['duration_minutes'],'pass_score':60}


def next_round(c, core, old):
    core=_core(core)
    if len(old.get('workshop_ids',[]))!=1: raise core.APIError('历史共享轮次不能开放下一轮，请使用独立小车间轮次',409)
    if not c.in_transaction: c.execute('BEGIN')
    c.execute('SAVEPOINT next_exam_round')
    try:
        closed=dict(old,status='closed',closed_at=core.now())
        core.put(c,'exam_rounds',closed)
        same=[r for r in core.all_docs(c,'exam_rounds') if len(r.get('workshop_ids',[]))==1
              and r['workshop_ids']==old['workshop_ids']]
        n=max(r.get('round_number',0) for r in same)+1
        body={k:old[k] for k in ('major_workshop_id','workshop_ids','position_ids','duration_minutes')}
        new=validate_round(c,core,dict(body,round_number=n,status='open'))
        core.put(c,'exam_rounds',new)
        c.execute('RELEASE SAVEPOINT next_exam_round')
        return new
    except Exception:
        c.execute('ROLLBACK TO SAVEPOINT next_exam_round'); c.execute('RELEASE SAVEPOINT next_exam_round'); raise


def migrate_shared_rounds(c, core):
    """Explicit transactional migration; frozen exams and source attempts stay intact.

    The caller commits. An existing unrelated independent round is a conflict,
    never a reason to replace workshop configuration or reuse an attempt slot.
    """
    core=_core(core)
    if not c.in_transaction: c.execute('BEGIN')
    c.execute('SAVEPOINT split_shared_rounds')
    result={'created':[],'updated':[],'attempts_copied':0,'already_migrated':0}
    try:
        sources=[r for r in core.all_docs(c,'exam_rounds') if len(r.get('workshop_ids',[]))>1]
        for old in sources:
            mapping=old.get('migrated_to_round_ids')
            if mapping:
                if set(mapping)!=set(old['workshop_ids']): raise core.APIError('历史轮次迁移映射不完整，请核对后再处理',409)
                for wid,ident in mapping.items():
                    target=core.get(c,'exam_rounds',ident,False)
                    if not target or target.get('migrated_from_round_id')!=old['id'] or target.get('workshop_ids')!=[wid] or target.get('round_number')!=old.get('round_number'):
                        raise core.APIError('历史轮次迁移目标发生冲突，请核对后再处理',409)
                result['already_migrated']+=1
            else:
                mapping={}; stamp=core.now()
                # Close the old group before validating its individual windows.
                closed=dict(old,status='closed',closed_at=old.get('closed_at') or stamp,
                            migrated_at=stamp,migration_version='workshop-rounds-v39')
                core.put(c,'exam_rounds',closed)
                for wid in old['workshop_ids']:
                    ident=str(uuid.uuid5(uuid.NAMESPACE_URL,'matrix:workshop-rounds-v39:'+old['id']+':'+wid))
                    if core.get(c,'exam_rounds',ident,False): raise core.APIError('历史轮次迁移目标ID已存在，请核对后再处理',409)
                    body={key:old[key] for key in ('major_workshop_id','position_ids','round_number','duration_minutes')}
                    body.update(workshop_ids=[wid],status=old['status'])
                    target=validate_round(c,core,body)
                    target.update(id=ident,migrated_from_round_id=old['id'])
                    core.put(c,'exam_rounds',target)
                    mapping[wid]=ident; result['created'].append(target)
                closed['migrated_to_round_ids']=mapping
                core.put(c,'exam_rounds',closed); result['updated'].append(closed)
            for attempt in c.execute('SELECT * FROM exam_round_attempts WHERE round_id=?',(old['id'],)).fetchall():
                target_id=mapping.get(attempt['workshop_id'])
                if not target_id: raise core.APIError('历史答题记录的车间不在迁移范围内，请核对后再处理',409)
                prior=c.execute('SELECT assignment_id,workshop_id FROM exam_round_attempts WHERE round_id=? AND employee_no_key=?',
                                (target_id,attempt['employee_no_key'])).fetchone()
                if prior:
                    if prior['assignment_id']!=attempt['assignment_id'] or prior['workshop_id']!=attempt['workshop_id']:
                        raise core.APIError('历史答题次数迁移冲突，未覆盖任何记录',409)
                    continue
                c.execute('INSERT INTO exam_round_attempts VALUES(?,?,?,?,?)',(target_id,attempt['workshop_id'],attempt['employee_no_key'],attempt['assignment_id'],attempt['created_at']))
                result['attempts_copied']+=1
        c.execute('RELEASE SAVEPOINT split_shared_rounds')
        result.update(created_count=len(result['created']),updated_count=len(result['updated']))
        return result
    except Exception:
        c.execute('ROLLBACK TO SAVEPOINT split_shared_rounds'); c.execute('RELEASE SAVEPOINT split_shared_rounds'); raise


def ensure_first_round(c, core, *, major_workshop_id, workshop_ids, position_ids=None):
    """Deployment-only opt-in. Adds independent windows; returns the first one."""
    core=_core(core)
    existing=[r for r in core.all_docs(c,'exam_rounds') if r.get('major_workshop_id')==major_workshop_id]
    if any(len(r.get('workshop_ids',[]))>1 and not r.get('migrated_to_round_ids') for r in existing):
        raise core.APIError('请先显式迁移历史共享考试轮次',409)
    workshops=[w for w in core.all_docs(c,'workshops') if w.get('major_workshop_id')==major_workshop_id
               and (workshop_ids is None or w['id'] in workshop_ids)]
    if not workshop_ids:
        raise core.APIError('请明确选择示例组织和小组，不推断默认范围')
    items={i['id']:i for i in core.all_docs(c,'work_items') if i.get('active') and assessment_mode(i)=='exam_practical'}
    eligible={items[q['work_item_id']]['position_id'] for q in core.all_docs(c,'questions')
              if q.get('status')=='active' and q.get('type') in ('single','multiple','true_false') and q.get('work_item_id') in items}
    positions=[p for p in core.all_docs(c,'positions') if p['id'] in eligible
               and (position_ids is None or p['id'] in position_ids)
               and any(core.position_in_workshop(p,w) for w in workshops)]
    if not workshops or not positions: raise core.APIError('没有可开放的车间及岗位')
    result=[]
    for workshop in workshops:
        prior=[r for r in existing if r.get('workshop_ids')==[workshop['id']]]
        if prior:
            result.append(min(prior,key=lambda r:r['round_number'])); continue
        ids=[p['id'] for p in positions if core.position_in_workshop(p,workshop)]
        if not ids: continue
        obj=validate_round(c,core,{'major_workshop_id':major_workshop_id,'workshop_ids':[workshop['id']],
            'position_ids':ids,'round_number':1,'duration_minutes':30,'status':'open'})
        core.put(c,'exam_rounds',obj); result.append(obj)
    if not result: raise core.APIError('没有可开放的车间及岗位')
    return result[0]
