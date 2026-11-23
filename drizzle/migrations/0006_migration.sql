CREATE TABLE public.bounties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('bounty','review')),
  title text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 140),
  description text NOT NULL CHECK (char_length(description) BETWEEN 10 AND 4000),
  reward_sol numeric NOT NULL CHECK (reward_sol > 0 AND reward_sol <= 1000),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.bounties TO anon, authenticated;
GRANT ALL ON public.bounties TO service_role;
ALTER TABLE public.bounties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public reads bounties of public projects" ON public.bounties FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.status IN ('live','migrated') AND p.hidden = false) OR owner_id = auth.uid());

CREATE TABLE public.bounty_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bounty_id uuid NOT NULL REFERENCES public.bounties(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  body text NOT NULL CHECK (char_length(body) BETWEEN 20 AND 8000),
  receive_address text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','declined')),
  paid_signature text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bounty_id, owner_id)
);
GRANT SELECT ON public.bounty_submissions TO authenticated;
GRANT ALL ON public.bounty_submissions TO service_role;
ALTER TABLE public.bounty_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "submitter reads own" ON public.bounty_submissions FOR SELECT TO authenticated USING (owner_id = auth.uid());