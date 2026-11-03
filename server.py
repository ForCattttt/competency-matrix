#!/usr/bin/env python3
"""Independent local competency framework. Python standard library only."""
from __future__ import annotations
import argparse, csv, gzip, hashlib, hmac, io, ipaddress, json, logging, math, mimetypes, os, secrets, socket, sqlite3, threading, time, unicodedata, uuid
from datetime import datetime, timezone
from functools import lru_cache
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer as _ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit, unquote, parse_qs, quote
from workshop_xlsx import build_workshop_xlsx, export_matrix_entries
from template_xlsx import build_selected_template_xlsx
from work_item_i18n import work_item_name_id
from exam_readiness import exam_options as ready_exam_options, equal_points_snapshot, exam_titles
from exam_rounds import choose_open_round, validate_round, virtual_plan, next_round, normalized_employee_no
from practical_guidance import practical_guidance, PRACTICAL_GUIDANCE_VERSION
from direct_assessments import (assessment_mode, item_metadata, validate_item_policy, direct_rules,
                                score as score_direct_skill, history as direct_skill_history,
                                cell as direct_skill_cell, record_id as direct_record_id)
from rating_rules import DIMENSIONS, EXAM_QUESTION_COUNT, PRACTICAL_MIN, PRACTICAL_MAX, rating_rules, level_for_percent, combined_percent, category_profile
import shared_question_banks as shared_banks
import capability_development as development
import exam_record_cleanup as duplicate_cleanup
import exam_record_delete
import work_categories
import question_document_import

ROOT = Path(__file__).resolve().parent
# Demo storage is always isolated inside this checkout.
DB = ROOT / 'runtime' / 'framework.sqlite3'
LOCK = threading.RLock()
COLLECTIONS = ('major_workshops','workshops','positions','work_items','question_banks','questions','employees','plans','exam_rounds','assignments','users')
MAJOR_WORKSHOPS = (
 {'id':'major-demo-operations','code':'DEMO-OPS','name':'示例运营部','name_id':'Departemen Operasional Demo','sort_order':1},
 {'id':'major-demo-quality','code':'DEMO-QA','name':'示例质量部','name_id':'Departemen Mutu Demo','sort_order':2},
 {'id':'major-demo-support','code':'DEMO-SUP','name':'示例支持部','name_id':'Departemen Dukungan Demo','sort_order':3},
)
ANSWER_FIELDS = {'correct_answer','reference_answer_zh','reference_answer_id'}
MAX_BODY = 3 * 1024 * 1024
NETWORK_IO_TIMEOUT = 10.0
DRAFT_SYNC_POLICY = 'server-snapshot-v1-20261017'
LOGIN_FAILURES = {}
LOGIN_IP_FAILURES = {}
LOGIN_FAILURE_WINDOW = 60
LOGIN_ACCOUNT_FAILURE_LIMIT = 8
LOGIN_IP_FAILURE_LIMIT = 60
LOGIN_MAX_ACCOUNT_KEYS = 8192
LOGIN_MAX_IP_KEYS = 4096
EXAM_ENTRY_FAILURES = {}
EXAM_REGISTRATION_CREATES = {}
EXAM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
EXAM_ENTRY_MAX_IPS = 4096
EXAM_TERMINATION_EVENTS = frozenset(('visibility_hidden','pagehide','navigation','storage_sync'))
SCREEN_SWITCH_LIMIT = 3
SCREEN_SWITCH_POLICY = 'warnings-v1-three-switches-20261016'
LEGACY_SWITCH_EVENT_ID = 'legacy-v1-switch'
EXAM_ASSESSMENT_CATEGORIES = (
 {'key':'operator','name':'类别 B','name_id':'Kategori B'},
 {'key':'leader','name':'类别 A','name_id':'Kategori A'},
)
FIELDS = {
 'workshops': ['major_workshop_id','name','name_id','code','manager','description'],
 'positions': ['major_workshop_id','workshop_id','name','name_id','description'],
 'work_items': ['position_id','name','name_id','description','practical_standard_zh','practical_standard_id','sort_order','active','assessment_mode','skill_category','work_category_id'],
 'questions': ['work_item_id','question_bank_id','type','dimension','title_zh','title_id','options','correct_answer','reference_answer_zh','reference_answer_id','points','status'],
 'employees': ['workshop_id','position_id','employee_no','name','language','active','assessment_category'],
 'plans': ['workshop_id','position_id','title','question_count','duration_minutes','pass_score','status'],
 'users': ['username','name','role','workshop_id','active'],
}

def now(): return datetime.now(timezone.utc).isoformat(timespec='microseconds')
def uid(): return str(uuid.uuid4())
def dumps(v): return json.dumps(v,ensure_ascii=False,separators=(',',':'))
class APIError(Exception):
 def __init__(self,message,status=400): self.message,self.status=message,status

class ThreadingHTTPServer(_ThreadingHTTPServer):
 """Bound connection workers without making the accept loop wait for a slot."""
 request_queue_size = 128
 def __init__(self,*args,max_workers=128,**kwargs):
  if type(max_workers) is not int or not 1<=max_workers<=4096:
   raise ValueError('max_workers must be an integer between 1 and 4096')
  self.max_workers=max_workers
  self._worker_slots=threading.BoundedSemaphore(max_workers)
  super().__init__(*args,**kwargs)
 def process_request(self,request,client_address):
  if not self._worker_slots.acquire(blocking=False):
   # A rejected connection gets no thread and never enters the database lock.
   # Nonblocking I/O also prevents an unread rejection from stalling accepts.
   payload=dumps({'error':'当前访问人数较多，请稍后重试 / Server sedang sibuk. Coba lagi.'}).encode('utf-8')
   packet=(b'HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n'
    b'Content-Type: application/json; charset=utf-8\r\nCache-Control: no-store\r\n'
    b'X-Content-Type-Options: nosniff\r\nRetry-After: 1\r\nContent-Length: '+str(len(payload)).encode('ascii')+b'\r\n\r\n'+payload)
   try:
    request.setblocking(False); request.sendall(packet)
   except OSError: pass
   finally: self.shutdown_request(request)
   return
  try: super().process_request(request,client_address)
  except BaseException:
   self._worker_slots.release()
   # ThreadingMixIn tracks a thread before starting it. Remove an unstarted
   # thread after a start failure so server_close() can still join safely.
   tracked=getattr(self,'_threads',None)
   if hasattr(tracked,'reap'): tracked.reap()
   raise
 def process_request_thread(self,request,client_address):
  try: super().process_request_thread(request,client_address)
  finally: self._worker_slots.release()

RFC1918_NETWORKS = tuple(ipaddress.IPv4Network(value) for value in ('10.0.0.0/8','172.16.0.0/12','192.168.0.0/16'))
LOCAL_HTTP_HOSTS = frozenset(('localhost','127.0.0.1','::1'))

def lan_network(value):
 """Only an explicit, canonical subnet wholly inside RFC1918 is accepted."""
 try:
  if '/' not in value or value.rsplit('/',1)[1] not in tuple(str(prefix) for prefix in range(33)): raise ValueError
  network=ipaddress.IPv4Network(value,strict=True)
 except (ValueError,TypeError): raise argparse.ArgumentTypeError('允许网段必须是明确的 RFC1918 IPv4 CIDR，例如 192.168.1.0/24') from None
 if not any(network.subnet_of(private) for private in RFC1918_NETWORKS):
  raise argparse.ArgumentTypeError('只允许 RFC1918 私有网段，不能填写公网或默认路由')
 return network

def lan_address(value):
 try: address=ipaddress.IPv4Address(value)
 except (ValueError,TypeError): raise argparse.ArgumentTypeError('局域网地址必须是 RFC1918 私有 IPv4 地址') from None
 if not any(address in private for private in RFC1918_NETWORKS):
  raise argparse.ArgumentTypeError('局域网地址必须是 RFC1918 私有 IPv4 地址')
 return str(address)

PUBLIC_STATIC_FILES = frozenset(('app.js', 'index.html', 'style.css', 'motion.js', 'motion.css', 'content-motion.js', 'matrix-export-cleanup.js', 'assets/matrix-symbol.svg', 'vendor/jszip.min.js', 'vendor/jszip.LICENSE.markdown', 'question-import-example.txt'))

STATIC_TEXT_SUFFIXES = frozenset(('.js','.mjs','.css','.svg'))
STATIC_PUBLIC_SUFFIXES = STATIC_TEXT_SUFFIXES | frozenset(('.png','.jpg','.jpeg','.webp','.gif','.ico','.woff','.woff2','.ttf'))

def static_encoding(value,can_gzip):
 """Negotiate only the representations this public asset can provide."""
 qualities={}
 for item in value.split(','):
  parts=item.split(';'); name=parts[0].strip().lower()
  if not name: continue
  quality=1.0
  for parameter in parts[1:]:
   key,separator,weight=parameter.strip().partition('=')
   if separator and key.strip().lower()=='q':
    try: quality=float(weight.strip())
    except ValueError: quality=0.0
    if not 0<=quality<=1: quality=0.0
  # An explicit refusal also wins if a client repeats a coding.
  qualities[name]=min(qualities.get(name,quality),quality)
 gzip_quality=qualities.get('gzip',qualities.get('*',0)) if can_gzip else 0
 identity_quality=qualities.get('identity',0 if qualities.get('*')==0 else 1)
 if gzip_quality>0 and gzip_quality>=identity_quality: return 'gzip'
 if identity_quality>0: return 'identity'
 if gzip_quality>0: return 'gzip'
 raise APIError('没有可接受的静态资源编码',406)

@lru_cache(maxsize=8)
def static_representations(filename,mtime_ns,ctime_ns,size):
 """The stat key invalidates changed files; keep only eight small asset versions."""
 raw=Path(filename).read_bytes()
 identity=(raw,'"'+hashlib.sha256(raw).hexdigest()+'"')
 encoded=gzip.compress(raw,compresslevel=6,mtime=0) if Path(filename).suffix.lower() in STATIC_TEXT_SUFFIXES else None
 compressed=(encoded,'"'+hashlib.sha256(encoded).hexdigest()+'"') if encoded is not None else None
 return identity,compressed

class ClosingConnection(sqlite3.Connection):
 def __exit__(self,*args):
  try: return super().__exit__(*args)
  finally: self.close()

def connect():
 c=sqlite3.connect(DB,timeout=30,factory=ClosingConnection); c.row_factory=sqlite3.Row
 c.execute('PRAGMA foreign_keys=ON'); c.execute('PRAGMA busy_timeout=30000')
 return c

def all_docs(c,kind): return [json.loads(r['payload']) for r in c.execute('SELECT payload FROM documents WHERE collection=? ORDER BY rowid',(kind,))]
def get(c,kind,ident,required=True):
 r=c.execute('SELECT payload FROM documents WHERE collection=? AND id=?',(kind,ident)).fetchone()
 if not r:
  if required: raise APIError('记录不存在',404)
  return None
 return json.loads(r['payload'])
def put(c,kind,obj): c.execute('INSERT INTO documents(collection,id,payload) VALUES(?,?,?) ON CONFLICT(collection,id) DO UPDATE SET payload=excluded.payload',(kind,obj['id'],dumps(obj)))

def position_assessment_category(position,requested):
 """Use the assessment category explicitly selected for the employee."""
 return requested

def effective_employee(c,employee):
 """Apply the current position policy without altering historical documents."""
 if employee is None: return None
 position=get(c,'positions',employee.get('position_id',''),False)
 return dict(employee,assessment_category=position_assessment_category(position,employee.get('assessment_category','')))

def password_hash(password):
 salt=secrets.token_hex(16); digest=hashlib.scrypt(password.encode(),salt=salt.encode(),n=16384,r=8,p=1).hex()
 return salt+':'+digest
def check_password(password,stored):
 try:
  salt,wanted=stored.split(':'); actual=hashlib.scrypt(password.encode(),salt=salt.encode(),n=16384,r=8,p=1).hex()
  return hmac.compare_digest(actual,wanted)
 except (ValueError,TypeError): return False

def login_failure_state(ip,username):
 # The request handler holds LOCK. Bound both retention and cardinality before
 # admitting a new key; rotating nonexistent usernames cannot grow this cache.
 current=time.time()
 for cache in (LOGIN_FAILURES,LOGIN_IP_FAILURES):
  for key,stamps in list(cache.items()):
   recent=[stamp for stamp in stamps if stamp>current-LOGIN_FAILURE_WINDOW]
   if recent: cache[key]=recent
   else: cache.pop(key,None)
 key=(ip,username.casefold())
 failures=LOGIN_FAILURES.get(key,[]); ip_failures=LOGIN_IP_FAILURES.get(ip,[])
 if len(failures)>=LOGIN_ACCOUNT_FAILURE_LIMIT or len(ip_failures)>=LOGIN_IP_FAILURE_LIMIT:
  raise APIError('登录尝试过多，请一分钟后重试',429)
 if (key not in LOGIN_FAILURES and len(LOGIN_FAILURES)>=LOGIN_MAX_ACCOUNT_KEYS) or (ip not in LOGIN_IP_FAILURES and len(LOGIN_IP_FAILURES)>=LOGIN_MAX_IP_KEYS):
  raise APIError('登录尝试过多，请一分钟后重试',429)
 return key,failures,ip_failures,current

def private_file_mode(fd,path):
 # Windows has no fchmod. Its chmod supports the writable bit; the deployment
 # directory's NTFS permissions provide the account-level access restriction.
 fchmod=getattr(os,'fchmod',None)
 if fchmod is not None: fchmod(fd,0o600)
 else: os.chmod(path,0o600)

def init_db():
 DB.parent.mkdir(parents=True,exist_ok=True)
 with LOCK,connect() as c:
  c.execute('PRAGMA journal_mode=WAL')
  c.execute('CREATE TABLE IF NOT EXISTS documents(collection TEXT NOT NULL,id TEXT NOT NULL,payload TEXT NOT NULL,PRIMARY KEY(collection,id))')
  c.execute('CREATE TABLE IF NOT EXISTS credentials(user_id TEXT PRIMARY KEY,password_hash TEXT NOT NULL)')
  c.execute('CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL,expires REAL NOT NULL)')
  # Registration keys are capabilities. Store only their hashes outside the
  # business-document collections, so bootstrap and exports cannot expose them.
  c.execute('CREATE TABLE IF NOT EXISTS exam_registrations(request_key_hash TEXT PRIMARY KEY,identity_hash TEXT NOT NULL,employee_id TEXT NOT NULL,assignment_id TEXT NOT NULL,created_at TEXT NOT NULL)')
  c.execute('CREATE TABLE IF NOT EXISTS exam_round_attempts(round_id TEXT NOT NULL,workshop_id TEXT NOT NULL,employee_no_key TEXT NOT NULL,assignment_id TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(round_id,workshop_id,employee_no_key))')
  c.execute('CREATE UNIQUE INDEX IF NOT EXISTS exam_round_attempt_identity ON exam_round_attempts(round_id,employee_no_key)')
  ensure_major_workshops(c)
  bank_state=shared_banks.assert_position_banks_ready(c,globals())
  logging.info('Position question banks: %s',dumps(bank_state))
  if not all_docs(c,'users'):
   password=secrets.token_urlsafe(15)
   u={'id':uid(),'username':'admin','name':'系统管理员','role':'admin','workshop_id':'','active':True}
   put(c,'users',u); c.execute('INSERT INTO credentials VALUES(?,?)',(u['id'],password_hash(password)))
   path=DB.parent/'initial-admin.json'
   fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_TRUNC,0o600)
   with os.fdopen(fd,'w',encoding='utf-8') as f:
    private_file_mode(f.fileno(),path)
    json.dump({'username':'admin','password':password,'created_at':now()},f,ensure_ascii=False,indent=2)
   logging.info('Initial administrator credentials saved to %s',path)
 try: os.chmod(DB,0o600)
 except OSError: pass

def ensure_major_workshops(c):
 """Create neutral example groups without modifying user-managed records."""
 for major in MAJOR_WORKSHOPS:
  if not get(c,'major_workshops',major['id'],False): put(c,'major_workshops',dict(major))

