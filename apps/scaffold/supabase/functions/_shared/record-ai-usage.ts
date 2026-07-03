import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

export interface RecordAiUsageInput {
  customerId: string;
  customerType: "app" | "builder";
  endpoint: string;
  source: "builder" | "edge_fn";
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  latencyMs: number;
  userId?: string | null;
}

export async function recordAiUsage(
  supabase: SupabaseClient,
  input: RecordAiUsageInput,
): Promise<void> {
  const { error } = await supabase.from("ai_usage").insert({
    customer_id: input.customerId,
    customer_type: input.customerType,
    endpoint: input.endpoint,
    source: input.source,
    model: input.model,
    prompt_tokens: input.promptTokens,
    completion_tokens: input.completionTokens,
    tokens: input.totalTokens,
    latency_ms: input.latencyMs,
    user_id: input.userId ?? null,
  });

  if (error) {
    console.error("[record-ai-usage]", error.message);
  }
}
