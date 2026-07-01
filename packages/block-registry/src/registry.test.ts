import { describe, expect, it } from "vitest";
import { getDefaultManifest, isBlockEnabled } from "./recipes/index.js";
import { validateManifestSchema } from "./manifest.js";

describe("block-registry", () => {
  it("validates default manifest", () => {
    const manifest = getDefaultManifest();
    expect(validateManifestSchema(manifest)).toEqual([]);
  });

  it("detects enabled blocks", () => {
    const manifest = getDefaultManifest();
    expect(isBlockEnabled(manifest, "auth")).toBe(false);
    manifest.blocks.auth.state = "enabled";
    expect(isBlockEnabled(manifest, "auth")).toBe(true);
  });
});