def strval(v,name,maxlen=2000,required=False):
 if not isinstance(v,str): raise APIError(f'{name} 必须为文字')
 v=v.strip()
 if required and not v: raise APIError(f'请填写{name}')
 if len(v)>maxlen: raise APIError(f'{name}过长')
 return v

def number(v,name,low,high,integer=False):
 if isinstance(v,bool) or not isinstance(v,(float,int)) or not (low <= v <= high): raise APIError(f'{name}须在 {low} 到 {high} 之间')
 if integer and int(v)!=v: raise APIError(f'{name}必须为整数')
 return int(v) if integer else float(v)

def boolval(v,name):
 if not isinstance(v,bool): raise APIError(f'{name}必须为是或否')
 return v

def workshop_of(c,kind,obj):
 if kind=='workshops': return obj['id']
 if kind in ('positions','employees','users'): return obj.get('workshop_id','')
 if kind=='plans': return obj.get('workshop_id') or get(c,'positions',obj['position_id']).get('workshop_id','')
 if kind=='work_items': return get(c,'positions',obj['position_id']).get('workshop_id','')
 if kind=='question_banks': return obj.get('workshop_id','')
 if kind=='questions': return workshop_of(c,'work_items',get(c,'work_items',obj['work_item_id']))
 if kind=='assignments': return workshop_of(c,'employees',get(c,'employees',obj['employee_id']))
 return ''

def major_of(c,kind,obj):
 if kind=='major_workshops': return obj['id']
 if kind=='workshops': return obj.get('major_workshop_id','')
 if kind=='positions': return obj.get('major_workshop_id','')
 if kind=='question_banks': return obj.get('major_workshop_id','')
 if kind in ('work_items','plans'): return major_of(c,'positions',get(c,'positions',obj['position_id']))
 if kind=='questions': return major_of(c,'work_items',get(c,'work_items',obj['work_item_id']))
 if kind in ('users','employees'):
  workshop=get(c,'workshops',obj.get('workshop_id',''),False)
  return major_of(c,'workshops',workshop) if workshop else ''
 if kind=='assignments': return major_of(c,'employees',get(c,'employees',obj['employee_id']))
 return ''

def shared_plan_allowed(c,user,plan):
 """A common plan exposes no sibling workshop's assignment or employee data."""
 major=major_of(c,'plans',plan)
 if not major or major!=major_of(c,'users',user): return False
 if user['role']=='workshop_admin': return True
 return any(a['plan_id']==plan['id'] and workshop_of(c,'assignments',a)==user.get('workshop_id') for a in all_docs(c,'assignments'))

def department_self_service(user):
 """A scoped lean account gains only explicitly enumerated authoring actions."""
 return user.get('role')=='question_contributor' and bool(user.get('workshop_id'))

def can_manage_round(user,obj):
 return user.get('role')=='admin' or (department_self_service(user) and obj.get('workshop_ids')==[user['workshop_id']])

def allowed(c,user,kind,obj):
 if user['role']=='admin': return True
 if kind=='exam_rounds': return bool(user.get('workshop_id')) and user['workshop_id'] in obj.get('workshop_ids',[])
 if kind=='major_workshops': return True
 if kind=='users': return obj['id']==user['id']
 wid=user.get('workshop_id','')
 if user['role'] in ('viewer','question_editor') and not wid: return True
 if kind in ('positions','work_items','question_banks','questions'):
  major=major_of(c,kind,obj)
  # "Support departments" is a display group, never a shared authorization
  # scope. Historical group-only bindings remain stored for audit; a lean
  # account must use a position explicitly bound to its own department.
  if major=='major-demo-support': return bool(wid) and workshop_of(c,kind,obj)==wid
  if major: return bool(wid) and major==major_of(c,'users',user)
 if kind=='plans' and not workshop_of(c,kind,obj): return shared_plan_allowed(c,user,obj)
 return bool(wid) and workshop_of(c,kind,obj)==wid

def capabilities(user):
 role=user['role']; full=role in ('admin','workshop_admin'); self_service=department_self_service(user)
 return {'manage_organization':full,'manage_positions':full or self_service,'manage_work_items':full or self_service,
         'manage_users':role=='admin','manage_exams':full,'manage_exam_rounds':role=='admin' or self_service,'grade_exams':full,
         'add_questions':full or role in ('question_editor','question_contributor'),
         'edit_questions':full or role=='question_editor' or self_service,'edit_own_questions':self_service,'delete_questions':full or role=='question_editor',
         'view_question_answers':role in ('admin','workshop_admin','question_editor') or self_service,
         'export_question_answers':full,'view_results':True,
         'score_practical':full or (role=='question_contributor' and bool(user.get('workshop_id'))),
         'manage_work_categories':role=='admin' or (role in ('workshop_admin','question_contributor') and bool(user.get('workshop_id')))}

def authorize(c,user,kind,obj=None,write=False,action='write'):
 if kind=='assignments' and write and action=='delete' and user['role']!='admin': raise APIError('仅系统管理员可删除考试记录',403)
 if kind=='question_banks' and write: raise APIError('共用题库目录由岗位作业自动维护，请在作业项目或题目中操作',403)
 if kind=='exam_rounds' and write and user['role']!='admin':
  if not department_self_service(user) or action not in ('create','put','next'): raise APIError('此账号只能维护本部门的独立考试轮次',403)
  if obj is not None and not can_manage_round(user,obj): raise APIError('只能维护本部门的独立考试轮次，历史共享轮次须由管理员处理',403)
 if kind=='major_workshops' and write: raise APIError('大车间分类为固定配置，不能新增、修改或删除',403)
 if write and user['role']=='viewer': raise APIError('只读账号不能修改数据',403)
 if user['role'] in ('question_editor','question_contributor'):
  if write:
   self_service=department_self_service(user)
   if kind=='questions':
    if user['role']=='question_contributor':
     if action not in ('create','import','put'): raise APIError('车间精益员不能删除题目',403)
     if action=='put' and (not self_service or not obj or obj.get('created_by')!=user['id']): raise APIError('只能维护自己录入的题目',403)
   elif self_service and kind in ('positions','work_items'):
    if action not in ('create','put'): raise APIError('车间精益员不能删除岗位或作业项目',403)
    if action=='put' and (not obj or obj.get('created_by')!=user['id']): raise APIError('只能维护自己创建的岗位和作业项目',403)
   elif not (self_service and kind=='exam_rounds'):
    raise APIError('此账号无权维护这类数据',403)
  elif kind=='questions' and obj and user['role']=='question_contributor' and obj.get('created_by')!=user['id']:
   raise APIError('此账号仅可查看自己录入的题目',403)
 if kind=='users' and write and user['role']!='admin': raise APIError('仅系统管理员可维护账号',403)
 if kind=='workshops' and write and user['role']!='admin': raise APIError('仅系统管理员可维护车间',403)
 if kind=='plans' and write and obj and major_of(c,'plans',obj) and not obj.get('workshop_id') and user['role']!='admin': raise APIError('共用考试计划仅系统管理员可维护',403)
 if kind=='users' and obj and user['role']!='admin' and obj['id']!=user['id']: raise APIError('无权访问其他账号',403)
 if obj and not allowed(c,user,kind,obj): raise APIError('无权访问其他车间的数据',403)

def sanitized(kind,obj,user,c=None,bank_catalog=None):
 if kind=='employees' and c is not None: obj=effective_employee(c,obj)
 result=dict(obj)
 if kind=='positions': result['assessment_category_override']=position_assessment_category(obj,'')
 if kind=='exam_rounds' and user['role']!='admin':
  result['can_manage']=can_manage_round(user,obj)
  result['workshop_ids']=[user['workshop_id']]
  if isinstance(result.get('migrated_to_round_ids'),dict):
   result['migrated_to_round_ids']={key:value for key,value in result['migrated_to_round_ids'].items() if key==user['workshop_id']}
 if kind=='work_items': result.update(name_id=work_item_name_id(obj),**item_metadata(obj))
 if kind=='plans':
  result['question_count']=EXAM_QUESTION_COUNT
  result['total_points']=100
  # Plan configuration is an upper limit; actual equal weights depend on
  # the current active bank. Never change an already-issued snapshot here.
  if c is not None:
   pool=shared_banks.pool_data(c,globals(),obj['position_id'])
   available=sum(map(len,pool['pools'].values()))
   count=min(EXAM_QUESTION_COUNT,available)
   result.update(available_question_count=available,exam_question_count=count,points_per_question=100/count if count else None)
  else:
   result['points_per_question']=None
 if kind=='questions':
  result.setdefault('dimension','knowledge')
  result['warnings']=question_warnings(obj)
  if c is not None: result.update(shared_banks.question_metadata(c,globals(),obj,catalogue=bank_catalog))
 if user['role'] in ('viewer','question_contributor','question_editor'):
  if kind=='questions':
   if user['role']!='question_editor' and not (department_self_service(user) and obj.get('created_by')==user['id']):
    for key in ANSWER_FIELDS: result.pop(key,None)
  if kind=='assignments':
   result.pop('token',None); result.pop('exam_code',None); result.pop('details',None); result.pop('snapshot',None)
  if kind=='employees' and user['role'] in ('question_contributor','question_editor'):
   result={k:obj.get(k) for k in ('id','name','employee_no','workshop_id','position_id','assessment_category')}
 result.pop('password',None); result.pop('password_hash',None)
 return result

def question_warnings(question):
 missing=[]
 if not question.get('title_zh'): missing.append('title_zh')
 if not question.get('title_id'): missing.append('title_id')
 for option in question.get('options',[]):
  for lang in ('zh','id'):
   if not option.get('text_'+lang): missing.append('option_'+str(option.get('key',''))+'_'+lang)
 return [{'code':'missing_translation','message':'题干或选项缺少中印双语，考生将看到现有语言内容','fields':missing}] if missing else []

def question_identity(question,c=None):
 if c is not None: return shared_banks.identity(c,globals(),question)
 def norm(value): return ' '.join(unicodedata.normalize('NFKC',str(value or '')).casefold().split())
 options=sorted((norm(o.get('key')),norm(o.get('text_zh')),norm(o.get('text_id'))) for o in question.get('options',[]))
 return dumps([question.get('question_bank_id') or question.get('work_item_id'),question.get('type'),question.get('dimension','knowledge'),norm(question.get('title_zh')),norm(question.get('title_id')),options])

def question_answer_identity(question):
 return tuple(sorted(question.get('correct_answer') or []))

def question_duplicate(question,known,c=None):
 """Use one identity/answer policy for single writes and batch imports."""
 key=question_identity(question,c)
 if key not in known: return False
 if known[key]!={question_answer_identity(question)}:
  raise APIError('同一作业已有相同题干及选项但标准答案冲突，请核对后再保存 / Soal dan pilihan yang sama sudah ada pada pekerjaan ini, tetapi kunci jawabannya berbeda. Periksa sebelum menyimpan.',409)
 return True

def check_question_write(c,question,old=None):
 if old and old.get('merged_into_question_id'):
  raise APIError('该重复题已归并到共用题库主题，请编辑原题，不能修改或重新启用此副本',409)
 # Existing duplicates were imported before this guard. Unrelated maintenance
 # must remain possible; check only new/changed content, answers or activation.
 if old and question_identity(question,c)==question_identity(old,c) and question_answer_identity(question)==question_answer_identity(old) and not (old.get('status')!='active' and question.get('status')=='active'):
  return
 known={}
 for existing in all_docs(c,'questions'):
  if existing['id']==question['id']: continue
  if existing.get('merged_into_question_id'): continue
  known.setdefault(question_identity(existing,c),set()).add(question_answer_identity(existing))
 if question_duplicate(question,known,c):
  raise APIError('同一作业已有相同题干、选项和答案的题目，请使用已有题目，不要重复新增或修改 / Soal, pilihan, dan jawaban yang sama sudah ada pada pekerjaan ini. Gunakan soal yang tersedia tanpa membuat duplikat.',409)

def import_questions(c,user,body):
 authorize(c,user,'questions',write=True,action='import')
 if not isinstance(body,dict) or not isinstance(body.get('rows'),list) or not 1<=len(body['rows'])<=2000: raise APIError('请提交 1 到 2000 道题目')
 # Validate the complete batch before writing; conflicting answer keys must be
 # reported, never silently mistaken for harmless duplicate content.
 known={}
 for q in all_docs(c,'questions'):
  if q.get('merged_into_question_id'): continue
  key=question_identity(q,c); answer=question_answer_identity(q)
  known.setdefault(key,set()).add(answer)
 batch=[]; skipped=0; warnings=[]
 for idx,row in enumerate(body['rows']):
  try:
   q=question_authorship(validate(c,'questions',row),user); authorize(c,user,'questions',q,True,'import')
   key=question_identity(q,c); answer=question_answer_identity(q)
   if question_duplicate(q,known,c): skipped+=1
   else:
    batch.append(q); known[key]={answer}
   for warning in question_warnings(q): warnings.append(dict(warning,row=idx+1))
  except APIError as error: raise APIError(f'第 {idx+1} 行：{error.message}',error.status) from None
 for question in batch: put(c,'questions',question)
 return {'imported':len(batch),'skipped_duplicates':skipped,'warnings':warnings}

def preview_question_import(c,user,body):
 """Read-only parse and validation; only explicit import may write questions."""
 authorize(c,user,'questions',write=True,action='import')
 if not isinstance(body,dict): raise APIError('请求内容必须为对象')
 item_id=strval(body.get('work_item_id',''),'作业项目',200,True)
 item=get(c,'work_items',item_id)
 requested_position=strval(body.get('position_id',''),'岗位',200)
 requested_bank=strval(body.get('question_bank_id',''),'岗位题库',200)
 if requested_position and requested_position!=item.get('position_id'): raise APIError('所选岗位与来源作业不一致，请重新选择',409)
 if requested_bank and requested_bank!=shared_banks.item_bank_id(c,globals(),item): raise APIError('所选题库与来源作业不一致，请重新选择',409)
 authorize(c,user,'questions',{'work_item_id':item_id},True,'import')
 if assessment_mode(item)=='direct': raise APIError('点检、数据等直接评分技能无需题目，不能关联题库')
 dimension=body.get('dimension','knowledge')
 if dimension not in DIMENSIONS: raise APIError('考核维度不正确')
 try: result=question_document_import.parse(dict(body,work_item_id=item_id,dimension=dimension))
 except question_document_import.ParseError as error: raise APIError(str(error)) from None
 # Shared-bank validation can repair a missing catalogue entry for legacy
 # items. A preview must not persist even that side effect.
 normalized=[]; validation_errors=[]
 c.execute('SAVEPOINT question_import_preview')
 try:
  for index,row in enumerate(result.get('rows',[])):
   try:
    candidate=dict(row,work_item_id=item_id,dimension=dimension,status='draft')
    question=validate(c,'questions',candidate)
    authorize(c,user,'questions',question,True,'import')
    normalized.append({key:question[key] for key in FIELDS['questions'] if key in question})
   except APIError as error:
    normalized.append({key:candidate[key] for key in FIELDS['questions'] if key in candidate})
    validation_errors.append(f'第 {index+1} 题：{error.message}')
    diagnostic=next((question for question in result.get('questions',[]) if question.get('row_index')==index),None)
    if diagnostic is not None: diagnostic.setdefault('errors',[]).append(error.message)
 finally:
  c.execute('ROLLBACK TO SAVEPOINT question_import_preview')
  c.execute('RELEASE SAVEPOINT question_import_preview')
 result['rows']=normalized
 result['errors']=list(result.get('errors',[]))
 if validation_errors and not result.get('questions'): result['errors'].extend(validation_errors)
 result['can_import']=bool(result.get('can_import')) and bool(normalized) and not result['errors'] and not validation_errors
 return result

def question_authorship(question,user):
 question['created_by']=user['id']; question['created_at']=now()
 return question

