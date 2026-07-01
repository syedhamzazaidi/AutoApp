import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { classifyPrompt, planAndApply, DEFAULT_PROTECTED_PATHS } from "@endian/agent-core";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../..");
const SCAFFOLD_ROOT = path.resolve(ROOT, "apps/scaffold");
const PORT = Number(process.env.PORT ?? 3001);

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

interface Message {
  role: "user" | "assistant";
  content: string;
}

const conversation: Message[] = [];

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/messages", (_req, res) => {
  res.json({ messages: conversation });
});

app.get("/api/files", (_req, res) => {
  res.json({ scaffoldRoot: "apps/scaffold" });
});

app.post("/api/agent-turn", async (req, res) => {
  const { prompt, planMode } = req.body as { prompt?: string; planMode?: boolean };

  if (!prompt?.trim()) {
    res.status(400).json({ error: "prompt is required" });
    return;
  }

  conversation.push({ role: "user", content: prompt });

  try {
    const classification = classifyPrompt(prompt);

    if (planMode && classification.workType === "feature_generation") {
      conversation.push({
        role: "assistant",
        content: `[Plan mode] Would generate feature code for: "${prompt}". Confirm to apply.`,
      });
      res.json({ classification, planMode: true, patches: [] });
      return;
    }

    const result = await planAndApply({
      prompt,
      scaffoldRoot: SCAFFOLD_ROOT,
      protectedPaths: DEFAULT_PROTECTED_PATHS,
    });

    const reply =
      result.workType === "block_activation"
        ? `Activated block via recipe. Manifest updated.`
        : `Generated ${result.patches.length} file(s). Build ${result.buildOutput ? "passed" : "skipped"}.`;

    conversation.push({ role: "assistant", content: reply });
    res.json({ ...result, classification });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    conversation.push({ role: "assistant", content: `Error: ${message}` });
    res.status(500).json({ error: message });
  }
});

app.listen(PORT, () => {
  console.log(`Platform server running at http://localhost:${PORT}`);
});
