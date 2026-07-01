import { supabase } from "@/integrations/supabase/client";
import { uploadFile } from "@/features/storage/upload";
import { isBlockEnabled } from "@/lib/blocks";

export interface PlantCheck {
  id: string;
  plantName: string | null;
  imagePath: string;
  analysis: string | null;
  healthScore: number | null;
  createdAt: string;
}

const BUCKET = "plant-images";

export async function uploadPlantImage(file: File, userId: string): Promise<string> {
  const path = `${userId}/${Date.now()}-${file.name}`;
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
  const { data, error } = await supabase
    .from("plant_checks")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    plantName: row.plant_name,
    imagePath: row.image_path,
    analysis: row.analysis,
    healthScore: row.health_score,
    createdAt: row.created_at,
  }));
}
