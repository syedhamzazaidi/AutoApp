import { serve } from "@hono/node-server";
import { Hono } from "hono";
import type { Context, Next } from "hono";
import { readManifest } from "@app/block-registry";
import {
  applyAndBuild,
  buildContext,
  DEFAULT_PROTECTED_PATHS,
  isEditablePath,
  isProtectedPath,
  resolveSafePath,
  snapshotFile,
} from "@app/agent-core";
import type { FilePatch } from "@app/shared";
import { SANDBOX_AUTH_HEADERS, verifySandboxRequest } from "@app/sandbox-client";

const WORKSPACE_ROOT = process.env.WORKSPACE_ROOT ?? "/workspace";
const PORT = Number(process.env.PORT ?? 3002);
const AUTH_SECRET = process.env.SANDBOX_AUTH_SECRET?.trim();
const PROJECT_ID = process.env.VITE_PROJECT_ID?.trim();

type SandboxVariables = {
  rawBody: string;
};

const app = new Hono<{ Variables: SandboxVariables }>();

async function captureBody(c: Context<{ Variables: SandboxVariables }>, next: Next) {
  if (c.req.method === "GET" || c.req.method === "HEAD") {
    c.set("rawBody", "");
    await next();
    return;
  }

  const rawBody = await c.req.text();
  c.set("rawBody", rawBody);
  await next();
}

async function requireAuth(c: Context<{ Variables: SandboxVariables }>, next: Next) {
  if (!AUTH_SECRET || !PROJECT_ID) {
    return c.json({ error: "Sandbox auth not configured" }, 500);
  }

  const body = c.get("rawBody") ?? "";
  const valid = verifySandboxRequest(
    AUTH_SECRET,
    PROJECT_ID,
    c.req.method,
    c.req.path,
    body,
    c.req.header(SANDBOX_AUTH_HEADERS.timestamp),
    c.req.header(SANDBOX_AUTH_HEADERS.signature),
  );

  if (!valid) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const headerProjectId = c.req.header(SANDBOX_AUTH_HEADERS.projectId);
  if (headerProjectId !== PROJECT_ID) {
    return c.json({ error: "Project mismatch" }, 403);
  }

  await next();
}

app.use("*", captureBody);

app.get("/health", (c) => {
  return c.json({
    status: "ok",
    workspaceReady: true,
    projectId: PROJECT_ID ?? null,
  });
});

app.get("/api/files", requireAuth, (c) => {
  const manifest = readManifest(WORKSPACE_ROOT);
  const context = buildContext(WORKSPACE_ROOT, manifest, [], DEFAULT_PROTECTED_PATHS);

  return c.json({
    fileTree: context.fileTree,
    editableFiles: context.editableFiles,
    manifest: context.manifest,
    protectedPaths: context.protectedPaths,
  });
});

app.get("/api/file", requireAuth, (c) => {
  const rawPath = c.req.query("path");
  if (!rawPath?.trim()) {
    return c.json({ error: "Missing path query parameter" }, 400);
  }

  const filePath = rawPath.replace(/\\/g, "/").trim();

  try {
    resolveSafePath(WORKSPACE_ROOT, filePath);
  } catch {
    return c.json({ error: "Invalid or unsafe path" }, 403);
  }

  if (isProtectedPath(filePath, DEFAULT_PROTECTED_PATHS)) {
    return c.json({ error: "Protected path" }, 403);
  }

  if (!isEditablePath(filePath)) {
    return c.json({ error: "Path not in editable prefixes" }, 403);
  }

  const content = snapshotFile(WORKSPACE_ROOT, filePath);
  if (content === null) {
    return c.json({ error: "File not found" }, 404);
  }

  return c.json({ path: filePath, content });
});

app.get("/api/manifest", requireAuth, (c) => {
  return c.json({ manifest: readManifest(WORKSPACE_ROOT) });
});

app.post("/api/patches", requireAuth, async (c) => {
  const rawBody = c.get("rawBody");
  let body: { patches?: FilePatch[]; blockId?: string };

  try {
    body = JSON.parse(rawBody) as { patches?: FilePatch[]; blockId?: string };
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const patches = body.patches ?? [];
  const result = await applyAndBuild(WORKSPACE_ROOT, {
    patches,
    blockId: body.blockId,
    protectedPaths: DEFAULT_PROTECTED_PATHS,
  });

  return c.json(result);
});

if (process.env.VITEST !== "true") {
  serve({ fetch: app.fetch, port: PORT }, () => {
    console.log(`Sandbox server listening on :${PORT} (workspace: ${WORKSPACE_ROOT})`);
  });
}

export { app, WORKSPACE_ROOT };
