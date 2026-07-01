-- Plant Pal domain table
CREATE TABLE IF NOT EXISTS public.plant_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plant_name TEXT,
  image_path TEXT NOT NULL,
  analysis TEXT,
  health_score INTEGER CHECK (health_score >= 0 AND health_score <= 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.plant_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own plant checks"
  ON public.plant_checks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own plant checks"
  ON public.plant_checks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- AI usage tracking
CREATE TABLE IF NOT EXISTS public.ai_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  endpoint TEXT NOT NULL,
  tokens INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read ai usage"
  ON public.ai_usage FOR SELECT
  USING (public.is_admin());

CREATE INDEX IF NOT EXISTS plant_checks_user_id_idx ON public.plant_checks(user_id);
CREATE INDEX IF NOT EXISTS ai_usage_created_at_idx ON public.ai_usage(created_at);
