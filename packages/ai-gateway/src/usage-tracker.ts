import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type CustomerType = "builder" | "app";
export type UsageSource = "builder" | "edge_fn";

export interface AiUsageRecord {
  customerId: string;
  customerType: CustomerType;
  endpoint: string;
  source: UsageSource;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  latencyMs: number;
  userId?: string | null;
}

export interface CustomerUsageSummary {
  customerId: string;
  customerType: CustomerType;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  requestCount: number;
  lastUsedAt: string | null;
}

let supabaseAdmin: SupabaseClient | null | undefined;

function getSupabaseAdmin(): SupabaseClient | null {
  if (supabaseAdmin !== undefined) {
    return supabaseAdmin;
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    supabaseAdmin = null;
    return null;
  }

  supabaseAdmin = createClient(url, key);
  return supabaseAdmin;
}

export async function recordAiUsage(record: AiUsageRecord): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    console.warn(
      "[ai-gateway] Usage not recorded — set SUPABASE_URL and SUPABASE_SECRET_KEY",
    );
    return;
  }

  const { error } = await supabase.from("ai_usage").insert({
    customer_id: record.customerId,
    customer_type: record.customerType,
    endpoint: record.endpoint,
    source: record.source,
    model: record.model,
    prompt_tokens: record.promptTokens,
    completion_tokens: record.completionTokens,
    tokens: record.totalTokens,
    latency_ms: record.latencyMs,
    user_id: record.userId ?? null,
  });

  if (error) {
    console.error("[ai-gateway] Failed to record usage:", error.message);
  }
}

export async function getCustomerUsageSummary(
  customerId: string,
  customerType: CustomerType,
): Promise<CustomerUsageSummary> {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return {
      customerId,
      customerType,
      totalTokens: 0,
      promptTokens: 0,
      completionTokens: 0,
      requestCount: 0,
      lastUsedAt: null,
    };
  }

  const { data, error } = await supabase
    .from("ai_usage")
    .select("tokens, prompt_tokens, completion_tokens, created_at")
    .eq("customer_id", customerId)
    .eq("customer_type", customerType)
    .order("created_at", { ascending: false });

  if (error || !data?.length) {
    return {
      customerId,
      customerType,
      totalTokens: 0,
      promptTokens: 0,
      completionTokens: 0,
      requestCount: 0,
      lastUsedAt: null,
    };
  }

  return {
    customerId,
    customerType,
    totalTokens: data.reduce((sum, row) => sum + (row.tokens ?? 0), 0),
    promptTokens: data.reduce((sum, row) => sum + (row.prompt_tokens ?? 0), 0),
    completionTokens: data.reduce((sum, row) => sum + (row.completion_tokens ?? 0), 0),
    requestCount: data.length,
    lastUsedAt: data[0]?.created_at ?? null,
  };
}
