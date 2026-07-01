import { execSync } from "node:child_process";

export async function runBuildGate(scaffoldRoot: string): Promise<string> {
  try {
    const output = execSync("pnpm build", {
      cwd: scaffoldRoot,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return output;
  } catch (error) {
    const err = error as { stderr?: string; stdout?: string };
    throw new Error(`Build failed:\n${err.stderr ?? err.stdout ?? String(error)}`);
  }
}
