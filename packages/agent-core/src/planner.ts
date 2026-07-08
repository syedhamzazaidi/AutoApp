import { existsSync, mkdirSync, writeFileSync, unlinkSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { AgentTurnResult, FilePatch } from "@app/shared";
import { activateBlock, readManifest } from "@app/block-registry";
import { classifyPrompt } from "./classifier.js";
import { buildContext, type ProjectContext } from "./context.js";
import { generateFeaturePatches } from "./prompts/feature-generation.js";
import { runBuildGate } from "./build-gate.js";
import { isProtectedPath } from "./protected-paths.js";
import { agentDebug, previewPatchContent } from "./debug.js";

export type AgentTurnPhase = "planning" | "applying" | "building";

export interface PlannerInput {
  prompt: string;
  scaffoldRoot: string;
  protectedPaths: string[];
  context?: ProjectContext;
  existingPaths?: string[];
  llmGenerate?: (
    prompt: string,
    context: string,
    handlers?: { onToken?: (delta: string) => void },
  ) => Promise<FilePatch[]>;
  onToken?: (delta: string) => void;
  onStatus?: (phase: AgentTurnPhase) => void;
}

export interface PlanPatchesResult {
  workType: AgentTurnResult["workType"];
  patches: FilePatch[];
  blockId?: string;
  manifestUpdates?: AgentTurnResult["manifestUpdates"];
}

export interface ApplyAndBuildInput {
  patches: FilePatch[];
  blockId?: string;
  protectedPaths?: string[];
  onStatus?: (phase: AgentTurnPhase) => void;
}

export function resolveSafePath(scaffoldRoot: string, relativePath: string): string {
  const normalized = relativePath.replace(/\\/g, "/");
  if (normalized.startsWith("/") || normalized.includes("\0")) {
    throw new Error(`Invalid path: ${relativePath}`);
  }

  const resolvedRoot = resolve(scaffoldRoot);
  const fullPath = resolve(resolvedRoot, normalized);

  if (fullPath !== resolvedRoot && !fullPath.startsWith(`${resolvedRoot}/`)) {
    throw new Error(`Path traversal rejected: ${relativePath}`);
  }

  return fullPath;
}

export async function planPatches(input: PlannerInput): Promise<PlanPatchesResult> {
  const classification = classifyPrompt(input.prompt);

  if (classification.workType === "block_activation" && classification.blockId) {
    return {
      workType: "block_activation",
      patches: [],
      blockId: classification.blockId,
    };
  }

  input.onStatus?.("planning");

  const manifest = input.context?.manifest ?? readManifest(input.scaffoldRoot);
  const context =
    input.context ?? buildContext(input.scaffoldRoot, manifest, [], input.protectedPaths);

  const patches = input.llmGenerate
    ? await input.llmGenerate(input.prompt, JSON.stringify(context), {
        onToken: input.onToken,
      })
    : generateFeaturePatches(input.prompt);

  const normalizedPatches = normalizePatchActions(input.scaffoldRoot, patches, input.existingPaths);
  agentDebug("parsed patches", normalizedPatches.map((patch) => ({
    path: patch.path,
    action: patch.action,
    preview: previewPatchContent(patch.content),
  })));

  const rejected = normalizedPatches.filter((p) => isProtectedPath(p.path, input.protectedPaths));
  if (rejected.length) {
    throw new Error(`Protected path edit rejected: ${rejected.map((p) => p.path).join(", ")}`);
  }

  return {
    workType: classification.workType,
    patches: normalizedPatches,
  };
}

export async function applyAndBuild(
  scaffoldRoot: string,
  input: ApplyAndBuildInput,
): Promise<AgentTurnResult> {
  const protectedPaths = input.protectedPaths ?? [];

  if (input.blockId) {
    const manifest = activateBlock(input.blockId, { scaffoldRoot, runMigrations: false });
    return {
      workType: "block_activation",
      patches: [],
      manifestUpdates: manifest,
    };
  }

  const rejected = input.patches.filter((p) => isProtectedPath(p.path, protectedPaths));
  if (rejected.length) {
    throw new Error(`Protected path edit rejected: ${rejected.map((p) => p.path).join(", ")}`);
  }

  input.onStatus?.("applying");
  applyPatches(scaffoldRoot, input.patches);
  input.onStatus?.("building");
  const buildResult = await runBuildGate(scaffoldRoot);

  if (!buildResult.ok) {
    agentDebug("build gate failed", buildResult.stderr);
    return {
      workType: "feature_generation",
      patches: input.patches,
      buildFailed: true,
      buildError: buildResult.stderr,
    };
  }

  return {
    workType: "feature_generation",
    patches: input.patches,
    buildOutput: buildResult.output,
  };
}

/** @deprecated Use planPatches + applyAndBuild in production; kept for unit tests. */
export async function planAndApply(input: PlannerInput): Promise<AgentTurnResult> {
  const plan = await planPatches(input);

  if (plan.blockId) {
    return applyAndBuild(input.scaffoldRoot, {
      blockId: plan.blockId,
      patches: [],
      protectedPaths: input.protectedPaths,
      onStatus: input.onStatus,
    });
  }

  return applyAndBuild(input.scaffoldRoot, {
    patches: plan.patches,
    protectedPaths: input.protectedPaths,
    onStatus: input.onStatus,
  });
}

export function normalizePatchActions(
  scaffoldRoot: string,
  patches: FilePatch[],
  existingPaths?: string[],
): FilePatch[] {
  const existing = existingPaths ? new Set(existingPaths) : null;

  return patches.map((patch) => {
    if (patch.action !== "create") {
      return patch;
    }

    const fileExists = existing
      ? existing.has(patch.path.replace(/\\/g, "/"))
      : existsSync(join(scaffoldRoot, patch.path));

    if (!fileExists) {
      return patch;
    }

    agentDebug(`coerced create→update for existing file: ${patch.path}`);
    return { ...patch, action: "update" };
  });
}

export function applyPatches(scaffoldRoot: string, patches: FilePatch[]): void {
  for (const patch of patches) {
    const fullPath = resolveSafePath(scaffoldRoot, patch.path);
    if (patch.action === "delete") {
      try {
        unlinkSync(fullPath);
      } catch {
        /* ignore */
      }
      continue;
    }
    mkdirSync(dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, patch.content);
  }
}
