ALTER TABLE public.machine_runners ADD COLUMN IF NOT EXISTS signing_key_norm text, ADD COLUMN IF NOT EXISTS key_verified_at timestamptz, ADD COLUMN IF NOT EXISTS replaced_by uuid;
COMMENT ON COLUMN public.machine_runners.public_key IS 'Runner-supplied key; only rows with key_verified_at proved possession via enrollment challenge.';
CREATE UNIQUE INDEX IF NOT EXISTS machine_runners_signing_key_unique ON public.machine_runners(signing_key_norm) WHERE signing_key_norm IS NOT NULL;
ALTER TABLE public.machine_runners ADD CONSTRAINT machine_runners_key_norm_format CHECK (signing_key_norm IS NULL OR signing_key_norm ~ '^[0-9a-f]{64}$');

CREATE TABLE public.machine_runner_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  label text NOT NULL,
  role text NOT NULL CHECK (role IN ('author','verifier')),
  public_key text NOT NULL,
  signing_key_norm text NOT NULL CHECK (signing_key_norm ~ '^[0-9a-f]{64}$'),
  nonce text NOT NULL UNIQUE,
  message text NOT NULL,
  replace_runner uuid,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.machine_runner_challenges TO service_role;
ALTER TABLE public.machine_runner_challenges ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.enroll_machine_runner(p_challenge uuid, p_owner uuid, p_key_norm text, p_token_hash text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c machine_runner_challenges; rid uuid; old machine_runners;
BEGIN
  SELECT * INTO c FROM machine_runner_challenges WHERE id=p_challenge FOR UPDATE;
  IF c.id IS NULL THEN RAISE EXCEPTION 'Unknown challenge'; END IF;
  IF c.owner_id<>p_owner THEN RAISE EXCEPTION 'Challenge belongs to another account'; END IF;
  IF c.consumed_at IS NOT NULL THEN RAISE EXCEPTION 'Challenge already used'; END IF;
  IF c.expires_at<=now() THEN RAISE EXCEPTION 'Challenge expired'; END IF;
  IF c.signing_key_norm<>p_key_norm THEN RAISE EXCEPTION 'Challenge key mismatch'; END IF;
  UPDATE machine_runner_challenges SET consumed_at=now() WHERE id=c.id;
  IF c.replace_runner IS NOT NULL THEN
    SELECT * INTO old FROM machine_runners WHERE id=c.replace_runner AND owner_id=p_owner FOR UPDATE;
    IF old.id IS NULL THEN RAISE EXCEPTION 'Replaced runner not owned'; END IF;
  END IF;
  INSERT INTO machine_runners(owner_id,label,public_key,token_hash,role,signing_key_norm,key_verified_at)
    VALUES(p_owner,c.label,c.public_key,p_token_hash,c.role,c.signing_key_norm,now()) RETURNING id INTO rid;
  IF old.id IS NOT NULL THEN UPDATE machine_runners SET active=false, replaced_by=rid WHERE id=old.id; END IF;
  RETURN jsonb_build_object('id',rid,'label',c.label,'role',c.role,'replaced',old.id);
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'Signing key already enrolled';
END; $$;
REVOKE ALL ON FUNCTION public.enroll_machine_runner(uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.enroll_machine_runner(uuid,uuid,text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.lease_machine_job(p_runner uuid) RETURNS SETOF public.machine_jobs LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.machine_runners; j uuid;
BEGIN
 SELECT * INTO r FROM public.machine_runners WHERE id=p_runner AND active=true AND key_verified_at IS NOT NULL AND signing_key_norm IS NOT NULL;
 IF r.id IS NULL THEN RETURN; END IF;
 SELECT q.id INTO j FROM public.machine_jobs q WHERE q.kind=r.role AND (q.status='queued' OR (q.status='leased' AND q.lease_until<now())) AND q.attempts<3 AND (q.kind='author' AND q.owner_id=r.owner_id OR q.kind='verifier' AND q.owner_id<>r.owner_id
   AND NOT EXISTS(SELECT 1 FROM public.machine_candidates c JOIN public.machine_runners ar ON ar.id::text=c.author_id WHERE c.id::text=q.snapshot->>'candidateId' AND (ar.signing_key_norm IS NULL OR ar.signing_key_norm=r.signing_key_norm OR ar.owner_id=r.owner_id))
   AND NOT EXISTS(SELECT 1 FROM public.machine_replays rp JOIN public.machine_runners rr ON rr.id=rp.runner_id WHERE rp.candidate_id::text=q.snapshot->>'candidateId' AND (rp.runner_id=r.id OR rp.owner_id=r.owner_id OR rr.signing_key_norm=r.signing_key_norm))
   AND NOT EXISTS(SELECT 1 FROM public.machine_jobs other JOIN public.machine_runners orr ON orr.id=other.runner_id WHERE other.id<>q.id AND other.kind='verifier' AND other.status='leased' AND other.lease_until>now() AND other.snapshot->>'candidateId'=q.snapshot->>'candidateId' AND (orr.owner_id=r.owner_id OR orr.signing_key_norm=r.signing_key_norm)))
 ORDER BY q.created_at FOR UPDATE SKIP LOCKED LIMIT 1;
 IF j IS NULL THEN RETURN; END IF;
 RETURN QUERY UPDATE public.machine_jobs SET status='leased',runner_id=r.id,lease_token=gen_random_uuid(),lease_until=now()+interval '10 minutes',attempts=attempts+1 WHERE id=j RETURNING *;
END; $$;
REVOKE ALL ON FUNCTION public.lease_machine_job(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.lease_machine_job(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.enforce_replay_key_separation() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE k text; ak text;
BEGIN
  SELECT signing_key_norm INTO k FROM machine_runners WHERE id=NEW.runner_id AND key_verified_at IS NOT NULL;
  IF k IS NULL THEN RAISE EXCEPTION 'Replay runner key not proven'; END IF;
  SELECT ar.signing_key_norm INTO ak FROM machine_candidates c JOIN machine_runners ar ON ar.id::text=c.author_id WHERE c.id=NEW.candidate_id;
  IF ak IS NULL OR ak=k THEN RAISE EXCEPTION 'Replay key must differ from proven author key'; END IF;
  PERFORM 1 FROM machine_candidates WHERE id=NEW.candidate_id FOR UPDATE;
  IF EXISTS(SELECT 1 FROM machine_replays rp JOIN machine_runners rr ON rr.id=rp.runner_id WHERE rp.candidate_id=NEW.candidate_id AND rp.id<>NEW.id AND rr.signing_key_norm=k) THEN RAISE EXCEPTION 'Replay key already used for candidate'; END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.enforce_replay_key_separation() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS machine_replay_key_separation ON public.machine_replays;
CREATE TRIGGER machine_replay_key_separation BEFORE INSERT ON public.machine_replays FOR EACH ROW EXECUTE FUNCTION public.enforce_replay_key_separation();