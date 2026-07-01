#!/usr/bin/env node
/**
 * Export scaffold as standalone repo (strip monorepo refs).
 */
import { cpSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const SCAFFOLD = resolve(ROOT, "apps/scaffold");
const OUT = resolve(ROOT, "export/scaffold");

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

cpSync(SCAFFOLD, OUT, {
  recursive: true,
  filter: (src) => !src.includes("node_modules") && !src.includes("dist"),
});

const pkg = JSON.parse(readFileSync(resolve(OUT, "package.json"), "utf-8"));
delete pkg.dependencies["@endian/shared"];
pkg.name = "plant-pal";
writeFileSync(resolve(OUT, "package.json"), JSON.stringify(pkg, null, 2));

// Inline env validation (remove workspace dep)
const envContent = readFileSync(resolve(OUT, "src/lib/env.ts"), "utf-8");
writeFileSync(
  resolve(OUT, "src/lib/env.ts"),
  envContent.replace('@endian/shared', './env-validate').replace('validateClientEnv', 'validateClientEnv'),
);

console.log(`Exported scaffold to ${OUT}`);
