export type SandboxStatus = "pending" | "starting" | "ready" | "failed" | "unknown";

export interface SandboxEnv {
  projectId: string;
  viteSupabaseUrl?: string;
  viteSupabaseAnonKey?: string;
  sandboxAuthSecret?: string;
}

export interface SandboxProvisionerStatus {
  projectId: string;
  status: SandboxStatus;
  previewUrl: string;
  podPhase?: string;
  message?: string;
}

export interface SandboxProvisionerOptions {
  namespace?: string;
  previewDomain?: string;
  sandboxImage?: string;
  pvcSize?: string;
  storageClass?: string;
  kubeConfigPath?: string;
}

export interface SandboxProvisioner {
  create(projectId: string, env: SandboxEnv): Promise<SandboxProvisionerStatus>;
  delete(projectId: string): Promise<void>;
  getStatus(projectId: string): Promise<SandboxProvisionerStatus>;
}

export function buildPreviewUrl(projectId: string, previewDomain: string): string {
  return `http://${projectId}.${previewDomain}`;
}

export function sandboxResourceName(projectId: string, kind: "pvc" | "secret" | "deployment" | "service"): string {
  return `sandbox-${projectId}-${kind}`;
}

export function sandboxLabels(projectId: string): Record<string, string> {
  return {
    "app.kubernetes.io/name": "sandbox",
    "app.kubernetes.io/component": "workspace",
    "endian.io/project-id": projectId,
  };
}

export function sandboxSelectorLabels(projectId: string): Record<string, string> {
  return {
    "app.kubernetes.io/name": "sandbox",
    "endian.io/project-id": projectId,
  };
}
