ALTER TABLE public.machines ADD COLUMN head_commit text;
ALTER TABLE public.machine_jobs ADD COLUMN deadline_at timestamptz NOT NULL DEFAULT now()+interval '20 minutes';
ALTER TABLE public.machine_replays ADD COLUMN signed_bytes text;
CREATE TABLE public.machine_callback_receipts(job_id uuid PRIMARY KEY REFERENCES public.machine_jobs(id),runner_id uuid NOT NULL,payload_digest text NOT NULL,payload_bytes text NOT NULL,result jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.machine_callback_receipts TO service_role;
ALTER TABLE public.machine_callback_receipts ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.machine_author_attempts(id uuid PRIMARY KEY,job_id uuid NOT NULL REFERENCES public.machine_jobs(id),owner_id uuid NOT NULL,request_digest text NOT NULL,status text NOT NULL DEFAULT 'pending',result jsonb,token_reservation integer NOT NULL DEFAULT 14000,created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.machine_author_attempts TO authenticated; GRANT ALL ON public.machine_author_attempts TO service_role;
ALTER TABLE public.machine_author_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY author_attempt_owner ON public.machine_author_attempts FOR SELECT TO authenticated USING(owner_id=auth.uid());
CREATE OR REPLACE FUNCTION public.reserve_author_attempt(p_id uuid,p_job uuid,p_runner uuid,p_lease uuid,p_digest text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE j machine_jobs; r machine_runners; a machine_author_attempts;
BEGIN
 SELECT * INTO j FROM machine_jobs WHERE id=p_job FOR UPDATE; SELECT * INTO r FROM machine_runners WHERE id=p_runner AND active;
 IF j.status<>'leased' OR j.runner_id<>p_runner OR j.lease_token<>p_lease OR j.lease_until<=now() OR j.deadline_at<=now() OR j.kind<>'author' OR r.role<>'author' OR r.owner_id<>j.owner_id OR r.id IS NULL THEN RAISE EXCEPTION 'Inactive owned author lease'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(j.owner_id::text,0));
 SELECT * INTO a FROM machine_author_attempts WHERE id=p_id;
 IF a.id IS NOT NULL THEN IF a.job_id<>p_job OR a.request_digest<>p_digest THEN RAISE EXCEPTION 'Attempt identity conflict'; END IF; RETURN jsonb_build_object('cached',true,'status',a.status,'result',a.result); END IF;
 IF (SELECT count(*) FROM machine_author_attempts WHERE job_id=p_job)>=3 OR (SELECT coalesce(sum(token_reservation),0) FROM machine_author_attempts WHERE owner_id=j.owner_id AND created_at>now()-interval '1 day')+14000>84000 OR EXISTS(SELECT 1 FROM machine_author_attempts WHERE owner_id=j.owner_id AND status='pending') THEN RAISE EXCEPTION 'Author quota or concurrency limit'; END IF;
 INSERT INTO machine_author_attempts(id,job_id,owner_id,request_digest) VALUES(p_id,p_job,j.owner_id,p_digest);
 RETURN jsonb_build_object('cached',false);
END; $$;
REVOKE ALL ON FUNCTION public.reserve_author_attempt(uuid,uuid,uuid,uuid,text) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.reserve_author_attempt(uuid,uuid,uuid,uuid,text) TO service_role;
CREATE OR REPLACE FUNCTION public.heartbeat_machine_job(p_job uuid,p_runner uuid,p_lease uuid) RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE expires timestamptz;
BEGIN UPDATE machine_jobs SET lease_until=least(now()+interval '3 minutes',deadline_at) WHERE id=p_job AND runner_id=p_runner AND lease_token=p_lease AND status='leased' AND lease_until>now() AND deadline_at>now() RETURNING lease_until INTO expires; IF expires IS NULL THEN RAISE EXCEPTION 'Lease cancelled or expired'; END IF; RETURN expires; END; $$;
REVOKE ALL ON FUNCTION public.heartbeat_machine_job(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.heartbeat_machine_job(uuid,uuid,uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.commit_machine_callback(p_job uuid,p_runner uuid,p_lease uuid,p_bytes text,p_digest text,p_payload jsonb,p_signature text,p_patch_digest text,p_recipe_digest text,p_evidence_digest text,p_fail boolean DEFAULT false) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE j machine_jobs; r machine_runners; receipt machine_callback_receipts; cid uuid; c machine_candidates; result jsonb;
BEGIN
 SELECT * INTO j FROM machine_jobs WHERE id=p_job FOR UPDATE;
 SELECT * INTO receipt FROM machine_callback_receipts WHERE job_id=p_job;
 IF receipt.job_id IS NOT NULL THEN IF receipt.runner_id<>p_runner OR receipt.payload_digest<>p_digest OR receipt.payload_bytes<>p_bytes THEN RAISE EXCEPTION 'Callback receipt conflict'; END IF; RETURN receipt.result; END IF;
 SELECT * INTO r FROM machine_runners WHERE id=p_runner AND active;
 IF j.id IS NULL OR r.id IS NULL OR j.kind<>r.role OR j.status<>'leased' OR j.runner_id<>p_runner OR j.lease_token<>p_lease OR j.lease_until<=now() OR j.deadline_at<=now() THEN RAISE EXCEPTION 'Expired cancelled or invalid lease'; END IF;
 IF (p_bytes::jsonb)<>p_payload OR p_payload->>'jobId'<>p_job::text OR p_payload->>'leaseToken'<>p_lease::text OR p_payload->>'status' NOT IN ('completed','failed') THEN RAISE EXCEPTION 'Signed payload mismatch'; END IF;
 IF p_payload->>'status'='completed' THEN
  IF j.kind='author' THEN
   IF r.owner_id<>j.owner_id OR coalesce(p_payload->>'patch','')='' OR p_payload->>'candidateCommit'=j.snapshot->'repository'->>'commit' THEN RAISE EXCEPTION 'Invalid author result'; END IF;
   INSERT INTO machine_candidates(machine_id,job_id,owner_id,author_id,baseline_commit,candidate_commit,patch,patch_digest,recipe_digest,status,provenance) VALUES(j.machine_id,j.id,j.owner_id,r.id::text,j.snapshot->'repository'->>'commit',p_payload->>'candidateCommit',p_payload->>'patch',p_patch_digest,p_recipe_digest,'awaiting_replays',jsonb_build_object('signature',p_signature,'signed_bytes',p_bytes,'author_evidence',p_payload->'evidence','attempts',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'result',result)),'[]') FROM machine_author_attempts WHERE job_id=j.id))) RETURNING id INTO cid;
   INSERT INTO machine_jobs(machine_id,owner_id,kind,snapshot) SELECT j.machine_id,j.owner_id,'verifier',j.snapshot||jsonb_build_object('candidateId',cid,'patch',p_payload->>'patch','patchDigest',p_patch_digest,'recipeDigest',p_recipe_digest,'candidateCommit',p_payload->>'candidateCommit') FROM generate_series(1,2);
  ELSE
   SELECT * INTO c FROM machine_candidates WHERE id=(j.snapshot->>'candidateId')::uuid FOR UPDATE;
   IF c.id IS NULL OR c.owner_id=r.owner_id OR c.author_id=r.id::text OR p_payload->>'candidateCommit'<>c.candidate_commit OR c.patch_digest<>j.snapshot->>'patchDigest' OR c.recipe_digest<>j.snapshot->>'recipeDigest' THEN RAISE EXCEPTION 'Replay snapshot mismatch'; END IF;
   IF EXISTS(SELECT 1 FROM machine_replays WHERE candidate_id=c.id AND owner_id=r.owner_id) THEN RAISE EXCEPTION 'Same owner replay excluded'; END IF;
   INSERT INTO machine_replays(machine_id,candidate_id,runner_id,owner_id,baseline_commit,candidate_commit,patch_digest,recipe_digest,evidence,evidence_digest,signature,signed_payload,signed_bytes,status) VALUES(j.machine_id,c.id,r.id,r.owner_id,c.baseline_commit,c.candidate_commit,c.patch_digest,c.recipe_digest,p_payload->'evidence',p_evidence_digest,p_signature,p_payload,p_bytes,'measured'); cid:=c.id;
  END IF;
 END IF;
 IF p_fail THEN RAISE EXCEPTION 'Injected failure after evidence writes'; END IF;
 UPDATE machine_jobs SET status=p_payload->>'status',finished_at=now(),error=p_payload->>'error' WHERE id=j.id;
 INSERT INTO machine_events(machine_id,job_id,owner_id,kind,message) VALUES(j.machine_id,j.id,j.owner_id,p_payload->>'status',j.kind||' signed callback committed');
 UPDATE machines SET status=CASE WHEN p_payload->>'status'='failed' THEN 'failed' ELSE 'idle' END WHERE id=j.machine_id;
 result:=jsonb_build_object('ok',true,'candidateId',cid);
 INSERT INTO machine_callback_receipts(job_id,runner_id,payload_digest,payload_bytes,result) VALUES(j.id,r.id,p_digest,p_bytes,result); RETURN result;
