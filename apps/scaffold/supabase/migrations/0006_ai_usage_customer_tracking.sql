-- Per-customer AI usage tracking (builder + app users)
ALTER TABLE public.ai_usage
  ADD COLUMN IF NOT EXISTS customer_id TEXT,
  ADD COLUMN IF NOT EXISTS customer_type TEXT NOT NULL DEFAULT 'app'
    CHECK (customer_type IN ('app', 'builder')),
  ADD COLUMN IF NOT EXISTS model TEXT,
  ADD COLUMN IF NOT EXISTS prompt_tokens INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS completion_tokens INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS latency_ms INTEGER,
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'edge_fn'
    CHECK (source IN ('builder', 'edge_fn'));

UPDATE public.ai_usage
SET customer_id = user_id::text
WHERE customer_id IS NULL AND user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ai_usage_customer_id_idx ON public.ai_usage(customer_id);
CREATE INDEX IF NOT EXISTS ai_usage_customer_type_idx ON public.ai_usage(customer_type);
