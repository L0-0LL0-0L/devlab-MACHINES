CREATE OR REPLACE FUNCTION public.machine_generation_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN RAISE EXCEPTION 'Accepted generation ancestry is immutable'; END; $$;
CREATE TRIGGER machine_generation_no_mutation BEFORE UPDATE OR DELETE ON public.machine_generations FOR EACH ROW EXECUTE FUNCTION public.machine_generation_immutable();
CREATE OR REPLACE FUNCTION public.machine_funding_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN RAISE EXCEPTION 'Verified funding receipts are immutable'; END; $$;
CREATE TRIGGER machine_funding_no_mutation BEFORE UPDATE OR DELETE ON public.machine_funding_receipts FOR EACH ROW EXECUTE FUNCTION public.machine_funding_immutable();
CREATE OR REPLACE FUNCTION public.test_machine_head_and_receipts() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE mid uuid:=gen_random_uuid(); oid uuid:=gen_random_uuid(); cid uuid:=gen_random_uuid(); rid1 uuid:=gen_random_uuid(); rid2 uuid:=gen_random_uuid(); replays uuid[]:=ARRAY[gen_random_uuid(),gen_random_uuid()]; gen jsonb; head_ok boolean:=false; dup_ok boolean:=false; network_ok boolean:=false; conflict_ok boolean:=false; stale_ok boolean:=false; fund jsonb;
BEGIN
 BEGIN
 INSERT INTO machines(id,owner_id,name,repository,soul,recipe,funding_config) VALUES(mid,oid,'ROLLBACK ONLY HEAD TEST',jsonb_build_object('commit',repeat('a',40)),'test','{}',jsonb_build_object('recipient','recipient','cluster','devnet','purpose','self-hosted'));
 INSERT INTO machine_candidates(id,machine_id,owner_id,author_id,baseline_commit,candidate_commit,patch,patch_digest,recipe_digest) VALUES(cid,mid,oid,'author',repeat('a',40),repeat('b',40),'fixture patch','p','r');
 INSERT INTO machine_runners(id,owner_id,label,public_key,token_hash,role) VALUES(rid1,gen_random_uuid(),'test','k',gen_random_uuid()::text,'verifier'),(rid2,gen_random_uuid(),'test','k',gen_random_uuid()::text,'verifier');
 INSERT INTO machine_replays(id,machine_id,candidate_id,runner_id,owner_id,baseline_commit,candidate_commit,patch_digest,recipe_digest,evidence,evidence_digest,signature,status) SELECT replays[1],mid,cid,rid1,owner_id,repeat('a',40),repeat('b',40),'p','r','{}','e','s','measured' FROM machine_runners WHERE id=rid1;
 INSERT INTO machine_replays(id,machine_id,candidate_id,runner_id,owner_id,baseline_commit,candidate_commit,patch_digest,recipe_digest,evidence,evidence_digest,signature,status) SELECT replays[2],mid,cid,rid2,owner_id,repeat('a',40),repeat('b',40),'p','r','{}','e','s','measured' FROM machine_runners WHERE id=rid2;
 gen:=publish_machine_generation(cid,'{"accepted":true}',replays);head_ok:=(SELECT head_commit=repeat('b',40) FROM machines WHERE id=mid) AND gen=publish_machine_generation(cid,'{"accepted":true}',replays);
 UPDATE machine_candidates SET baseline_commit=repeat('c',40) WHERE id=cid;
 BEGIN UPDATE machine_generations SET candidate_commit=repeat('c',40) WHERE candidate_id=cid; EXCEPTION WHEN OTHERS THEN stale_ok:=true; END;
 fund:=record_machine_funding(mid,oid,'devnet','fixture-signature','123456789','sender','recipient',10,'{}'); dup_ok:=fund=record_machine_funding(mid,oid,'devnet','fixture-signature','123456789','sender','recipient',10,'{}');
 BEGIN PERFORM record_machine_funding(mid,oid,'devnet','fixture-signature','1','sender','recipient',10,'{}'); EXCEPTION WHEN OTHERS THEN conflict_ok:=true;END;
 UPDATE machines SET funding_config=jsonb_build_object('recipient','recipient','cluster','mainnet-beta','purpose','self-hosted') WHERE id=mid;
 PERFORM record_machine_funding(mid,oid,'mainnet-beta','fixture-signature','123456789','sender','recipient',10,'{}');network_ok:=(SELECT count(*) FROM machine_funding_receipts WHERE machine_id=mid)=2;
 IF NOT head_ok OR NOT dup_ok OR NOT network_ok OR NOT conflict_ok OR NOT stale_ok THEN RAISE EXCEPTION 'Head or receipt test failed';END IF;
 RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='rollback fixtures';
 EXCEPTION WHEN no_data_found THEN NULL;
 END;
 RETURN jsonb_build_object('atomicHeadAndIdempotentGeneration',head_ok,'immutableAncestry',stale_ok,'receiptIdempotency',dup_ok,'networkSeparation',network_ok,'receiptConflictRejected',conflict_ok,'fixturesPersisted',EXISTS(SELECT 1 FROM machines WHERE id=mid));
END; $$;
REVOKE ALL ON FUNCTION public.test_machine_head_and_receipts() FROM PUBLIC,anon,authenticated;GRANT EXECUTE ON FUNCTION public.test_machine_head_and_receipts() TO service_role;