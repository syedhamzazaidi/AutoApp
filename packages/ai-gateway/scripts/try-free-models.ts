#!/usr/bin/env tsx
/**
 * Probe all fully-free OpenRouter models and report which respond successfully.
 *
 * Usage:
 *   pnpm try:free-models
 *   pnpm try:free-models -- --stop-on-first
 *   pnpm try:free-models -- --prompt "say hi"
 *
 * Loads OPENROUTER_API_KEY from apps/platform/.env then repo root .env.
 */
import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { OpenRouter } from "@openrouter/agent";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");

config({ path: path.join(repoRoot, "apps/platform/.env") });
config({ path: path.join(repoRoot, ".env") });

const MODELS_URL = "https://openrouter.ai/api/v1/models";
const DEFAULT_PROMPT = "Reply with exactly: hi";

interface OpenRouterModel {
  id: string;
  name?: string;
  pricing?: {
    prompt?: string;
    completion?: string;
  };
}

interface CliOptions {
  prompt: string;
  stopOnFirst: boolean;
}

interface TryResult {
  model: string;
  ok: boolean;
  latencyMs?: number;
  response?: string;
  error?: string;
}

function parseArgs(argv: string[]): CliOptions {
  let prompt = DEFAULT_PROMPT;
  let stopOnFirst = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--prompt" && argv[i + 1]) {
      prompt = argv[++i]!;
    } else if (arg === "--stop-on-first") {
      stopOnFirst = true;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
  }

  return { prompt, stopOnFirst };
}

function printHelp(): void {
  console.log(`Try all fully-free OpenRouter models with a minimal chat completion.

Usage:
  pnpm try:free-models [-- options]

Options:
  --prompt <text>     Minimal prompt (default: "${DEFAULT_PROMPT}")
  --stop-on-first     Stop after the first successful model
  --help              Show this help

Environment:
  OPENROUTER_API_KEY  Required (loaded from apps/platform/.env)
`);
}

function isFullyFree(model: OpenRouterModel): boolean {
  const prompt = Number.parseFloat(model.pricing?.prompt ?? "999");
  const completion = Number.parseFloat(model.pricing?.completion ?? "999");
  return (prompt === 0 && completion === 0) || model.id.endsWith(":free");
}

async function fetchFreeModels(): Promise<OpenRouterModel[]> {
  const response = await fetch(MODELS_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch models: ${response.status} ${response.statusText}`);
  }

  const body = (await response.json()) as { data?: OpenRouterModel[] };
  const models = body.data ?? [];
  return models.filter(isFullyFree).sort((a, b) => a.id.localeCompare(b.id));
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

async function tryModel(
  client: OpenRouter,
  model: string,
  prompt: string,
): Promise<TryResult> {
  const start = Date.now();
  try {
    const result = client.callModel({ model, input: prompt });
    const text = await result.getText();
    return {
      model,
      ok: true,
      latencyMs: Date.now() - start,
      response: text.trim().slice(0, 120),
    };
  } catch (error) {
    return {
      model,
      ok: false,
      latencyMs: Date.now() - start,
      error: formatError(error),
    };
  }
}

function printResult(result: TryResult): void {
  if (result.ok) {
    console.log(
      `  OK   ${result.model} (${result.latencyMs}ms) -> ${JSON.stringify(result.response)}`,
    );
    return;
  }

  console.log(`  FAIL ${result.model} (${result.latencyMs}ms) -> ${result.error}`);
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();

  if (!apiKey) {
    console.error("Missing OPENROUTER_API_KEY. Set it in apps/platform/.env");
    process.exit(1);
  }

  console.log("Fetching OpenRouter model list...");
  const freeModels = await fetchFreeModels();
  console.log(`Found ${freeModels.length} fully-free models.\n`);

  const client = new OpenRouter({
    apiKey,
    httpReferer: process.env.BETTER_AUTH_URL ?? "http://localhost:3001",
    appTitle: "AutoApp Builder",
  });

  console.log(`Prompt: ${JSON.stringify(options.prompt)}\n`);
  console.log("Testing models...\n");

  const results: TryResult[] = [];

  for (const model of freeModels) {
    const result = await tryModel(client, model.id, options.prompt);
    results.push(result);
    printResult(result);

    if (result.ok && options.stopOnFirst) {
      console.log(`\nStopped on first success: ${result.model}`);
      return;
    }
  }

  const working = results.filter((r) => r.ok);
  const failed = results.filter((r) => !r.ok);

  console.log("\n" + "=".repeat(72));
  console.log("SUMMARY");
  console.log("=".repeat(72));
  console.log(`Working: ${working.length}/${results.length}`);
  if (working.length > 0) {
    console.log("\nWorking models:");
    for (const r of working) {
      console.log(`  - ${r.model}`);
    }
  }

  if (failed.length > 0) {
    console.log("\nFailed models:");
    for (const r of failed) {
      console.log(`  - ${r.model}: ${r.error}`);
    }
  }

  if (working.length > 0) {
    console.log(`\nRecommendation: use ${working[0]!.model} as OPENROUTER_MODEL default.`);
  } else {
    console.log("\nNo working free models found right now.");
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
