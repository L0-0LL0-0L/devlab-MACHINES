ALTER TABLE public.projects ADD COLUMN private_support_address text;

CREATE TABLE public.private_support_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  cluster text NOT NULL,
  signature text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.private_support_receipts TO service_role;
ALTER TABLE public.private_support_receipts ENABLE ROW LEVEL SECURITY;
CREATE INDEX private_support_receipts_project_idx ON public.private_support_receipts(project_id);