import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { BlocksManifest } from "@endian/shared";
import schema from "../schema.json" with { type: "json" };

function findScaffoldRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    const candidate = resolve(dir, "apps/scaffold/lovable.blocks.json");
    if (existsSync(candidate)) return resolve(dir, "apps/scaffold");
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  // Fallback: relative to this package
  const pkgRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  return resolve(pkgRoot, "../../apps/scaffold");
}

const SCAFFOLD_ROOT = findScaffoldRoot();
const MANIFEST_PATH = resolve(SCAFFOLD_ROOT, "lovable.blocks.json");

export function getManifestPath(customRoot?: string): string {
  if (customRoot) return resolve(customRoot, "lovable.blocks.json");
  return MANIFEST_PATH;
}

export function readManifest(customRoot?: string): BlocksManifest {
  const path = getManifestPath(customRoot);
  const raw = readFileSync(path, "utf-8");
  return JSON.parse(raw) as BlocksManifest;
}

export function writeManifest(manifest: BlocksManifest, customRoot?: string): void {
  const path = getManifestPath(customRoot);
  writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`);
}

export function validateManifestSchema(manifest: unknown): string[] {
  const errors: string[] = [];
  const m = manifest as BlocksManifest;

  if (!m || typeof m !== "object" || !m.blocks) {
    errors.push("Manifest must have a blocks object");
    return errors;
  }

  const allowedStates = schema.properties.blocks.additionalProperties.properties.state.enum;
  for (const [blockId, config] of Object.entries(m.blocks)) {
    if (!config || typeof config !== "object") {
      errors.push(`Block ${blockId} must be an object`);
      continue;
    }
    if (!allowedStates.includes(config.state)) {
      errors.push(`Block ${blockId} has invalid state: ${config.state}`);
    }
  }

  return errors;
}
