ALTER TABLE public.research_runs
  ADD COLUMN IF NOT EXISTS depth text NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS stance text NOT NULL DEFAULT 'conservative',
  ADD COLUMN IF NOT EXISTS upload_path text,
  ADD COLUMN IF NOT EXISTS domain jsonb,
  ADD COLUMN IF NOT EXISTS error text,
  ADD COLUMN IF NOT EXISTS stage text NOT NULL DEFAULT 'prepare',
  ADD COLUMN IF NOT EXISTS cancel_requested boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS checklist jsonb,
  ADD COLUMN IF NOT EXISTS usage jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS prompt_version text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.research_runs ADD CONSTRAINT research_runs_depth_chk CHECK (depth IN ('quick','standard','deep')) NOT VALID;
ALTER TABLE public.research_runs ADD CONSTRAINT research_runs_stance_chk CHECK (stance IN ('conservative','exploratory')) NOT VALID;
ALTER TABLE public.research_runs ADD CONSTRAINT research_runs_q_len CHECK (char_length(question) BETWEEN 5 AND 2000) NOT VALID;
ALTER TABLE public.research_runs ADD CONSTRAINT research_runs_src_len CHECK (source_text IS NULL OR char_length(source_text) <= 60000) NOT VALID;
ALTER TABLE public.research_runs ADD CONSTRAINT research_runs_roles_len CHECK (cardinality(roles) BETWEEN 1 AND 12) NOT VALID;

DROP POLICY IF EXISTS "own runs all" ON public.research_runs;
CREATE POLICY "own runs select" ON public.research_runs FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "own runs insert queued" ON public.research_runs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id AND status = 'queued' AND result IS NULL AND error IS NULL AND domain IS NULL AND checklist IS NULL AND stage = 'prepare' AND cancel_requested = false);
CREATE POLICY "own runs delete" ON public.research_runs FOR DELETE TO authenticated USING (auth.uid() = owner_id);
REVOKE UPDATE ON public.research_runs FROM authenticated;
GRANT SELECT, INSERT, DELETE ON public.research_runs TO authenticated;
GRANT ALL ON public.research_runs TO service_role;

CREATE TABLE public.research_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.research_runs(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  ref text NOT NULL,
  provider text NOT NULL,
  external_id text,
  title text NOT NULL,
  authors text,
  year integer,
  url text,
  text_kind text NOT NULL,
  body text,
  relevance numeric,
  included boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (run_id, ref)
);
GRANT SELECT ON public.research_sources TO authenticated;
GRANT ALL ON public.research_sources TO service_role;
ALTER TABLE public.research_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own sources select" ON public.research_sources FOR SELECT TO authenticated USING (auth.uid() = owner_id);

CREATE TABLE public.research_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.research_runs(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  seq integer NOT NULL,
  kind text NOT NULL,
  role text,
  status text NOT NULL DEFAULT 'pending',
  provider text,
  model text,
  prompt_version text,
  summary text,
  output jsonb,
  usage jsonb,
  error text,
  started_at timestamptz,
  finished_at timestamptz,
  UNIQUE (run_id, seq)
);
GRANT SELECT ON public.research_steps TO authenticated;
GRANT ALL ON public.research_steps TO service_role;
ALTER TABLE public.research_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own steps select" ON public.research_steps FOR SELECT TO authenticated USING (auth.uid() = owner_id);

CREATE TABLE public.research_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.research_runs(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  step_id uuid REFERENCES public.research_steps(id) ON DELETE CASCADE,
  role text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('finding','hypothesis','dissent','limitation')),
  statement text NOT NULL,
  citations jsonb NOT NULL DEFAULT '[]'::jsonb,
  support_prob numeric,
  support_confidence numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.research_findings TO authenticated;
GRANT ALL ON public.research_findings TO service_role;
ALTER TABLE public.research_findings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own findings select" ON public.research_findings FOR SELECT TO authenticated USING (auth.uid() = owner_id);

CREATE INDEX ON public.research_sources(run_id);
CREATE INDEX ON public.research_steps(run_id);
CREATE INDEX ON public.research_findings(run_id);
CREATE INDEX ON public.research_runs(owner_id, created_at);

CREATE POLICY "own uploads insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'research-uploads' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "own uploads select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'research-uploads' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "own uploads delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'research-uploads' AND (storage.foldername(name))[1] = auth.uid()::text);