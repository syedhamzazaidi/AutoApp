export interface AIOptions {
  model?: string;
  maxTokens?: number;
}

export interface AIResponse {
  text: string;
  tokens: number;
  latencyMs: number;
}

export async function callAI(prompt: string, _options: AIOptions = {}): Promise<AIResponse> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  const start = Date.now();

  if (!apiKey) {
    // Mock response for POC when no secret is set
    return {
      text: `Mock AI analysis: The plant appears healthy. Prompt was: ${prompt.slice(0, 100)}...`,
      tokens: 50,
      latencyMs: Date.now() - start,
    };
  }

  // Real gateway call would go here
  const response = await fetch("https://api.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gemini-2.0-flash",
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    throw new Error(`AI Gateway error: ${response.status}`);
  }

  const data = await response.json();
  return {
    text: data.choices?.[0]?.message?.content ?? "No response",
    tokens: data.usage?.total_tokens ?? 0,
    latencyMs: Date.now() - start,
  };
}
