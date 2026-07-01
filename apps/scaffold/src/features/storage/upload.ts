import { isBlockEnabled } from "@/lib/blocks";
import { isSupabaseReady, supabase } from "@/integrations/supabase/client";

export async function uploadFile(bucket: string, path: string, file: File): Promise<string> {
  if (!isBlockEnabled("storage")) {
    throw new Error("Storage block is not enabled. Run: pnpm blocks:activate storage");
  }
  if (!isSupabaseReady()) {
    throw new Error("Supabase is not configured");
  }

  const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
  if (error) throw error;
  return path;
}

export function getPublicUrl(bucket: string, path: string): string {
  if (!isBlockEnabled("storage") || !isSupabaseReady()) {
    throw new Error("Storage block is not enabled or Supabase not configured");
  }
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}
