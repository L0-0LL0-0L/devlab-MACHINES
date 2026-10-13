CREATE OR REPLACE FUNCTION public.test_machine_head_and_receipts() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE mid uuid:=gen_random_uuid(); oid uuid:=gen_random_uuid(); cid uuid:=gen_random_uuid(); aid uuid:=gen_random_uuid(); rid1 uuid:=gen_random_uuid(); rid2 uuid:=gen_random_uuid(); rid3 uuid:=gen_random_uuid(); replays uuid[]:=ARRAY[gen_random_uuid(),gen_random_uuid()]; gen jsonb; head_ok boolean:=false; dup_ok boolean:=false; network_ok boolean:=false; conflict_ok boolean:=false; stale_ok boolean:=false; unproven_ok boolean:=false; fund jsonb;
BEGIN
 BEGIN
 INSERT INTO machines(id,owner_id,name,repository,soul,recipe,funding_config) VALUES(mid,oid,'ROLLBACK ONLY HEAD TEST',jsonb_build_object('commit',repeat('a',40)),'test','{}',jsonb_build_object('recipient','recipient','cluster','devnet','purpose','self-hosted'));
 INSERT INTO machine_runners(id,owner_id,label,public_key,token_hash,role,signing_key_norm,key_verified_at) VALUES
  (aid,oid,'test','k',gen_random_uuid()::text,'author',md5(random()::text)||md5(random()::text),now()),
  (rid1,gen_random_uuid(),'test','k',gen_random_uuid()::text,'verifier',md5(random()::text)||md5(random()::text),now()),
  (rid2,gen_random_uuid(),'test','k',gen_random_uuid()::text,'verifier',md5(random()::text)||md5(random()::text),now()),
  (rid3,gen_random_uuid(),'test','k',gen_random_uuid()::text,'verifier',NULL,NULL);
 INSERT INTO machine_candidates(id,machine_id,owner_id,author_id,baseline_commit,candidate_commit,patch,patch_digest,recipe_digest) VALUES(cid,mid,oid,aid::text,repeat('a',40),repeat('b',40),'fixture patch','p','r');
 BEGIN INSERT INTO machine_replays(machine_id,candidate_id,runner_id,owner_id,baseline_commit,candidate_commit,patch_digest,recipe_digest,evidence,evidence_digest,signature,status) SELECT mid,cid,rid3,owner_id,repeat('a',40),repeat('b',40),'p','r','{}','e','s','measured' FROM machine_runners WHERE id=rid3; EXCEPTION WHEN OTHERS THEN unproven_ok:=true; END;
 INSERT INTO machine_replays(id,machine_id,candidate_id,runner_id,owner_id,baseline_commit,candidate_commit,patch_digest,recipe_digest,evidence,evidence_digest,signature,status) SELECT replays[1],mid,cid,rid1,owner_id,repeat('a',40),repeat('b',40),'p','r','{}','e','s','measured' FROM machine_runners WHERE id=rid1;
 INSERT INTO machine_replays(id,machine_id,candidate_id,runner_id,owner_id,baseline_commit,candidate_commit,patch_digest,recipe_digest,evidence,evidence_digest,signature,status) SELECT replays[2],mid,cid,rid2,owner_id,repeat('a',40),repeat('b',40),'p','r','{}','e','s','measured' FROM machine_runners WHERE id=rid2;
 gen:=publish_machine_generation(cid,'{"accepted":true}',replays);head_ok:=(SELECT head_commit=repeat('b',40) FROM machines WHERE id=mid) AND gen=publish_machine_generation(cid,'{"accepted":true}',replays);
 UPDATE machine_candidates SET baseline_commit=repeat('c',40) WHERE id=cid;
 BEGIN UPDATE machine_generations SET candidate_commit=repeat('c',40) WHERE candidate_id=cid; EXCEPTION WHEN OTHERS THEN stale_ok:=true; END;
 fund:=record_machine_funding(mid,oid,'devnet','fixture-signature','123456789','sender','recipient',10,'{}'); dup_ok:=fund=record_machine_funding(mid,oid,'devnet','fixture-signature','123456789','sender','recipient',10,'{}');
 BEGIN PERFORM record_machine_funding(mid,oid,'devnet','fixture-signature','1','sender','recipient',10,'{}'); EXCEPTION WHEN OTHERS THEN conflict_ok:=true;END;
 UPDATE machines SET funding_config=jsonb_build_object('recipient','recipient','cluster','mainnet-beta','purpose','self-hosted') WHERE id=mid;
 PERFORM record_machine_funding(mid,oid,'mainnet-beta','fixture-signature','123456789','sender','recipient',10,'{}');network_ok:=(SELECT count(*) FROM machine_funding_receipts WHERE machine_id=mid)=2;
 IF NOT head_ok OR NOT dup_ok OR NOT network_ok OR NOT conflict_ok OR NOT stale_ok OR NOT unproven_ok THEN RAISE EXCEPTION 'Head or receipt test failed';END IF;
 RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='rollback fixtures';
 EXCEPTION WHEN no_data_found THEN NULL;
 END;
 RETURN jsonb_build_object('atomicHeadAndIdempotentGeneration',head_ok,'immutableAncestry',stale_ok,'receiptIdempotency',dup_ok,'networkSeparation',network_ok,'receiptConflictRejected',conflict_ok,'fixturesPersisted',EXISTS(SELECT 1 FROM machines WHERE id=mid));
END; $$;
REVOKE ALL ON FUNCTION public.test_machine_head_and_receipts() FROM PUBLIC,anon,authenticated;GRANT EXECUTE ON FUNCTION public.test_machine_head_and_receipts() TO service_role;

