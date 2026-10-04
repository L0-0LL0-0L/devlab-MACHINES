ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS website_url text,
  ADD COLUMN IF NOT EXISTS x_url text;

ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_status_check;
ALTER TABLE public.projects ADD CONSTRAINT projects_status_check
  CHECK (status IN ('draft', 'submitted', 'pending_external', 'live', 'migrated'));

COMMENT ON COLUMN public.projects.image_url IS 'Project image URL used in launch listings and token metadata.';
COMMENT ON COLUMN public.projects.website_url IS 'Verified public project website URL.';
COMMENT ON COLUMN public.projects.x_url IS 'Verified public project X profile URL.';