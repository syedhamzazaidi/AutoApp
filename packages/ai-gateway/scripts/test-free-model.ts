#!/usr/bin/env tsx
/**
 * Exercise the configured OpenRouter model (defaults to nvidia/nemotron-3-ultra-550b-a55b:free).
 *
 * Usage:
 *   pnpm test:openrouter-model
 *   pnpm test:openrouter-model -- --prompt "Create a contact page"
 *   pnpm test:openrouter-model -- --model nvidia/nemotron-3-ultra-550b-a55b:free --repair
 *
 * Loads env from apps/platform/.env then repo root .env.
 */
import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { OpenRouter } from "@openrouter/agent";
import { OPENROUTER_DEFAULT_MODEL, PATCH_PROMPT } from "../src/openrouter.js";
import { parsePatchesFromModelOutput } from "../src/parse-patches.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");

config({ path: path.join(repoRoot, "apps/platform/.env") });
config({ path: path.join(repoRoot, ".env") });

interface CliOptions {
  prompt: string;
  model: string;
  repair: boolean;
  listSamples: boolean;
}

const SAMPLE_PROMPTS = [
  "Create an about page",
  "Create a plants listing page",
  "Add a simple contact form page",
];

function parseArgs(argv: string[]): CliOptions {
  let prompt = SAMPLE_PROMPTS[0]!;
  let model = process.env.OPENROUTER_MODEL?.trim() || OPENROUTER_DEFAULT_MODEL;
  let repair = false;
  let listSamples = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--prompt" && argv[i + 1]) {
      prompt = argv[++i]!;
    } else if (arg === "--model" && argv[i + 1]) {
      model = argv[++i]!;
    } else if (arg === "--repair") {
      repair = true;
    } else if (arg === "--samples") {
      listSamples = true;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
  }

  return { prompt, model, repair, listSamples };
}

function printHelp(): void {
  console.log(`Test OpenRouter model responses for builder patch generation.

Usage:
  pnpm test:openrouter-model [-- options]

Options:
  --prompt <text>   User prompt to send (default: first sample)
  --model <id>      OpenRouter model id (default: ${OPENROUTER_DEFAULT_MODEL})
  --repair          Run the repair retry flow after a parse failure
  --samples         Run all built-in sample prompts
  --help            Show this help

Environment:
  OPENROUTER_API_KEY   Required
  OPENROUTER_MODEL     Optional override for default model
`);
}

function divider(label: string): void {
  console.log(`\n${"=".repeat(72)}\n${label}\n${"=".repeat(72)}`);
}

async function callModel(
  client: OpenRouter,
  model: string,
  input: string,
): Promise<{ text: string; promptTokens: number; completionTokens: number; latencyMs: number }> {
  const start = Date.now();
  const result = client.callModel({
    model,
    instructions: PATCH_PROMPT,
    input,
  });

  const text = await result.getText();
  const response = await result.getResponse();

  return {
    text,
    promptTokens: response.usage?.inputTokens ?? 0,
    completionTokens: response.usage?.outputTokens ?? 0,
    latencyMs: Date.now() - start,
  };
}

async function runPrompt(client: OpenRouter, model: string, prompt: string, repair: boolean): Promise<void> {
  divider(`Prompt: ${prompt}`);

  const first = await callModel(
    client,
    model,
    `Project context:\n{"fileTree":["src/pages/Home.tsx"],"manifest":{"blocks":{}}}\n\nUser request:\n${prompt}`,
  );

  console.log("\n--- Raw response ---");
  console.log(first.text);
  console.log("\n--- Usage ---");
  console.log(
    `model=${model} promptTokens=${first.promptTokens} completionTokens=${first.completionTokens} latencyMs=${first.latencyMs}`,
  );

  try {
    const patches = parsePatchesFromModelOutput(first.text);
    console.log("\n--- Parse result: OK ---");
    for (const patch of patches) {
      console.log(`  ${patch.action} ${patch.path} (${patch.content.length} chars)`);
    }
    return;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log("\n--- Parse result: FAILED ---");
    console.log(message);
  }

  if (!repair) {
    console.log("\nTip: re-run with --repair to test the correction retry flow.");
    return;
  }

  console.log("\n--- Repair attempt ---");
  const repairResult = await callModel(
    client,
    model,
    `Fix the model output below into a valid JSON array of file patches only.

Original request:
${prompt}

Invalid output:
${first.text}`,
  );

  console.log(repairResult.text);

  try {
    const patches = parsePatchesFromModelOutput(repairResult.text);
    console.log("\n--- Repair parse: OK ---");
    for (const patch of patches) {
      console.log(`  ${patch.action} ${patch.path} (${patch.content.length} chars)`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log("\n--- Repair parse: FAILED ---");
    console.log(message);
  }
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();

  if (!apiKey) {
    console.error("Missing OPENROUTER_API_KEY. Set it in apps/platform/.env");
    process.exit(1);
  }

  const client = new OpenRouter({
    apiKey,
    httpReferer: process.env.BETTER_AUTH_URL ?? "http://localhost:3001",
    appTitle: "AutoApp Builder",
  });

  console.log(`OpenRouter model tester`);
  console.log(`Model: ${options.model}`);

  const prompts = options.listSamples ? SAMPLE_PROMPTS : [options.prompt];
  for (const prompt of prompts) {
    await runPrompt(client, options.model, prompt, options.repair);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
