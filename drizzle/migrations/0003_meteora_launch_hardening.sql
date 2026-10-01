ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS mint_address text,
  ADD COLUMN IF NOT EXISTS pool_address text,
  ADD COLUMN IF NOT EXISTS config_address text,
  ADD COLUMN IF NOT EXISTS launch_signature text,
  ADD COLUMN IF NOT EXISTS launched_at timestamptz,
  ADD COLUMN IF NOT EXISTS migrated_at timestamptz,
  ADD COLUMN IF NOT EXISTS migration_signature text,
  ADD COLUMN IF NOT EXISTS creator_wallet text,
  ADD COLUMN IF NOT EXISTS pending_mint text,
  ADD COLUMN IF NOT EXISTS pending_config text,
  ADD COLUMN IF NOT EXISTS initial_market_cap_sol numeric,
  ADD COLUMN IF NOT EXISTS migration_market_cap_sol numeric;

CREATE UNIQUE INDEX IF NOT EXISTS projects_cluster_mint_uq ON public.projects(cluster, mint_address) WHERE mint_address IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS projects_cluster_sig_uq ON public.projects(cluster, launch_signature) WHERE launch_signature IS NOT NULL;

DROP POLICY IF EXISTS "own projects all" ON public.projects;

GRANT SELECT ON public.projects TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;

CREATE POLICY "public live projects" ON public.projects FOR SELECT TO anon, authenticated USING (status IN ('live','migrated'));
CREATE POLICY "own projects select" ON public.projects FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "own draft insert" ON public.projects FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id AND status = 'draft' AND mint_address IS NULL AND pool_address IS NULL AND config_address IS NULL AND launch_signature IS NULL AND launched_at IS NULL AND migrated_at IS NULL AND migration_signature IS NULL AND creator_wallet IS NULL AND pending_mint IS NULL AND pending_config IS NULL);
CREATE POLICY "own draft update" ON public.projects FOR UPDATE TO authenticated
  USING (auth.uid() = owner_id AND status = 'draft')
  WITH CHECK (auth.uid() = owner_id AND status = 'draft' AND mint_address IS NULL AND pool_address IS NULL AND launch_signature IS NULL AND launched_at IS NULL AND migrated_at IS NULL);
CREATE POLICY "own draft delete" ON public.projects FOR DELETE TO authenticated USING (auth.uid() = owner_id AND status = 'draft');

-- Server-only chain fields: block client edits of pending/config/creator columns even on drafts
REVOKE UPDATE ON public.projects FROM authenticated;
GRANT UPDATE (title, symbol, thesis, category, evidence, treasury_address, token_supply, token_decimals, initial_market_cap_sol, migration_market_cap_sol, updated_at) ON public.projects TO authenticated;

-- Wallet address on profiles is server-verified only
REVOKE INSERT, UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (display_name, preferred_cluster, updated_at) ON public.profiles TO authenticated;

CREATE TABLE IF NOT EXISTS public.chain_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster text NOT NULL,
  signature text NOT NULL,
  kind text NOT NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  wallet text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cluster, signature)
);
GRANT SELECT ON public.chain_transactions TO anon, authenticated;
GRANT ALL ON public.chain_transactions TO service_role;
ALTER TABLE public.chain_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public confirmed tx of live projects" ON public.chain_transactions FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.status IN ('live','migrated')));