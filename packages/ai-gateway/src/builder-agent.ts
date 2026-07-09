import {
  FunctionCallingConfigMode,
  Type,
  type Content,
  type FunctionCall,
  type FunctionDeclaration,
  type Part,
} from "@google/genai";
import {
  DEFAULT_PROTECTED_PATHS,
  isProtectedPath,
  normalizePatchActions,
  PLANNER_PROMPT,
  REACT_PROMPT,
} from "@app/agent-core";
import type { AgentMessage, FilePatch, WorkType } from "@app/shared";
import type { ApplyPatchesResponse, SandboxClient } from "@app/sandbox-client";
import {
  generateContent,
  generateContentStream,
  getVertexModel,
  type GenerateContentResult,
} from "./gemini.js";
import { recordAiUsage } from "./usage-tracker.js";

const MAX_REACT_STEPS = 10;
const MAX_INSPECT_TREE = 200;
const MAX_FILE_CHARS = 24_000;

export type BuilderAgentEvent =
  | { type: "status"; phase: string }
  | { type: "plan"; plan: BuilderPlan }
  | {
      type: "tool";
      name: string;
      args?: Record<string, unknown>;
      result?: unknown;
      error?: string;
    }
  | { type: "token"; delta: string };

export interface BuilderPlan {
  goal: string;
  steps: string[];
  filesToTouch: string[];
  notes: string;
}

export interface BuilderAgentOptions {
  prompt: string;
  projectId: string;
  customerId: string;
  sandboxClient: SandboxClient;
  recentMessages?: AgentMessage[];
  protectedPaths?: string[];
  maxSteps?: number;
  model?: string;
  onToken?: (delta: string) => void;
  onStatus?: (phase: string) => void;
  onEvent?: (event: BuilderAgentEvent) => void;
}

export interface BuilderAgentResult {
  reply: string;
  plan: BuilderPlan;
  workType: WorkType;
  patches: FilePatch[];
  appliedPaths: string[];
  buildOutput?: string;
  buildFailed?: boolean;
  buildError?: string;
  manifestUpdates?: ApplyPatchesResponse["manifestUpdates"];
  stepsUsed: number;
  model: string;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
}

interface UsageAccumulator {
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
  model: string;
}

function emit(
  options: BuilderAgentOptions,
  event: BuilderAgentEvent,
): void {
  options.onEvent?.(event);
  if (event.type === "status") {
    options.onStatus?.(event.phase);
  }
  if (event.type === "token") {
    options.onToken?.(event.delta);
  }
}

function accumulateUsage(
  acc: UsageAccumulator,
  result: GenerateContentResult,
): void {
  acc.promptTokens += result.promptTokens;
  acc.completionTokens += result.completionTokens;
  acc.latencyMs += result.latencyMs;
  acc.model = result.model;
}

function parseJsonObject(raw: string): Record<string, unknown> | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const candidates: string[] = [];
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) candidates.push(fenced[1].trim());

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    candidates.push(trimmed.slice(start, end + 1));
  }
  candidates.push(trimmed);

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      /* try next */
    }
  }
  return null;
}

function normalizePlan(raw: string, prompt: string): BuilderPlan {
  const parsed = parseJsonObject(raw);
  if (!parsed) {
    return {
      goal: prompt.trim(),
      steps: ["Inspect the project", "Apply minimal patches", "Verify build"],
      filesToTouch: [],
      notes: "Planner returned non-JSON; using a minimal fallback plan.",
    };
  }

  const steps = Array.isArray(parsed.steps)
    ? parsed.steps.filter((s): s is string => typeof s === "string")
    : [];
  const filesToTouch = Array.isArray(parsed.filesToTouch)
    ? parsed.filesToTouch.filter((s): s is string => typeof s === "string")
    : [];

  return {
    goal: typeof parsed.goal === "string" && parsed.goal.trim()
      ? parsed.goal.trim()
      : prompt.trim(),
    steps: steps.length
      ? steps
      : ["Inspect the project", "Apply minimal patches", "Verify build"],
    filesToTouch,
    notes: typeof parsed.notes === "string" ? parsed.notes : "",
  };
}

function formatRecentMessages(messages: AgentMessage[]): string {
  if (!messages.length) return "(none)";
  return messages
    .slice(-10)
    .map((m) => `${m.role}: ${m.content.slice(0, 500)}`)
    .join("\n");
}

