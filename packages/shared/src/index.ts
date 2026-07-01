import { z } from "zod";

export const clientEnvSchema = z.object({
  VITE_SUPABASE_URL: z.union([z.string().url(), z.literal("")]).optional(),
  VITE_SUPABASE_ANON_KEY: z.string().optional(),
});

export type ClientEnv = z.infer<typeof clientEnvSchema>;

export function validateClientEnv(raw: Record<string, string | undefined>, mode: string) {
  const parsed = clientEnvSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Invalid env: ${parsed.error.message}`);
  }

  for (const [key, value] of Object.entries(raw)) {
    if (key.startsWith("VITE_") && value?.includes("service_role")) {
      throw new Error(`service_role key must not be exposed in ${key}`);
    }
  }

  if (mode === "production") {
    const { VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY } = parsed.data;
    if (!VITE_SUPABASE_URL || !VITE_SUPABASE_ANON_KEY) {
      throw new Error("VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are required in production");
    }
  }

  return parsed.data;
}

export type BlockState = "enabled" | "stub" | "disabled";

export interface BlockConfig {
  state: BlockState;
  [key: string]: unknown;
}

export interface BlocksManifest {
  blocks: Record<string, BlockConfig>;
  admin?: {
    enabled?: boolean;
    customTabs?: Array<{ id: string; label: string; route: string }>;
  };
}

export type WorkType =
  | "block_activation"
  | "block_configuration"
  | "feature_generation"
  | "block_override";

export interface AgentMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface FilePatch {
  path: string;
  content: string;
  action: "create" | "update" | "delete";
}

export interface AgentTurnResult {
  workType: WorkType;
  patches: FilePatch[];
  manifestUpdates?: Partial<BlocksManifest>;
  buildOutput?: string;
  previewUrl?: string;
}
