ALTER TABLE public.machine_replays ADD COLUMN signed_payload jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE OR REPLACE FUNCTION public.lease_machine_job(p_runner uuid) RETURNS SETOF public.machine_jobs LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.machine_runners; j uuid;
BEGIN
 SELECT * INTO r FROM public.machine_runners WHERE id=p_runner AND active=true;
 IF r.id IS NULL THEN RETURN; END IF;
 SELECT q.id INTO j FROM public.machine_jobs q WHERE q.kind=r.role AND (q.status='queued' OR (q.status='leased' AND q.lease_until<now())) AND q.attempts<3 AND (q.kind='author' AND q.owner_id=r.owner_id OR q.kind='verifier' AND q.owner_id<>r.owner_id AND NOT EXISTS(SELECT 1 FROM public.machine_replays rp WHERE rp.candidate_id::text=q.snapshot->>'candidateId' AND (rp.runner_id=r.id OR rp.owner_id=r.owner_id)) AND NOT EXISTS(SELECT 1 FROM public.machine_jobs other WHERE other.id<>q.id AND other.kind='verifier' AND other.status='leased' AND other.lease_until>now() AND other.snapshot->>'candidateId'=q.snapshot->>'candidateId' AND other.runner_id IN (SELECT id FROM public.machine_runners WHERE owner_id=r.owner_id))) ORDER BY q.created_at FOR UPDATE SKIP LOCKED LIMIT 1;
 IF j IS NULL THEN RETURN; END IF;
 RETURN QUERY UPDATE public.machine_jobs SET status='leased',runner_id=r.id,lease_token=gen_random_uuid(),lease_until=now()+interval '10 minutes',attempts=attempts+1 WHERE id=j RETURNING *;
END; $$;
REVOKE ALL ON FUNCTION public.lease_machine_job(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.lease_machine_job(uuid) TO service_role;
CREATE UNIQUE INDEX machine_generation_single_parent ON public.machine_generations(machine_id,parent_id) NULLS NOT DISTINCT;