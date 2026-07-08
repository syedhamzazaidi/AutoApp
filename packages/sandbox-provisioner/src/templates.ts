import type { V1Deployment, V1PersistentVolumeClaim, V1Secret, V1Service } from "@kubernetes/client-node";
import {
  sandboxLabels,
  sandboxResourceName,
  sandboxSelectorLabels,
  type SandboxEnv,
} from "./types.js";

export interface SandboxManifestSet {
  pvc: V1PersistentVolumeClaim;
  secret: V1Secret;
  deployment: V1Deployment;
  service: V1Service;
}

export interface BuildManifestOptions {
  projectId: string;
  namespace: string;
  env: SandboxEnv;
  sandboxImage: string;
  pvcSize: string;
  storageClass: string;
  previewDomain: string;
}

/** Builds K8s objects matching infra/k8s/base/sandbox/*.yaml templates. */
export function buildSandboxManifests(options: BuildManifestOptions): SandboxManifestSet {
  const { projectId, namespace, env, sandboxImage, pvcSize, storageClass } = options;
  const labels = sandboxLabels(projectId);
  const selectorLabels = sandboxSelectorLabels(projectId);

  const pvc: V1PersistentVolumeClaim = {
    apiVersion: "v1",
    kind: "PersistentVolumeClaim",
    metadata: {
      name: sandboxResourceName(projectId, "pvc"),
      namespace,
      labels,
    },
    spec: {
      accessModes: ["ReadWriteOnce"],
      storageClassName: storageClass,
      resources: {
        requests: { storage: pvcSize },
      },
    },
  };

  const secret: V1Secret = {
    apiVersion: "v1",
    kind: "Secret",
    metadata: {
      name: sandboxResourceName(projectId, "secret"),
      namespace,
      labels,
    },
    type: "Opaque",
    stringData: {
      VITE_PROJECT_ID: env.projectId,
      VITE_SUPABASE_URL: env.viteSupabaseUrl ?? "",
      VITE_SUPABASE_ANON_KEY: env.viteSupabaseAnonKey ?? "",
      SANDBOX_AUTH_SECRET: env.sandboxAuthSecret ?? "",
    },
  };

  const deployment: V1Deployment = {
    apiVersion: "apps/v1",
    kind: "Deployment",
    metadata: {
      name: sandboxResourceName(projectId, "deployment"),
      namespace,
      labels,
    },
    spec: {
      replicas: 1,
      selector: { matchLabels: selectorLabels },
      template: {
        metadata: { labels: selectorLabels },
        spec: {
          securityContext: {
            runAsNonRoot: true,
            runAsUser: 1000,
            fsGroup: 1000,
          },
          containers: [
            {
              name: "sandbox",
              image: sandboxImage,
              ports: [
                { name: "preview", containerPort: 5173 },
                { name: "agent", containerPort: 3002 },
              ],
              envFrom: [{ secretRef: { name: sandboxResourceName(projectId, "secret") } }],
              env: [{ name: "WORKSPACE_ROOT", value: "/workspace" }],
              resources: {
                requests: { cpu: "250m", memory: "512Mi" },
                limits: { cpu: "1000m", memory: "2Gi" },
              },
              securityContext: {
                allowPrivilegeEscalation: false,
                capabilities: { drop: ["ALL"] },
                readOnlyRootFilesystem: true,
              },
              volumeMounts: [
                { name: "workspace", mountPath: "/workspace" },
                { name: "tmp", mountPath: "/tmp" },
              ],
              readinessProbe: {
                httpGet: { path: "/health", port: 3002 },
                initialDelaySeconds: 10,
                periodSeconds: 5,
              },
            },
          ],
          volumes: [
            { name: "workspace", persistentVolumeClaim: { claimName: sandboxResourceName(projectId, "pvc") } },
            { name: "tmp", emptyDir: {} },
          ],
        },
      },
    },
  };

  const service: V1Service = {
    apiVersion: "v1",
    kind: "Service",
    metadata: {
      name: sandboxResourceName(projectId, "service"),
      namespace,
      labels,
    },
    spec: {
      selector: selectorLabels,
      ports: [
        { name: "preview", port: 5173, targetPort: 5173 },
        { name: "agent", port: 3002, targetPort: 3002 },
      ],
    },
  };

  return { pvc, secret, deployment, service };
}
