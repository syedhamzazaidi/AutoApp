import { describe, expect, it } from "vitest";
import { truncateBuildLog } from "./build-gate.js";

describe("truncateBuildLog", () => {
  it("returns short text unchanged", () => {
    expect(truncateBuildLog("ok")).toBe("ok");
  });

  it("truncates long build output with marker", () => {
    const long = "x".repeat(1300);
    const result = truncateBuildLog(long);

    expect(result.length).toBeLessThan(long.length);
    expect(result).toContain("… (truncated)");
  });
});
