import { validateClientEnv } from "@app/shared";

const raw = {
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL as string | undefined,
  VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined,
  VITE_PROJECT_ID: import.meta.env.VITE_PROJECT_ID as string | undefined,
};

export const env = validateClientEnv(raw, import.meta.env.MODE);

export const isSupabaseConfigured = Boolean(env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY);
