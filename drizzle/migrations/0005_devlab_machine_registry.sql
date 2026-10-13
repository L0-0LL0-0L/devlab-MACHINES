CREATE TABLE public.machines (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL, name text NOT NULL, symbol text NOT NULL DEFAULT '', repository jsonb NOT NULL, soul text NOT NULL DEFAULT '', model text NOT NULL DEFAULT 'claude-sonnet-5-5', recipe jsonb NOT NULL, runtime text NOT NULL DEFAULT 'self-hosted', visibility text NOT NULL DEFAULT 'private', status text NOT NULL DEFAULT 'idle', token_project_id uuid REFERENCES public.projects(id), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), CONSTRAINT machine_visibility CHECK (visibility IN ('private','public')), CONSTRAINT machine_runtime CHECK (runtime IN ('self-hosted','hosted'))
);
GRANT SELECT ON public.machines TO anon, authenticated;
GRANT ALL ON public.machines TO service_role;
ALTER TABLE public.machines ENABLE ROW LEVEL SECURITY;
CREATE POLICY machine_read ON public.machines FOR SELECT TO anon,authenticated USING (visibility='public' OR owner_id=auth.uid());
CREATE TABLE public.machine_jobs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), machine_id uuid NOT NULL REFERENCES public.machines(id), owner_id uuid NOT NULL, kind text NOT NULL DEFAULT 'author', status text NOT NULL DEFAULT 'queued', snapshot jsonb NOT NULL, runner_id uuid, lease_token uuid, lease_until timestamptz, attempts integer NOT NULL DEFAULT 0, error text, created_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz, CONSTRAINT job_kind CHECK(kind IN ('author','verifier')), CONSTRAINT job_status CHECK(status IN ('queued','leased','completed','failed','cancelled','blocked'))
);
GRANT SELECT ON public.machine_jobs TO authenticated;
GRANT ALL ON public.machine_jobs TO service_role;
ALTER TABLE public.machine_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY jobs_owner ON public.machine_jobs FOR SELECT TO authenticated USING(owner_id=auth.uid());
CREATE TABLE public.machine_events (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), machine_id uuid NOT NULL REFERENCES public.machines(id), job_id uuid REFERENCES public.machine_jobs(id), owner_id uuid NOT NULL, kind text NOT NULL, message text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.machine_events TO anon,authenticated;
GRANT ALL ON public.machine_events TO service_role;
ALTER TABLE public.machine_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY event_read ON public.machine_events FOR SELECT TO anon,authenticated USING(owner_id=auth.uid() OR EXISTS(SELECT 1 FROM public.machines m WHERE m.id=machine_id AND m.visibility='public'));
CREATE TABLE public.machine_candidates (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), machine_id uuid NOT NULL REFERENCES public.machines(id), job_id uuid REFERENCES public.machine_jobs(id), owner_id uuid NOT NULL, author_id text NOT NULL, baseline_commit text NOT NULL, candidate_commit text, patch text NOT NULL, patch_digest text NOT NULL, recipe_digest text NOT NULL, status text NOT NULL DEFAULT 'proposed', provenance jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.machine_candidates TO anon,authenticated;
GRANT ALL ON public.machine_candidates TO service_role;
ALTER TABLE public.machine_candidates ENABLE ROW LEVEL SECURITY;
CREATE POLICY candidate_read ON public.machine_candidates FOR SELECT TO anon,authenticated USING(owner_id=auth.uid() OR EXISTS(SELECT 1 FROM public.machines m WHERE m.id=machine_id AND m.visibility='public'));
CREATE TABLE public.machine_runners (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL, label text NOT NULL, public_key text NOT NULL, token_hash text NOT NULL UNIQUE, role text NOT NULL, active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), CONSTRAINT runner_role CHECK(role IN ('author','verifier')));
GRANT ALL ON public.machine_runners TO service_role;
ALTER TABLE public.machine_runners ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.machine_replays (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), machine_id uuid NOT NULL REFERENCES public.machines(id), candidate_id uuid NOT NULL REFERENCES public.machine_candidates(id), runner_id uuid NOT NULL REFERENCES public.machine_runners(id), owner_id uuid NOT NULL, baseline_commit text NOT NULL, candidate_commit text NOT NULL, patch_digest text NOT NULL, recipe_digest text NOT NULL, evidence jsonb NOT NULL, evidence_digest text NOT NULL, signature text NOT NULL, status text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(candidate_id,runner_id));
GRANT SELECT ON public.machine_replays TO anon,authenticated;
GRANT ALL ON public.machine_replays TO service_role;
ALTER TABLE public.machine_replays ENABLE ROW LEVEL SECURITY;
CREATE POLICY replay_read ON public.machine_replays FOR SELECT TO anon,authenticated USING(owner_id=auth.uid() OR EXISTS(SELECT 1 FROM public.machines m WHERE m.id=machine_id AND m.visibility='public'));
CREATE TABLE public.machine_generations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), machine_id uuid NOT NULL REFERENCES public.machines(id), candidate_id uuid NOT NULL UNIQUE REFERENCES public.machine_candidates(id), parent_id uuid REFERENCES public.machine_generations(id), baseline_commit text NOT NULL, candidate_commit text NOT NULL, decision jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.machine_generations TO anon,authenticated;
GRANT ALL ON public.machine_generations TO service_role;
ALTER TABLE public.machine_generations ENABLE ROW LEVEL SECURITY;
CREATE POLICY generation_read ON public.machine_generations FOR SELECT TO anon,authenticated USING(EXISTS(SELECT 1 FROM public.machines m WHERE m.id=machine_id AND (m.visibility='public' OR m.owner_id=auth.uid())));
CREATE TABLE public.machine_ledger (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), machine_id uuid NOT NULL REFERENCES public.machines(id), owner_id uuid NOT NULL, kind text NOT NULL, amount_sol numeric NOT NULL, signature text UNIQUE, detail jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now(), CONSTRAINT ledger_kind CHECK(kind IN ('received','claimed_fee','compute_debit')), CONSTRAINT ledger_positive CHECK(amount_sol>0));
GRANT SELECT ON public.machine_ledger TO authenticated;
GRANT ALL ON public.machine_ledger TO service_role;
ALTER TABLE public.machine_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY ledger_owner ON public.machine_ledger FOR SELECT TO authenticated USING(owner_id=auth.uid());
CREATE TABLE public.machine_follows (owner_id uuid NOT NULL, machine_id uuid NOT NULL REFERENCES public.machines(id), created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(owner_id,machine_id));
GRANT SELECT,INSERT,DELETE ON public.machine_follows TO authenticated;
GRANT ALL ON public.machine_follows TO service_role;
ALTER TABLE public.machine_follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY follows_owner ON public.machine_follows FOR ALL TO authenticated USING(owner_id=auth.uid()) WITH CHECK(owner_id=auth.uid());
CREATE TABLE public.machine_desks (owner_id uuid PRIMARY KEY, machine_id uuid REFERENCES public.machines(id), panel text NOT NULL DEFAULT 'activity', updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT,INSERT,UPDATE ON public.machine_desks TO authenticated;
GRANT ALL ON public.machine_desks TO service_role;
ALTER TABLE public.machine_desks ENABLE ROW LEVEL SECURITY;
CREATE POLICY desks_owner ON public.machine_desks FOR ALL TO authenticated USING(owner_id=auth.uid()) WITH CHECK(owner_id=auth.uid());
CREATE OR REPLACE FUNCTION public.lease_machine_job(p_runner uuid) RETURNS SETOF public.machine_jobs LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.machine_runners; j uuid;
BEGIN
 SELECT * INTO r FROM public.machine_runners WHERE id=p_runner AND active=true;
 IF r.id IS NULL THEN RETURN; END IF;
 SELECT id INTO j FROM public.machine_jobs WHERE kind=r.role AND (status='queued' OR (status='leased' AND lease_until<now())) AND attempts<3 AND (kind='verifier' AND owner_id<>r.owner_id OR kind='author' AND owner_id=r.owner_id) ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1;
 IF j IS NULL THEN RETURN; END IF;
 RETURN QUERY UPDATE public.machine_jobs SET status='leased',runner_id=r.id,lease_token=gen_random_uuid(),lease_until=now()+interval '10 minutes',attempts=attempts+1 WHERE id=j RETURNING *;
END; $$;
REVOKE ALL ON FUNCTION public.lease_machine_job(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.lease_machine_job(uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.finish_machine_job(p_job uuid,p_runner uuid,p_lease uuid,p_status text) RETURNS SETOF public.machine_jobs LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
 UPDATE public.machine_jobs SET status=p_status,finished_at=now() WHERE id=p_job AND runner_id=p_runner AND lease_token=p_lease AND status='leased' AND lease_until>now() AND p_status IN ('completed','failed') RETURNING *;
$$;
REVOKE ALL ON FUNCTION public.finish_machine_job(uuid,uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finish_machine_job(uuid,uuid,uuid,text) TO service_role;