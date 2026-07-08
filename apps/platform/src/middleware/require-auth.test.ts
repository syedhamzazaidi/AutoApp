import { afterEach, describe, expect, it } from "vitest";
import { isAuthDisabled, requiresAuth } from "./require-auth.js";

describe("require-auth", () => {
  const original = process.env.BUILDER_AUTH_DISABLED;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.BUILDER_AUTH_DISABLED;
    } else {
      process.env.BUILDER_AUTH_DISABLED = original;
    }
  });

  it("disables auth when BUILDER_AUTH_DISABLED is set", () => {
    process.env.BUILDER_AUTH_DISABLED = "1";
    expect(isAuthDisabled()).toBe(true);
    expect(requiresAuth("/builder")).toBe(false);
    expect(requiresAuth("/api/projects")).toBe(false);
  });

  it("protects builder and API routes when auth is enabled", () => {
    delete process.env.BUILDER_AUTH_DISABLED;
    expect(requiresAuth("/builder")).toBe(true);
    expect(requiresAuth("/builder.js")).toBe(true);
    expect(requiresAuth("/builder.css")).toBe(true);
    expect(requiresAuth("/api/projects")).toBe(true);
    expect(requiresAuth("/api/projects/abc/messages")).toBe(true);
    expect(requiresAuth("/api/health")).toBe(false);
    expect(requiresAuth("/api/auth/sign-in/social")).toBe(false);
    expect(requiresAuth("/")).toBe(false);
  });
});
