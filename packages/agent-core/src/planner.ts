import { mkdirSync, writeFileSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import type { AgentTurnResult, FilePatch } from "@endian/shared";
import { activateBlock, readManifest } from "@endian/block-registry";
import { classifyPrompt } from "./classifier.js";
import { buildContext } from "./context.js";
import { generateFeaturePatches } from "./prompts/feature-generation.js";
import { runBuildGate } from "./build-gate.js";
import { isProtectedPath } from "./protected-paths.js";

export interface PlannerInput {
  prompt: string;
  scaffoldRoot: string;
  protectedPaths: string[];
  llmGenerate?: (prompt: string, context: string) => Promise<FilePatch[]>;
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

  const patches = input.llmGenerate
    ? await input.llmGenerate(input.prompt, JSON.stringify(context))
    : generateFeaturePatches(input.prompt);

  const rejected = patches.filter((p) => isProtectedPath(p.path, input.protectedPaths));
  if (rejected.length) {
    throw new Error(`Protected path edit rejected: ${rejected.map((p) => p.path).join(", ")}`);
  }

  applyPatches(input.scaffoldRoot, patches);
  const buildOutput = await runBuildGate(input.scaffoldRoot);

  return {
    workType: classification.workType,
    patches,
    buildOutput,
  };
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