CREATE OR REPLACE FUNCTION public.test_runner_enrollment() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE o uuid:=gen_random_uuid(); other uuid:=gen_random_uuid(); k text:=md5(random()::text)||md5(random()::text); k2 text:=md5(random()::text)||md5(random()::text);
 c1 uuid:=gen_random_uuid(); c2 uuid:=gen_random_uuid(); c3 uuid:=gen_random_uuid(); c4 uuid:=gen_random_uuid(); c5 uuid:=gen_random_uuid(); c6 uuid:=gen_random_uuid();
 first jsonb; reuse_ok boolean:=false; expired_ok boolean:=false; owner_ok boolean:=false; dupkey_ok boolean:=false; mismatch_ok boolean:=false; replace_ok boolean:=false; author_key_ok boolean:=false; out jsonb; rep jsonb; mid uuid:=gen_random_uuid(); cid uuid:=gen_random_uuid();
BEGIN
 BEGIN
 INSERT INTO machine_runner_challenges(id,owner_id,label,role,public_key,signing_key_norm,nonce,message,expires_at,replace_runner) VALUES
  (c1,o,'a','author','K',k,gen_random_uuid()::text,'m',now()+interval '5 minutes',NULL),
  (c2,o,'b','verifier','K',k2,gen_random_uuid()::text,'m',now()-interval '1 second',NULL),
  (c3,o,'c','verifier','K',k2,gen_random_uuid()::text,'m',now()+interval '5 minutes',NULL),
  (c4,o,'d','verifier','K',k,gen_random_uuid()::text,'m',now()+interval '5 minutes',NULL);
 first:=enroll_machine_runner(c1,o,k,gen_random_uuid()::text);
 BEGIN PERFORM enroll_machine_runner(c1,o,k,gen_random_uuid()::text); EXCEPTION WHEN OTHERS THEN reuse_ok:=SQLERRM LIKE '%already used%'; END;
 BEGIN PERFORM enroll_machine_runner(c2,o,k2,gen_random_uuid()::text); EXCEPTION WHEN OTHERS THEN expired_ok:=SQLERRM LIKE '%expired%'; END;
 BEGIN PERFORM enroll_machine_runner(c3,other,k2,gen_random_uuid()::text); EXCEPTION WHEN OTHERS THEN owner_ok:=SQLERRM LIKE '%another account%'; END;
 BEGIN PERFORM enroll_machine_runner(c3,o,k,gen_random_uuid()::text); EXCEPTION WHEN OTHERS THEN mismatch_ok:=SQLERRM LIKE '%mismatch%'; END;
 BEGIN PERFORM enroll_machine_runner(c4,o,k,gen_random_uuid()::text); EXCEPTION WHEN OTHERS THEN dupkey_ok:=SQLERRM LIKE '%already enrolled%'; END;
 -- Re-enrollment replaces an unproven legacy identity with a newly proven key.
 INSERT INTO machine_runners(id,owner_id,label,public_key,token_hash,role) VALUES(c6,o,'legacy','unproven',gen_random_uuid()::text,'verifier');
 INSERT INTO machine_runner_challenges(id,owner_id,label,role,public_key,signing_key_norm,nonce,message,expires_at,replace_runner) VALUES(c5,o,'e','verifier','K',k2,gen_random_uuid()::text,'m',now()+interval '5 minutes',c6);
 rep:=enroll_machine_runner(c5,o,k2,gen_random_uuid()::text);
 replace_ok:=(SELECT NOT active AND replaced_by=(rep->>'id')::uuid FROM machine_runners WHERE id=c6) AND (SELECT key_verified_at IS NOT NULL FROM machine_runners WHERE id=(rep->>'id')::uuid);
 -- Replay with the author's own proven key is rejected even under a different runner row/owner path.
 INSERT INTO machines(id,owner_id,name,repository,soul,recipe) VALUES(mid,o,'ROLLBACK ONLY KEY TEST',jsonb_build_object('commit',repeat('a',40)),'test','{}');
 INSERT INTO machine_candidates(id,machine_id,owner_id,author_id,baseline_commit,candidate_commit,patch,patch_digest,recipe_digest) VALUES(cid,mid,o,first->>'id',repeat('a',40),repeat('b',40),'p','p','r');
 BEGIN INSERT INTO machine_replays(machine_id,candidate_id,runner_id,owner_id,baseline_commit,candidate_commit,patch_digest,recipe_digest,evidence,evidence_digest,signature,status) VALUES(mid,cid,(first->>'id')::uuid,other,repeat('a',40),repeat('b',40),'p','r','{}','e','s','measured'); EXCEPTION WHEN OTHERS THEN author_key_ok:=SQLERRM LIKE '%differ%'; END;
 out:=jsonb_build_object('enrolled',first ? 'id','reusedRejected',reuse_ok,'expiredRejected',expired_ok,'wrongOwnerRejected',owner_ok,'keyMismatchRejected',mismatch_ok,'duplicateKeyRejected',dupkey_ok,'unprovenReplaced',replace_ok,'authorKeyReplayRejected',author_key_ok);
 RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='rollback fixtures';
 EXCEPTION WHEN no_data_found THEN NULL;
 END;
 RETURN out || jsonb_build_object('fixturesPersisted',EXISTS(SELECT 1 FROM machine_runner_challenges WHERE id=c1));
END; $$;
REVOKE ALL ON FUNCTION public.test_runner_enrollment() FROM PUBLIC,anon,authenticated;GRANT EXECUTE ON FUNCTION public.test_runner_enrollment() TO service_role;