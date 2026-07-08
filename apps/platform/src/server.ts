import "./load-env.js";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { toNodeHandler, fromNodeHeaders } from "better-auth/node";
import {
  classifyPrompt,
  planPatches,
  DEFAULT_PROTECTED_PATHS,
} from "@app/agent-core";
import type { AgentTurnPhase } from "@app/agent-core";
import {
  generatePatchesWithOpenRouter,
  getCustomerUsageSummary,
  isOpenRouterConfigured,
} from "@app/ai-gateway";
import { createSandboxClient } from "@app/sandbox-client";
import { buildPreviewUrl, createSandboxProvisioner } from "@app/sandbox-provisioner";
import { auth, runAuthMigrations } from "./auth.js";
import { isAuthDisabled, requireAuth } from "./middleware/require-auth.js";
import { requireProjectAccess, type ProjectRequest } from "./middleware/require-project-access.js";
import {
  addMessage,
  createProject,
  deleteProject,
  getProjectById,
  initDb,
  listMessages,
  listProjectsForUser,
  runMigrations,
  updateProjectSandboxStatus,
} from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLATFORM_ROOT = path.resolve(__dirname, "..");
const PUBLIC_DIR = path.join(PLATFORM_ROOT, process.env.VERCEL ? "public" : "src/public");
const PORT = Number(process.env.PORT ?? 3001);
const PREVIEW_DOMAIN = process.env.PREVIEW_DOMAIN ?? "preview.localtest.me";
const SANDBOX_AUTH_SECRET = process.env.SANDBOX_AUTH_SECRET?.trim() ?? "dev-sandbox-secret";

initDb();
await runMigrations();
await runAuthMigrations();

export const sandboxClient = createSandboxClient({ authSecret: SANDBOX_AUTH_SECRET });
export const sandboxProvisioner = createSandboxProvisioner();

export const app = express();

app.all("/api/auth/*", toNodeHandler(auth));

app.use(requireAuth);
app.use(express.json());
app.use(express.static(PUBLIC_DIR));

app.get("/", (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

app.get("/login", (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "login.html"));
});

app.get("/builder", (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "builder.html"));
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", authEnabled: !isAuthDisabled() });
});

app.get("/api/me", async (req, res) => {
  if (isAuthDisabled()) {
    res.json({
      user: { id: "dev@local", email: "dev@local", name: "Dev User" },
      session: null,
      authEnabled: false,
    });
    return;
  }

  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  if (!session) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  res.json({ ...session, authEnabled: true });
});

async function resolveBuilderCustomerId(req: express.Request): Promise<string> {
  if (isAuthDisabled()) {
    return "dev@local";
  }

  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  return session?.user?.id ?? "anonymous";
}

async function resolveOwnerId(req: express.Request): Promise<string | null> {
  if (isAuthDisabled()) {
    return "dev@local";
  }

  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  return session?.user?.id ?? null;
}

