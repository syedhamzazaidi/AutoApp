import { OpenRouter } from "@openrouter/agent";
import type { FilePatch } from "@app/shared";
import { SYSTEM_PROMPT, agentDebug, previewPatchContent } from "@app/agent-core";
import { parsePatchesFromModelOutput } from "./parse-patches.js";
import { recordAiUsage } from "./usage-tracker.js";

const DEFAULT_MODEL = "openrouter/free";

export const OPENROUTER_DEFAULT_MODEL = DEFAULT_MODEL;

export const PATCH_PROMPT = `${SYSTEM_PROMPT}

You must respond with ONLY a JSON array of file patches. No prose, no markdown fences.

Rules:
- Return a JSON array, even for a single file.
- Each item must have: path, action ("create"|"update"|"delete"), content.
- Put file content on one line; use JSON string escapes (\\n for newlines, \\" for quotes).
- Do not double-escape: write \\n in JSON, not \\\\n.
- The landing/hero page is src/pages/Index.tsx (route "/"). For hero or home page requests, update that file.
- If a path appears in editableFiles or fileTree, use action "update" (not "create").
- Include every import a file needs. For links: import { Link } from "react-router-dom" and use the "to" prop.
- Only create files under src/pages, src/services, or src/components.

Example response:
[{"path":"src/pages/Index.tsx","action":"update","content":"import { Link } from \\"react-router-dom\\";\\n\\nexport default function Home(){\\n  return <div className=\\"p-8\\"><h1>Welcome</h1><Link to=\\"/about\\">About</Link></div>;\\n}"}]`;

let client: OpenRouter | null = null;

function getDefaultModel(): string {
  return process.env.OPENROUTER_MODEL?.trim() || DEFAULT_MODEL;
}

function getClient(): OpenRouter | null {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }

  if (!client) {
    client = new OpenRouter({
      apiKey,
      httpReferer: process.env.BETTER_AUTH_URL ?? "http://localhost:3001",
      appTitle: "AutoApp Builder",
    });
  }

  return client;
}

export function isOpenRouterConfigured(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY?.trim());
}

export interface GeneratePatchesOptions {
  prompt: string;
  context: string;
  customerId: string;
  endpoint?: string;
  onToken?: (delta: string) => void;
}

async function callModelForPatches(
  openRouter: OpenRouter,
  model: string,
  instructions: string,
  input: string,
  onToken?: (delta: string) => void,
): Promise<{ text: string; promptTokens: number; completionTokens: number; latencyMs: number }> {
  const start = Date.now();
  const result = openRouter.callModel({ model, instructions, input });

  let text: string;
  if (onToken) {
    const chunks: string[] = [];
    for await (const delta of result.getTextStream()) {
      chunks.push(delta);
      onToken(delta);
    }
    text = chunks.join("");
  } else {
    text = await result.getText();
  }

  const response = await result.getResponse();

  return {
    text,
    promptTokens: response.usage?.inputTokens ?? 0,
    completionTokens: response.usage?.outputTokens ?? 0,
    latencyMs: Date.now() - start,
  };
}

export async function generatePatchesWithOpenRouter(
  options: GeneratePatchesOptions,
): Promise<FilePatch[]> {
  const openRouter = getClient();
  if (!openRouter) {
    throw new Error("OPENROUTER_API_KEY is not configured");
  }

  const model = getDefaultModel();
  const input = `Project context:\n${options.context}\n\nUser request:\n${options.prompt}`;

  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;
  let totalLatencyMs = 0;

  const first = await callModelForPatches(openRouter, model, PATCH_PROMPT, input, options.onToken);
  totalPromptTokens += first.promptTokens;
  totalCompletionTokens += first.completionTokens;
  totalLatencyMs += first.latencyMs;

  try {
    const patches = parsePatchesFromModelOutput(first.text);
    agentDebug("openrouter parsed patches", patches.map((patch) => ({
      path: patch.path,
      action: patch.action,
      preview: previewPatchContent(patch.content),
    })));
    await recordUsage(options, model, totalPromptTokens, totalCompletionTokens, totalLatencyMs);
    return patches;
  } catch (firstError) {
    const repair = await callModelForPatches(
      openRouter,
      model,
      PATCH_PROMPT,
      `Fix the model output below into a valid JSON array of file patches only.

Original request:
${options.prompt}

Invalid output:
${first.text}`,
    );

    totalPromptTokens += repair.promptTokens;
    totalCompletionTokens += repair.completionTokens;
    totalLatencyMs += repair.latencyMs;

    try {
      const patches = parsePatchesFromModelOutput(repair.text);
      await recordUsage(options, model, totalPromptTokens, totalCompletionTokens, totalLatencyMs);
      return patches;
    } catch {
      throw firstError instanceof Error ? firstError : new Error(String(firstError));
    }
  }
}

async function recordUsage(
  options: GeneratePatchesOptions,
  model: string,
  promptTokens: number,
  completionTokens: number,
  latencyMs: number,
): Promise<void> {
  await recordAiUsage({
    customerId: options.customerId,
    customerType: "builder",
    endpoint: options.endpoint ?? "agent-turn",
    source: "builder",
    model,
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
    latencyMs,
  });
}
