export {
  DEFAULT_MODEL,
  VERTEX_DEFAULT_MODEL,
  generateContent,
  generateContentStream,
  getGcpProjectId,
  getGeminiClient,
  getVertexLocation,
  getVertexModel,
  isGeminiConfigured,
  resetGeminiClient,
} from "./gemini.js";
export type {
  GenerateContentOptions,
  GenerateContentResult,
  StreamGenerateContentOptions,
} from "./gemini.js";
export { runBuilderAgent } from "./builder-agent.js";
export type {
  BuilderAgentEvent,
  BuilderAgentOptions,
  BuilderAgentResult,
  BuilderPlan,
} from "./builder-agent.js";
export { parsePatchesFromModelOutput } from "./parse-patches.js";
export {
  getCustomerUsageSummary,
  recordAiUsage,
} from "./usage-tracker.js";
export type {
  AiUsageRecord,
  CustomerType,
  CustomerUsageSummary,
  UsageSource,
} from "./usage-tracker.js";