function writeSseEvent(res: express.Response, event: string, data: unknown): void {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function formatAppliedPaths(paths: string[]): string {
  if (paths.length === 0) return "";
  const lines = paths.map((p) => `  • ${p}`).join("\n");
  return `\n\nApplied:\n${lines}`;
}

function buildAgentTurnReply(
  workType: string,
  patchCount: number,
  buildOutput: string | undefined,
  appliedPaths: string[],
  buildFailed?: boolean,
  buildError?: string,
): string {
  if (workType === "block_activation") {
    return "Activated block via recipe. Manifest updated.";
  }

  const applied = formatAppliedPaths(appliedPaths);

  if (buildFailed) {
    const provider = isOpenRouterConfigured() ? "OpenRouter" : "template";
    const header = `Applied ${patchCount} file(s) via ${provider}, but the build failed.${applied}`;
    return buildError ? `${header}\n\nBuild errors:\n${buildError}` : header;
  }

  const provider = isOpenRouterConfigured() ? "OpenRouter" : "template";
  const summary = `Generated ${patchCount} file(s) via ${provider}. Build ${buildOutput ? "passed" : "skipped"}.`;
  return summary + applied;
}

async function runAgentTurn(
  projectId: string,
  prompt: string,
  req: express.Request,
  handlers?: {
    onToken?: (delta: string) => void;
    onStatus?: (phase: AgentTurnPhase) => void;
  },
) {
  const classification = classifyPrompt(prompt);
  const customerId = await resolveBuilderCustomerId(req);

  const sandboxContext = await sandboxClient.getContext(projectId);

  const plan = await planPatches({
    prompt,
    scaffoldRoot: "/workspace",
    protectedPaths: sandboxContext.protectedPaths.length
      ? sandboxContext.protectedPaths
      : DEFAULT_PROTECTED_PATHS,
    context: {
      fileTree: sandboxContext.fileTree,
      editableFiles: sandboxContext.editableFiles,
      manifest: sandboxContext.manifest,
      recentMessages: [],
      protectedPaths: sandboxContext.protectedPaths.length
        ? sandboxContext.protectedPaths
        : DEFAULT_PROTECTED_PATHS,
    },
    existingPaths: sandboxContext.fileTree,
    onToken: handlers?.onToken,
    onStatus: handlers?.onStatus,
    llmGenerate: isOpenRouterConfigured()
      ? async (userPrompt, context, llmHandlers) =>
          generatePatchesWithOpenRouter({
            prompt: userPrompt,
            context,
            customerId,
            endpoint: "agent-turn",
            onToken: llmHandlers?.onToken,
          })
      : undefined,
  });

  handlers?.onStatus?.("applying");
  const result = await sandboxClient.applyPatches(projectId, {
    patches: plan.patches,
    blockId: plan.blockId,
  });
  handlers?.onStatus?.("building");

  const appliedPaths = result.patches.map((patch) => patch.path);
  const appliedLabels = result.patches.map((patch) => `${patch.action} ${patch.path}`);
  const reply = buildAgentTurnReply(
    result.workType,
    result.patches.length,
    result.buildOutput,
    appliedLabels,
    result.buildFailed,
    result.buildError,
  );

  return {
    ...result,
    classification,
    reply,
    appliedPaths,
    aiProvider: isOpenRouterConfigured() ? "openrouter" : "template",
  };
}

function serializeProject(project: NonNullable<Awaited<ReturnType<typeof getProjectById>>>) {
  return {
    id: project.id,
    name: project.name,
    status: project.status,
    previewUrl: project.preview_url,
    sandboxStatus: project.sandbox_status,
    createdAt: project.created_at,
    updatedAt: project.updated_at,
  };
}

app.post("/api/projects", async (req, res) => {
  const ownerId = await resolveOwnerId(req);
  if (!ownerId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const name = (req.body as { name?: string }).name?.trim() || "Untitled project";

  const project = await createProject({
    ownerId,
    name,
    sandboxStatus: "starting",
  });

  const previewUrl = buildPreviewUrl(project.id, PREVIEW_DOMAIN);
  await updateProjectSandboxStatus(project.id, "starting", previewUrl);

  try {
    const status = await sandboxProvisioner.create(project.id, {
      projectId: project.id,
      viteSupabaseUrl: process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL,
      viteSupabaseAnonKey: process.env.VITE_SUPABASE_ANON_KEY,
      sandboxAuthSecret: SANDBOX_AUTH_SECRET,
    });
    await updateProjectSandboxStatus(project.id, status.status, status.previewUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await updateProjectSandboxStatus(project.id, "failed");
    res.status(500).json({ error: `Sandbox provisioning failed: ${message}` });
    return;
  }

  const updated = await getProjectById(project.id);
  res.status(201).json({ project: serializeProject(updated!) });
});

app.get("/api/projects", async (req, res) => {
  const ownerId = await resolveOwnerId(req);
  if (!ownerId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const projects = await listProjectsForUser(ownerId);
  res.json({ projects: projects.map(serializeProject) });
});

app.get("/api/projects/:id", requireProjectAccess, async (req: ProjectRequest, res) => {
  let project = req.project!;

  try {
    const status = await sandboxProvisioner.getStatus(project.id);
    if (status.status !== project.sandbox_status || status.previewUrl !== project.preview_url) {
      await updateProjectSandboxStatus(project.id, status.status, status.previewUrl);
      const refreshed = await getProjectById(project.id);
      if (refreshed) project = refreshed;
    }
  } catch {
    // Keep stored status when cluster is unavailable locally.
  }

  res.json({ project: serializeProject(project) });
});

app.delete("/api/projects/:id", requireProjectAccess, async (req: ProjectRequest, res) => {
  try {
    await sandboxProvisioner.delete(req.projectId!);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Sandbox teardown warning for ${req.projectId}: ${message}`);
  }

  await deleteProject(req.projectId!);
  res.status(204).end();
});

app.get("/api/projects/:id/messages", requireProjectAccess, async (req: ProjectRequest, res) => {
  const messages = await listMessages(req.projectId!);
  res.json({
    messages: messages.map((message) => ({
      role: message.role,
      content: message.content,
      createdAt: message.created_at,
    })),
  });
});

app.post("/api/projects/:id/agent-turn/stream", requireProjectAccess, async (req: ProjectRequest, res) => {
  const { prompt } = req.body as { prompt?: string };

  if (!prompt?.trim()) {
    res.status(400).json({ error: "prompt is required" });
    return;
  }

  await addMessage({ projectId: req.projectId!, role: "user", content: prompt });

  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  try {
    writeSseEvent(res, "status", { phase: "planning" });

    const turn = await runAgentTurn(req.projectId!, prompt, req, {
      onToken: (delta) => writeSseEvent(res, "token", { delta }),
      onStatus: (phase) => writeSseEvent(res, "status", { phase }),
    });

    await addMessage({ projectId: req.projectId!, role: "assistant", content: turn.reply });
    writeSseEvent(res, "done", {
      reply: turn.reply,
      workType: turn.workType,
      patchCount: turn.patches.length,
      appliedPaths: turn.appliedPaths,
      patches: turn.patches.map((patch) => ({ path: patch.path, action: patch.action })),
      buildOutput: turn.buildOutput,
      buildFailed: turn.buildFailed ?? false,
      buildError: turn.buildError,
      classification: turn.classification,
      aiProvider: turn.aiProvider,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await addMessage({ projectId: req.projectId!, role: "assistant", content: `Error: ${message}` });
    writeSseEvent(res, "error", { message });
  } finally {
    res.end();
  }
});

app.get("/api/usage", async (req, res) => {
  const customerId = await resolveBuilderCustomerId(req);

  if (!isAuthDisabled() && customerId === "anonymous") {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const usage = await getCustomerUsageSummary(customerId, "builder");
  res.json({
    customerId,
    customerType: "builder",
    openRouterConfigured: isOpenRouterConfigured(),
    usage,
  });
});

if (process.env.VITEST !== "true" && !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Platform running at http://localhost:${PORT}`);
    console.log(`  Landing:  http://localhost:${PORT}/`);
    console.log(`  Builder:  http://localhost:${PORT}/builder`);
    console.log(`  Login:    http://localhost:${PORT}/login`);
    if (isAuthDisabled()) {
      console.log("  Auth:     disabled (BUILDER_AUTH_DISABLED)");
    }
  });
}

export default app;
