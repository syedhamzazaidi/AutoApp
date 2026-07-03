import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Server } from "node:http";
import * as agentCore from "@app/agent-core";

process.env.BUILDER_AUTH_DISABLED = "1";

const { app } = await import("./server.js");

describe("platform server auth", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      server = app.listen(0, "127.0.0.1", () => resolve());
    });
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test server");
    }
    baseUrl = `http://127.0.0.1:${address.port}`;
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
    expect(html).toContain("profile-dropdown");
    expect(html).toContain('id="project-panel"');
    expect(html).toContain("hidden");
    expect(html).toContain("builder-chat-bar");
    expect(html).toContain('id="preview-back"');
    expect(html).toContain('id="preview-forward"');
    expect(html).toContain('id="preview-refresh"');
    expect(html).toContain('id="preview-url"');
    expect(html).toContain("builder-url-bar");
    expect(html).toContain('aria-label="Go back"');
    expect(html).toContain('aria-label="Go forward"');
    expect(html).toContain('aria-label="Refresh preview"');
    expect(html).not.toContain("preview-toolbar");
    expect(html).not.toContain("preview-nav-bar");
    expect(html).toContain('id="chat-toggle"');
    expect(html).toContain('aria-label="Toggle chat"');
    expect(html).toContain("chat-toggle-chevron");
    expect(html).not.toContain("panel-chat");
  });

  it("returns dev user for /api/me when auth is disabled", async () => {
    const res = await fetch(`${baseUrl}/api/me`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user).toEqual({ email: "dev@local", name: "Dev User" });
    expect(body.authEnabled).toBe(false);
  });

  it("returns messages for authenticated-disabled mode", async () => {
    const res = await fetch(`${baseUrl}/api/messages`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.messages)).toBe(true);
  });

  it("streams agent-turn SSE for block activation", async () => {
    const res = await fetch(`${baseUrl}/api/agent-turn/stream`, {
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
    vi.spyOn(agentCore, "planAndApply").mockResolvedValueOnce({
      workType: "feature_generation",
      patches: [{ path: "src/pages/Broken.tsx", content: "export default 1", action: "create" }],
      buildFailed: true,
      buildError: "error TS2322: Type 'number' is not assignable to type 'Component'.",
    });

    const res = await fetch(`${baseUrl}/api/agent-turn/stream`, {
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
});
