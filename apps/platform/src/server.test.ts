import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Server } from "node:http";

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
});
