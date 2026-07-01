import { execSync } from "node:child_process";
import { resolve } from "node:path";
import type { BlocksManifest } from "@endian/shared";
import { RECIPES } from "./recipes/index.js";
import { readManifest, writeManifest } from "./manifest.js";

export interface ActivateOptions {
  scaffoldRoot?: string;
  runMigrations?: boolean;
}

export function activateBlock(blockId: string, options: ActivateOptions = {}): BlocksManifest {
  const recipe = RECIPES[blockId];
  if (!recipe) {
    throw new Error(`Unknown block: ${blockId}. Available: ${Object.keys(RECIPES).join(", ")}`);
  }

  const manifest = readManifest(options.scaffoldRoot);
  const updated = recipe.onActivate ? recipe.onActivate(manifest) : manifest;
  updated.blocks[blockId] = { ...updated.blocks[blockId], state: "enabled" };
  writeManifest(updated, options.scaffoldRoot);

  if (options.runMigrations && recipe.migrations?.length) {
    const supabaseDir = resolve(options.scaffoldRoot ?? "apps/scaffold", "supabase");
    try {
      execSync("supabase db reset", { cwd: supabaseDir, stdio: "inherit" });
    } catch {
      console.warn("supabase db reset skipped (Supabase CLI not available or not running)");
    }
  }

  return updated;
}

export function deactivateBlock(blockId: string, options: ActivateOptions = {}): BlocksManifest {
  const recipe = RECIPES[blockId];
  if (!recipe) {
    throw new Error(`Unknown block: ${blockId}`);
  }

  const manifest = readManifest(options.scaffoldRoot);
  const updated = recipe.onDeactivate ? recipe.onDeactivate(manifest) : manifest;
  updated.blocks[blockId] = { ...updated.blocks[blockId], state: "stub" };
  writeManifest(updated, options.scaffoldRoot);
  return updated;
}

export function listRecipes(): Array<{ id: string; description: string }> {
  return Object.values(RECIPES).map((r) => ({ id: r.blockId, description: r.description }));
}
