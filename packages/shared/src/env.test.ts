import { describe, expect, it } from "vitest";
import { validateClientEnv } from "./index";

describe("validateClientEnv", () => {
  it("rejects service_role in VITE_* keys", () => {
    expect(() =>
      validateClientEnv(
        {
          VITE_SUPABASE_URL: "https://x.supabase.co",
          VITE_SUPABASE_ANON_KEY: "service_role_secret",
        },
        "development",
      ),
    ).toThrow(/service_role/);
  });

  it("requires keys in production mode", () => {
    expect(() => validateClientEnv({}, "production")).toThrow(/required in production/);
  });

  it("allows empty keys in development", () => {
    const env = validateClientEnv({}, "development");
    expect(env.VITE_SUPABASE_URL).toBeUndefined();
  });
});
