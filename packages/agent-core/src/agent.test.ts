import { describe, expect, it } from "vitest";
import { classifyPrompt } from "./classifier.js";
import { isProtectedPath } from "./protected-paths.js";

describe("classifier", () => {
  it('routes "add login" to block_activation', () => {
    const result = classifyPrompt("Add login to my app");
    expect(result.workType).toBe("block_activation");
    expect(result.blockId).toBe("auth");
  });

  it('routes "build todo app" to feature_generation', () => {
    const result = classifyPrompt("Build a todo app with tasks");
    expect(result.workType).toBe("feature_generation");
  });
});

describe("protected paths", () => {
  it("rejects auth provider edits", () => {
    expect(isProtectedPath("src/features/auth/AuthProvider.tsx", ["src/features/auth/AuthProvider.tsx"])).toBe(true);
    expect(isProtectedPath("src/pages/MyPage.tsx", ["src/features/auth/**"])).toBe(false);
  });
});