def validate(c,kind,body,old=None,user=None):
 if not isinstance(body,dict): raise APIError('请求内容必须为对象')
 if kind=='questions' and old and old.get('merged_into_question_id'): raise APIError('该重复题已归并到共用题库主题，请编辑原题，不能修改或重新启用此副本',409)
 if kind=='exam_rounds': return validate_round(c,globals(),body,old)
 if kind not in FIELDS: raise APIError('该记录不支持直接编辑')
 obj=dict(old or {'id':uid()})
 for k in FIELDS[kind]:
  if k in body: obj[k]=body[k]
 if kind=='workshops':
  for k in FIELDS[kind]: obj[k]=strval(obj.get(k,''),{'name':'车间名称'}.get(k,k),required=k=='name')
  if obj['major_workshop_id']: get(c,'major_workshops',obj['major_workshop_id'])
  if old and (old.get('major_workshop_id') or '')!=obj['major_workshop_id']:
   for employee in all_docs(c,'employees'):
    if employee['workshop_id']!=obj['id']: continue
    position=get(c,'positions',employee['position_id'],False)
    if position and position.get('major_workshop_id') and position['major_workshop_id']!=obj['major_workshop_id']:
     raise APIError('该编号车间已有员工绑定共用岗位，不能更改为不匹配的大车间分类')
 elif kind=='positions':
  obj['major_workshop_id']=strval(obj.get('major_workshop_id',''),'大车间分类')
  obj['workshop_id']=strval(obj.get('workshop_id',''),'编号车间')
  if not old:
   if department_self_service(user or {}):
    own=get(c,'workshops',user['workshop_id'])
    own_major=own.get('major_workshop_id','')
    if obj['major_workshop_id'] and obj['major_workshop_id']!=own_major: raise APIError('只能创建本部门范围内的岗位',403)
    if obj['workshop_id'] and obj['workshop_id']!=own['id']: raise APIError('只能创建本部门范围内的岗位',403)
    if own_major=='major-demo-support':
     obj.update(major_workshop_id='',workshop_id=own['id'])
    elif own_major:
     # Numbered production workshops deliberately share their major's
     # positions; support departments deliberately do not.
     obj.update(major_workshop_id=own_major,workshop_id='')
   if obj['major_workshop_id']=='major-demo-support':
    workshop=get(c,'workshops',obj['workshop_id'],False) if obj['workshop_id'] else None
    if not workshop or workshop.get('major_workshop_id')!='major-demo-support': raise APIError('部门岗位必须选择具体所属部门')
    obj['major_workshop_id']=''
  if obj['major_workshop_id']:
   get(c,'major_workshops',obj['major_workshop_id'])
   if obj['workshop_id']: raise APIError('共用题库岗位请选择大车间分类，不要同时指定编号车间')
  elif obj['workshop_id']: get(c,'workshops',obj['workshop_id'])
  else: raise APIError('请先选择大车间分类')
  obj['name']=strval(obj.get('name',''),'岗位名称',required=True); obj['description']=strval(obj.get('description',''),'说明')
  obj['name_id']=strval(obj.get('name_id',''),'岗位名称（印尼文）')
  # Do not split a shared position's bank by creating another ID for the same
  # normalized name. Existing historical duplicates are never merged or
  # blocked from unrelated metadata maintenance by this future-write guard.
  name_key=shared_banks.normalize(obj['name'])
  if not old or name_key!=shared_banks.normalize(old.get('name')):
   scope=('major',obj['major_workshop_id']) if obj['major_workshop_id'] else ('workshop',obj['workshop_id'])
   for existing in all_docs(c,'positions'):
    other_scope=('major',existing['major_workshop_id']) if existing.get('major_workshop_id') else ('workshop',existing.get('workshop_id',''))
    if existing['id']!=obj['id'] and other_scope==scope and shared_banks.normalize(existing.get('name'))==name_key:
     raise APIError('本范围已有同名岗位，请使用已有岗位，避免题库重复拆分',409)
 elif kind=='work_items':
  obj['position_id']=strval(obj.get('position_id',''),'岗位',required=True); get(c,'positions',obj['position_id'])
  obj['name']=strval(obj.get('name',''),'作业项目名称',required=True)
  obj['name_id']=strval(obj.get('name_id',''),'作业项目名称（印尼文）')
  for key,label in [('practical_standard_zh','实操考核要点（中文）'),('practical_standard_id','实操考核要点（印尼文）')]: obj[key]=strval(obj.get(key,''),label,3000)
  obj['description']=strval(obj.get('description',''),'说明')
  obj['sort_order']=number(obj.get('sort_order',0),'顺序',0,99999,True); obj['active']=boolval(obj.get('active',True),'启用状态')
  work_categories.validate_binding(c,globals(),user,obj,old)
  validate_item_policy(c,globals(),obj,old)
  name_key=shared_banks.normalize(obj['name'])
  if not old or name_key!=shared_banks.normalize(old.get('name')) or assessment_mode(obj)!=assessment_mode(old):
   for existing in all_docs(c,'work_items'):
    if existing['id']!=obj['id'] and existing.get('position_id')==obj['position_id'] and shared_banks.normalize(existing.get('name'))==name_key and assessment_mode(existing)==assessment_mode(obj):
     raise APIError('本岗位已有同名同考核方式的作业项目，请使用已有项目',409)
  shared_banks.bind_item(c,globals(),obj,old)
 elif kind=='questions':
  shared_banks.bind_question(c,globals(),obj,body,old)
  obj['work_item_id']=strval(obj.get('work_item_id',''),'作业项目',required=True); question_item=get(c,'work_items',obj['work_item_id'])
  if assessment_mode(question_item)=='direct': raise APIError('点检、数据等直接评分技能无需题目，不能关联题库')
  obj['dimension']=obj.get('dimension','knowledge')
  if obj['dimension'] not in DIMENSIONS: raise APIError('考核维度不正确')
  obj['type']=obj.get('type','single')
  if obj['type'] not in ('single','multiple','true_false','essay'): raise APIError('不支持的题型')
  if obj['type']=='essay':
   # Frozen old papers remain readable/gradable. Legacy bank essays may only
   # be archived unchanged; they can never become a source of new papers.
   archive_only=old and old.get('type')=='essay' and body.get('status')=='archived' and all(k in ('id','status') or body[k]==old.get(k) for k in body)
   if archive_only: return dict(old,status='archived')
   raise APIError('仅支持单选、多选和判断题；历史简答题只能归档')
  for k in ('title_zh','title_id','reference_answer_zh','reference_answer_id'): obj[k]=strval(obj.get(k,''),k,20000)
  if not obj['title_zh'] and not obj['title_id']: raise APIError('至少填写一种语言的题目')
  obj['points']=number(obj.get('points',5),'分值',0.01,10000)
  obj['status']=obj.get('status','draft')
  if obj['status'] not in ('draft','active','archived'): raise APIError('题目状态不正确')
  options=obj.get('options',[])
  if not isinstance(options,list) or len(options)>20: raise APIError('选项必须为最多 20 项的列表')
  cleaned=[]
  for o in options:
   if not isinstance(o,dict): raise APIError('选项格式不正确')
   raw_key=o.get('key','')
   if isinstance(raw_key,str) and any(unicodedata.category(ch) in ('Cc','Cf','Cs') for ch in raw_key): raise APIError('选项编号不能包含控制字符或隐藏格式字符 / Kode pilihan tidak boleh memuat karakter kontrol atau karakter format tersembunyi.')
   o={k:strval(o.get(k,''),'选项',2000,required=k=='key') for k in ('key','text_zh','text_id')}
   if not o['text_zh'] and not o['text_id']: raise APIError('请填写选项文字')
   if len(o['key'])>20 or any(x['key']==o['key'] for x in cleaned): raise APIError('选项编号重复或过长')
   cleaned.append(o)
  obj['options']=cleaned
  ans=obj.get('correct_answer',[])
  if not isinstance(ans,list) or any(not isinstance(k,str) for k in ans) or len(ans)!=len(set(ans)): raise APIError('标准答案须为不重复的选项编号列表')
  if any(k not in {o['key'] for o in cleaned} for k in ans): raise APIError('标准答案不在选项中')
  if obj['type']=='essay': obj['options']=[]; obj['correct_answer']=[]
  else:
   if len(cleaned)<2: raise APIError('客观题至少需要两个选项')
   if obj['type']=='true_false' and len(cleaned)!=2: raise APIError('判断题须有两个选项')
   if obj['status']=='active' and (not ans or (obj['type']!='multiple' and len(ans)!=1)): raise APIError('启用的客观题必须设置有效标准答案')
   if obj['type']!='multiple' and len(ans)>1: raise APIError('单选或判断题只能有一个标准答案')
   obj['correct_answer']=ans
 elif kind=='employees':
  obj['position_id']=strval(obj.get('position_id',''),'岗位',required=True); pos=get(c,'positions',obj['position_id'])
  obj['workshop_id']=strval(obj.get('workshop_id',pos.get('workshop_id','')),'编号车间',required=True)
  workshop=get(c,'workshops',obj['workshop_id'])
  if pos.get('major_workshop_id'):
   if pos['major_workshop_id']!=workshop.get('major_workshop_id'): raise APIError('员工所在编号车间与岗位的大车间分类不一致')
  elif obj['workshop_id']!=pos.get('workshop_id'): raise APIError('员工车间与岗位不一致')
  obj['name']=strval(obj.get('name',''),'员工姓名',required=True)
  obj['employee_no']=strval(obj.get('employee_no',''),'工号',required=True)
  if any(normalized_employee_no(e['employee_no'])==normalized_employee_no(obj['employee_no']) and e['id']!=obj['id'] for e in all_docs(c,'employees')): raise APIError('工号已存在')
  obj['language']=obj.get('language','zh')
  if obj['language'] not in ('zh','id'): raise APIError('语言仅支持 zh 或 id')
  obj['active']=boolval(obj.get('active',True),'启用状态')
  category=obj.get('assessment_category','')
  category=strval('' if category is None else category,'人员类别',100)
  try: category_profile(category)
  except ValueError: raise APIError('人员类别仅支持类别 A或类别 B')
  obj['assessment_category']=position_assessment_category(pos,category)
 elif kind=='plans':
  obj['position_id']=strval(obj.get('position_id',''),'岗位',required=True); pos=get(c,'positions',obj['position_id'])
  obj['workshop_id']=strval(obj.get('workshop_id',pos.get('workshop_id','')),'编号车间')
  if obj['workshop_id']:
   workshop=get(c,'workshops',obj['workshop_id'])
   if pos.get('major_workshop_id'):
    if pos['major_workshop_id']!=workshop.get('major_workshop_id'): raise APIError('考试计划编号车间与岗位分类不一致')
   elif obj['workshop_id']!=pos.get('workshop_id'): raise APIError('考试计划车间与岗位不一致')
  obj['title']=strval(obj.get('title',''),'考试名称',required=True)
  obj['question_count']=EXAM_QUESTION_COUNT
  obj['duration_minutes']=number(obj.get('duration_minutes',30),'考试时长',1,480,True)
  obj['pass_score']=number(obj.get('pass_score',60),'及格百分比',0,100)
  obj['status']=obj.get('status','draft')
  if obj['status'] not in ('draft','active','archived'): raise APIError('考试状态不正确')
 elif kind=='users':
  obj['username']=strval(obj.get('username',''),'账号',100,True)
  if any(u['username'].casefold()==obj['username'].casefold() and u['id']!=obj['id'] for u in all_docs(c,'users')): raise APIError('账号已存在')
  obj['name']=strval(obj.get('name',''),'姓名',100,True); obj['role']=obj.get('role','viewer')
  if obj['role'] not in ('admin','workshop_admin','viewer','question_editor','question_contributor'): raise APIError('角色不正确')
  obj['workshop_id']=strval(obj.get('workshop_id',''),'车间')
  if obj['workshop_id']: get(c,'workshops',obj['workshop_id'])
  if obj['role'] in ('workshop_admin','question_contributor') and not obj['workshop_id']: raise APIError('车间管理员和车间精益员必须指定车间')
  obj['active']=boolval(obj.get('active',True),'启用状态')
  if not old or body.get('password'): strval(body.get('password',''),'密码',200,True)
  if old and old['role']=='admin' and (obj['role']!='admin' or not obj['active']):
   if not any(u['id']!=obj['id'] and u['role']=='admin' and u['active'] for u in all_docs(c,'users')): raise APIError('至少保留一个启用的系统管理员')
 if kind in ('positions','work_items') and user is not None and not old:
  # These fields are never accepted from the request body or replaced on PUT.
  obj.update(created_by=user['id'],created_at=now())
 return obj

def create_assignment(c,user,body):
 if not isinstance(body,dict): raise APIError('请求内容必须为对象')
 plan=get(c,'plans',str(body.get('plan_id',''))); emp=get(c,'employees',str(body.get('employee_id','')))
 authorize(c,user,'plans',plan); authorize(c,user,'employees',emp,True)
 a=build_validated_assignment(c,plan,emp)
 put(c,'assignments',a); return a

def build_validated_assignment(c,plan,emp):
 # Both administrative assignment and public self-registration use the same
 # validated draw and frozen snapshot; this helper grants no user permissions.
 if plan['position_id']!=emp['position_id']: raise APIError('考试岗位与员工岗位不一致')
 if plan.get('workshop_id') and plan['workshop_id']!=emp['workshop_id']: raise APIError('考试计划与员工编号车间不一致')
 if major_of(c,'plans',plan) and major_of(c,'plans',plan)!=major_of(c,'employees',emp): raise APIError('考试岗位与员工编号车间的大车间分类不一致')
 if plan['status']!='active' or not emp['active']: raise APIError('请先启用考试和员工')
 pool=shared_banks.pool_data(c,globals(),plan['position_id'])
 if pool['duplicate_bank_bindings']: raise APIError('同一岗位重复启用了同一个作业题库，请联系管理员合并岗位作业绑定',409)
 items,pools=pool['items'],pool['pools']
 limit=EXAM_QUESTION_COUNT
 if not items: raise APIError('该岗位尚未配置启用的作业项目')
 if len(items)>limit: raise APIError(f'该岗位启用了 {len(items)} 个作业项目，{limit} 道题无法覆盖，请先调整作业项目')
 total=sum(map(len,pools.values()))
 if not total: raise APIError('该岗位尚无启用的有效题目，请补充并启用题目后再分配')
 empty=[items[key]['name'] for key,pool in pools.items() if not pool]
 if empty: raise APIError('以下作业项目没有可用题目：'+'、'.join(empty)+'；请补充并启用题目后再分配')
 count=min(limit,total)
 rng=secrets.SystemRandom(); groups=[]
 for pool in pools.values():
  # Interleave the available dimensions within each operation. The outer loop
  # then balances operations, so a large single-axis bank cannot crowd out
  # either another operation or another available axis.
  axes={dimension:[] for dimension in DIMENSIONS}
  for q in pool:
   q.setdefault('dimension','knowledge'); axes[q['dimension']].append(q)
  axis_pools=[p for p in axes.values() if p]; rng.shuffle(axis_pools)
  for axis in axis_pools: rng.shuffle(axis)
  ordered=[]
  while any(axis_pools):
   for axis in axis_pools:
    if axis: ordered.append(axis.pop())
  groups.append(ordered)
 rng.shuffle(groups)
 selected=[]
 while len(selected)<count:
  for p in groups:
   if p and len(selected)<count: selected.append(p.pop(0))
 rng.shuffle(selected)
 selected=equal_points_snapshot(selected)
 titles=exam_titles(get(c,'workshops',emp['workshop_id']),get(c,'positions',emp['position_id']))
 existing_codes={a.get('exam_code') for a in all_docs(c,'assignments')}
 while True:
  exam_code=''.join(secrets.choice(EXAM_CODE_ALPHABET) for _ in range(10))
  if exam_code not in existing_codes: break
 a={'id':uid(),'plan_id':plan['id'],'employee_id':emp['id'],'status':'assigned','token':secrets.token_urlsafe(32),'exam_code':exam_code,'score':None,'max_score':100,'percent':None,'started_at':None,'submitted_at':None,'created_at':now(),'employee_name':emp['name'],'language':emp.get('language','zh'),'plan_title':plan['title'],'plan_title_id':titles['title_id'],'scoring_policy':'equal-up-to-50-v1','details':{'questions':selected,'answers':{},'grades':{},'duration_minutes':plan['duration_minutes'],'pass_score':plan['pass_score'],'position_id':plan['position_id']}}
 return a

