import { describe, expect, it } from "vitest";
import { validateClientEnv } from "@endian/shared";

describe("env validation", () => {
  it("allows empty keys in development", () => {
    const env = validateClientEnv({}, "development");
    expect(env).toBeDefined();
  });

  it("rejects service_role in client env", () => {
    expect(() =>
      validateClientEnv({ VITE_SUPABASE_ANON_KEY: "service_role_abc" }, "development"),
    ).toThrow(/service_role/);
  });
});
