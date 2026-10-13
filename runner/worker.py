"""Bounded host coordinator. No repository code executes outside restricted Docker."""
import os,json,time,urllib.request,subprocess,tempfile,hashlib,base64,pathlib,math,re,uuid,threading,signal,platform
from nacl.signing import SigningKey

def serialize(value): return json.dumps(value,separators=(',',':'),ensure_ascii=False,allow_nan=False)
def envelope(value,key):
    payload=serialize(value)
    return {'payload':payload,'signature':base64.b64encode(key.sign(payload.encode()).signature).decode()}
def sha(value):return hashlib.sha256(value.encode() if isinstance(value,str) else value).hexdigest()
def safe_path(p,protected=()):
    return bool(re.fullmatch(r'[A-Za-z0-9_./-]+',p)) and not any(x in ('..','.git','') for x in p.split('/')) and not re.search(r'(?:^|/)(?:\.[^/]+|tests?|benchmarks?|harness|fixtures|runner|node_modules|vendor)(?:/|$)|(?:lock|config|secret|credential|Dockerfile|Makefile|package\.json|requirements|\.pem$|\.key$|\.(?:test|spec)\.)',p,re.I) and not any(p==f or p.startswith(f+'/') for f in protected)
def patch_paths(patch,protected):
    if len(patch)>200000 or not patch.startswith('diff --git ') or re.search(r'^(?:GIT binary patch|Binary files|rename |old mode|new mode|new file mode (?!100644$)|deleted file mode)',patch,re.M):raise ValueError('Unsafe patch format')
    paths=[]
    for a,b in re.findall(r'^diff --git a/([^\n]+) b/([^\n]+)$',patch,re.M):paths.extend([a,b])
    paths.extend(re.findall(r'^(?:---|\+\+\+) [ab]/([^\n\t]+)',patch,re.M))
    if not paths or any(not safe_path(p,protected) for p in paths):raise ValueError('Protected patch path')
    return set(paths)
def qualifying(base,candidate,recipe):
    c=recipe['calibration']; required=set(c['metrics'])
    for r in (base,candidate):
        if not r.get('testsPassed') or not r.get('equivalent') or r.get('testIdentities')!=c['tests'] or r.get('equivalenceDigest')!=c['equivalenceDigest']:return False
        if set(r.get('metrics',{}))!=required:return False
        for k,v in r['metrics'].items():
            if isinstance(v,bool) or not isinstance(v,(int,float)) or not math.isfinite(v) or not c['metrics'][k]['min']<=v<=c['metrics'][k]['max']:return False
    b=base['metrics'][recipe['metric']];v=candidate['metrics'][recipe['metric']]
    if b<=0:return False
    gain=(b-v if recipe['direction']=='lower' else v-b)/b*100
    return gain>=recipe['improvement'] and all(candidate['metrics'][k]<=base['metrics'][k] for k in recipe['guards'])