def public_exam(a,employee=None):
 public={k:a.get(k) for k in ('id','status','employee_name','plan_title','plan_title_id','scoring_policy','max_score','submission_snapshot_source','client_binding_required','round_id','round_number','round_title','round_title_id','started_at','percent','submitted_at','terminated_at','termination_reason','termination_event')}
 # Classification and weights always come from the employee record. An exam
 # code/link can display them, but a public request cannot change them.
 try: profile=category_profile(employee.get('assessment_category')) if employee else None
 except ValueError: profile=None
 category=next((item for item in EXAM_ASSESSMENT_CATEGORIES if profile and item['key']==profile['key']),None)
 public.update({'assessment_category':profile['key'] if profile else None,
  'assessment_category_label':category['name'] if category else None,
  'assessment_category_label_id':category['name_id'] if category else None,
  'theory_weight':profile['theory_weight'] if profile else None,
  'practical_weight':profile['practical_weight'] if profile else None})
 public['server_now']=now()
 public.update(screen_switch_state(a))
 public['draft_sync']=public_draft_sync(a)
 public['client_bound']=public['draft_sync']['client_bound']
 public['submission_review_required']=bool(a.get('submission_review_required'))
 public['submission_review_reason']=a.get('submission_review_reason')
 if a['status']=='in_progress' and isinstance(a['details'].get('draft_answers'),dict):
  public['draft_answers']=a['details']['draft_answers']
 public['duration_minutes']=a['details']['duration_minutes']
 public['language']=a.get('language','zh'); public['question_count']=len(a['details']['questions']); public['timed_out']=a.get('timed_out',False)
 if a['started_at']: public['deadline']=datetime.fromtimestamp(datetime.fromisoformat(a['started_at']).timestamp()+public['duration_minutes']*60,timezone.utc).isoformat()
 questions=[] if a['status']=='assigned' else [{k:q.get(k,'knowledge' if k=='dimension' else None) for k in ('id','work_item_id','type','dimension','title_zh','title_id','options','points')} for q in a['details']['questions']]
 return {'assignment':public,'questions':questions}

def public_exam_context(c,a):
 employee=effective_employee(c,get(c,'employees',a['employee_id'],False))
 result=public_exam(a,employee)
 if employee and not result['assignment'].get('plan_title_id'):
  workshop=get(c,'workshops',employee.get('workshop_id'),False)
  position=get(c,'positions',employee.get('position_id'),False)
  if workshop and position: result['assignment']['plan_title_id']=exam_titles(workshop,position)['title_id']
 return result

def find_token(c,token):
 if not token or len(token)>100 or not token.isascii() or any(not (ch.isalnum() or ch in '-_') for ch in token): raise APIError('考试入口无效',404)
 for a in all_docs(c,'assignments'):
  if hmac.compare_digest(a['token'],token): return a
 raise APIError('考试入口无效',404)

def exam_time_key(assignment,fields):
 # Legacy/imported timestamp text is not trusted as a sortable ISO string.
 # Invalid dates fall back to another date or the stable record ID.
 for field in fields:
  value=assignment.get(field)
  if not isinstance(value,str): continue
  try:
   parsed=datetime.fromisoformat(value)
   if parsed.tzinfo is None: parsed=parsed.replace(tzinfo=timezone.utc)
   return (parsed.timestamp(),str(assignment.get('id','')))
  except (ValueError,OverflowError,OSError): continue
 return (0,str(assignment.get('id','')))

def register_exam_entry(c,body,ip):
 """Create a fresh exam using the entered employee number and exact profile.

 Only an unguessable request key can resume an existing registration. Reusing
 a number requires the complete matching profile and an unused open round;
 neither names nor employee numbers disclose an older exam link.
 The caller holds LOCK; the savepoint also makes direct callers atomic.
 """
 if not isinstance(body,dict): raise APIError('请求内容必须为对象 / Data permintaan tidak valid.')
 raw_name=body.get('name')
 if not isinstance(raw_name,str) or any(unicodedata.category(ch) in ('Cc','Cf','Cs') for ch in raw_name):
  raise APIError('姓名不能包含控制字符 / Nama tidak boleh memuat karakter kontrol.')
 name=raw_name.strip()
 if not 1<=len(name)<=100:
  raise APIError('请填写 1–100 个字符的姓名 / Masukkan nama sepanjang 1–100 karakter.')
 raw_employee_no=body.get('employee_no')
 if not isinstance(raw_employee_no,str) or any(unicodedata.category(ch) in ('Cc','Cf','Cs') for ch in raw_employee_no):
  raise APIError('请填写有效工号，不能包含控制字符 / Masukkan nomor karyawan yang valid tanpa karakter kontrol.')
 employee_no=raw_employee_no.strip()
 if not 1<=len(employee_no)<=100:
  raise APIError('请填写 1–100 个字符的工号 / Masukkan nomor karyawan sepanjang 1–100 karakter.')
 wid=strval(body.get('workshop_id',''),'车间 / Unit kerja',200,True)
 pid=strval(body.get('position_id',''),'岗位 / Posisi',200,True)
 category=body.get('assessment_category'); language=body.get('language','zh')
 if category not in ('operator','leader'):
  raise APIError('请选择人员类别 / Pilih kategori karyawan.')
 position=get(c,'positions',pid,False)
 category_override=position_assessment_category(position,'')
 category=position_assessment_category(position,category)
 if language not in ('zh','id'):
  raise APIError('请选择中文或印尼语 / Pilih bahasa Mandarin atau Indonesia.')
 key=body.get('request_key')
 if not isinstance(key,str) or not 32<=len(key)<=200 or not key.isascii() or any(not (ch.isalnum() or ch in '-_') for ch in key):
  raise APIError('报名请求标识无效，请刷新页面 / Identitas pendaftaran tidak valid. Muat ulang halaman.')
 key_hash=hashlib.sha256(key.encode()).hexdigest()
 # Display-language changes do not turn an in-flight retry into a new person.
 # The saved employee and frozen assignment keep their original language.
 identity_hash=hashlib.sha256(dumps([name,employee_no,wid,pid,category]).encode()).hexdigest()
 # A pre-policy registration may have frozen the old manually chosen leader
 # category. Only this position's forced category may differ on a retry;
 # the request capability and every other identity field must still match.
 retry_identity_hashes=[identity_hash]
 if category_override:
  retry_identity_hashes.append(hashlib.sha256(dumps([name,employee_no,wid,pid,'leader']).encode()).hexdigest())
 prior=c.execute('SELECT identity_hash,assignment_id FROM exam_registrations WHERE request_key_hash=?',(key_hash,)).fetchone()
 if prior:
  if not any(hmac.compare_digest(prior['identity_hash'],candidate) for candidate in retry_identity_hashes):
   raise APIError('报名信息已改变，请重新进入 / Data pendaftaran berubah. Silakan masuk kembali.',409)
  assigned=get(c,'assignments',prior['assignment_id'],False)
  if not assigned:
   raise APIError('本次报名已失效，请重新报名 / Pendaftaran ini tidak berlaku lagi. Silakan daftar kembali.',409)
  if body.get('round_id') is not None and assigned.get('round_id')!=body['round_id']:
   raise APIError('本次进入标识属于另一轮考试，请刷新后重试 / Identitas ini milik putaran lain. Muat ulang dan coba lagi.',409)
  return '/take/'+assigned['token']
 workshop=get(c,'workshops',wid,False); position=get(c,'positions',pid,False)
 if not workshop or not position or not position_in_workshop(position,workshop):
  raise APIError('车间与岗位不匹配，请重新选择 / Unit kerja dan posisi tidak sesuai. Pilih kembali.')
 round_=choose_open_round(c,globals(),wid,pid)
 if not round_:
  raise APIError('该车间岗位尚未开放考试，请联系管理员 / Ujian belum dibuka untuk unit kerja dan posisi ini. Hubungi administrator.',409)
 requested_round=body.get('round_id')
 if requested_round is not None and requested_round!=round_['id']:
  raise APIError('考试轮次已更新，请刷新后重新选择 / Putaran ujian telah berubah. Muat ulang dan pilih kembali.',409)
 number_key=normalized_employee_no(employee_no)
 prior_attempt=c.execute('SELECT assignment_id FROM exam_round_attempts WHERE round_id=? AND employee_no_key=?',(round_['id'],number_key)).fetchone()
 if prior_attempt:
  raise APIError('本工号已进入本轮考试，请使用原考试页面；下一轮开放后可再次考试 / Nomor karyawan ini sudah mengikuti putaran ini. Gunakan halaman ujian semula; ujian baru tersedia pada putaran berikutnya.',409)
 plan=virtual_plan(round_,pid,workshop,position)
 current=time.time()
 for address,attempts in list(EXAM_REGISTRATION_CREATES.items()):
  recent=[stamp for stamp in attempts if stamp>current-60]
  if recent: EXAM_REGISTRATION_CREATES[address]=recent
  else: EXAM_REGISTRATION_CREATES.pop(address,None)
 attempts=EXAM_REGISTRATION_CREATES.get(ip,[])
 if len(attempts)>=60:
  raise APIError('当前报名人数较多，请一分钟后重试 / Pendaftaran sedang ramai. Coba lagi dalam satu menit.',429)
 matches=[effective_employee(c,employee) for employee in all_docs(c,'employees') if normalized_employee_no(employee.get('employee_no',''))==number_key]
 if matches and (len(matches)!=1 or not matches[0].get('active') or
  any(matches[0].get(field)!=value for field,value in
   (('name',name),('workshop_id',wid),('position_id',pid),('assessment_category',category)))):
  raise APIError('工号与员工信息不一致或不可报名，请核对姓名、车间、岗位和人员类别，或联系车间精益员 / Nomor karyawan tidak sesuai dengan data atau belum dapat didaftarkan. Periksa nama, unit kerja, posisi dan kategori, atau hubungi petugas lean unit kerja.',409)
 existing_employee=matches[0] if matches else None
 employee=existing_employee or validate(c,'employees',{'workshop_id':wid,'position_id':pid,
  'employee_no':employee_no,'name':name,'language':language,
  'assessment_category':category,'active':True})
 if not existing_employee: employee.update({'source':'self_registration','created_at':now()})
 # The chosen language belongs to the new frozen exam. Repeated registration
 # never edits an existing employee profile, its historical scores or language.
 try: assignment=build_validated_assignment(c,plan,dict(employee,language=language))
 except APIError as error:
  raise APIError(error.message+' / Bank soal belum siap. Hubungi petugas lean unit kerja untuk melengkapi soal aktif.',error.status) from None
 assignment.update(source='self_registration',round_id=round_['id'],round_number=round_['round_number'],round_title=round_['title'],round_title_id=round_['title_id'],client_binding_required=True)
 assignment['plan_title_id']=round_['title_id']+' · '+exam_titles(workshop,position)['title_id'].partition(' · ')[2]
 c.execute('SAVEPOINT free_exam_registration')
 try:
  c.execute('INSERT INTO exam_round_attempts VALUES(?,?,?,?,?)',(round_['id'],wid,number_key,assignment['id'],now()))
  if not existing_employee: put(c,'employees',employee)
  put(c,'assignments',assignment)
  c.execute('INSERT INTO exam_registrations VALUES(?,?,?,?,?)',(key_hash,identity_hash,employee['id'],assignment['id'],now()))
  c.execute('RELEASE SAVEPOINT free_exam_registration')
 except sqlite3.IntegrityError:
  c.execute('ROLLBACK TO SAVEPOINT free_exam_registration'); c.execute('RELEASE SAVEPOINT free_exam_registration')
  raise APIError('本工号已经参加本轮考试 / Nomor karyawan ini sudah mengikuti putaran ini.',409) from None
 except Exception:
  c.execute('ROLLBACK TO SAVEPOINT free_exam_registration'); c.execute('RELEASE SAVEPOINT free_exam_registration')
  raise
 if ip not in EXAM_REGISTRATION_CREATES and len(EXAM_REGISTRATION_CREATES)>=EXAM_ENTRY_MAX_IPS:
  oldest=min(EXAM_REGISTRATION_CREATES,key=lambda address:EXAM_REGISTRATION_CREATES[address][-1])
  EXAM_REGISTRATION_CREATES.pop(oldest,None)
 EXAM_REGISTRATION_CREATES[ip]=attempts+[current]
 return '/take/'+assignment['token']

def resolve_exam_entry(c,body,ip):
 # Failed guesses share one short window per address. Keep the in-memory table
 # bounded even when a future deployment receives requests from many addresses.
 current=time.time()
 for address,attempts in list(EXAM_ENTRY_FAILURES.items()):
  recent=[t for t in attempts if t>current-60]
  if recent: EXAM_ENTRY_FAILURES[address]=recent
  else: EXAM_ENTRY_FAILURES.pop(address,None)
 failures=EXAM_ENTRY_FAILURES.get(ip,[])
 if len(failures)>=8: raise APIError('尝试次数过多，请一分钟后重试',429)
 value=body.get('code','') if isinstance(body,dict) else ''
 code=value.strip() if isinstance(value,str) else ''
 valid=bool(code) and len(code)<=100 and code.isascii()
 normalized=''.join(code.upper().split()).replace('-','') if valid else ''
 is_short_code=len(normalized)==10 and all(ch in EXAM_CODE_ALPHABET for ch in normalized)
 if valid:
  for assignment in all_docs(c,'assignments'):
   if hmac.compare_digest(assignment['token'],code) or (is_short_code and hmac.compare_digest(assignment.get('exam_code',''),normalized)):
    return '/take/'+assignment['token']
 if ip not in EXAM_ENTRY_FAILURES and len(EXAM_ENTRY_FAILURES)>=EXAM_ENTRY_MAX_IPS:
  oldest=min(EXAM_ENTRY_FAILURES,key=lambda address:EXAM_ENTRY_FAILURES[address][-1])
  EXAM_ENTRY_FAILURES.pop(oldest,None)
 EXAM_ENTRY_FAILURES[ip]=failures+[current]
 raise APIError('考试码或考试链接无效，请核对后重试 / Kode atau tautan ujian tidak valid. Periksa dan coba lagi.',404)

def exam_options(c):
 result=ready_exam_options(c,globals())
 for position in result['positions']:
  position['assessment_category_override']=position_assessment_category(position,'')
 return result

def safe_login_next(path,query=''):
 # Never put a scheme-relative path, backslash, or control character in a
 # login return location. The frontend checks this again before navigation.
 if not path.startswith('/') or path.startswith('//') or '\\' in path or any(ord(ch)<32 or ord(ch)==127 for ch in path): return '/'
 return path+('?' + query if query else '')

def calc_score(a):
 details=a['details']; pending=False; score=0; previous=a['status']
 for q in details['questions']:
  g=details['grades'].get(q['id'])
  if g is None: pending=True
  else: score+=g
 # Equal fractional points (for example 100/49) must yield exactly 100 on
 # a perfect paper. Keep legacy grading arithmetic unchanged.
 if a.get('scoring_policy')=='equal-up-to-50-v1': score=math.fsum(details['grades'][q['id']] for q in details['questions'] if details['grades'].get(q['id']) is not None)
 a['score']=round(score,6)
 a['percent']=None if pending else round(score/a['max_score']*100,2)
 a['status']='pending_review' if pending else 'completed'
 a['requires_review']=pending
 if not pending and previous!='completed': a['completed_at']=now()
 return a

def clean_exam_answers(a,answers):
 # Shared by ordinary submission and switch drafts: a warning can never save
 # an unvalidated snapshot that is later accepted on refresh.
 if not isinstance(answers,dict): raise APIError('答题格式不正确')
 qs=a['details']['questions']; validids={q['id'] for q in qs}
 if any(qid not in validids for qid in answers): raise APIError('包含本场考试之外的题目')
 cleaned={}
 for q in qs:
  ans=answers.get(q['id'],'' if q['type']=='essay' else [])
  if q['type']=='essay':
   if not isinstance(ans,str) or len(ans)>20000: raise APIError('简答内容格式不正确或过长')
   cleaned[q['id']]=ans.strip()
  else:
   if not isinstance(ans,list) or any(not isinstance(x,str) for x in ans) or len(ans)!=len(set(ans)): raise APIError('选项答案格式不正确')
   if any(x not in {o['key'] for o in q['options']} for x in ans): raise APIError('答案含无效选项')
   if q['type']!='multiple' and len(ans)>1: raise APIError('单选或判断题只能选择一项')
   cleaned[q['id']]=sorted(ans)
 return cleaned

