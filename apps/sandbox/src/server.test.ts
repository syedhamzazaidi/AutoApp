import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createSandboxClient, signSandboxRequest, SANDBOX_AUTH_HEADERS } from "@app/sandbox-client";

process.env.VITEST = "true";
process.env.SANDBOX_AUTH_SECRET = "test-sandbox-secret";
process.env.VITE_PROJECT_ID = "proj-test";

const workspaceRoot = mkdtempSync(join(tmpdir(), "sandbox-read-file-"));
process.env.WORKSPACE_ROOT = workspaceRoot;

const { app } = await import("./server.js");

const PROJECT_ID = "proj-test";
const AUTH_SECRET = "test-sandbox-secret";

function authHeaders(method: string, path: string, body = "") {
  const auth = signSandboxRequest(AUTH_SECRET, PROJECT_ID, method, path, body);
  return {
    [SANDBOX_AUTH_HEADERS.timestamp]: auth.timestamp,
    [SANDBOX_AUTH_HEADERS.projectId]: auth.projectId,
    [SANDBOX_AUTH_HEADERS.signature]: auth.signature,
  };
}

describe("GET /api/file", () => {
  beforeAll(() => {
    mkdirSync(join(workspaceRoot, "src/pages"), { recursive: true });
    mkdirSync(join(workspaceRoot, "src/features/auth"), { recursive: true });
    writeFileSync(
      join(workspaceRoot, "src/pages/Index.tsx"),
      "export default function Home() { return null; }\n",
    );
    writeFileSync(
      join(workspaceRoot, "src/features/auth/AuthProvider.tsx"),
      "export function AuthProvider() { return null; }\n",
    );
    writeFileSync(join(workspaceRoot, "package.json"), '{"name":"fixture"}\n');
    writeFileSync(join(workspaceRoot, "lovable.blocks.json"), JSON.stringify({ blocks: {} }));
  });

  afterAll(() => {
    rmSync(workspaceRoot, { recursive: true, force: true });
  });

  it("returns file content for an editable path", async () => {
    const res = await app.request("/api/file?path=src%2Fpages%2FIndex.tsx", {
      headers: authHeaders("GET", "/api/file"),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      path: "src/pages/Index.tsx",
      content: "export default function Home() { return null; }\n",
    });
  });

  it("rejects protected paths with 403", async () => {
    const res = await app.request(
      "/api/file?path=src%2Ffeatures%2Fauth%2FAuthProvider.tsx",
      { headers: authHeaders("GET", "/api/file") },
    );

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Protected path" });
  });

  it("rejects path traversal with 403", async () => {
    const res = await app.request("/api/file?path=..%2Fetc%2Fpasswd", {
      headers: authHeaders("GET", "/api/file"),
    });

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Invalid or unsafe path" });
  });

  it("rejects non-editable paths with 403", async () => {
    const res = await app.request("/api/file?path=package.json", {
      headers: authHeaders("GET", "/api/file"),
    });

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Path not in editable prefixes" });
  });

  it("returns 404 for missing editable files", async () => {
    const res = await app.request("/api/file?path=src%2Fpages%2FMissing.tsx", {
      headers: authHeaders("GET", "/api/file"),
    });

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "File not found" });
  });

  it("rejects unauthenticated requests", async () => {
    const res = await app.request("/api/file?path=src%2Fpages%2FIndex.tsx");
    expect(res.status).toBe(401);
  });

  it("SandboxClient.readFile fetches via signed request", async () => {
    const client = createSandboxClient({
      authSecret: AUTH_SECRET,
      urlOverride: "http://sandbox.test",
      fetchImpl: async (input, init) => {
        const url = typeof input === "string" ? input : input.url;
        const pathWithQuery = url.replace("http://sandbox.test", "");
        return app.request(pathWithQuery, init);
      },
    });

    const result = await client.readFile(PROJECT_ID, "src/pages/Index.tsx");
    expect(result).toEqual({
      path: "src/pages/Index.tsx",
      content: "export default function Home() { return null; }\n",
    });
  });
});
