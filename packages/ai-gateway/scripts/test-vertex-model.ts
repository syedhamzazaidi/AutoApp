#!/usr/bin/env tsx
/**
 * Smoke-test Vertex Gemini via @google/genai (ADC / Workload Identity).
 *
 * Usage:
 *   pnpm test:vertex-model
 *   pnpm test:vertex-model -- --prompt "Say hello in one sentence"
 *   pnpm test:vertex-model -- --model gemini-2.5-flash-lite
 *
 * Loads env from apps/platform/.env then repo root .env.
 *
 * Auth: `gcloud auth application-default login` or
 * GOOGLE_APPLICATION_CREDENTIALS=$PWD/.secrets/gcp-admin-sa.json
 * (relative paths are resolved from the repo root — package cwd differs under pnpm)
 */
import { config } from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_MODEL,
  generateContent,
  getGcpProjectId,
  getVertexLocation,
  getVertexModel,
  isGeminiConfigured,
} from "../src/gemini.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");

config({ path: path.join(repoRoot, "apps/platform/.env") });
config({ path: path.join(repoRoot, ".env") });

/** Resolve relative GOOGLE_APPLICATION_CREDENTIALS against the repo root. */
function resolveApplicationCredentials(): void {
  const raw = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  if (!raw || path.isAbsolute(raw)) return;

  const candidates = [
    path.resolve(repoRoot, raw),
    path.resolve(process.cwd(), raw),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      process.env.GOOGLE_APPLICATION_CREDENTIALS = candidate;
      return;
    }
  }
}

resolveApplicationCredentials();

interface CliOptions {
  prompt: string;
  model: string;
}

function parseArgs(argv: string[]): CliOptions {
  let prompt = "Reply with exactly: vertex-ok";
  let model = getVertexModel();

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--prompt" && argv[i + 1]) {
      prompt = argv[++i]!;
    } else if (arg === "--model" && argv[i + 1]) {
      model = argv[++i]!;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
  }

  return { prompt, model };
}

function printHelp(): void {
  console.log(`Smoke-test Vertex Gemini generateContent.

Usage:
  pnpm test:vertex-model [-- options]

Options:
  --prompt <text>   Prompt to send (default: Reply with exactly: vertex-ok)
  --model <id>      Vertex model id (default: ${DEFAULT_MODEL})
  --help            Show this help

Environment:
  GCP_PROJECT_ID     Optional (default: project-5be3cb47-0a28-4053-b3a)
  VERTEX_LOCATION    Optional (default: global)
  VERTEX_MODEL       Optional model override
  GEMINI_MODEL       Optional model override (alias)
  GOOGLE_APPLICATION_CREDENTIALS  SA JSON path (relative → repo root)
  GEMINI_DISABLED / VERTEX_DISABLED  Must not be 1
`);
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  if (!isGeminiConfigured()) {
    console.error("Gemini/Vertex is not configured (GCP_PROJECT_ID missing).");
    process.exit(1);
  }

  console.log("Vertex Gemini smoke test");
  console.log(`  project:  ${getGcpProjectId()}`);
  console.log(`  location: ${getVertexLocation()}`);
  console.log(`  model:    ${options.model}`);
  console.log(`  prompt:   ${options.prompt}`);

  const result = await generateContent({
    model: options.model,
    contents: options.prompt,
  });

  console.log("\n--- Response ---");
  console.log(result.text);
  console.log("\n--- Usage ---");
  console.log(
    `promptTokens=${result.promptTokens} completionTokens=${result.completionTokens} latencyMs=${result.latencyMs}`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
