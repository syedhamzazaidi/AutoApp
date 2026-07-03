export interface AIOptions {
  model?: string;
  maxTokens?: number;
}

export interface AIResponse {
  text: string;
  tokens: number;
  promptTokens: number;
  completionTokens: number;
  model: string;
  latencyMs: number;
}

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "nvidia/nemotron-3-ultra-550b-a55b:free";

function getDefaultModel(): string {
  return Deno.env.get("OPENROUTER_MODEL")?.trim() || DEFAULT_MODEL;
}

export async function callAI(prompt: string, options: AIOptions = {}): Promise<AIResponse> {
  const apiKey = Deno.env.get("OPENROUTER_API_KEY");
  const model = options.model ?? getDefaultModel();
  const start = Date.now();

  if (!apiKey) {
    return {
      text: `Mock AI analysis: The plant appears healthy. Prompt was: ${prompt.slice(0, 100)}...`,
      tokens: 50,
      promptTokens: 20,
      completionTokens: 30,
      model: "mock",
      latencyMs: Date.now() - start,
    };
  }

  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": Deno.env.get("OPENROUTER_HTTP_REFERER") ?? "https://autoapp.local",
      "X-Title": Deno.env.get("OPENROUTER_APP_TITLE") ?? "AutoApp",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: options.maxTokens,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenRouter error ${response.status}: ${body}`);
  }

  const data = await response.json();
  const promptTokens = data.usage?.prompt_tokens ?? 0;
  const completionTokens = data.usage?.completion_tokens ?? 0;

  return {
    text: data.choices?.[0]?.message?.content ?? "No response",
    tokens: data.usage?.total_tokens ?? promptTokens + completionTokens,
    promptTokens,
    completionTokens,
    model,
    latencyMs: Date.now() - start,
  };
}
