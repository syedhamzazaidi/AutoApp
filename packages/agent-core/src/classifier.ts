import type { WorkType } from "@endian/shared";

const ACTIVATION_PATTERNS = [
  /\badd\s+login\b/i,
  /\benable\s+auth\b/i,
  /\badd\s+authentication\b/i,
  /\badd\s+signup\b/i,
  /\benable\s+storage\b/i,
  /\badd\s+file\s+upload\b/i,
  /\benable\s+ai\b/i,
  /\benable\s+admin\b/i,
  /\benable\s+rbac\b/i,
];

const BLOCK_MAP: Record<string, string> = {
  login: "auth",
  auth: "auth",
  authentication: "auth",
  signup: "auth",
  storage: "storage",
  upload: "storage",
  ai: "ai",
  admin: "rbac",
  rbac: "rbac",
};

export interface ClassificationResult {
  workType: WorkType;
  blockId?: string;
  confidence: number;
}

export function classifyPrompt(prompt: string): ClassificationResult {
  const normalized = prompt.toLowerCase().trim();

  for (const pattern of ACTIVATION_PATTERNS) {
    if (pattern.test(normalized)) {
      for (const [keyword, blockId] of Object.entries(BLOCK_MAP)) {
        if (normalized.includes(keyword)) {
          return { workType: "block_activation", blockId, confidence: 0.9 };
        }
      }
      return { workType: "block_activation", blockId: "auth", confidence: 0.7 };
    }
  }

  if (/\bswitch.*clerk\b/i.test(normalized) || /\breplace.*auth\b/i.test(normalized)) {
    return { workType: "block_override", confidence: 0.8 };
  }

  if (/\badd\s+google\s+oauth\b/i.test(normalized) || /\bconfigure\b/i.test(normalized)) {
    return { workType: "block_configuration", blockId: "auth", confidence: 0.7 };
  }

  return { workType: "feature_generation", confidence: 0.8 };
}
