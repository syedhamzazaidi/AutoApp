import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Server } from "node:http";
import * as agentCore from "@app/agent-core";

process.env.BUILDER_AUTH_DISABLED = "1";
process.env.VITEST = "true";
process.env.SANDBOX_AUTH_SECRET = "test-secret";
process.env.GEMINI_DISABLED = "1";

const isGeminiConfiguredMock = vi.fn(() => false);
const runBuilderAgentMock = vi.fn();

vi.mock("@app/ai-gateway", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@app/ai-gateway")>();
  return {
    ...actual,
    isGeminiConfigured: () => isGeminiConfiguredMock(),
    runBuilderAgent: (...args: unknown[]) => runBuilderAgentMock(...args),
  };
});

vi.mock("@app/sandbox-client", () => ({
  createSandboxClient: () => ({
    getServiceUrl: (projectId: string) => `http://sandbox-${projectId}.test:3002`,
    getContext: vi.fn().mockResolvedValue({
      fileTree: ["src/pages/Index.tsx"],
      editableFiles: {},
      manifest: { blocks: {} },
      protectedPaths: [],
    }),
    readFile: vi.fn().mockResolvedValue({
      path: "src/pages/Index.tsx",
      content: "export default function Index() { return null; }",
    }),
    applyPatches: vi.fn().mockResolvedValue({
      workType: "block_activation",
      patches: [],
      manifestUpdates: { blocks: {} },
    }),
    getHealth: vi.fn().mockResolvedValue({ status: "ok", workspaceReady: true }),
    getManifest: vi.fn().mockResolvedValue({ manifest: { blocks: {} } }),
  }),
}));

vi.mock("@app/sandbox-provisioner", () => ({
  buildPreviewUrl: (projectId: string) => `http://${projectId}.preview.test`,
  createSandboxProvisioner: () => ({
    create: vi.fn().mockResolvedValue({
      projectId: "mock",
      status: "ready",
      previewUrl: "http://mock.preview.test",
    }),
    delete: vi.fn().mockResolvedValue(undefined),
    getStatus: vi.fn().mockResolvedValue({
      projectId: "mock",
      status: "ready",
      previewUrl: "http://mock.preview.test",
    }),
  }),
}));

const { app, sandboxClient } = await import("./server.js");

describe("platform server auth", () => {
  let server: Server;
  let baseUrl: string;
  let projectId: string;

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      server = app.listen(0, "127.0.0.1", () => resolve());
    });
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test server");
    }
    baseUrl = `http://127.0.0.1:${address.port}`;

    const createRes = await fetch(`${baseUrl}/api/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Test project" }),
    });
    const createBody = await createRes.json();
    projectId = createBody.project.id;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it("serves landing page without auth", async () => {
    const res = await fetch(`${baseUrl}/`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("AutoApp");
  });

  it("allows builder access when auth is disabled", async () => {
    const res = await fetch(`${baseUrl}/builder`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Builder");
    expect(html).toContain("profile-toggle");
    expect(html).toContain("project-list");
    expect(html).toContain('sandbox="allow-scripts allow-same-origin"');
    expect(html).toContain('id="preview-back"');
    expect(html).not.toContain("http://localhost:5173");
  });

  it("returns dev user for /api/me when auth is disabled", async () => {
    const res = await fetch(`${baseUrl}/api/me`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user).toEqual({ id: "dev@local", email: "dev@local", name: "Dev User" });
    expect(body.authEnabled).toBe(false);
  });

  it("returns scoped messages for a project", async () => {
    const res = await fetch(`${baseUrl}/api/projects/${projectId}/messages`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.messages)).toBe(true);
  });

  it("streams agent-turn SSE for block activation", async () => {
    const res = await fetch(`${baseUrl}/api/projects/${projectId}/agent-turn/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "Add login to my app" }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");

    const text = await res.text();
    expect(text).toContain("event: status");
    expect(text).toContain('"phase":"planning"');
    expect(text).toContain("event: done");
    expect(text).toContain("Activated block via recipe");
    expect(text).toContain('"appliedPaths":[]');
  });

  it("streams build failure as done event with applied paths", async () => {
    vi.spyOn(agentCore, "planPatches").mockResolvedValueOnce({
      workType: "feature_generation",
      patches: [{ path: "src/pages/Broken.tsx", content: "export default 1", action: "create" }],
    });

    vi.spyOn(sandboxClient, "applyPatches").mockResolvedValueOnce({
      workType: "feature_generation",
      patches: [{ path: "src/pages/Broken.tsx", content: "export default 1", action: "create" }],
      buildFailed: true,
      buildError: "error TS2322: Type 'number' is not assignable to type 'Component'.",
    });

    const res = await fetch(`${baseUrl}/api/projects/${projectId}/agent-turn/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "Build a broken page" }),
    });

    expect(res.status).toBe(200);

    const text = await res.text();
    expect(text).toContain("event: done");
    expect(text).toContain('"buildFailed":true');
    expect(text).toContain("TS2322");
    expect(text).toContain('"appliedPaths":["src/pages/Broken.tsx"]');
    expect(text).not.toContain("event: error");
  });

  it("streams plan and tool SSE events from the Gemini builder agent", async () => {
    const plan = {
      goal: "Add a settings page",
      steps: ["inspect", "apply", "finish"],
      filesToTouch: ["src/pages/Settings.tsx"],
      notes: "mock plan",
    };

    isGeminiConfiguredMock.mockReturnValueOnce(true);
    runBuilderAgentMock.mockImplementationOnce(async (options: {
      onEvent?: (event: {
        type: string;
        plan?: typeof plan;
        name?: string;
        args?: Record<string, unknown>;
        result?: unknown;
      }) => void;
      onStatus?: (phase: string) => void;
    }) => {
      options.onStatus?.("planning");
      options.onEvent?.({ type: "plan", plan });
      options.onStatus?.("applying");
      options.onEvent?.({
        type: "tool",
        name: "inspect_project",
        args: {},
        result: { fileTree: ["src/pages/Index.tsx"] },
      });
      options.onEvent?.({
        type: "tool",
        name: "finish",
        args: { summary: "Added settings page" },
        result: { ok: true },
      });
      options.onStatus?.("building");
      return {
        workType: "feature_generation",
        patches: [{ path: "src/pages/Settings.tsx", content: "export default function Settings() {}", action: "create" }],
        appliedPaths: ["src/pages/Settings.tsx"],
        reply: "Added settings page",
        plan,
        buildFailed: false,
      };
    });

    const res = await fetch(`${baseUrl}/api/projects/${projectId}/agent-turn/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "Add a settings page" }),
    });

    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("event: plan");
    expect(text).toContain('"goal":"Add a settings page"');
    expect(text).toContain("event: tool");
    expect(text).toContain('"name":"inspect_project"');
    expect(text).toContain('"name":"finish"');
    expect(text).toContain("event: done");
    expect(text).toContain('"aiProvider":"gemini"');
    expect(text).toContain("Added settings page");
    expect(runBuilderAgentMock).toHaveBeenCalled();
  });
});
