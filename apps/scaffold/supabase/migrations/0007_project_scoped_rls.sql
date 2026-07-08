-- Project-scoped RLS for shared Supabase tenant isolation

CREATE TABLE IF NOT EXISTS public.builder_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_builder_user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.builder_projects ENABLE ROW LEVEL SECURITY;

-- Map platform project UUID to builder metadata (control plane owns rows; app reads via anon + RLS)
CREATE POLICY "Service role manages builder projects"
  ON public.builder_projects
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

ALTER TABLE public.plant_checks
  ADD COLUMN IF NOT EXISTS project_id UUID;

-- Backfill existing rows with a sentinel project for local dev (replace in prod migrations)
UPDATE public.plant_checks
SET project_id = '00000000-0000-0000-0000-000000000001'::uuid
WHERE project_id IS NULL;

ALTER TABLE public.plant_checks
  ALTER COLUMN project_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS plant_checks_project_id_idx ON public.plant_checks(project_id);

DROP POLICY IF EXISTS "Users read own plant checks" ON public.plant_checks;
DROP POLICY IF EXISTS "Users insert own plant checks" ON public.plant_checks;

CREATE POLICY "Users read own project plant checks"
  ON public.plant_checks FOR SELECT
  USING (
    auth.uid() = user_id
    AND project_id = COALESCE(
      (auth.jwt() ->> 'project_id')::uuid,
      (current_setting('request.jwt.claims', true)::json ->> 'project_id')::uuid
    )
  );

CREATE POLICY "Users insert own project plant checks"
  ON public.plant_checks FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND project_id = COALESCE(
      (auth.jwt() ->> 'project_id')::uuid,
      (current_setting('request.jwt.claims', true)::json ->> 'project_id')::uuid
    )
  );

-- Storage path prefix: {project_id}/{user_id}/...
DROP POLICY IF EXISTS "Users upload own plant images" ON storage.objects;
DROP POLICY IF EXISTS "Users read own plant images" ON storage.objects;

CREATE POLICY "Users upload project-scoped plant images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'plant-images'
    AND auth.uid()::text = (storage.foldername(name))[2]
    AND (storage.foldername(name))[1] = COALESCE(
      auth.jwt() ->> 'project_id',
      current_setting('request.jwt.claims', true)::json ->> 'project_id'
    )
  );

CREATE POLICY "Users read project-scoped plant images"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'plant-images'
    AND auth.uid()::text = (storage.foldername(name))[2]
    AND (storage.foldername(name))[1] = COALESCE(
      auth.jwt() ->> 'project_id',
      current_setting('request.jwt.claims', true)::json ->> 'project_id'
    )
  );
