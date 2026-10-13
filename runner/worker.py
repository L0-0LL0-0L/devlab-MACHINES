"""Host coordinator. Untrusted repository commands run only in restricted Docker containers."""
import os,json,time,urllib.request,subprocess,tempfile,hashlib,base64,pathlib,math
from nacl.signing import SigningKey
URL=os.environ['DEVLAB_URL'].rstrip('/')
TOKEN=os.environ['DEVLAB_RUNNER_TOKEN']
KEY=SigningKey(base64.b64decode(os.environ['DEVLAB_SIGNING_KEY']))
IMAGE=os.environ.get('DEVLAB_IMAGE','devlab-sandbox:local')
def canonical(v):
 if isinstance(v,dict):return '{'+','.join(json.dumps(k,ensure_ascii=False)+':'+canonical(v[k]) for k in sorted(v))+'}'
 if isinstance(v,list):return '['+','.join(canonical(x) for x in v)+']'
 if isinstance(v,float):
  if not math.isfinite(v):raise ValueError('Non-finite measurement')
  if v.is_integer():return str(int(v))
 return json.dumps(v,separators=(',',':'),ensure_ascii=False)
def api(path,body):
 req=urllib.request.Request(URL+'/api/public/runner/'+path,data=canonical(body).encode(),headers={'Authorization':'Bearer '+TOKEN,'Content-Type':'application/json'},method='POST')
 with urllib.request.urlopen(req,timeout=30) as r:return json.load(r)
def run(args,**kw):return subprocess.run(args,check=True,capture_output=True,text=True,timeout=240,**kw).stdout
def sandbox(work,command):
 return run(['docker','run','--rm','--network','none','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges','--pids-limit','128','--memory','2g','--cpus','2','--tmpfs','/tmp:rw,noexec,nosuid,size=256m','--tmpfs','/work/.git:rw,noexec,nosuid,size=1m','-v',str(work)+':/work:rw',IMAGE,'sh','-lc',command])
def measure(work,recipe):
 logs=sandbox(work,recipe['command'])
 # Pinned recipe MUST emit one final JSON line. No scraping success from arbitrary logs.
 result=json.loads(logs.strip().splitlines()[-1])
 if not isinstance(result.get('metrics'),dict) or not isinstance(result.get('testsPassed'),bool) or not isinstance(result.get('equivalent'),bool):raise ValueError('Recipe must emit metrics, testsPassed and equivalent')
 return result,logs[-45000:]
def execute(job):
 snap=job['snapshot'];repo=snap['repository'];recipe=snap['recipe']
 import re
 if not re.fullmatch(r'https://github.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+',repo['url']):raise ValueError('Unsafe repository URL')
 with tempfile.TemporaryDirectory(prefix='devlab-') as tmp:
  work=pathlib.Path(tmp)/'repo'
  run(['git','-c','core.hooksPath=/dev/null','clone','--no-checkout',repo['url'],str(work)])
  run(['git','-c','core.hooksPath=/dev/null','checkout','--detach',repo['commit']],cwd=work)
  # The coordinator never runs scripts from the repository, and strips git credentials/hooks.
  os.chmod(tmp,0o755)
  run(['chmod','-R','a+rwX',str(work)])
  base,base_logs=measure(work,recipe)
  run(['git','-c','core.hooksPath=/dev/null','reset','--hard',repo['commit']],cwd=work)
  run(['git','-c','core.hooksPath=/dev/null','clean','-fdx'],cwd=work)
  if job['kind']=='author':
   # Supply a real patch externally; no simulated AI, authoring or success.
   patch_file=os.environ.get('DEVLAB_PATCH_FILE')
   if not patch_file:raise ValueError('Author requires DEVLAB_PATCH_FILE from a real proposed patch')
   patch=pathlib.Path(patch_file).read_text()
  else:patch=snap['patch']
  p=pathlib.Path(tmp)/'candidate.diff';p.write_text(patch)
  run(['git','apply','--check',str(p)],cwd=work);run(['git','apply',str(p)],cwd=work)
  # Candidate hash is deterministic across author and verifier: fixed identity/time/parent.
  run(['git','add','--all'],cwd=work)
  env={**os.environ,'GIT_AUTHOR_NAME':'devlab','GIT_AUTHOR_EMAIL':'machine@devlab.invalid','GIT_COMMITTER_NAME':'devlab','GIT_COMMITTER_EMAIL':'machine@devlab.invalid','GIT_AUTHOR_DATE':'2000-01-01T00:00:00Z','GIT_COMMITTER_DATE':'2000-01-01T00:00:00Z'}
  run(['git','-c','core.hooksPath=/dev/null','commit','-m','devlab candidate'],cwd=work,env=env)
  commit=run(['git','rev-parse','HEAD'],cwd=work).strip()
  cand,cand_logs=measure(work,recipe)
  if job['kind']=='author':return {'patch':patch,'candidateCommit':commit}
  if commit!=snap['candidateCommit']:raise ValueError('Candidate commit mismatch')
  if hashlib.sha256(patch.encode()).hexdigest()!=snap['patchDigest']:raise ValueError('Patch digest mismatch')
  return {'candidateCommit':commit,'evidence':{'testsPassed':base['testsPassed'] and cand['testsPassed'],'equivalent':base['equivalent'] and cand['equivalent'],'baseline':base['metrics'],'candidate':cand['metrics'],'logs':base_logs+'\n--- candidate ---\n'+cand_logs,'environment':run(['docker','image','inspect','--format','{{.Id}}',IMAGE]).strip()}}
while True:
 try:
  job=api('lease',{})['job']
  if not job:time.sleep(10);continue
  result={'jobId':job['id'],'leaseToken':job['lease_token']}
  try:result.update(status='completed',**execute(job))
  except Exception as e:result.update(status='failed',error=str(e)[:1800])
  result['signature']=base64.b64encode(KEY.sign(canonical(result).encode()).signature).decode()
  api('callback',result)
 except Exception as e:
  print('Runner request failed:',type(e).__name__,flush=True);time.sleep(20)
