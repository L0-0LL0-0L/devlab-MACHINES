CREATE OR REPLACE FUNCTION public.queue_machine_author(p_machine uuid,p_owner uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE m machines; s jsonb; chain jsonb; state text; j machine_jobs;
BEGIN SELECT * INTO m FROM machines WHERE id=p_machine AND owner_id=p_owner FOR UPDATE; IF m.id IS NULL THEN RAISE EXCEPTION 'Not your machine'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_owner::text,0));
 IF EXISTS(SELECT 1 FROM machine_jobs WHERE machine_id=m.id AND status IN ('queued','leased')) OR (SELECT count(*) FROM machine_jobs WHERE owner_id=p_owner AND status IN ('queued','leased') AND kind='author')>=1 OR (SELECT count(*) FROM machine_jobs WHERE owner_id=p_owner AND kind='author' AND created_at>now()-interval '1 day')>=10 THEN RAISE EXCEPTION 'Owner job quota or active job'; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',g.id,'parentId',g.parent_id,'baselineCommit',g.baseline_commit,'candidateCommit',g.candidate_commit,'patch',c.patch,'patchDigest',c.patch_digest) ORDER BY g.created_at),'[]') INTO chain FROM machine_generations g JOIN machine_candidates c ON c.id=g.candidate_id WHERE g.machine_id=m.id;
 state:=CASE WHEN m.runtime='hosted' OR m.recipe->'calibration' IS NULL OR m.recipe->'calibration'->'harness'='{}'::jsonb OR NOT EXISTS(SELECT 1 FROM machine_runners WHERE owner_id=p_owner AND role='author' AND active) THEN 'blocked' ELSE 'queued' END;
 s:=jsonb_build_object('repository',m.repository||jsonb_build_object('commit',coalesce(m.head_commit,m.repository->>'commit')),'originalCommit',m.repository->>'commit','chain',chain,'recipe',m.recipe,'soul',m.soul,'model',m.model);
 INSERT INTO machine_jobs(machine_id,owner_id,status,snapshot,error) VALUES(m.id,p_owner,state,s,CASE WHEN state='blocked' THEN 'Execution needs an author runner and calibrated recipe with pinned image/harness. Hosted compute is not configured.' END) RETURNING * INTO j;
 UPDATE machines SET status=state WHERE id=m.id;
 INSERT INTO machine_events(machine_id,job_id,owner_id,kind,message) VALUES(m.id,j.id,p_owner,'run','Owner requested bounded author session');RETURN to_jsonb(j);
END; $$;
REVOKE ALL ON FUNCTION public.queue_machine_author(uuid,uuid) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.queue_machine_author(uuid,uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.cancel_machine_jobs(p_machine uuid,p_owner uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN PERFORM 1 FROM machines WHERE id=p_machine AND owner_id=p_owner FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'Not your machine';END IF; UPDATE machine_jobs SET status='cancelled' WHERE machine_id=p_machine AND status IN ('queued','leased','blocked');UPDATE machines SET status='paused' WHERE id=p_machine; END; $$;
REVOKE ALL ON FUNCTION public.cancel_machine_jobs(uuid,uuid) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.cancel_machine_jobs(uuid,uuid) TO service_role;
COMMENT ON FUNCTION public.finish_machine_job(uuid,uuid,uuid,text) IS 'DEPRECATED: use atomic commit_machine_callback'; REVOKE ALL ON FUNCTION public.finish_machine_job(uuid,uuid,uuid,text) FROM service_role;