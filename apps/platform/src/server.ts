import "./load-env.js";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { toNodeHandler, fromNodeHeaders } from "better-auth/node";
import { classifyPrompt, planAndApply, DEFAULT_PROTECTED_PATHS } from "@app/agent-core";
import type { AgentTurnPhase } from "@app/agent-core";
import {
  generatePatchesWithOpenRouter,
  getCustomerUsageSummary,
  isOpenRouterConfigured,
} from "@app/ai-gateway";
import { auth } from "./auth.js";
import { isAuthDisabled, requireAuth } from "./middleware/require-auth.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../..");
const SCAFFOLD_ROOT = path.resolve(ROOT, "apps/scaffold");
const PUBLIC_DIR = path.join(__dirname, "public");
const PORT = Number(process.env.PORT ?? 3001);

export const app = express();

app.all("/api/auth/*", toNodeHandler(auth));

app.use(requireAuth);
app.use(express.json());
app.use(express.static(PUBLIC_DIR));

interface Message {
  role: "user" | "assistant";
  content: string;
}

const conversation: Message[] = [];

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
      user: { email: "dev@local", name: "Dev User" },
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

app.get("/api/messages", (_req, res) => {
  res.json({ messages: conversation });
});

app.get("/api/files", (_req, res) => {
  res.json({ scaffoldRoot: "apps/scaffold" });
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
  prompt: string,
  req: express.Request,
  handlers?: {
    onToken?: (delta: string) => void;
    onStatus?: (phase: AgentTurnPhase) => void;
  },
) {
  const classification = classifyPrompt(prompt);
  const customerId = await resolveBuilderCustomerId(req);

  const result = await planAndApply({
    prompt,
    scaffoldRoot: SCAFFOLD_ROOT,
    protectedPaths: DEFAULT_PROTECTED_PATHS,
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

app.post("/api/agent-turn", async (req, res) => {
  const { prompt } = req.body as { prompt?: string };

  if (!prompt?.trim()) {
    res.status(400).json({ error: "prompt is required" });
    return;
  }

  conversation.push({ role: "user", content: prompt });

  try {
    const turn = await runAgentTurn(prompt, req);
    conversation.push({ role: "assistant", content: turn.reply });
    res.json({
      ...turn,
      classification: turn.classification,
      aiProvider: turn.aiProvider,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    conversation.push({ role: "assistant", content: `Error: ${message}` });
    res.status(500).json({ error: message });
  }
});

app.post("/api/agent-turn/stream", async (req, res) => {
  const { prompt } = req.body as { prompt?: string };

  if (!prompt?.trim()) {
    res.status(400).json({ error: "prompt is required" });
    return;
  }

  conversation.push({ role: "user", content: prompt });

  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  try {
    writeSseEvent(res, "status", { phase: "planning" });

    const turn = await runAgentTurn(prompt, req, {
      onToken: (delta) => writeSseEvent(res, "token", { delta }),
      onStatus: (phase) => writeSseEvent(res, "status", { phase }),
    });

    conversation.push({ role: "assistant", content: turn.reply });
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
    conversation.push({ role: "assistant", content: `Error: ${message}` });
    writeSseEvent(res, "error", { message });
  } finally {
    res.end();
  }
});

if (process.env.VITEST !== "true") {
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