class Worker:
    def __init__(self):
        self.url=os.environ['DEVLAB_URL'].rstrip('/');self.token=os.environ['DEVLAB_RUNNER_TOKEN'];self.key=SigningKey(base64.b64decode(os.environ['DEVLAB_SIGNING_KEY']))
        self.deadline=0;self.cancel=threading.Event();self.job=None;self.work=None
    def api(self,path,body,signed=True):
        data=envelope(body,self.key) if signed else body
        req=urllib.request.Request(self.url+'/api/public/runner/'+path,data=serialize(data).encode(),headers={'Authorization':'Bearer '+self.token,'Content-Type':'application/json'},method='POST')
        with urllib.request.urlopen(req,timeout=115 if path=='propose' else 25) as r:
            raw=r.read(400001)
            if len(raw)>400000:raise ValueError('Oversized server response')
            return json.loads(raw)
    def check(self):
        if self.cancel.is_set() or time.monotonic()>self.deadline:raise TimeoutError('Cancelled or hard job deadline exceeded')
        if self.work and self.work.exists() and sum(p.stat().st_size for p in self.work.rglob('*') if p.is_file() and not p.is_symlink())>256000000:raise ValueError('Checkout/output disk limit exceeded')
    def heartbeat(self):
        while not self.cancel.wait(20):
            try:self.api('heartbeat',{'jobId':self.job['id'],'leaseToken':self.job['lease_token']})
            except Exception:self.cancel.set();return
    def run(self,args,cwd=None,env=None,limit=180):
        self.check();safe_env={'PATH':os.environ.get('PATH','/usr/bin:/bin'),'HOME':'/tmp','GIT_CONFIG_NOSYSTEM':'1','GIT_TERMINAL_PROMPT':'0','LC_ALL':'C.UTF-8',**(env or {})}
        with tempfile.TemporaryFile() as out:
            proc=subprocess.Popen(args,cwd=cwd,env=safe_env,stdout=out,stderr=out,start_new_session=True)
            end=min(self.deadline,time.monotonic()+limit)
            try:
                while proc.poll() is None:
                    self.check()
                    if time.monotonic()>end or os.fstat(out.fileno()).st_size>1000000:raise TimeoutError('Command time/output limit')
                    time.sleep(.15)
                if proc.returncode:out.seek(0);raise ValueError(out.read(6000).decode(errors='replace'))
                out.seek(0);return out.read(1000000).decode(errors='replace')
            finally:
                if proc.poll() is None:os.killpg(proc.pid,signal.SIGKILL);proc.wait()
    def git(self,work,*args):return self.run(['git','-c','core.hooksPath=/dev/null','-c','core.fsmonitor=false',*args],cwd=work)
    def apply(self,work,patch,protected):
        paths=patch_paths(patch,protected)
        for path in paths:
            p=work/path
            if p.is_symlink() or any(x.is_symlink() for x in p.parents if x!=work.parent):raise ValueError('Symlink patch blocked')
        with tempfile.NamedTemporaryFile(mode='w',suffix='.diff') as f:
            f.write(patch);f.flush();self.git(work,'apply','--check',f.name);self.git(work,'apply',f.name)
        self.git(work,'add','--all')
        env={ 'GIT_AUTHOR_NAME':'devlab','GIT_AUTHOR_EMAIL':'machine@devlab.invalid','GIT_COMMITTER_NAME':'devlab','GIT_COMMITTER_EMAIL':'machine@devlab.invalid','GIT_AUTHOR_DATE':'2000-01-01T00:00:00Z','GIT_COMMITTER_DATE':'2000-01-01T00:00:00Z'}
        self.run(['git','-c','core.hooksPath=/dev/null','-c','core.fsmonitor=false','commit','-m','devlab candidate'],cwd=work,env=env)
        return self.git(work,'rev-parse','HEAD').strip()
    def restore_chain(self,work,snapshot):
        self.git(work,'checkout','--detach',snapshot['originalCommit'])
        head=snapshot['originalCommit']
        for generation in snapshot.get('chain',[]):
            if generation['baselineCommit']!=head or sha(generation['patch'])!=generation['patchDigest']:raise ValueError('Generation ancestry/digest mismatch')
            head=self.apply(work,generation['patch'],snapshot['recipe']['protectedFiles']+list(snapshot['recipe']['calibration']['harness']))
            if head!=generation['candidateCommit']:raise ValueError('Deterministic accepted commit mismatch')
        if head!=snapshot['repository']['commit']:raise ValueError('Accepted head mismatch')
        return head
    def measure(self,work,recipe):
        c=recipe['calibration']; image=c['image']
        if not re.fullmatch(r'sha256:[a-f0-9]{64}',image):raise ValueError('Immutable image required')
        if platform.machine()!=c['architecture']:raise ValueError('Architecture mismatch')
        for path,expected in c['harness'].items():
            p=work/path
            if p.is_symlink() or not p.is_file() or sha(p.read_bytes())!=expected:raise ValueError('Pinned harness digest mismatch')
        name='devlab-'+uuid.uuid4().hex
        args=['docker','run','--name',name,'--rm','--network','none','--read-only','--user','65534:65534','--cap-drop','ALL','--security-opt','no-new-privileges','--pids-limit','128','--memory','2g','--cpus','2','--tmpfs','/tmp:rw,noexec,nosuid,size=128m','--tmpfs','/work/.git:rw,noexec,nosuid,size=1m','-e','DEVLAB_HOLDOUT_SEED='+c['holdoutSeed'],'-v',str(work)+':/work:rw',image,'sh','-lc',recipe['command']]
        for path in c['harness']:
            args[args.index(image):args.index(image)]=['-v',str(work/path)+':/work/'+path+':ro']
        try:logs=self.run(args,limit=150)
        finally:subprocess.run(['docker','rm','-f',name],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,timeout=15,env={'PATH':os.environ.get('PATH','/usr/bin:/bin')})
        result=json.loads(logs.strip().splitlines()[-1])
        if result.get('toolchain')!=c['toolchain'] or result.get('holdoutSeed')!=c['holdoutSeed'] or result.get('architecture')!=c['architecture']:raise ValueError('Actual harness environment metadata mismatch')
        return result,logs[-35000:]
    def clean(self,work,head):self.git(work,'reset','--hard',head);self.git(work,'clean','-fdx')
    def execute(self,job):
        snap=job['snapshot'];recipe=snap['recipe'];c=recipe.get('calibration')
        if sha(snap['recipeBytes'])!=snap['recipeDigest'] or json.loads(snap['recipeBytes'])!=recipe:raise ValueError('Pinned recipe digest mismatch')
        if not c or not c['harness']:raise ValueError('Calibrated recipe and immutable harness required')
        if not re.fullmatch(r'https://github.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+',snap['repository']['url']):raise ValueError('Unsafe repository URL')
        self.run(['docker','image','inspect',c['image']],limit=15)
        with tempfile.TemporaryDirectory(prefix='devlab-') as tmp:
            work=pathlib.Path(tmp)/'repo';self.work=work;os.chmod(tmp,0o755)
            # Fixed HTTPS transport; no hooks/submodules and bounded checkout.
            self.run(['git','-c','core.hooksPath=/dev/null','-c','http.followRedirects=false','clone','--filter=blob:none','--no-checkout',snap['repository']['url'],str(work)],limit=90)
            head=self.restore_chain(work,snap);self.run(['chmod','-R','a+rwX',str(work)])
            if sum(p.stat().st_size for p in work.rglob('*') if p.is_file() and not p.is_symlink())>256000000:raise ValueError('Checkout exceeds 256 MB')
            base,base_logs=self.measure(work,recipe);self.clean(work,head)
            protected=recipe['protectedFiles']+list(c['harness']);feedback='';manual=os.environ.get('DEVLAB_PATCH_FILE')
            for attempt in range(min(3,max(1,int(os.environ.get('DEVLAB_MAX_ATTEMPTS','3')))) if job['kind']=='author' and not manual else 1):
                self.check();self.clean(work,head)
                if job['kind']=='verifier':patch=snap['patch']
                elif manual:patch=pathlib.Path(manual).read_text()
                else:
                    files=[];total=0
                    for path in sorted(self.git(work,'ls-files').splitlines()):
                        p=work/path
                        if not safe_path(path,protected) or p.is_symlink() or not re.search(r'\.(py|rs|ts|tsx|js|go|c|cpp|java)$',path):continue
                        if p.stat().st_size>18000:continue
                        try:text=p.read_text()
                        except (UnicodeError,OSError):continue
                        if total+len(text)>8000:continue
                        files.append({'path':path,'text':text});total+=len(text)
                        if len(files)>=6:break
                    if not files:raise ValueError('No safe bounded source selected')
                    request={'jobId':job['id'],'leaseToken':job['lease_token'],'attemptId':str(uuid.uuid4()),'files':files,'feedback':feedback[:2000]}
                    response=None
                    for retry in range(3):
                        self.check()
                        try:response=self.api('propose',request);break
                        except Exception:
                            if retry==2:raise
                    if response.get('status')=='pending':raise ValueError('Provider attempt pending; do not duplicate charge')
                    output=response.get('result',{})
                    if not output.get('ok'):feedback=output.get('error','Provider failed');continue
                    patch=output['patch']
                try:
                    commit=self.apply(work,patch,protected);cand,cand_logs=self.measure(work,recipe)
                    if not qualifying(base,cand,recipe):raise ValueError('Actual candidate did not pass calibrated author acceptance')
                    if job['kind']=='verifier' and (commit!=snap['candidateCommit'] or sha(patch)!=snap['patchDigest']):raise ValueError('Replay candidate mismatch')
                    return {'patch':patch,'candidateCommit':commit,'evidence':{'testsPassed':True,'equivalent':True,'baseline':base['metrics'],'candidate':cand['metrics'],'logs':base_logs+'\n--- candidate ---\n'+cand_logs,'environment':c['image'],'architecture':c['architecture'],'toolchain':c['toolchain'],'holdoutSeed':c['holdoutSeed'],'harnessDigest':json.dumps(c['harness'],sort_keys=True,separators=(',',':')),'testIdentities':c['tests'],'baselineEquivalenceDigest':base['equivalenceDigest'],'candidateEquivalenceDigest':cand['equivalenceDigest']}}
                except Exception as e:
                    feedback=str(e)[:5000]
                    if job['kind']=='verifier' or manual:raise
            raise ValueError('Author exhausted three bounded attempts: '+feedback)
    def serve(self):
        while True:
            try:
                job=self.api('lease',{},False)['job']
                if not job:time.sleep(10);continue
                self.job=job;self.deadline=time.monotonic()+min(1000,max(1,int(os.environ.get('DEVLAB_JOB_SECONDS','1000'))),max(0,__import__('datetime').datetime.fromisoformat(job['deadline_at'].replace('Z','+00:00')).timestamp()-time.time()));self.cancel.clear()
                thread=threading.Thread(target=self.heartbeat,daemon=True);thread.start()
                result={'jobId':job['id'],'leaseToken':job['lease_token']}
                try:
                    output=self.execute(job)
                    if job['kind']=='verifier':output.pop('patch',None)
                    result.update(status='completed',**output)
                except Exception as e:result.update(status='failed',error=str(e)[:1800])
                # One immutable payload retry; callback receipts are idempotent.
                for retry in range(3):
                    try:
                        receipt=self.api('callback',result)
                        if receipt.get('judgePending') and receipt.get('candidateId'):self.api('judge',{'candidateId':receipt['candidateId']})
                        break
                    except Exception:
                        if retry==2:raise
                self.cancel.set();thread.join(timeout=30)
            except Exception as e:self.cancel.set();print('Runner failed:',type(e).__name__,flush=True);time.sleep(20)
if __name__=='__main__':Worker().serve()
