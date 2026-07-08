import type { AgentTurnResult, BlocksManifest, FilePatch } from "@app/shared";

export interface SandboxContext {
  fileTree: string[];
  editableFiles: Record<string, string>;
  manifest: BlocksManifest;
  protectedPaths: string[];
}

export interface SandboxHealth {
  status: "ok" | "degraded" | "error";
  workspaceReady: boolean;
  viteReady?: boolean;
}

export interface SandboxManifestResponse {
  manifest: BlocksManifest;
}

export interface ApplyPatchesRequest {
  patches: FilePatch[];
  blockId?: string;
}

export interface ApplyPatchesResponse extends Pick<
  AgentTurnResult,
  "patches" | "buildOutput" | "buildFailed" | "buildError" | "manifestUpdates" | "workType"
> {}

export interface SandboxClientOptions {
  authSecret: string;
  namespace?: string;
  urlOverride?: string;
  fetchImpl?: typeof fetch;
}

export interface SandboxClient {
  getContext(projectId: string): Promise<SandboxContext>;
  applyPatches(projectId: string, request: ApplyPatchesRequest): Promise<ApplyPatchesResponse>;
  getHealth(projectId: string): Promise<SandboxHealth>;
  getManifest(projectId: string): Promise<SandboxManifestResponse>;
  getServiceUrl(projectId: string): string;
}
