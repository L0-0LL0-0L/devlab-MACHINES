CREATE TABLE public.wallet_auth_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet text NOT NULL,
  nonce text NOT NULL UNIQUE,
  message text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.wallet_auth_challenges TO service_role;
ALTER TABLE public.wallet_auth_challenges ENABLE ROW LEVEL SECURITY;
CREATE INDEX wallet_auth_challenges_wallet_idx ON public.wallet_auth_challenges(wallet, created_at DESC);
CREATE UNIQUE INDEX profiles_wallet_address_uniq ON public.profiles(wallet_address) WHERE wallet_address IS NOT NULL;