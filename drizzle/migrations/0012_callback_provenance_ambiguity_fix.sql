CREATE OR REPLACE FUNCTION public.commit_machine_callback(p_job uuid,p_runner uuid,p_lease uuid,p_bytes text,p_digest text,p_payload jsonb,p_signature text,p_patch_digest text,p_recipe_digest text,p_evidence_digest text,p_fail boolean DEFAULT false) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE j machine_jobs; r machine_runners; receipt machine_callback_receipts; cid uuid; c machine_candidates; response jsonb;
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
   INSERT INTO machine_candidates(machine_id,job_id,owner_id,author_id,baseline_commit,candidate_commit,patch,patch_digest,recipe_digest,status,provenance) VALUES(j.machine_id,j.id,j.owner_id,r.id::text,j.snapshot->'repository'->>'commit',p_payload->>'candidateCommit',p_payload->>'patch',p_patch_digest,p_recipe_digest,'awaiting_replays',jsonb_build_object('signature',p_signature,'signed_bytes',p_bytes,'author_evidence',p_payload->'evidence','attempts',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',a.id,'result',a.result)),'[]') FROM machine_author_attempts a WHERE a.job_id=j.id))) RETURNING id INTO cid;
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
 response:=jsonb_build_object('ok',true,'candidateId',cid);
 INSERT INTO machine_callback_receipts(job_id,runner_id,payload_digest,payload_bytes,result) VALUES(j.id,r.id,p_digest,p_bytes,response); RETURN response;
END; $$;
REVOKE ALL ON FUNCTION public.commit_machine_callback(uuid,uuid,uuid,text,text,jsonb,text,text,text,text,boolean) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.commit_machine_callback(uuid,uuid,uuid,text,text,jsonb,text,text,text,text,boolean) TO service_role;