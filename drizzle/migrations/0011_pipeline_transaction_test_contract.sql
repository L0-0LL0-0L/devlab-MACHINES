CREATE OR REPLACE FUNCTION public.test_machine_pipeline_atomicity() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE m uuid:=gen_random_uuid(); owner uuid:=gen_random_uuid(); rid uuid:=gen_random_uuid(); jid uuid:=gen_random_uuid(); lease uuid:=gen_random_uuid(); cid uuid; raw text; payload jsonb; result jsonb; failed boolean:=false; rollback_ok boolean; duplicate_ok boolean; conflict_ok boolean:=false;
BEGIN
 BEGIN
 INSERT INTO machines(id,owner_id,name,repository,soul,recipe) VALUES(m,owner,'ROLLBACK-ONLY TRANSACTION TEST',jsonb_build_object('commit',repeat('a',40)),'test','{}');
 INSERT INTO machine_runners(id,owner_id,label,public_key,token_hash,role) VALUES(rid,owner,'ROLLBACK-ONLY TEST','test',gen_random_uuid()::text,'author');
 INSERT INTO machine_jobs(id,machine_id,owner_id,status,snapshot,runner_id,lease_token,lease_until,deadline_at) VALUES(jid,m,owner,'leased',jsonb_build_object('repository',jsonb_build_object('commit',repeat('a',40))),rid,lease,now()+interval '5 minutes',now()+interval '15 minutes');
 payload:=jsonb_build_object('jobId',jid,'leaseToken',lease,'status','completed','patch','fixture-only patch','candidateCommit',repeat('b',40)); raw:=payload::text;
 BEGIN PERFORM commit_machine_callback(jid,rid,lease,raw,'digest',payload,'test-signature','patch-digest','recipe-digest','evidence-digest',true); EXCEPTION WHEN OTHERS THEN failed:=true; END;
 rollback_ok:=failed AND (SELECT status='leased' FROM machine_jobs WHERE id=jid) AND NOT EXISTS(SELECT 1 FROM machine_candidates WHERE job_id=jid) AND NOT EXISTS(SELECT 1 FROM machine_callback_receipts WHERE job_id=jid) AND NOT EXISTS(SELECT 1 FROM machine_events WHERE job_id=jid);
 result:=commit_machine_callback(jid,rid,lease,raw,'digest',payload,'test-signature','patch-digest','recipe-digest','evidence-digest');
 duplicate_ok:=result=commit_machine_callback(jid,rid,lease,raw,'digest',payload,'test-signature','patch-digest','recipe-digest','evidence-digest') AND (SELECT count(*) FROM machine_candidates WHERE job_id=jid)=1 AND (SELECT count(*) FROM machine_jobs WHERE machine_id=m AND kind='verifier')=2 AND (SELECT count(*) FROM machine_events WHERE job_id=jid)=1;
 BEGIN PERFORM commit_machine_callback(jid,rid,lease,raw,'different',payload,'test-signature','patch-digest','recipe-digest','evidence-digest');EXCEPTION WHEN OTHERS THEN conflict_ok:=true;END;
 IF NOT rollback_ok OR NOT duplicate_ok OR NOT conflict_ok THEN RAISE EXCEPTION 'Transaction tests failed';END IF;
 RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='rollback fixtures';
 EXCEPTION WHEN no_data_found THEN NULL;
 END;
 RETURN jsonb_build_object('failureInjectionRollback',rollback_ok,'idempotentCandidateAndQueue',duplicate_ok,'conflictingReceiptRejected',conflict_ok,'fixturesPersisted',EXISTS(SELECT 1 FROM machines WHERE id=m));
END; $$;
REVOKE ALL ON FUNCTION public.test_machine_pipeline_atomicity() FROM PUBLIC,anon,authenticated;GRANT EXECUTE ON FUNCTION public.test_machine_pipeline_atomicity() TO service_role;