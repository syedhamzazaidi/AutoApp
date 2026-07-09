import {
  GoogleGenAI,
  type Content,
  type GenerateContentConfig,
  type GenerateContentResponse,
} from "@google/genai";

const DEFAULT_GCP_PROJECT = "project-5be3cb47-0a28-4053-b3a";
const DEFAULT_LOCATION = "global";

/** Default Vertex Gemini model for the builder agent. */
export const DEFAULT_MODEL = "gemini-2.5-flash-lite";

export const VERTEX_DEFAULT_MODEL = DEFAULT_MODEL;

let client: GoogleGenAI | null = null;

export function getGcpProjectId(): string {
  return process.env.GCP_PROJECT_ID?.trim() || DEFAULT_GCP_PROJECT;
}

export function getVertexLocation(): string {
  return process.env.VERTEX_LOCATION?.trim() || DEFAULT_LOCATION;
}

export function getVertexModel(): string {
  return (
    process.env.VERTEX_MODEL?.trim() ||
    process.env.GEMINI_MODEL?.trim() ||
    DEFAULT_MODEL
  );
}

/**
 * True when Vertex Gemini should be used for the builder agent.
 * Set GEMINI_DISABLED=1 to force the template fallback (tests / local).
 * Otherwise a GCP project is assumed (explicit env or default).
 */
export function isGeminiConfigured(): boolean {
  if (process.env.GEMINI_DISABLED === "1" || process.env.VERTEX_DISABLED === "1") {
    return false;
  }
  return Boolean(getGcpProjectId());
}

export function getGeminiClient(): GoogleGenAI {
  if (!client) {
    client = new GoogleGenAI({
      vertexai: true,
      project: getGcpProjectId(),
      location: getVertexLocation(),
    });
  }
  return client;
}

/** Reset the cached client (tests / env changes). */
export function resetGeminiClient(): void {
  client = null;
}

export interface GenerateContentOptions {
  /** Model id; defaults to VERTEX_MODEL / GEMINI_MODEL / DEFAULT_MODEL. */
  model?: string;
  /** Prompt contents (string, Content, or Content[]). */
  contents: string | Content | Content[];
  /** Optional system instruction, tools, temperature, etc. */
  config?: GenerateContentConfig;
}

export interface GenerateContentResult {
  text: string;
  response: GenerateContentResponse;
  model: string;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
}

function usageFromResponse(response: GenerateContentResponse): {
  promptTokens: number;
  completionTokens: number;
} {
  const usage = response.usageMetadata;
  const promptTokens = usage?.promptTokenCount ?? 0;
  const completionTokens =
    usage?.candidatesTokenCount ??
    Math.max(0, (usage?.totalTokenCount ?? 0) - promptTokens);
  return { promptTokens, completionTokens };
}

/** One-shot `generateContent` against Vertex Gemini. */
export async function generateContent(
  options: GenerateContentOptions,
): Promise<GenerateContentResult> {
  const ai = getGeminiClient();
  const model = options.model ?? getVertexModel();
  const start = Date.now();

  const response = await ai.models.generateContent({
    model,
    contents: options.contents,
    config: options.config,
  });

  const { promptTokens, completionTokens } = usageFromResponse(response);

  return {
    text: response.text ?? "",
    response,
    model,
    promptTokens,
    completionTokens,
    latencyMs: Date.now() - start,
  };
}

export interface StreamGenerateContentOptions extends GenerateContentOptions {
  /** Called for each text delta as chunks arrive. */
  onToken?: (delta: string) => void;
}

/** Streaming `generateContentStream`; concatenates text and returns the final aggregate. */
export async function generateContentStream(
  options: StreamGenerateContentOptions,
): Promise<GenerateContentResult> {
  const ai = getGeminiClient();
  const model = options.model ?? getVertexModel();
  const start = Date.now();

  const stream = await ai.models.generateContentStream({
    model,
    contents: options.contents,
    config: options.config,
  });

  const chunks: string[] = [];
  let lastResponse: GenerateContentResponse | undefined;

  for await (const chunk of stream) {
    lastResponse = chunk;
    const delta = chunk.text;
    if (delta) {
      chunks.push(delta);
      options.onToken?.(delta);
    }
  }

  const response = lastResponse ?? ({} as GenerateContentResponse);
  const { promptTokens, completionTokens } = usageFromResponse(response);

  return {
    text: chunks.join(""),
    response,
    model,
    promptTokens,
    completionTokens,
    latencyMs: Date.now() - start,
  };
}
