import { supabase } from "@/integrations/supabase/client";
import { uploadFile } from "@/features/storage/upload";
import { isBlockEnabled } from "@/lib/blocks";
import { env } from "@/lib/env";

export interface PlantCheck {
  id: string;
  projectId: string;
  plantName: string | null;
  imagePath: string;
  analysis: string | null;
  healthScore: number | null;
  createdAt: string;
}

const BUCKET = "plant-images";

function projectScopedPath(userId: string, fileName: string): string {
  const projectId = env.VITE_PROJECT_ID ?? "local-dev";
  return `${projectId}/${userId}/${Date.now()}-${fileName}`;
}

export async function uploadPlantImage(file: File, userId: string): Promise<string> {
  const path = projectScopedPath(userId, file.name);
  if (isBlockEnabled("storage")) {
    return uploadFile(BUCKET, path, file);
  }
  // Fallback for when storage block uses plant-images bucket after activation
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true });
  if (error) throw error;
  return path;
}

export async function analyzePlant(
  imagePath: string,
  userId: string,
  plantName?: string,
): Promise<{ analysis: string; healthScore: number }> {
  const { data, error } = await supabase.functions.invoke("analyze-plant", {
    body: { imagePath, userId, plantName },
  });
  if (error) throw error;
  return data as { analysis: string; healthScore: number };
}

export async function getPlantHistory(): Promise<PlantCheck[]> {
  let query = supabase.from("plant_checks").select("*").order("created_at", { ascending: false });

  if (env.VITE_PROJECT_ID) {
    query = query.eq("project_id", env.VITE_PROJECT_ID);
  }

  const { data, error } = await query;

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    projectId: row.project_id,
    plantName: row.plant_name,
    imagePath: row.image_path,
    analysis: row.analysis,
    healthScore: row.health_score,
    createdAt: row.created_at,
  }));
}
