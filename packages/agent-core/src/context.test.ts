import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildContext, buildEditableFileContents } from "./context.js";

describe("buildEditableFileContents", () => {
  let root = "";

  afterEach(() => {
    if (root) {
      rmSync(root, { recursive: true, force: true });
      root = "";
    }
  });

  it("includes existing editable source files", () => {
    root = mkdtempSync(join(tmpdir(), "agent-core-context-"));
    mkdirSync(join(root, "src/pages"), { recursive: true });
    writeFileSync(join(root, "src/pages/Index.tsx"), "export default function Home() { return null; }");

    const contents = buildEditableFileContents(root, ["src/pages/Index.tsx", "package.json"]);

    expect(contents["src/pages/Index.tsx"]).toContain("Home");
    expect(contents["package.json"]).toBeUndefined();
  });
});

describe("buildContext", () => {
  it("includes editableFiles in project context", () => {
    const root = mkdtempSync(join(tmpdir(), "agent-core-context-"));
    mkdirSync(join(root, "src/pages"), { recursive: true });
    writeFileSync(join(root, "src/pages/Index.tsx"), "export default function Home() { return null; }");
    writeFileSync(join(root, "lovable.blocks.json"), JSON.stringify({ blocks: {} }));

    const context = buildContext(root, { blocks: {} }, [], []);

    expect(context.editableFiles["src/pages/Index.tsx"]).toContain("Home");

    rmSync(root, { recursive: true, force: true });
  });
});