def exam_deadline(a):
 return datetime.fromisoformat(a['started_at']).timestamp()+a['details']['duration_minutes']*60

def public_draft_sync(a):
 metadata={key:value for key,value in (a['details'].get('draft_sync') or {}).items() if key!='client_id'}
 metadata.update(policy=DRAFT_SYNC_POLICY,client_bound=bool(a['details'].get('exam_client_id') or (a['details'].get('draft_sync') or {}).get('client_id')))
 return metadata

def draft_metadata(a):
 return {'assignment_id':a['id'],'status':a['status'],
  'draft_answers':a['details'].get('draft_answers',{}),
  'draft_sync':public_draft_sync(a)}

def valid_exam_client(client):
 return isinstance(client,str) and 16<=len(client)<=128 and client.isascii() and all(ch.isalnum() or ch in '-_' for ch in client)

def assert_exam_client(a,body,*,bind=False):
 if not isinstance(body,dict): raise APIError('答题请求格式不正确')
 client=body.get('client_id')
 owner=a['details'].get('exam_client_id') or (a['details'].get('draft_sync') or {}).get('client_id')
 required=a.get('client_binding_required',False)
 if (required or owner or client is not None) and not valid_exam_client(client):
  raise APIError('答题窗口标识无效，请回到原考试页面 / Identitas halaman tidak valid. Kembali ke halaman ujian semula.',409)
 if owner and client!=owner:
  raise APIError('另一处答题窗口正在使用本场考试，请回到原考试页面 / Ujian ini sedang digunakan di halaman lain. Kembali ke halaman semula.',409)
 if required and not owner and not bind:
  raise APIError('请先在当前窗口开始考试 / Mulai ujian pada halaman ini terlebih dahulu.',409)
 if bind and client: a['details']['exam_client_id']=client
 return client

def start_exam(a,body):
 if a['status'] in ('completed','pending_review','voided'): return a
 assert_exam_client(a,body,bind=True)
 if a['status']=='assigned': a['status']='in_progress'; a['started_at']=now()
 return a

def sync_exam_draft(a,body,received_at=None):
 """Only snapshots received by the server before the deadline can earn marks.

 The ID is shared by a token's browser tabs. Revisions order snapshots across
 refreshes and HTTP retries; a colliding revision is rejected rather than
 silently replacing a different answer sheet. A final assignment is immutable.
 """
 if a['status'] in ('completed','pending_review','voided'):
  return dict(draft_metadata(a),accepted=False,reason='finalized')
 if a['status']!='in_progress': raise APIError('请先开始考试')
 if not isinstance(body,dict): raise APIError('答题草稿格式不正确')
 assert_exam_client(a,body)
 cleaned=clean_exam_answers(a,body.get('answers'))
 client=body.get('client_id'); revision=body.get('revision')
 if not isinstance(client,str) or not 16<=len(client)<=128 or not client.isascii() or any(not(ch.isalnum() or ch in '-_') for ch in client):
  raise APIError('答题同步标识无效，请重新加载考试 / Identitas sinkronisasi tidak valid. Muat ulang ujian.')
 if type(revision) is not int or not 1<=revision<=9007199254740991:
  raise APIError('答题同步版本无效 / Versi sinkronisasi tidak valid.')
 previous=a['details'].get('draft_sync') or {}
 if previous.get('client_id') and previous['client_id']!=client:
  raise APIError('另一处答题页面已同步，请重新加载后继续 / Halaman lain telah disinkronkan. Muat ulang sebelum melanjutkan.',409)
 old_revision=previous.get('revision',0)
 if revision<old_revision: return dict(draft_metadata(a),accepted=False,reason='stale')
 if revision==old_revision:
  if cleaned!=a['details'].get('draft_answers'):
   raise APIError('答题同步版本冲突，请重新加载并核对答案 / Konflik versi jawaban. Muat ulang dan periksa jawaban.',409)
  return dict(draft_metadata(a),accepted=True,reason='unchanged')
 received_at=time.time() if received_at is None else received_at
 if received_at>exam_deadline(a):
  return dict(draft_metadata(a),accepted=False,reason='deadline_passed')
 a['details']['draft_answers']=cleaned
 a['details']['draft_sync']={'client_id':client,'revision':revision,
  'saved_at':datetime.fromtimestamp(received_at,timezone.utc).isoformat(timespec='microseconds')}
 return dict(draft_metadata(a),accepted=True,reason='saved')

def authoritative_exam_answers(a,body,received_at=None):
 """Choose an ordered snapshot for submit and the third screen switch."""
 cleaned=clean_exam_answers(a,body.get('answers'))
 received_at=time.time() if received_at is None else received_at
 if received_at>exam_deadline(a):
  a['timed_out']=True
  saved=a['details'].get('draft_answers')
  if isinstance(saved,dict):
   a['submission_snapshot_source']='server_draft'
   return clean_exam_answers(a,saved)
  # Retain delayed evidence privately for an explicit, audited human decision.
  # It must never silently become a 0-mark completed exam or count as marks.
  a['submission_review_required']=True
  a['submission_review_reason']='deadline_without_server_snapshot'
  a['details']['late_submission_evidence']={'answers':cleaned,'received_at':now(),
   'reason':'deadline_without_server_snapshot'}
  return None
 if 'client_id' in body or 'revision' in body:
  result=sync_exam_draft(a,body,received_at)
  if result['reason']=='stale':
   a['submission_snapshot_source']='server_draft'
   return clean_exam_answers(a,a['details']['draft_answers'])
  a['submission_snapshot_source']='submission'
  return clean_exam_answers(a,a['details']['draft_answers'])
 # Compatibility for already-open legacy clients. A synchronized newer sheet
 # always wins; an unversioned stale switch must not overwrite it.
 if a['details'].get('draft_sync'):
  a['submission_snapshot_source']='server_draft'
  return clean_exam_answers(a,a['details']['draft_answers'])
 a['submission_snapshot_source']='submission'
 return cleaned

def finalize_exam_answers(a,cleaned):
 qs=a['details']['questions']; a['details']['answers']=cleaned; grades={}
 for q in qs:
  ans=cleaned[q['id']]
  grades[q['id']]=(None if ans else 0) if q['type']=='essay' else (q['points'] if set(ans)==set(q['correct_answer']) else 0)
 a['details']['grades']=grades
 a['details'].pop('draft_answers',None)
 a['submitted_at']=now()
 return calc_score(a)

def submit_exam(a,body,received_at=None):
 if a['status'] in ('completed','pending_review','voided'): return a
 if a['status']!='in_progress': raise APIError('请先开始考试')
 if not isinstance(body,dict): raise APIError('答题格式不正确')
 assert_exam_client(a,body)
 cleaned=authoritative_exam_answers(a,body,received_at)
 if cleaned is None:
  a['status']='pending_review'; a['requires_review']=True
  a['score']=None; a['percent']=None; a['submitted_at']=now()
  a['details']['answers']={}; a['details']['grades']={}
  return a
 return finalize_exam_answers(a,cleaned)

def review_late_submission(a,body,user):
 if not a.get('submission_review_required') or a['status']!='pending_review':
  raise APIError('本场考试没有待复核的同步异常',409)
 if not isinstance(body,dict): raise APIError('复核内容不正确')
 decision=body.get('decision')
 if decision not in ('accept_evidence','require_retest'):
  raise APIError('请选择接纳迟到答卷或安排补考')
 note=strval(body.get('note',''),'复核说明',2000,True)
 evidence=a['details'].get('late_submission_evidence')
 if not isinstance(evidence,dict): raise APIError('迟到答卷证据不存在，请安排补考',409)
 submitted_at=a.get('submitted_at')
 if decision=='accept_evidence':
  finalize_exam_answers(a,clean_exam_answers(a,evidence.get('answers')))
  a['submission_snapshot_source']='reviewed_late_evidence'
 else:
  # A rejected anomalous attempt stays in the record without yielding a moon.
  a['status']='voided'; a['score']=None; a['percent']=None; a['requires_review']=False
 a['submitted_at']=submitted_at
 a['reviewed_at']=now()
 a['submission_review_required']=False
 a['submission_review']={'decision':decision,'note':note,'reviewed_at':now(),'reviewed_by':user['id']}
 return a

def screen_switch_state(a):
 return {'screen_switch_count':a.get('screen_switch_count',0),
  'screen_switch_limit':SCREEN_SWITCH_LIMIT,'screen_switch_policy':SCREEN_SWITCH_POLICY,
  'screen_switch_event_ids':[event['id'] for event in a.get('screen_switch_events',[])]}

def switch_exam(a,body,legacy=False,received_at=None):
 # The handler holds LOCK and its database transaction from token lookup through
 # this mutation. IDs belong to the exam; a retry cannot count or rewrite twice.
 if a['status'] in ('completed','pending_review','voided'): return a
 if a['status']!='in_progress': raise APIError('请先开始考试')
 if not isinstance(body,dict): raise APIError('切屏记录格式不正确')
 assert_exam_client(a,body)
 if (legacy or 'reason' in body) and body.get('reason')!='screen_switch': raise APIError('考试结束原因不正确')
 event=body.get('event')
 if not isinstance(event,str) or event not in EXAM_TERMINATION_EVENTS: raise APIError('考试结束事件不正确')
 event_id=body.get('event_id',LEGACY_SWITCH_EVENT_ID if legacy else None)
 if not isinstance(event_id,str) or not 16<=len(event_id)<=128 or not event_id.isascii() or any(not(ch.isalnum() or ch in '-_') for ch in event_id):
  raise APIError('切屏事件编号格式不正确')
 events=a.get('screen_switch_events',[])
 if any(item['id']==event_id for item in events): return a
 received_at=time.time() if received_at is None else received_at
 recorded={'id':event_id,'type':event,'recorded_at':now()}
 count=len(events)+1
 # Snapshots on warnings are drafts only. Invalid drafts are discarded while
 # the server still records the actual switch, rather than making it invisible.
 if count<SCREEN_SWITCH_LIMIT:
  if 'client_id' in body or 'revision' in body:
   try: sync_exam_draft(a,body,received_at)
   except APIError: pass
  elif not a['details'].get('draft_sync') and received_at<=exam_deadline(a):
   try: draft=clean_exam_answers(a,body.get('answers',{}))
   except APIError: draft=None
   if draft is not None: a['details']['draft_answers']=draft
 else:
  try: submit_exam(a,body,received_at)
  except APIError:
   # A bad third snapshot must not keep the exam open, or partially score it.
   fallback={'answers':a['details'].get('draft_answers',{})}
   owner=a['details'].get('exam_client_id') or (a['details'].get('draft_sync') or {}).get('client_id')
   if owner: fallback.update(client_id=owner,revision=(a['details'].get('draft_sync') or {}).get('revision',0)+1)
   submit_exam(a,fallback,received_at)
   a['snapshot_rejected']=True
  a['termination_reason']='screen_switch'; a['termination_event']=event; a['terminated_at']=now()
 a['screen_switch_events']=[*events,recorded]
 a['screen_switch_count']=count; a['screen_switch_policy']=SCREEN_SWITCH_POLICY
 return a

def terminate_exam(a,body):
 # Compatibility with existing clients: their several lifecycle signals use one
 # fixed ID unless they explicitly supply an ID. There is no immediate-end path.
 return switch_exam(a,body,legacy=True)

def public_exam_result(a,event_id=None):
 result={k:a.get(k) for k in ('status','score','max_score','percent','requires_review','timed_out','terminated_at','termination_reason','termination_event','submission_review_required','submission_review_reason','submission_snapshot_source')}
 result['server_now']=now()
 result.update(screen_switch_state(a))
 result['draft_sync']=public_draft_sync(a)
 if event_id is not None:
  result['event_id']=event_id
  result['warning']=a['status']=='in_progress' and result['screen_switch_count']<SCREEN_SWITCH_LIMIT
 return result

def position_in_workshop(position,workshop):
 if position.get('major_workshop_id')=='major-demo-support':
  return bool(position.get('workshop_id')) and position['workshop_id']==workshop['id'] and workshop.get('major_workshop_id')=='major-demo-support'
 if position.get('major_workshop_id'): return position['major_workshop_id']==workshop.get('major_workshop_id')
 return position.get('workshop_id')==workshop['id']

def latest_completed_assignment(c,user,employee_id):
 exams=[a for a in all_docs(c,'assignments') if a['employee_id']==employee_id and a['status']=='completed' and allowed(c,user,'assignments',a)]
 return max(exams,key=lambda a:exam_time_key(a,('completed_at','graded_at','submitted_at','created_at'))) if exams else None

def valid_theory_percent(exam):
 value=exam.get('percent') if exam else None
 return value if not isinstance(value,bool) and isinstance(value,(int,float)) and 0<=value<=100 else None

def item_theory_percent(exam,item_id):
 questions=[q for q in exam['details']['questions'] if q['work_item_id']==item_id] if exam else []
 if not questions: return None
 score=0; maximum=0
 for question in questions:
  grade=exam['details'].get('grades',{}).get(question['id']); points=question.get('points')
  if isinstance(points,bool) or not isinstance(points,(int,float)) or not points>0: return None
  if isinstance(grade,bool) or not isinstance(grade,(int,float)) or not 0<=grade<=points: return None
  score+=grade; maximum+=points
 return round(score/maximum*100,2) if maximum else None

def practical_record_id(employee_id,work_item_id,assignment_id):
 return hashlib.sha256(dumps([employee_id,work_item_id,assignment_id]).encode('utf-8')).hexdigest()

def practical_history(c,user,query):
 eid=query.get('employee_id',[''])[0]; iid=query.get('work_item_id',[''])[0]; aid=query.get('assignment_id',[''])[0]
 if eid: authorize(c,user,'employees',get(c,'employees',eid))
 employees={e['id'] for e in all_docs(c,'employees') if allowed(c,user,'employees',e)}
 records=[r for r in all_docs(c,'practical_history') if r['employee_id'] in employees and (not eid or r['employee_id']==eid) and (not iid or r['work_item_id']==iid) and (not aid or r['assignment_id']==aid)]
 if not aid: records.extend(direct_skill_history(c,globals(),user,query)['history'])
 records.sort(key=lambda r:(r['reviewed_at'],r['id']))
 return {'history':records}

