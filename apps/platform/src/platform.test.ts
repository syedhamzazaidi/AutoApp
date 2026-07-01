import { describe, expect, it } from "vitest";
import { classifyPrompt } from "@app/agent-core";

describe("platform agent integration", () => {
  it("classifies login prompt as block activation", () => {
    expect(classifyPrompt("Add login").workType).toBe("block_activation");
  });
});
