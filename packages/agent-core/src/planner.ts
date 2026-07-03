import { existsSync, mkdirSync, writeFileSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import type { AgentTurnResult, FilePatch } from "@app/shared";
import { activateBlock, readManifest } from "@app/block-registry";
import { classifyPrompt } from "./classifier.js";
import { buildContext } from "./context.js";
import { generateFeaturePatches } from "./prompts/feature-generation.js";
import { runBuildGate } from "./build-gate.js";
import { isProtectedPath } from "./protected-paths.js";
import { agentDebug, previewPatchContent } from "./debug.js";

export type AgentTurnPhase = "planning" | "applying" | "building";

export interface PlannerInput {
  prompt: string;
  scaffoldRoot: string;
  protectedPaths: string[];
  llmGenerate?: (
    prompt: string,
    context: string,
    handlers?: { onToken?: (delta: string) => void },
  ) => Promise<FilePatch[]>;
  onToken?: (delta: string) => void;
  onStatus?: (phase: AgentTurnPhase) => void;
}

export async function planAndApply(input: PlannerInput): Promise<AgentTurnResult> {
  const classification = classifyPrompt(input.prompt);
  const manifest = readManifest(input.scaffoldRoot);
  const context = buildContext(input.scaffoldRoot, manifest, [], input.protectedPaths);

  if (classification.workType === "block_activation" && classification.blockId) {
    const manifest = activateBlock(classification.blockId, { scaffoldRoot: input.scaffoldRoot });
    return {
      workType: "block_activation",
      patches: [],
      manifestUpdates: manifest,
    };
  }

  input.onStatus?.("planning");

  const patches = input.llmGenerate
    ? await input.llmGenerate(input.prompt, JSON.stringify(context), {
        onToken: input.onToken,
      })
    : generateFeaturePatches(input.prompt);

  const normalizedPatches = normalizePatchActions(input.scaffoldRoot, patches);
  agentDebug("parsed patches", normalizedPatches.map((patch) => ({
    path: patch.path,
    action: patch.action,
    preview: previewPatchContent(patch.content),
  })));

  const rejected = normalizedPatches.filter((p) => isProtectedPath(p.path, input.protectedPaths));
  if (rejected.length) {
    throw new Error(`Protected path edit rejected: ${rejected.map((p) => p.path).join(", ")}`);
  }

  input.onStatus?.("applying");
  applyPatches(input.scaffoldRoot, normalizedPatches);
  input.onStatus?.("building");
  const buildResult = await runBuildGate(input.scaffoldRoot);

  if (!buildResult.ok) {
    agentDebug("build gate failed", buildResult.stderr);
    return {
      workType: classification.workType,
      patches: normalizedPatches,
      buildFailed: true,
      buildError: buildResult.stderr,
    };
  }

  return {
    workType: classification.workType,
    patches: normalizedPatches,
    buildOutput: buildResult.output,
  };
}

export function normalizePatchActions(scaffoldRoot: string, patches: FilePatch[]): FilePatch[] {
  return patches.map((patch) => {
    if (patch.action !== "create") {
      return patch;
    }

    const fullPath = join(scaffoldRoot, patch.path);
    if (!existsSync(fullPath)) {
      return patch;
    }

    agentDebug(`coerced create→update for existing file: ${patch.path}`);
    return { ...patch, action: "update" };
  });
}

export function applyPatches(scaffoldRoot: string, patches: FilePatch[]): void {
  for (const patch of patches) {
    const fullPath = join(scaffoldRoot, patch.path);
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