END; $$;
REVOKE ALL ON FUNCTION public.commit_machine_callback(uuid,uuid,uuid,text,text,jsonb,text,text,text,text,boolean) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.commit_machine_callback(uuid,uuid,uuid,text,text,jsonb,text,text,text,text,boolean) TO service_role;
CREATE OR REPLACE FUNCTION public.publish_machine_generation(p_candidate uuid,p_decision jsonb,p_replays uuid[]) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c machine_candidates; m machines; g machine_generations; parent uuid;
BEGIN
 SELECT * INTO c FROM machine_candidates WHERE id=p_candidate; SELECT * INTO m FROM machines WHERE id=c.machine_id FOR UPDATE;
 SELECT * INTO g FROM machine_generations WHERE candidate_id=c.id; IF g.id IS NOT NULL THEN RETURN to_jsonb(g); END IF;
 IF c.id IS NULL OR p_decision->>'accepted'<>'true' OR cardinality(p_replays)<2 OR (SELECT count(DISTINCT owner_id) FROM machine_replays WHERE id=ANY(p_replays) AND candidate_id=c.id AND owner_id<>c.owner_id AND runner_id::text<>c.author_id)<>cardinality(p_replays) THEN RAISE EXCEPTION 'Independent evidence required'; END IF;
 IF c.baseline_commit<>coalesce(m.head_commit,m.repository->>'commit') THEN RAISE EXCEPTION 'Stale generation baseline'; END IF;
 SELECT id INTO parent FROM machine_generations WHERE machine_id=m.id ORDER BY created_at DESC LIMIT 1;
 INSERT INTO machine_generations(machine_id,candidate_id,parent_id,baseline_commit,candidate_commit,decision) VALUES(m.id,c.id,parent,c.baseline_commit,c.candidate_commit,p_decision) RETURNING * INTO g;
 UPDATE machines SET head_commit=c.candidate_commit,updated_at=now() WHERE id=m.id;
 UPDATE machine_candidates SET status='accepted' WHERE id=c.id; RETURN to_jsonb(g);
END; $$;
REVOKE ALL ON FUNCTION public.publish_machine_generation(uuid,jsonb,uuid[]) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.publish_machine_generation(uuid,jsonb,uuid[]) TO service_role;
DROP POLICY replay_read ON public.machine_replays;
CREATE POLICY replay_machine_owner ON public.machine_replays FOR SELECT TO anon,authenticated USING(EXISTS(SELECT 1 FROM public.machines m WHERE m.id=machine_id AND (m.visibility='public' OR m.owner_id=auth.uid())));