function modelContentFromResponse(
  response: GenerateContentResult["response"],
): Content {
  const parts = response.candidates?.[0]?.content?.parts;
  if (parts?.length) {
    return { role: "model", parts };
  }

  const calls = response.functionCalls;
  if (calls?.length) {
    return {
      role: "model",
      parts: calls.map((call) => ({ functionCall: call })),
    };
  }

  const text = response.text;
  return {
    role: "model",
    parts: [{ text: text || "" }],
  };
}

function functionResponseParts(
  calls: FunctionCall[],
  results: Array<{ name: string; response: Record<string, unknown> }>,
): Part[] {
  return results.map((result, index) => {
    const call = calls[index];
    return {
      functionResponse: {
        id: call?.id,
        name: result.name,
        response: result.response,
      },
    };
  });
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n… (truncated)`;
}

function asFilePatches(value: unknown): FilePatch[] {
  if (!Array.isArray(value)) {
    throw new Error("apply_patches requires a patches array");
  }

  return value.map((entry, index) => {
    if (!entry || typeof entry !== "object") {
      throw new Error(`Patch at index ${index} is not an object`);
    }
    const patch = entry as Record<string, unknown>;
    const path = typeof patch.path === "string" ? patch.path.replace(/^\/+/, "") : "";
    const action = patch.action;
    const content = typeof patch.content === "string" ? patch.content : "";

    if (!path) {
      throw new Error(`Patch at index ${index} is missing path`);
    }
    if (action !== "create" && action !== "update" && action !== "delete") {
      throw new Error(`Patch at index ${index} has invalid action`);
    }

    return {
      path,
      action,
      content: action === "delete" ? "" : content,
    };
  });
}

const TOOL_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: "inspect_project",
    description:
      "Inspect the sandbox project: file tree, blocks manifest, and protected paths. Does not return bulk file bodies.",
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
  {
    name: "read_file",
    description:
      "Read a single editable source file (src/pages, src/components, src/services). Protected paths are rejected.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        path: {
          type: Type.STRING,
          description: "Relative path within the project workspace",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "apply_patches",
    description:
      "Validate and apply file patches, then run the build gate. Returns build ok/error observation.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        patches: {
          type: Type.ARRAY,
          description: "File patches to apply",
          items: {
            type: Type.OBJECT,
            properties: {
              path: { type: Type.STRING },
              action: {
                type: Type.STRING,
                format: "enum",
                enum: ["create", "update", "delete"],
              },
              content: { type: Type.STRING },
            },
            required: ["path", "action"],
          },
        },
      },
      required: ["patches"],
    },
  },
  {
    name: "activate_block",
    description:
      "Activate a known block recipe (auth, storage, ai, rbac) without writing patches manually.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        blockId: {
          type: Type.STRING,
          description: "Block id: auth | storage | ai | rbac",
        },
      },
      required: ["blockId"],
    },
  },
  {
    name: "finish",
    description: "End the turn with a short user-facing summary of what changed.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        summary: {
          type: Type.STRING,
          description: "User-facing summary of the completed work",
        },
      },
      required: ["summary"],
    },
  },
];

async function runPlanner(
  options: BuilderAgentOptions,
  usage: UsageAccumulator,
): Promise<BuilderPlan> {
  emit(options, { type: "status", phase: "planning" });

  const plannerContents: Content[] = [
    {
      role: "user",
      parts: [
        {
          text: `User request:\n${options.prompt}\n\nRecent messages:\n${formatRecentMessages(options.recentMessages ?? [])}\n\nReturn the plan JSON now.`,
        },
      ],
    },
  ];

  const result = await generateContentStream({
    model: options.model,
    contents: plannerContents,
    config: {
      systemInstruction: PLANNER_PROMPT,
      temperature: 0.2,
      responseMimeType: "application/json",
    },
    onToken: (delta) => emit(options, { type: "token", delta }),
  });

  accumulateUsage(usage, result);
  return normalizePlan(result.text, options.prompt);
}

interface ToolExecContext {
  options: BuilderAgentOptions;
  protectedPaths: string[];
  existingPaths: Set<string>;
  appliedPatches: FilePatch[];
  lastApply?: ApplyPatchesResponse;
  workType: WorkType;
}

async function executeTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolExecContext,
): Promise<{ response: Record<string, unknown>; finished?: boolean; summary?: string }> {
  const { options, protectedPaths } = ctx;
  const { sandboxClient, projectId } = options;

  switch (name) {
    case "inspect_project": {
      const context = await sandboxClient.getContext(projectId);
      for (const path of context.fileTree) {
        ctx.existingPaths.add(path.replace(/\\/g, "/"));
      }
      return {
        response: {
          fileTree: context.fileTree.slice(0, MAX_INSPECT_TREE),
          fileTreeTruncated: context.fileTree.length > MAX_INSPECT_TREE,
          manifest: context.manifest,
          protectedPaths: context.protectedPaths.length
            ? context.protectedPaths
            : protectedPaths,
          editablePrefixes: ["src/pages/", "src/components/", "src/services/"],
        },
      };
    }

    case "read_file": {
      const path = typeof args.path === "string" ? args.path.replace(/^\/+/, "") : "";
      if (!path) {
        return { response: { error: "path is required" } };
      }
      if (isProtectedPath(path, protectedPaths)) {
        return { response: { error: `Protected path rejected: ${path}` } };
      }
      try {
        const file = await sandboxClient.readFile(projectId, path);
        ctx.existingPaths.add(file.path.replace(/\\/g, "/"));
        return {
          response: {
            path: file.path,
            content: truncate(file.content, MAX_FILE_CHARS),
          },
        };
      } catch (error) {
        return {
          response: {
            error: error instanceof Error ? error.message : String(error),
          },
        };
      }
    }

    case "apply_patches": {
      let patches: FilePatch[];
      try {
        patches = asFilePatches(args.patches);
      } catch (error) {
        return {
          response: {
            error: error instanceof Error ? error.message : String(error),
          },
        };
      }

      const normalized = normalizePatchActions("/workspace", patches, [
        ...ctx.existingPaths,
      ]);
      const rejected = normalized.filter((p) =>
        isProtectedPath(p.path, protectedPaths),
      );
      if (rejected.length) {
        return {
          response: {
            error: `Protected path edit rejected: ${rejected.map((p) => p.path).join(", ")}`,
          },
        };
      }

      emit(options, { type: "status", phase: "applying" });
      try {
        const result = await sandboxClient.applyPatches(projectId, {
          patches: normalized,
        });
        emit(options, { type: "status", phase: "building" });

        ctx.lastApply = result;
        ctx.workType = result.workType ?? "feature_generation";
        ctx.appliedPatches.push(...result.patches);
        for (const patch of result.patches) {
          const path = patch.path.replace(/\\/g, "/");
          if (patch.action === "delete") {
            ctx.existingPaths.delete(path);
          } else {
            ctx.existingPaths.add(path);
          }
        }

        return {
          response: {
            ok: !result.buildFailed,
            buildFailed: Boolean(result.buildFailed),
            buildError: result.buildError,
            buildOutput: result.buildOutput
              ? truncate(result.buildOutput, 4000)
              : undefined,
            applied: result.patches.map((p: FilePatch) => ({
              path: p.path,
              action: p.action,
            })),
            workType: result.workType,
          },
        };
      } catch (error) {
        return {
          response: {
            error: error instanceof Error ? error.message : String(error),
          },
        };
      }
    }

    case "activate_block": {
      const blockId =
        typeof args.blockId === "string" ? args.blockId.trim() : "";
      if (!blockId) {
        return { response: { error: "blockId is required" } };
      }

      emit(options, { type: "status", phase: "applying" });
      try {
        const result = await sandboxClient.applyPatches(projectId, {
          patches: [],
          blockId,
        });
        ctx.lastApply = result;
        ctx.workType = result.workType ?? "block_activation";
        return {
          response: {
            ok: true,
            blockId,
            workType: result.workType,
            manifestUpdates: result.manifestUpdates,
          },
        };
      } catch (error) {
        return {
          response: {
            error: error instanceof Error ? error.message : String(error),
          },
        };
      }
    }

    case "finish": {
      const summary =
        typeof args.summary === "string" && args.summary.trim()
          ? args.summary.trim()
          : "Done.";
      return { response: { ok: true, summary }, finished: true, summary };
    }

    default:
      return { response: { error: `Unknown tool: ${name}` } };
  }
}

async function runReactLoop(
  options: BuilderAgentOptions,
  plan: BuilderPlan,
  usage: UsageAccumulator,
): Promise<{
  reply: string;
  stepsUsed: number;
  ctx: ToolExecContext;
}> {
  emit(options, { type: "status", phase: "executing" });

  const protectedPaths =
    options.protectedPaths?.length
      ? options.protectedPaths
      : DEFAULT_PROTECTED_PATHS;

  const ctx: ToolExecContext = {
    options,
    protectedPaths,
    existingPaths: new Set(),
    appliedPatches: [],
    workType: "feature_generation",
  };

  const contents: Content[] = [
    {
      role: "user",
      parts: [
        {
          text: [
            `User request:\n${options.prompt}`,
            `Plan JSON:\n${JSON.stringify(plan, null, 2)}`,
            `Recent messages:\n${formatRecentMessages(options.recentMessages ?? [])}`,
            "Execute the plan with tools. Call finish when done.",
          ].join("\n\n"),
        },
      ],
    },
  ];

  const maxSteps = options.maxSteps ?? MAX_REACT_STEPS;
  let reply = "";
  let stepsUsed = 0;

  for (let step = 1; step <= maxSteps; step += 1) {
    stepsUsed = step;

    const result = await generateContent({
      model: options.model,
      contents,
      config: {
        systemInstruction: REACT_PROMPT,
        temperature: 0.2,
        tools: [{ functionDeclarations: TOOL_DECLARATIONS }],
        toolConfig: {
          functionCallingConfig: {
            mode: FunctionCallingConfigMode.AUTO,
          },
        },
        automaticFunctionCalling: { disable: true },
      },
    });

    accumulateUsage(usage, result);

    const functionCalls = result.response.functionCalls ?? [];
    contents.push(modelContentFromResponse(result.response));

    if (!functionCalls.length) {
      reply = result.text.trim() || "Completed the planned changes.";
      if (result.text) {
        emit(options, { type: "token", delta: result.text });
      }
      break;
    }

    const toolResults: Array<{
      name: string;
      response: Record<string, unknown>;
    }> = [];
    let finished = false;

    for (const call of functionCalls) {
      const name = call.name ?? "unknown";
      const args = (call.args ?? {}) as Record<string, unknown>;

      let exec: Awaited<ReturnType<typeof executeTool>>;
      try {
        exec = await executeTool(name, args, ctx);
      } catch (error) {
        exec = {
          response: {
            error: error instanceof Error ? error.message : String(error),
          },
        };
      }

      emit(options, {
        type: "tool",
        name,
        args,
        result: exec.response,
        error:
          typeof exec.response.error === "string"
            ? exec.response.error
            : undefined,
      });

      toolResults.push({ name, response: exec.response });

      if (exec.finished) {
        finished = true;
        reply = exec.summary ?? "Done.";
      }
    }

    contents.push({
      role: "user",
      parts: functionResponseParts(functionCalls, toolResults),
    });

    if (finished) {
      break;
    }

    if (step === maxSteps) {
      reply =
        reply ||
        "Reached the maximum number of tool steps. Review the applied changes.";
    }
  }

  return { reply, stepsUsed, ctx };
}

/**
 * Planner → ReAct builder agent using Vertex Gemini function calling.
 * Side-effect tools are executed manually (AFC disabled).
 */
export async function runBuilderAgent(
  options: BuilderAgentOptions,
): Promise<BuilderAgentResult> {
  const usage: UsageAccumulator = {
    promptTokens: 0,
    completionTokens: 0,
    latencyMs: 0,
    model: options.model ?? getVertexModel(),
  };

  const plan = await runPlanner(options, usage);
  emit(options, { type: "plan", plan });

  const { reply, stepsUsed, ctx } = await runReactLoop(options, plan, usage);

  await recordAiUsage({
    customerId: options.customerId,
    customerType: "builder",
    endpoint: "agent-turn",
    source: "builder",
    model: usage.model,
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
    totalTokens: usage.promptTokens + usage.completionTokens,
    latencyMs: usage.latencyMs,
  });

  const applied = ctx.lastApply;
  const patches = applied?.patches?.length
    ? applied.patches
    : ctx.appliedPatches;
  const appliedPaths = patches.map((p: FilePatch) => p.path);

  return {
    reply,
    plan,
    workType: ctx.workType,
    patches,
    appliedPaths,
    buildOutput: applied?.buildOutput,
    buildFailed: applied?.buildFailed,
    buildError: applied?.buildError,
    manifestUpdates: applied?.manifestUpdates,
    stepsUsed,
    model: usage.model,
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
    latencyMs: usage.latencyMs,
  };
}

/** Exported for unit tests. */
export const __test = {
  normalizePlan,
  asFilePatches,
  TOOL_DECLARATIONS,
  parseJsonObject,
  executeTool,
};
