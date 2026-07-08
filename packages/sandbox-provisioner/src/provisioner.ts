import * as k8s from "@kubernetes/client-node";
import {
  buildPreviewUrl,
  sandboxResourceName,
  type SandboxEnv,
  type SandboxProvisioner,
  type SandboxProvisionerOptions,
  type SandboxProvisionerStatus,
  type SandboxStatus,
} from "./types.js";
import { buildSandboxManifests } from "./templates.js";

const DEFAULT_NAMESPACE = "endian-sandboxes";
const DEFAULT_PVC_SIZE = "5Gi";
const DEFAULT_STORAGE_CLASS = "standard";
const DEFAULT_SANDBOX_IMAGE = "endian-sandbox:latest";

function mapPodPhase(phase?: string): SandboxStatus {
  switch (phase) {
    case "Running":
      return "ready";
    case "Pending":
      return "starting";
    case "Failed":
      return "failed";
    default:
      return "unknown";
  }
}

export function createSandboxProvisioner(options: SandboxProvisionerOptions = {}): SandboxProvisioner {
  const kc = new k8s.KubeConfig();

  if (options.kubeConfigPath ?? process.env.KUBECONFIG) {
    kc.loadFromFile(options.kubeConfigPath ?? process.env.KUBECONFIG!);
  } else {
    try {
      kc.loadFromCluster();
    } catch {
      kc.loadFromDefault();
    }
  }

  const core = kc.makeApiClient(k8s.CoreV1Api);
  const apps = kc.makeApiClient(k8s.AppsV1Api);

  const namespace = options.namespace ?? process.env.SANDBOX_NAMESPACE ?? DEFAULT_NAMESPACE;
  const previewDomain = options.previewDomain ?? process.env.PREVIEW_DOMAIN ?? "preview.localtest.me";
  const sandboxImage = options.sandboxImage ?? process.env.SANDBOX_IMAGE ?? DEFAULT_SANDBOX_IMAGE;
  const pvcSize = options.pvcSize ?? process.env.SANDBOX_PVC_SIZE ?? DEFAULT_PVC_SIZE;
  const storageClass = options.storageClass ?? process.env.SANDBOX_STORAGE_CLASS ?? DEFAULT_STORAGE_CLASS;

  async function getStatus(projectId: string): Promise<SandboxProvisionerStatus> {
    const previewUrl = buildPreviewUrl(projectId, previewDomain);
    const deploymentName = sandboxResourceName(projectId, "deployment");

    try {
      const deployment = await apps.readNamespacedDeployment({ name: deploymentName, namespace });
      const readyReplicas = deployment.status?.readyReplicas ?? 0;

      let podPhase: string | undefined;
      const podList = await core.listNamespacedPod({
        namespace,
        labelSelector: `endian.io/project-id=${projectId}`,
      });
      podPhase = podList.items[0]?.status?.phase;

      const status: SandboxStatus =
        readyReplicas > 0 && podPhase === "Running" ? "ready" : mapPodPhase(podPhase);

      return {
        projectId,
        status,
        previewUrl,
        podPhase,
        message: deployment.status?.conditions?.find((c) => c.type === "Available")?.message,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("404") || message.includes("not found")) {
        return { projectId, status: "pending", previewUrl };
      }
      return { projectId, status: "failed", previewUrl, message };
    }
  }

  return {
    async create(projectId: string, env: SandboxEnv): Promise<SandboxProvisionerStatus> {
      const manifests = buildSandboxManifests({
        projectId,
        namespace,
        env,
        sandboxImage,
        pvcSize,
        storageClass,
        previewDomain,
      });

      try {
        await core.createNamespacedPersistentVolumeClaim({ namespace, body: manifests.pvc });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!message.includes("AlreadyExists") && !message.includes("409")) {
          throw error;
        }
      }

      try {
        await core.createNamespacedSecret({ namespace, body: manifests.secret });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!message.includes("AlreadyExists") && !message.includes("409")) {
          throw error;
        }
      }

      try {
        await apps.createNamespacedDeployment({ namespace, body: manifests.deployment });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!message.includes("AlreadyExists") && !message.includes("409")) {
          throw error;
        }
      }

      try {
        await core.createNamespacedService({ namespace, body: manifests.service });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!message.includes("AlreadyExists") && !message.includes("409")) {
          throw error;
        }
      }

      return getStatus(projectId);
    },

    async delete(projectId: string): Promise<void> {
      const names = [
        sandboxResourceName(projectId, "service"),
        sandboxResourceName(projectId, "deployment"),
        sandboxResourceName(projectId, "secret"),
        sandboxResourceName(projectId, "pvc"),
      ];

      for (const name of names) {
        try {
          if (name.includes("-deployment")) {
            await apps.deleteNamespacedDeployment({ name, namespace });
          } else if (name.includes("-service")) {
            await core.deleteNamespacedService({ name, namespace });
          } else if (name.includes("-secret")) {
            await core.deleteNamespacedSecret({ name, namespace });
          } else if (name.includes("-pvc")) {
            await core.deleteNamespacedPersistentVolumeClaim({ name, namespace });
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          if (!message.includes("404") && !message.includes("not found")) {
            throw error;
          }
        }
      }
    },

    getStatus,
  };
}
