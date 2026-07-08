import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as buildGate from "./build-gate.js";
import { applyPatches, normalizePatchActions, planAndApply } from "./planner.js";

describe("planAndApply build failure", () => {
  let scaffoldRoot = "";

  afterEach(() => {
    if (scaffoldRoot) {
      rmSync(scaffoldRoot, { recursive: true, force: true });
      scaffoldRoot = "";
    }
    vi.restoreAllMocks();
  });

  it("returns structured build failure after patches are applied", async () => {
    scaffoldRoot = mkdtempSync(join(tmpdir(), "agent-core-build-fail-"));
    writeFileSync(
      join(scaffoldRoot, "lovable.blocks.json"),
      JSON.stringify({ blocks: {} }, null, 2),
    );

    vi.spyOn(buildGate, "runBuildGate").mockResolvedValue({
      ok: false,
      stderr: "error TS2322: Type 'string' is not assignable to type 'number'.",
    });

    const result = await planAndApply({
      prompt: "Build a todo app with tasks",
      scaffoldRoot,
      protectedPaths: [],
    });

    expect(result.buildFailed).toBe(true);
    expect(result.buildError).toContain("TS2322");
    expect(result.patches.length).toBeGreaterThan(0);
    expect(readFileSync(join(scaffoldRoot, result.patches[0].path), "utf-8")).toBe(
      result.patches[0].content,
    );
  });

  it("coerces create to update when target file already exists", () => {
    scaffoldRoot = mkdtempSync(join(tmpdir(), "agent-core-normalize-"));
    const target = join(scaffoldRoot, "src/pages/Index.tsx");
    mkdirSync(join(scaffoldRoot, "src/pages"), { recursive: true });
    writeFileSync(target, "export default function Old() { return null; }");

    const patches = normalizePatchActions(scaffoldRoot, [
      {
        path: "src/pages/Index.tsx",
        action: "create",
        content: "export default function New() { return null; }",
      },
    ]);

    expect(patches[0]?.action).toBe("update");
  });

  it("rejects path traversal in applyPatches", () => {
    scaffoldRoot = mkdtempSync(join(tmpdir(), "agent-core-traversal-"));

    expect(() =>
      applyPatches(scaffoldRoot, [
        { path: "../../outside.txt", action: "create", content: "pwned" },
      ]),
    ).toThrow(/Path traversal rejected/);
  });

  it("applies a valid hero Index patch without missing imports", () => {
    scaffoldRoot = mkdtempSync(join(tmpdir(), "agent-core-hero-patch-"));
    mkdirSync(join(scaffoldRoot, "src/pages"), { recursive: true });
    writeFileSync(
      join(scaffoldRoot, "lovable.blocks.json"),
      JSON.stringify({ blocks: {} }, null, 2),
    );
    writeFileSync(join(scaffoldRoot, "src/pages/Index.tsx"), "export default function Home() { return null; }");

    const heroPatch = {
      path: "src/pages/Index.tsx",
      action: "create" as const,
      content: `import { Link } from "react-router-dom";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center space-y-6">
      <h1 className="text-4xl font-bold">My Kitchen</h1>
      <Link to="/menu">View Menu</Link>
    </div>
  );
}
`,
    };

    applyPatches(scaffoldRoot, normalizePatchActions(scaffoldRoot, [heroPatch]));
    const written = readFileSync(join(scaffoldRoot, "src/pages/Index.tsx"), "utf-8");

    expect(written).toContain('import { Link } from "react-router-dom"');
    expect(written).toContain('to="/menu"');
    expect(written).not.toContain("href=");
  });
});