def score_practical(c,user,body):
 # This narrow permission must not flow through the general CRUD/grading
 # authorizer: contribution accounts still cannot edit theory questions,
 # change examination records or grade essays.
 if not capabilities(user)['score_practical']: raise APIError('此账号没有现场实操评分权限',403)
 if not isinstance(body,dict): raise APIError('实操评分格式不正确')
 # Work-item configuration, never a browser-supplied mode, selects the rule.
 candidate=get(c,'work_items',strval(body.get('work_item_id',''),'作业项目',200,True))
 if assessment_mode(candidate)=='direct': return score_direct_skill(c,globals(),user,body)
 eid=strval(body.get('employee_id',''),'员工',200,True)
 iid=strval(body.get('work_item_id',''),'作业项目',200,True)
 aid=strval(body.get('assignment_id',''),'理论考试',200,True)
 employee=effective_employee(c,get(c,'employees',eid)); authorize(c,user,'employees',employee)
 item=get(c,'work_items',iid); authorize(c,user,'work_items',item)
 if not employee.get('active',False): raise APIError('停用员工不能进行实操评分')
 if not item.get('active',False): raise APIError('停用作业项目不能进行实操评分')
 if item['position_id']!=employee['position_id']: raise APIError('员工与作业项目必须属于同一岗位')
 exam=latest_completed_assignment(c,user,eid)
 if not exam: raise APIError('请先完成理论考试并等待理论成绩',409)
 if aid!=exam['id']: raise APIError('理论考试已更新，请刷新页面后对最近一次已完成考试评分',409)
 theory_percent=valid_theory_percent(exam)
 if theory_percent is None: raise APIError('本次理论成绩尚未完成，不能进行实操评分',409)
 if not any(q['work_item_id']==iid for q in exam['details']['questions']): raise APIError('本次理论考试未覆盖该作业项目，不能进行实操评分')
 if item_theory_percent(exam,iid) is None: raise APIError('该作业项目尚无已完成的理论成绩，不能进行实操评分')
 try: profile=category_profile(employee.get('assessment_category'))
 except ValueError: raise APIError('员工人员类别无效，请联系管理员设置为类别 A或类别 B')
 if profile is None: raise APIError('请先由管理员设置员工人员类别（类别 A或类别 B），再进行实操评分')
 value=body.get('score')
 if type(value) is not int or not PRACTICAL_MIN<=value<=PRACTICAL_MAX: raise APIError('现场实操评分必须为1至5的整数')
 note=strval(body.get('note',''),'实操评分备注',5000)
 ident=practical_record_id(eid,iid,aid); old=get(c,'practical_scores',ident,False)
 version=rating_rules()['version']
 unchanged=bool(old and old['score']==value and old.get('note','')==note
  and old.get('assessment_category')==profile['key'] and old.get('theory_weight')==profile['theory_weight']
  and old.get('practical_weight')==profile['practical_weight'] and old.get('rule_version')==version)
 # Every scorer must identify the version they read. Missing versions must
 # never turn a stale page into an unconditional overwrite of a newer score.
 expected=body.get('expected_reviewed_at')
 if not isinstance(expected,str): raise APIError('请提供实操评分版本，刷新页面后重新保存')
 if expected!=(old.get('reviewed_at','') if old else '') and not unchanged:
  raise APIError('该项实操评分已被更新，请刷新核对后重新保存',409)
 if unchanged: record=old
 else:
  timestamp=now()
  record={'id':ident,'employee_id':eid,'work_item_id':iid,'assignment_id':aid,'score':value,'note':note,
   'reviewed_at':timestamp,'reviewed_by':user['name'],'reviewer_id':user['id'],
   'created_at':old.get('created_at',timestamp) if old else timestamp,'rule_version':version,
   'assessment_category':profile['key'],'assessment_category_label':profile['label_zh'],
   'theory_weight':profile['theory_weight'],'practical_weight':profile['practical_weight']}
  record['guidance_version']=PRACTICAL_GUIDANCE_VERSION
  record['practical_standard_zh']=item.get('practical_standard_zh','')
  record['practical_standard_id']=item.get('practical_standard_id','')
  put(c,'practical_scores',record)
  put(c,'practical_history',dict(record,id=uid(),practical_id=ident))
 result=matrix(c,user,employee['position_id'],employee['workshop_id'])
 cell=next(cell for row in result['rows'] if row['employee']['id']==eid for cell in row['cells'] if cell['work_item_id']==iid)
 return {'practical':record,'assessment':cell,'unchanged':unchanged}

def score_practical_batch(c,user,body):
 # Keep one transaction for the whole page. The savepoint also protects direct
 # callers that catch a validation error and later commit other pending work.
 if not capabilities(user)['score_practical']: raise APIError('此账号没有现场实操评分权限',403)
 if not isinstance(body,dict) or not isinstance(body.get('scores'),list) or not 1<=len(body['scores'])<=500:
  raise APIError('请提交 1 到 500 条现场实操评分')
 seen=set()
 for index,row in enumerate(body['scores']):
  if not isinstance(row,dict): raise APIError(f'第 {index+1} 条：实操评分格式不正确')
  key=(strval(row.get('employee_id',''),'员工',200,True),strval(row.get('work_item_id',''),'作业项目',200,True))
  if key in seen: raise APIError('同一员工的同一作业项目不能重复提交')
  seen.add(key)
 # Releasing a top-level SQLite savepoint would commit automatically. Start an
 # outer transaction so that only the API handler/caller decides to commit.
 if not c.in_transaction: c.execute('BEGIN')
 savepoint='practical_batch_'+uuid.uuid4().hex
 c.execute('SAVEPOINT '+savepoint)
 try:
  results=[]
  for index,row in enumerate(body['scores']):
   try: results.append(score_practical(c,user,row))
   except APIError as error: raise APIError(f'第 {index+1} 条：{error.message}',error.status) from None
 except BaseException:
  c.execute('ROLLBACK TO SAVEPOINT '+savepoint)
  c.execute('RELEASE SAVEPOINT '+savepoint)
  raise
 c.execute('RELEASE SAVEPOINT '+savepoint)
 unchanged=sum(result['unchanged'] for result in results)
 return {'saved_count':len(results)-unchanged,'unchanged_count':unchanged,'results':results}

def matrix(c,user,position_id,workshop_id=''):
 workshop=None
 if workshop_id:
  workshop=get(c,'workshops',workshop_id); authorize(c,user,'workshops',workshop)
 positions={p['id']:p for p in all_docs(c,'positions') if allowed(c,user,'positions',p)}
 if workshop: positions={key:p for key,p in positions.items() if position_in_workshop(p,workshop)}
 if position_id and position_id not in positions: raise APIError('岗位不存在或无权查看',403)
 items=[dict(i,name_id=work_item_name_id(i),**item_metadata(i)) for i in all_docs(c,'work_items') if i['position_id'] in positions and (not position_id or i['position_id']==position_id)]
 items.sort(key=lambda i:(i['sort_order'],i['name']))
 employees=[effective_employee(c,e) for e in all_docs(c,'employees') if e['position_id'] in positions and allowed(c,user,'employees',e) and (not position_id or e['position_id']==position_id) and (not workshop_id or e['workshop_id']==workshop_id)]
 latest={}; pending_latest={}
 for a in all_docs(c,'assignments'):
  if not allowed(c,user,'assignments',a): continue
  if a['status'] in ('assigned','in_progress','pending_review'):
   pending_key=exam_time_key(a,('submitted_at','started_at','created_at'))
   if a['employee_id'] not in pending_latest or pending_key>pending_latest[a['employee_id']][0]: pending_latest[a['employee_id']]=(pending_key,a)
  if a['status']!='completed': continue
  # Only a finalized exam is evidence. Pending essays cannot replace an older
  # finalized result. Keep ties deterministic across reads and exports.
  key=exam_time_key(a,('completed_at','graded_at','submitted_at','created_at'))
  if a['employee_id'] not in latest or key>latest[a['employee_id']][0]: latest[a['employee_id']]=(key,a)
 rows=[]
 rules=rating_rules()
 practical_records={r['id']:r for r in all_docs(c,'practical_scores')}
 direct_records={r['id']:r for r in all_docs(c,'direct_scores')}
 may_score=capabilities(user)['score_practical']
 for e in employees:
  exam=latest.get(e['id'],(None,None))[1]
  exam_percent=valid_theory_percent(exam)
  assessment_category=e.get('assessment_category') or ''
  try: profile=category_profile(assessment_category)
  except ValueError: profile=None
  category_fields={'assessment_category':assessment_category,
   'assessment_category_label':profile['label_zh'] if profile else None,
   'assessment_category_label_id':profile['label_id'] if profile else None,
   'theory_weight':profile['theory_weight'] if profile else None,
   'practical_weight':profile['practical_weight'] if profile else None}
  grouped={}
  if exam:
   for q in exam['details']['questions']:
    dimension=q.get('dimension','knowledge')
    if dimension not in DIMENSIONS: dimension='knowledge'
    p=grouped.setdefault(q['work_item_id'],{})
    axis=p.setdefault(dimension,{'dimension':dimension,'score':0,'max_score':0,'question_count':0})
    axis['score']+=exam['details']['grades'].get(q['id'],0) or 0
    axis['max_score']+=q['points']; axis['question_count']+=1
  cells=[]
  for item in items:
   if item['position_id']!=e['position_id']: continue
   if assessment_mode(item)=='direct':
    cells.append(direct_skill_cell(e,item,direct_records.get(direct_record_id(e['id'],item['id'])),may_score))
    continue
   axes=grouped.get(item['id'],{}); scores=[]
   for dimension in DIMENSIONS:
    axis=dict(axes.get(dimension,{'dimension':dimension,'score':0,'max_score':0,'question_count':0}))
    axis['score']=round(axis['score'],6); axis['max_score']=round(axis['max_score'],6)
    axis['percent']=round(axis['score']/axis['max_score']*100,2) if axis['max_score'] else None
    scores.append(axis)
   count=sum(axis['question_count'] for axis in scores); total=sum(axis['max_score'] for axis in scores)
   percent=item_theory_percent(exam,item['id'])
   theory_completed_at=(exam.get('completed_at') or exam.get('graded_at') or exam.get('submitted_at')) if exam else None
   assessed=[axis['dimension'] for axis in scores if axis['question_count']]
   pending_exam=pending_latest.get(e['id'],(None,None))[1]
   pending_count=sum(q['work_item_id']==item['id'] for q in pending_exam['details']['questions']) if pending_exam else 0
   practical=practical_records.get(practical_record_id(e['id'],item['id'],exam['id'])) if exam and percent is not None else None
   theory_eligible=bool(percent is not None and exam_percent is not None)
   eligible=bool(theory_eligible and profile)
   practical_score=practical.get('score') if practical and theory_eligible else None
   if type(practical_score) is not int or not PRACTICAL_MIN<=practical_score<=PRACTICAL_MAX: practical_score=None
   practical_percent=practical_score*rules['practical_scale']['percent_multiplier'] if practical_score is not None else None
   final=combined_percent(percent,practical_score,assessment_category) if eligible else None
   if percent is not None and exam_percent is None: assessment_status='theory_pending'
   elif percent is not None and not profile: assessment_status='category_pending'
   elif final is not None: assessment_status='completed'
   elif percent is not None: assessment_status='pending_practical'
   elif count or (not exam and pending_count): assessment_status='theory_pending'
   else: assessment_status='unassessed'
   reviewed_at=practical.get('reviewed_at') if practical and theory_eligible else None
   reviewer=practical.get('reviewed_by') if practical and theory_eligible else None
   assessment_message={
    'unassessed':'本次已完成理论考试尚未覆盖该作业项目，或员工尚未参加理论考试',
    'theory_pending':'理论成绩尚未完成，暂不能进行实操评分',
    'category_pending':'请由管理员设置人员类别（类别 A或类别 B）后再评分和生成月亮图',
    'pending_practical':'等待车间对本次理论考试对应的作业项目进行实操评分',
    'completed':'已按员工当前人员类别的权重生成综合能力等级'}[assessment_status]
   cells.append({'work_item_id':item['id'],**item_metadata(item),'can_score_direct':False,'direct_score':None,'knowledge_percent':percent,'theory_item_percent':percent,
    **category_fields,
    'theory_exam_percent':exam_percent,'theory_completed_at':theory_completed_at,'level':level_for_percent(final),
    'practical_score':practical_score,'practical_percent':practical_percent,'final_percent':final,'composite_percent':final,
    'practical_note':practical.get('note','') if practical and theory_eligible else '',
    'practical_reviewed_at':reviewed_at,'practical_reviewed_by':reviewer,'practical_reviewed_by_name':reviewer,
    'practical_reviewer_id':practical.get('reviewer_id') if practical and theory_eligible else None,
    'practical_reviewed_by_id':practical.get('reviewer_id') if practical and theory_eligible else None,
    'practical_rule_version':practical.get('rule_version') if practical else None,
    'practical_assessment_category':practical.get('assessment_category') if practical else None,
    'practical_theory_weight':practical.get('theory_weight') if practical else None,
    'practical_practical_weight':practical.get('practical_weight') if practical else None,
    'assessment_status':assessment_status,'assessment_message':assessment_message,
    'can_score_practical':bool(may_score and e.get('active',False) and item.get('active',False) and eligible),'practical_eligible':eligible,
    'question_count':count,'dimension_scores':scores,'source':'theory_practical' if final is not None else 'exam' if percent is not None else None,
    'rated_at':reviewed_at,'rule_version':rules['version'],'assignment_id':exam['id'] if exam else None,
    'status':assessment_status,'theory_status':'completed' if percent is not None else 'pending_review' if pending_count else 'unassessed','pending_question_count':pending_count,
    'coverage':{'assessed_dimensions':assessed,'dimension_count':len(assessed),'required_dimensions':len(DIMENSIONS),'complete':len(assessed)==len(DIMENSIONS)},
    'note':practical.get('note','') if practical and theory_eligible else '',
    'reviewed_at':reviewed_at,'reviewed_by':reviewer})
  rows.append({'employee':sanitized('employees',e,user,c),'cells':cells,**category_fields,
   'theory_exam_percent':exam_percent,'latest_assignment_id':exam['id'] if exam else None})
 return {'items':items,'rows':rows,'rating_rules':rules,'direct_rating_rules':direct_rules(),'source':'theory_practical_and_direct' if any(assessment_mode(i)=='direct' for i in items) else 'theory_practical'}

def template_meta():
 """The public edition generates exports without an external workbook."""
 return {'available':False,'message':'使用通用导出功能生成能力矩阵。'}

