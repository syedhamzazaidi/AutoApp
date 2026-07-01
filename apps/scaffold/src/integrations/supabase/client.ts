import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env, isSupabaseConfigured } from "@/lib/env";
import type { Database } from "./types";

let _client: SupabaseClient<Database> | null = null;

/** Stable contract: get or create Supabase client */
export function getSupabase(): SupabaseClient<Database> {
  if (!isSupabaseConfigured) {
    throw new Error(
      "Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.",
    );
  }
  if (!_client) {
    _client = createClient<Database>(env.VITE_SUPABASE_URL!, env.VITE_SUPABASE_ANON_KEY!);
  }
  return _client;
}

/** Stable contract: singleton Supabase client */
export const supabase: SupabaseClient<Database> = new Proxy({} as SupabaseClient<Database>, {
  get(_target, prop, receiver) {
    const client = getSupabase();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

export function isSupabaseReady(): boolean {
  return isSupabaseConfigured;
}
