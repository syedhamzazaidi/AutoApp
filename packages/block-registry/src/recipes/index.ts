import type { BlockConfig, BlocksManifest } from "@app/shared";

export interface ActivationRecipe {
  blockId: string;
  migrations?: string[];
  description: string;
  onActivate?: (manifest: BlocksManifest) => BlocksManifest;
  onDeactivate?: (manifest: BlocksManifest) => BlocksManifest;
}

export const RECIPES: Record<string, ActivationRecipe> = {
  auth: {
    blockId: "auth",
    migrations: ["0001_rls_helpers.sql", "0002_auth_profiles.sql"],
    description: "Enable Supabase Auth with profiles table and RLS",
    onActivate: (manifest) => ({
      ...manifest,
      blocks: {
        ...manifest.blocks,
        auth: { state: "enabled", provider: "supabase", methods: ["email"] },
      },
    }),
    onDeactivate: (manifest) => ({
      ...manifest,
      blocks: {
        ...manifest.blocks,
        auth: { state: "stub", provider: "supabase", methods: ["email"] },
      },
    }),
  },
  storage: {
    blockId: "storage",
    migrations: ["0003_storage.sql"],
    description: "Enable Supabase Storage with uploads bucket",
    onActivate: (manifest) => ({
      ...manifest,
      blocks: {
        ...manifest.blocks,
        storage: { state: "enabled", buckets: ["uploads"] },
      },
    }),
    onDeactivate: (manifest) => ({
      ...manifest,
      blocks: {
        ...manifest.blocks,
        storage: { state: "stub", buckets: ["uploads"] },
      },
    }),
  },
  ai: {
    blockId: "ai",
    description: "Enable AI gateway (mock unless secret set)",
    onActivate: (manifest) => ({
      ...manifest,
      blocks: {
        ...manifest.blocks,
        ai: { state: "enabled", gateway: "openrouter" },
      },
    }),
    onDeactivate: (manifest) => ({
      ...manifest,
      blocks: {
        ...manifest.blocks,
        ai: { state: "stub", gateway: "openrouter" },
      },
    }),
  },
  rbac: {
    blockId: "rbac",
    migrations: ["0004_rbac.sql"],
    description: "Enable admin RBAC with user_roles table",
    onActivate: (manifest) => ({
      ...manifest,
      blocks: {
        ...manifest.blocks,
        rbac: { state: "enabled" },
      },
      admin: { ...manifest.admin, enabled: true },
    }),
    onDeactivate: (manifest) => ({
      ...manifest,
      blocks: {
        ...manifest.blocks,
        rbac: { state: "stub" },
      },
      admin: { ...manifest.admin, enabled: false },
    }),
  },
  realtime: {
    blockId: "realtime",
    description: "Enable realtime subscriptions",
    onActivate: (manifest) => ({
      ...manifest,
      blocks: { ...manifest.blocks, realtime: { state: "enabled" } },
    }),
    onDeactivate: (manifest) => ({
      ...manifest,
      blocks: { ...manifest.blocks, realtime: { state: "stub" } },
    }),
  },
  email: {
    blockId: "email",
    description: "Enable email notifications edge function",
    onActivate: (manifest) => ({
      ...manifest,
      blocks: { ...manifest.blocks, email: { state: "enabled" } },
    }),
    onDeactivate: (manifest) => ({
      ...manifest,
      blocks: { ...manifest.blocks, email: { state: "stub" } },
    }),
  },
};

export function getDefaultManifest(): BlocksManifest {
  return {
    blocks: {
      env: { state: "enabled" },
      designSystem: { state: "enabled" },
      errorBoundary: { state: "enabled" },
      supabaseClient: { state: "enabled" },
      appShell: { state: "enabled" },
      admin: { state: "enabled" },
      auth: { state: "stub", provider: "supabase", methods: ["email"] },
      rls: { state: "stub" },
      storage: { state: "stub", buckets: ["uploads"] },
      edgeFunctions: { state: "stub" },
      ai: { state: "stub", gateway: "openrouter" },
      realtime: { state: "stub" },
      email: { state: "stub" },
      rbac: { state: "stub" },
      payments: { state: "stub" },
      multiTenant: { state: "stub" },
    },
    admin: { enabled: false, customTabs: [] },
  };
}

export function isBlockEnabled(manifest: BlocksManifest, blockId: string): boolean {
  return manifest.blocks[blockId]?.state === "enabled";
}

export function getBlockConfig(manifest: BlocksManifest, blockId: string): BlockConfig | undefined {
  return manifest.blocks[blockId];
}