class Handler(BaseHTTPRequestHandler):
 server_version='MatrixFramework/1.0'
 def setup(self):
  # Bound slow headers, request bodies and disconnected response readers per
  # connection; no socket I/O is ever performed while holding the DB lock.
  self.request.settimeout(getattr(self.server,'network_io_timeout',NETWORK_IO_TIMEOUT))
  super().setup()
 def parse_request(self):
  if not super().parse_request(): return False
  try: self.check_network_access()
  except APIError as error:
   self.close_connection=True
   self.response({'error':error.message},error.status)
   return False
  return True
 def check_network_access(self):
  # Imported test servers that do not configure a policy retain their old behavior.
  networks=getattr(self.server,'lan_networks',None); hosts=getattr(self.server,'lan_hosts',None)
  if networks is not None:
   try: peer=ipaddress.ip_address(self.client_address[0])
   except ValueError: raise APIError('当前网络不在允许访问范围内',403) from None
   if not peer.is_loopback and not any(peer in network for network in networks):
    raise APIError('当前网络不在允许访问范围内',403)
  if hosts is not None:
   values=self.headers.get_all('Host',[])
   if len(values)!=1: raise APIError('访问地址无效，请使用已配置的本机或局域网地址',403)
   value=values[0]
   try:
    if not value or len(value)>255 or any(ord(char)<=32 or ord(char)==127 for char in value) or any(char in value for char in '/\\@?#') or value.endswith(':'):
     raise ValueError
    parsed=urlsplit('//'+value)
    hostname=parsed.hostname
    if not hostname or parsed.username is not None or parsed.password is not None or parsed.path or parsed.query or parsed.fragment: raise ValueError
    if ':' in hostname: hostname=str(ipaddress.IPv6Address(hostname))
    port=parsed.port if parsed.port is not None else 80
    if hostname not in hosts or port!=self.server.server_port: raise ValueError
   except ValueError: raise APIError('访问地址无效，请使用已配置的本机或局域网地址',403) from None
 def log_message(self,fmt,*args):
  # Exam entry tokens and passwords never appear in request logs.
  path=urlsplit(self.path).path
  if path.startswith('/api/take/') or path.startswith('/take/'): path='/take/[private]'
  logging.info('%s %s %s',self.client_address[0],self.command,path)
 def response(self,value,status=200,headers=None):
  data=dumps(value).encode('utf-8'); self.send_bytes(data,'application/json; charset=utf-8',status,headers)
 def send_bytes(self,data,content_type,status=200,headers=None):
  headers=dict(headers or {})
  headers.setdefault('Content-Length',str(len(data)))
  headers.setdefault('Cache-Control','no-store')
  self.queue_response(data,content_type,status,headers)
 def queue_response(self,data,content_type,status,headers):
  packet=(data,content_type,status,dict(headers))
  if getattr(self,'_buffering_response',False):
   self._pending_response=packet
  else: self.write_response(packet)
 def write_response(self,packet):
  data,content_type,status,headers=packet
  self.connection.settimeout(getattr(self.server,'network_io_timeout',NETWORK_IO_TIMEOUT))
  self.send_response(status); self.send_header('Content-Type',content_type)
  self.send_header('X-Content-Type-Options','nosniff'); self.send_header('X-Frame-Options','DENY'); self.send_header('Referrer-Policy','same-origin')
  self.send_header('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'")
  for k,v in headers.items(): self.send_header(k,v)
  self.end_headers()
  if self.command!='HEAD' and status!=304: self.wfile.write(data)
 def send_static_asset(self,file):
  encoding=static_encoding(','.join(self.headers.get_all('Accept-Encoding',[])),file.suffix.lower() in STATIC_TEXT_SUFFIXES)
  stat=file.stat(); identity,compressed=static_representations(str(file),stat.st_mtime_ns,stat.st_ctime_ns,stat.st_size)
  data,etag=compressed if encoding=='gzip' else identity
  requested=self.headers.get('If-None-Match','')
  unchanged=any(tag.strip()=='*' or tag.strip().removeprefix('W/')==etag for tag in requested.split(','))
  headers={'Cache-Control':'public, max-age=0, must-revalidate','Vary':'Accept-Encoding','ETag':etag}
  if not unchanged: headers['Content-Length']=str(len(data))
  if encoding=='gzip': headers['Content-Encoding']='gzip'
  self.queue_response(data,mimetypes.guess_type(file.name)[0] or 'application/octet-stream',304 if unchanged else 200,headers)
 def body(self):
  if getattr(self,'_request_body_ready',False): return self._request_body
  if self.headers.get_all('Transfer-Encoding',[]):
   self.close_connection=True; raise APIError('不支持分块请求',400)
  lengths=self.headers.get_all('Content-Length',[])
  if len(lengths)>1:
   self.close_connection=True; raise APIError('请求长度不正确',400)
  value=lengths[0] if lengths else '0'
  if not value.isascii() or not value.isdigit():
   self.close_connection=True; raise APIError('请求长度不正确',400)
  length=int(value)
  if length>MAX_BODY:
   self.close_connection=True; raise APIError('请求内容过大',413)
  if not length: return {}
  expires=time.monotonic()+getattr(self.server,'network_io_timeout',NETWORK_IO_TIMEOUT)
  chunks=[]; remaining=length
  try:
   while remaining:
    wait=expires-time.monotonic()
    if wait<=0: raise TimeoutError
    self.connection.settimeout(wait)
    chunk=self.rfile.read1(min(65536,remaining))
    if not chunk:
     self.close_connection=True; raise APIError('请求内容不完整，请重试',400)
    chunks.append(chunk); remaining-=len(chunk)
  except (socket.timeout,TimeoutError):
   self.close_connection=True; raise APIError('请求上传超时，请检查网络后重试',408) from None
  finally:
   self.connection.settimeout(getattr(self.server,'network_io_timeout',NETWORK_IO_TIMEOUT))
  try: return json.loads(b''.join(chunks).decode('utf-8'))
  except (ValueError,UnicodeError): raise APIError('JSON 格式不正确')
 def same_origin(self):
  origin=self.headers.get('Origin'); host=self.headers.get('Host','')
  if origin and origin not in ('http://'+host,'https://'+host): raise APIError('拒绝跨站写入请求',403)
  if self.headers.get('Sec-Fetch-Site') in ('cross-site','same-site'): raise APIError('拒绝跨站写入请求',403)
 def user(self,c,required=True):
  cookie=self.headers.get('Cookie',''); token=''
  for part in cookie.split(';'):
   k,sep,v=part.strip().partition('=')
   if sep and k=='matrix_session': token=v
  if token:
   row=c.execute('SELECT user_id FROM sessions WHERE token_hash=? AND expires>?',(hashlib.sha256(token.encode()).hexdigest(),time.time())).fetchone()
   if row:
    u=get(c,'users',row['user_id'],False)
    if u and u['active']: return u
  if required: raise APIError('请先登录',401)
  return None
 def do_HEAD(self): self.handle_request()
 def do_GET(self): self.handle_request()
 def do_POST(self): self.handle_request()
 def do_PUT(self): self.handle_request()
 def do_DELETE(self): self.handle_request()
 def handle_request(self):
  self._pending_response=None; self._buffering_response=True
  self._request_body_ready=False
  try:
   parsed=urlsplit(self.path); path=unquote(parsed.path); query=parse_qs(parsed.query,keep_blank_values=path=='/api/export/matrix.xlsx')
   if self.command not in ('GET','HEAD'): self.same_origin()
   # Read and validate the complete body before entering the serialized business
   # transaction. One stalled uploader cannot block exams or health checks.
   if self.command in ('POST','PUT'):
    self._request_body=self.body(); self._request_body_ready=True
    self._request_received_at=time.time()
   with LOCK,connect() as c:
    if path.startswith('/api/'):
     return self.api(c,path,query)
    if self.command not in ('GET','HEAD'): raise APIError('不支持的请求',405)
    static=ROOT/'static'; asset_path=path.removeprefix('/static/') if path.startswith('/static/') else path.lstrip('/'); file=(static/asset_path).resolve()
    if not file.is_relative_to(static.resolve()): raise APIError('文件不存在',404)
    if path.startswith('/static/') and asset_path not in PUBLIC_STATIC_FILES: raise APIError('文件不存在',404)
    if file.is_file() and file.name!='index.html' and asset_path not in PUBLIC_STATIC_FILES: raise APIError('文件不存在',404)
    if not file.is_file():
     if Path(path).suffix: raise APIError('文件不存在',404)
     file=static/'index.html'
    if not file.is_file(): raise APIError('前端文件尚未就绪',503)
    public_page=path in ('/login','/exam') or (path.startswith('/take/') and len(path.strip('/').split('/'))==2)
    if file.suffix.lower() in ('.html','.htm') and not public_page and not self.user(c,required=False):
     location='/login?next='+quote(safe_login_next(path,parsed.query),safe='')
     return self.send_bytes(b'','text/plain; charset=utf-8',302,{'Location':location})
    if path.startswith('/static/') and file.suffix.lower() in STATIC_PUBLIC_SUFFIXES:
     return self.send_static_asset(file)
    return self.send_bytes(file.read_bytes(),mimetypes.guess_type(file.name)[0] or 'application/octet-stream')
  except APIError as e: self.response({'error':e.message},e.status)
  except (BrokenPipeError,ConnectionResetError,socket.timeout): pass
  except Exception:
   logging.exception('Request failed')
   try: self.response({'error':'服务器处理失败，请重试或联系管理员'},500)
   except (BrokenPipeError,ConnectionResetError,socket.timeout): pass
  finally:
   self._buffering_response=False
   if self._pending_response is not None:
    try: self.write_response(self._pending_response)
    except (BrokenPipeError,ConnectionResetError,socket.timeout): self.close_connection=True
 def api(self,c,path,query):
  method=self.command; body=self.body() if method in ('POST','PUT') else {}
  if path=='/api/health' and method in ('GET','HEAD'): return self.response({'status':'ok','database':'sqlite','framework':True})
  if path=='/api/login' and method=='POST':
   if not isinstance(body,dict): raise APIError('请求内容不正确')
   username=strval(body.get('username',''),'账号',100); password=strval(body.get('password',''),'密码',200)
   key,failures,ip_failures,current=login_failure_state(self.client_address[0],username)
   u=next((u for u in all_docs(c,'users') if u['username'].casefold()==username.casefold() and u['active']),None)
   auth=c.execute('SELECT password_hash FROM credentials WHERE user_id=?',(u['id'],)).fetchone() if u else None
   if not auth or not check_password(password,auth['password_hash']):
    LOGIN_FAILURES[key]=failures+[current]; LOGIN_IP_FAILURES[key[0]]=ip_failures+[current]
    raise APIError('账号或密码错误',401)
   LOGIN_FAILURES.pop(key,None); token=secrets.token_urlsafe(32)
   c.execute('DELETE FROM sessions WHERE expires<?',(time.time(),)); c.execute('INSERT INTO sessions VALUES(?,?,?)',(hashlib.sha256(token.encode()).hexdigest(),u['id'],time.time()+86400)); c.commit()
   return self.response({'user':u},headers={'Set-Cookie':f'matrix_session={token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400'})
  if path=='/api/logout' and method=='POST':
   cookie=self.headers.get('Cookie','')
   for part in cookie.split(';'):
    k,sep,v=part.strip().partition('=')
    if sep and k=='matrix_session': c.execute('DELETE FROM sessions WHERE token_hash=?',(hashlib.sha256(v.encode()).hexdigest(),))
   c.commit(); return self.response({'ok':True},headers={'Set-Cookie':'matrix_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0'})
  if path=='/api/exam/resolve' and method=='POST':
   return self.response({'path':resolve_exam_entry(c,body,self.client_address[0])})
  if path=='/api/exam/register' and method=='POST':
   registered_path=register_exam_entry(c,body,self.client_address[0]); c.commit()
   return self.response({'path':registered_path})
  if path=='/api/exam/options' and method in ('GET','HEAD'): return self.response(exam_options(c))
  if path.startswith('/api/take/'):
   parts=path.strip('/').split('/')
   if len(parts) not in (3,4): raise APIError('接口不存在',404)
   a=find_token(c,parts[2]); action=parts[3] if len(parts)==4 else ''
   if method in ('GET','HEAD') and not action: return self.response(public_exam_context(c,a))
   if method=='POST' and action=='start':
    if a['status']=='assigned' and a.get('round_id'):
     round_=get(c,'exam_rounds',a['round_id'],False)
     if not round_ or round_.get('status')!='open': raise APIError('本轮考试已关闭，无法开始新答卷 / Putaran ujian telah ditutup; ujian baru tidak dapat dimulai.',409)
    start_exam(a,body); put(c,'assignments',a); c.commit()
    return self.response(public_exam_context(c,a))
   if method=='POST' and action=='draft':
    result=sync_exam_draft(a,body,self._request_received_at)
    if result['accepted'] and result['reason']=='saved': put(c,'assignments',a); c.commit()
    return self.response(result)
   if method=='POST' and action=='submit':
    if a['status'] not in ('completed','pending_review','voided'):
     a=submit_exam(a,body,self._request_received_at); put(c,'assignments',a); c.commit()
    return self.response(public_exam_result(a))
   if method=='POST' and action in ('switch','terminate'):
    if a['status'] not in ('completed','pending_review','voided'):
     a=switch_exam(a,body,legacy=action=='terminate',received_at=self._request_received_at); put(c,'assignments',a); c.commit()
    event_id=body.get('event_id',LEGACY_SWITCH_EVENT_ID if action=='terminate' else None) if isinstance(body,dict) else None
    return self.response(public_exam_result(a,event_id))
   raise APIError('接口不存在',404)
  user=self.user(c)
  if path.startswith('/api/exam-rounds/') and path.endswith('/next') and method=='POST':
   parts=path.strip('/').split('/')
   if len(parts)!=4: raise APIError('接口不存在',404)
   old=get(c,'exam_rounds',parts[2]); authorize(c,user,'exam_rounds',old,True,'next')
   result=next_round(c,globals(),old); c.commit(); return self.response(sanitized('exam_rounds',result,user,c),201)
  if path=='/api/me' and method in ('GET','HEAD'): return self.response({'user':user})
  if path=='/api/template' and method in ('GET','HEAD'): return self.response(template_meta())
  if path=='/api/rating-rules' and method in ('GET','HEAD'): return self.response(rating_rules())
  if path=='/api/work-categories' and method in ('GET','HEAD'): return self.response(work_categories.catalog(c,globals(),user))
  if path=='/api/work-categories' and method=='POST':
   category=work_categories.create(c,globals(),user,body); c.commit(); return self.response(category,201)
  if path=='/api/development' and method in ('GET','HEAD'): return self.response(development.report(c,globals(),user,query))
  if path=='/api/exam-record-cleanup' and method in ('GET','HEAD'): return self.response(duplicate_cleanup.preview(c,globals(),user))
  if path=='/api/exam-record-cleanup/settings' and method=='PUT':
   result=duplicate_cleanup.save_settings(c,globals(),user,body); c.commit(); return self.response(result)
  if path=='/api/exam-record-cleanup/apply' and method=='POST':
   result=duplicate_cleanup.apply(c,globals(),user,body); c.commit(); return self.response(result)
  if path=='/api/bootstrap' and method in ('GET','HEAD'):
   out={'user':user,'template':template_meta(),'permissions':capabilities(user),'rating_rules':rating_rules(),'practical_guidance':practical_guidance(),'direct_rating_rules':direct_rules()}
   out['work_categories']=work_categories.catalog(c,globals(),user)
   bank_catalog=shared_banks.catalog(c,globals())
   for kind in COLLECTIONS:
    docs=bank_catalog if kind=='question_banks' else all_docs(c,kind)
    if kind=='users' and user['role']!='admin': docs=[u for u in docs if u['id']==user['id']]
    if kind=='questions' and user['role']=='question_contributor': docs=[q for q in docs if q.get('created_by')==user['id']]
    out[kind]=[sanitized(kind,o,user,c,bank_catalog=bank_catalog) for o in docs if allowed(c,user,kind,o)]
   out['summary']={k:len(out[k]) for k in COLLECTIONS}; out['summary']['completed_exams']=sum(a['status']=='completed' for a in out['assignments'])
   return self.response(out)
  if path=='/api/matrix' and method in ('GET','HEAD'): return self.response(matrix(c,user,query.get('position_id',[''])[0],query.get('workshop_id',[''])[0]))
  if path=='/api/practical' and method in ('GET','HEAD'): return self.response(matrix(c,user,query.get('position_id',[''])[0],query.get('workshop_id',[''])[0]))
  if path=='/api/practical/history' and method in ('GET','HEAD'): return self.response(practical_history(c,user,query))
  if path=='/api/direct/history' and method in ('GET','HEAD'): return self.response(direct_skill_history(c,globals(),user,query))
  if path=='/api/direct/score' and method=='POST':
   result=score_direct_skill(c,globals(),user,body); c.commit(); return self.response(result)
  if path=='/api/direct/score-batch' and method=='POST':
   if not isinstance(body,dict) or not isinstance(body.get('scores'),list): raise APIError('请提交直接评分列表')
   for row in body['scores']:
    if not isinstance(row,dict) or assessment_mode(get(c,'work_items',strval(row.get('work_item_id',''),'技能',200,True)))!='direct': raise APIError('直接评分批次只能包含直接评分技能')
   result=score_practical_batch(c,user,body); c.commit(); return self.response(result)
  if path=='/api/practical/score' and method=='POST':
   result=score_practical(c,user,body); c.commit(); return self.response(result)
  if path=='/api/practical/score-batch' and method=='POST':
   result=score_practical_batch(c,user,body); c.commit(); return self.response(result)
  if path=='/api/matrix/review' and method=='POST':
   raise APIError('能力等级由理论与现场实操综合生成，不能直接修改等级',403)
  if path=='/api/questions/import-preview' and method=='POST':
   return self.response(preview_question_import(c,user,body))
  if path=='/api/questions/import' and method=='POST':
   result=import_questions(c,user,body); c.commit(); return self.response(result,201)
  if path.startswith('/api/export/') and method in ('GET','HEAD'): return self.export(c,user,path,query)
  parts=path.strip('/').split('/')
  if len(parts)<2 or parts[0]!='api' or parts[1] not in COLLECTIONS: raise APIError('接口不存在',404)
  kind=parts[1]
  if kind=='assignments' and len(parts)==4 and parts[3] in ('delete-preview','delete-record'):
   if user['role']!='admin': raise APIError('仅系统管理员可删除考试记录',403)
   if parts[3]=='delete-preview' and method in ('GET','HEAD'):
    return self.response(exam_record_delete.preview(c,globals(),user,parts[2]))
   if parts[3]=='delete-record' and method=='POST':
    result=exam_record_delete.apply(c,globals(),user,parts[2],body); c.commit(); return self.response(result)
   raise APIError('不支持的请求',405)
  if kind=='assignments' and len(parts)==4 and parts[3]=='review-submission' and method=='POST':
   a=get(c,kind,parts[2]); authorize(c,user,kind,a,True)
   if user['role']!='admin': raise APIError('仅系统管理员可复核迟到答卷',403)
   review_late_submission(a,body,user); put(c,kind,a); c.commit(); return self.response(sanitized(kind,a,user,c))
  if kind=='assignments' and len(parts)==4 and parts[3]=='grade' and method=='POST':
   a=get(c,kind,parts[2]); authorize(c,user,kind,a,True)
   if a.get('submission_review_required'): raise APIError('请先复核答题同步异常，不能直接批改',409)
   if a['status']!='pending_review': raise APIError('仅待批改考试可以评分')
   if not isinstance(body,dict) or not isinstance(body.get('grades'),list) or not body['grades']: raise APIError('请提供评分列表')
   qs={q['id']:q for q in a['details']['questions']}; seen=set()
   for grade in body['grades']:
    if not isinstance(grade,dict): raise APIError('评分格式不正确')
    ident=grade.get('question_id'); q=qs.get(ident)
    if not q or q['type']!='essay' or ident in seen: raise APIError('仅可对本场简答题评分，每题一次')
    seen.add(ident); a['details']['grades'][ident]=number(grade.get('score'),'题目得分',0,q['points'])
   a=calc_score(a); a['graded_at']=now(); a['graded_by']=user['id']; put(c,kind,a); c.commit(); return self.response(a)
  if len(parts)==2 and method=='POST':
   authorize(c,user,kind,write=True,action='create')
   if kind=='assignments': raise APIError('已改为开放考试轮次，不能通过旧考试计划新建答卷 / Gunakan putaran ujian terbuka; rencana lama tidak dapat membuat ujian baru.',410)
   obj=validate(c,kind,body,user=user)
   if kind=='questions': question_authorship(obj,user)
   authorize(c,user,kind,obj,True,'create')
   if kind=='questions': check_question_write(c,obj)
   put(c,kind,obj)
   if kind=='users':
    c.execute('INSERT INTO credentials VALUES(?,?)',(obj['id'],password_hash(body['password'])))
   c.commit(); return self.response(sanitized(kind,obj,user,c),201)
  if len(parts)==3:
   obj=get(c,kind,parts[2]); authorize(c,user,kind,obj,method not in ('GET','HEAD'),method.lower())
   if method in ('GET','HEAD'):
    if kind=='question_banks':
     entries=shared_banks.catalog(c,globals(),banks=[obj])
     if not entries: raise APIError('此题库已作为历史目录保留，请选择岗位题库',410)
     obj=entries[0]
    return self.response(sanitized(kind,obj,user,c))
   if method=='PUT':
    if kind=='assignments': raise APIError('考试记录不能直接修改，请使用批改接口')
    new=validate(c,kind,body,obj,user=user); authorize(c,user,kind,new,True,'put')
    # Relationships already used by history must remain stable.
    relations={'positions':('workshop_id','major_workshop_id'),'work_items':('position_id',),'questions':('work_item_id',),'employees':('position_id','workshop_id'),'plans':('position_id',)}.get(kind,())
    if any((obj.get(relation) or '')!=(new.get(relation) or '') for relation in relations): raise APIError('所属关系不能直接更改，请新建记录')
    if kind=='plans' and workshop_of(c,kind,obj)!=workshop_of(c,kind,new): raise APIError('所属关系不能直接更改，请新建记录')
    if kind=='questions': check_question_write(c,new,obj)
    put(c,kind,new)
    if kind=='users' and body.get('password'):
     c.execute('UPDATE credentials SET password_hash=? WHERE user_id=?',(password_hash(body['password']),obj['id']))
    if kind=='users' and (body.get('password') or any(obj.get(key)!=new.get(key) for key in ('active','role','workshop_id','username'))):
     c.execute('DELETE FROM sessions WHERE user_id=?',(obj['id'],))
    c.commit(); return self.response(sanitized(kind,new,user,c))
   if method=='DELETE':
    self.delete(c,user,kind,obj); c.commit(); return self.response({'ok':True})
  raise APIError('不支持的请求',405)
 def delete(self,c,user,kind,obj):
  ident=obj['id']
  if kind=='work_items' and shared_banks.has_questions(c,globals(),obj): raise APIError('该岗位作业关联的共用题库已有题目，请停用并保留历史，不要删除',409)
  if kind=='questions' and obj.get('merged_into_question_id'): raise APIError('已归并的题目须保留追溯，不能删除',409)
  if kind=='questions' and any(q.get('merged_into_question_id')==ident for q in all_docs(c,'questions')): raise APIError('该题是归并后的主题，已有副本关联；请归档并保留追溯，不要删除',409)
  if kind=='exam_rounds': raise APIError('考试轮次须保留追溯，请关闭而不要删除',409)
  if kind=='users':
   if ident==user['id']: raise APIError('不能删除当前登录账号')
   if obj['role']=='admin' and obj['active'] and not any(u['id']!=ident and u['role']=='admin' and u['active'] for u in all_docs(c,'users')): raise APIError('至少保留一个启用的系统管理员')
   c.execute('DELETE FROM credentials WHERE user_id=?',(ident,)); c.execute('DELETE FROM sessions WHERE user_id=?',(ident,))
  if kind=='assignments':
   exam_record_delete.delete_unstarted(c,globals(),user,obj); return
  refs={'workshops':[('positions','workshop_id'),('employees','workshop_id'),('users','workshop_id')], 'positions':[('work_items','position_id'),('employees','position_id'),('plans','position_id')], 'work_items':[('questions','work_item_id'),('reviews','work_item_id'),('practical_scores','work_item_id'),('practical_history','work_item_id'),('direct_scores','work_item_id'),('direct_history','work_item_id')], 'employees':[('assignments','employee_id'),('reviews','employee_id'),('practical_scores','employee_id'),('practical_history','employee_id'),('direct_scores','employee_id'),('direct_history','employee_id')], 'plans':[('assignments','plan_id')]}
  for child,key in refs.get(kind,[]):
   if any(x.get(key)==ident for x in all_docs(c,child)): raise APIError('记录已有下级数据或评价，请先处理关联记录')
  if kind in ('work_items','questions'):
   for a in all_docs(c,'assignments'):
    if any((q['work_item_id'] if kind=='work_items' else q['id'])==ident for q in a['details']['questions']): raise APIError('记录已用于考试，请停用或归档以保留追溯')
  c.execute('DELETE FROM documents WHERE collection=? AND id=?',(kind,ident))
 def export(self,c,user,path,query):
  kind=path.rsplit('/',1)[-1]
  if kind=='matrix.xlsx':
   wid=query.get('workshop_id',[''])[0].strip()
   if not wid: raise APIError('请先选择要导出的车间')
   workshop=get(c,'workshops',wid); authorize(c,user,'workshops',workshop)
   if 'employee_ids' in query:
    # An explicit but empty selection must never fall back to exporting the
    # whole workshop.  Repeated parameters and comma-separated IDs both keep
    # the user's selected order and reject malformed/duplicate IDs.
    selected=[ident.strip() for value in query['employee_ids'] for ident in value.split(',')]
    if not selected or any(not ident for ident in selected): raise APIError('请至少勾选一名员工后导出')
    if len(selected)!=len(set(selected)): raise APIError('所选员工不能重复')
    if len(selected)>2000: raise APIError('单次最多导出2000名员工')
    pid=query.get('position_id',[''])[0].strip()
    if not pid: raise APIError('按所选员工导出时必须选择岗位')
    position=get(c,'positions',pid); authorize(c,user,'positions',position)
    if not position_in_workshop(position,workshop): raise APIError('所选岗位不属于该车间')
    for ident in selected:
     employee=get(c,'employees',ident); authorize(c,user,'employees',employee)
     if employee['workshop_id']!=wid: raise APIError('所选员工不属于要导出的车间',403)
     if employee['position_id']!=pid: raise APIError('所选员工不属于要导出的岗位')
    result=matrix(c,user,pid,wid); row_by_id={row['employee']['id']:row for row in result['rows']}
    if any(ident not in row_by_id for ident in selected): raise APIError('部分所选员工已更新，请刷新后重新选择',409)
    result['rows']=[row_by_id[ident] for ident in selected]
    content=build_selected_template_xlsx(workshop,export_matrix_entries([{'position':position,'matrix':result}]),now())
   else:
    # Keep the established whole-workshop detail export for existing links.
    positions=[p for p in all_docs(c,'positions') if position_in_workshop(p,workshop) and allowed(c,user,'positions',p)]
    positions.sort(key=lambda p:(p['name'],p['id']))
    entries=[{'position':p,'matrix':matrix(c,user,p['id'],wid)} for p in positions]
    reviewers={u['id']:u.get('name') or u.get('username','') for u in all_docs(c,'users')}
    content=build_workshop_xlsx(workshop,export_matrix_entries(entries),now(),reviewers)
   filename=''.join(ch for ch in workshop['name'] if ch.isprintable() and ch not in '/\\')[:100]+'能力矩阵.xlsx'
   return self.send_bytes(content,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',headers={'Content-Disposition':"attachment; filename=\"workshop-matrix.xlsx\"; filename*=UTF-8''"+quote(filename,safe='')})
  pid=query.get('position_id',[''])[0]
  wid=query.get('workshop_id',[''])[0]
  if wid: authorize(c,user,'workshops',get(c,'workshops',wid))
  if pid: authorize(c,user,'positions',get(c,'positions',pid))
  stream=io.StringIO(newline=''); writer=csv.writer(stream)
  if kind=='questions.csv':
   if not capabilities(user)['export_question_answers']: raise APIError('此账号不能导出题库答案',403)
   writer.writerow(['id','岗位','作业项目','type','dimension','title_zh','title_id','options','correct_answer','reference_answer_zh','reference_answer_id','points','status'])
   bank_catalog=shared_banks.catalog(c,globals())
   positions={p['id']:p for p in all_docs(c,'positions')}
   for q in all_docs(c,'questions'):
    if not allowed(c,user,'questions',q): continue
    if q.get('merged_into_question_id'): continue
    item=get(c,'work_items',q['work_item_id']); pos=get(c,'positions',item['position_id'])
    metadata=shared_banks.question_metadata(c,globals(),q,catalogue=bank_catalog)
    if pid and pid not in metadata['applicable_position_ids']: continue
    names='、'.join(positions[ident]['name'] for ident in metadata['applicable_position_ids'] if ident in positions)
    writer.writerow([q['id'],names or pos['name'],item['name'],q['type'],q.get('dimension','knowledge'),q['title_zh'],q['title_id'],dumps(q['options']),dumps(q['correct_answer']),q['reference_answer_zh'],q['reference_answer_id'],q['points'],q['status']])
  elif kind=='results.csv':
   writer.writerow(['员工工号','员工姓名','岗位','考试','状态','得分','满分','百分比','开始时间','提交时间'])
   for a in all_docs(c,'assignments'):
    if not allowed(c,user,'assignments',a): continue
    e=get(c,'employees',a['employee_id']); p=get(c,'positions',e['position_id'])
    if wid and e['workshop_id']!=wid: continue
    if pid and p['id']!=pid: continue
    writer.writerow([e['employee_no'],e['name'],p['name'],a['plan_title'],a['status'],a['score'],a['max_score'],a['percent'],a['started_at'],a['submitted_at']])
  elif kind=='matrix.csv':
   m=matrix(c,user,pid,wid); itemnames={i['id']:i['name'] for i in m['items']}
   rules=rating_rules(); dimension_labels={d['key']:d['label_zh'] for d in rules['dimensions']}
   writer.writerow(['工号','姓名','作业项目','理论考试总分百分比','作业项目理论得分百分比','实操评分（1-5）','实操得分百分比','综合得分百分比','综合能力等级','评定状态','题数','维度覆盖']+[dimension_labels[d]+'得分百分比' for d in DIMENSIONS]+['规则版本','实操评分人','实操评分时间','实操备注','理论考试记录ID','当前考核类别','当前理论权重(%)','当前实操权重(%)','原评分考核类别','原评分理论权重(%)','原评分实操权重(%)','原评分规则版本','考核方式','技能分类','直接评分（1-5）','作业类别','作业类别（印尼文）','作业类别ID'])
   status_names={'unassessed':'未考核','theory_pending':'理论待出分','category_pending':'待设置人员类别','pending_practical':'待实操','pending_direct':'待直接评分','completed':'已完成'}
   category_labels={profile['key']:profile['label_zh'] for profile in rules['categories']}
   def weight_percent(value): return round(value*100,2) if isinstance(value,(int,float)) and not isinstance(value,bool) else None
   for row in m['rows']:
    for cell in row['cells']:
     dimension_scores={axis['dimension']:axis['percent'] for axis in cell['dimension_scores']}
     direct=cell['assessment_mode']=='direct'
     writer.writerow([row['employee']['employee_no'],row['employee']['name'],itemnames[cell['work_item_id']],cell['theory_exam_percent'],cell['theory_item_percent'],None if direct else cell['practical_score'],cell['practical_percent'],cell['final_percent'],cell['level'],status_names[cell['assessment_status']],cell['question_count'],'' if direct else f"{cell['coverage']['dimension_count']}/{len(DIMENSIONS)}"]+[dimension_scores.get(d) for d in DIMENSIONS]+[cell['rule_version'],cell['practical_reviewed_by_name'],cell['practical_reviewed_at'],cell['practical_note'],cell['assignment_id'],'' if direct else cell['assessment_category_label'] or '待设置',weight_percent(cell['theory_weight']),weight_percent(cell['practical_weight']),category_labels.get(cell['practical_assessment_category'],cell['practical_assessment_category']),weight_percent(cell['practical_theory_weight']),weight_percent(cell['practical_practical_weight']),cell['practical_rule_version'],cell['assessment_mode_label'],cell['skill_category_label'],cell.get('direct_score'),cell.get('work_category_label',cell['skill_category_label']),cell.get('work_category_label_id',cell.get('skill_category_label_id','')),cell.get('work_category_id','')])
  else: raise APIError('导出不存在',404)
  # Spreadsheet formula injection is blocked on every cell, including user names.
  contents=stream.getvalue(); reader=csv.reader(io.StringIO(contents)); safe=io.StringIO(newline=''); sw=csv.writer(safe)
  for row in reader: sw.writerow(["'"+v if v.lstrip().startswith(('=','+','-','@','\t','\r')) else v for v in row])
  return self.send_bytes(('\ufeff'+safe.getvalue()).encode(),'text/csv; charset=utf-8',headers={'Content-Disposition':f'attachment; filename="{kind}"'})

def parse_server_args(argv=None):
 parser=argparse.ArgumentParser(description='Independent competency framework')
 parser.add_argument('--host',default='127.0.0.1'); parser.add_argument('--port',type=int,default=8897)
 parser.add_argument('--lan',action='store_true',help='显式启用受网段和访问地址限制的局域网试用模式')
 parser.add_argument('--allow-network',action='append',default=[],type=lan_network,metavar='CIDR',help='允许访问的 RFC1918 IPv4 网段，可重复指定')
 parser.add_argument('--allow-all-networks',action='store_true',help='显式允许所有 IPv4 来源网段，仅与 --lan 一起使用；访问地址限制和登录权限保持不变')
 parser.add_argument('--lan-address',action='append',default=[],type=lan_address,metavar='IP',help='本机用于访问的 RFC1918 IPv4 地址，可重复指定')
 args=parser.parse_args(argv)
 if not 1<=args.port<=65535: parser.error('端口必须在 1 至 65535 之间')
 if args.lan:
  if not args.allow_network and not args.allow_all_networks: parser.error('--lan 必须指定至少一个 --allow-network 或显式指定 --allow-all-networks')
  if not args.lan_address: parser.error('--lan 必须指定至少一个 --lan-address')
  if args.host not in LOCAL_HTTP_HOSTS and args.host!='0.0.0.0' and args.host not in args.lan_address:
   parser.error('局域网监听地址只允许 0.0.0.0、本机地址或已列出的 --lan-address')
 elif args.allow_network or args.lan_address or args.allow_all_networks:
  parser.error('--allow-network、--allow-all-networks 和 --lan-address 只能与 --lan 一起使用')
 elif args.host not in LOCAL_HTTP_HOSTS:
  parser.error('默认仅支持本机监听；局域网模式需显式指定 --lan 和访问范围')
 args.lan_networks=((ipaddress.IPv4Network('0.0.0.0/0'),) if args.allow_all_networks else tuple(args.allow_network)) if args.lan else ()
 args.lan_hosts=LOCAL_HTTP_HOSTS | frozenset(args.lan_address if args.lan else ())
 return args

def main():
 args=parse_server_args()
 logging.basicConfig(level=logging.INFO,format='%(asctime)s %(levelname)s %(message)s')
 init_db(); httpd=ThreadingHTTPServer((args.host,args.port),Handler)
 httpd.lan_networks=args.lan_networks; httpd.lan_hosts=args.lan_hosts
 logging.info('Framework ready at http://%s:%s',args.host,args.port)
 try: httpd.serve_forever()
 except KeyboardInterrupt: pass
 finally: httpd.server_close()
if __name__=='__main__': main()
