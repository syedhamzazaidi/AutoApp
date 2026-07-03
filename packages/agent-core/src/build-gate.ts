import { execSync } from "node:child_process";
import { agentDebug } from "./debug.js";

const MAX_BUILD_LOG_CHARS = 1200;

export type BuildGateResult =
  | { ok: true; output: string }
  | { ok: false; stderr: string };

export function truncateBuildLog(text: string): string {
  if (text.length <= MAX_BUILD_LOG_CHARS) {
    return text;
  }

  return `${text.slice(0, MAX_BUILD_LOG_CHARS)}\n… (truncated)`;
}

export async function runBuildGate(scaffoldRoot: string): Promise<BuildGateResult> {
  try {
    const output = execSync("pnpm build", {
      cwd: scaffoldRoot,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { ok: true, output };
  } catch (error) {
    const err = error as { stderr?: string; stdout?: string };
    const raw = err.stderr ?? err.stdout ?? String(error);
    agentDebug("build stderr (raw)", raw);
    const stderr = truncateBuildLog(raw);
    return { ok: false, stderr };
  }
}
