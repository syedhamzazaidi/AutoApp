import { describe, expect, it } from "vitest";
import { buildSandboxManifests } from "./templates.js";
import {
  buildPreviewHost,
  buildPreviewUrl,
  sandboxLabels,
  sandboxResourceName,
  sandboxSelectorLabels,
} from "./types.js";

const BASE_OPTIONS = {
  projectId: "demo-proj",
  namespace: "endian-sandboxes",
  env: {
    projectId: "demo-proj",
    viteSupabaseUrl: "https://supabase.example",
    viteSupabaseAnonKey: "anon-key",
    sandboxAuthSecret: "auth-secret",
  },
  sandboxImage: "endian/sandbox:latest",
  pvcSize: "5Gi",
  storageClass: "standard-rwo",
  previewDomain: "preview.example.com",
};

describe("sandbox type helpers", () => {
  it("builds preview host and url", () => {
    expect(buildPreviewHost("abc", "preview.test")).toBe("abc.preview.test");
    expect(buildPreviewUrl("abc", "preview.test")).toBe("http://abc.preview.test");
  });

  it("names resources consistently", () => {
    expect(sandboxResourceName("abc", "deployment")).toBe("sandbox-abc-deployment");
  });

  it("applies standard labels", () => {
    expect(sandboxLabels("abc")).toEqual({
      "app.kubernetes.io/name": "sandbox",
      "app.kubernetes.io/component": "workspace",
      "endian.io/project-id": "abc",
    });
    expect(sandboxSelectorLabels("abc")).toEqual({
      "app.kubernetes.io/name": "sandbox",
      "endian.io/project-id": "abc",
    });
  });
});

describe("buildSandboxManifests", () => {
  it("returns linked PVC, Secret, Deployment, Service, and Ingress", () => {
    const manifests = buildSandboxManifests(BASE_OPTIONS);
    const { projectId, namespace } = BASE_OPTIONS;

    expect(manifests.pvc.metadata?.name).toBe(`sandbox-${projectId}-pvc`);
    expect(manifests.pvc.metadata?.namespace).toBe(namespace);
    expect(manifests.pvc.spec?.storageClassName).toBe("standard-rwo");
    expect(manifests.pvc.spec?.resources?.requests?.storage).toBe("5Gi");

    expect(manifests.secret.metadata?.name).toBe(`sandbox-${projectId}-secret`);
    expect(manifests.secret.stringData).toMatchObject({
      VITE_PROJECT_ID: projectId,
      VITE_SUPABASE_URL: "https://supabase.example",
      SANDBOX_AUTH_SECRET: "auth-secret",
    });

    const container = manifests.deployment.spec?.template?.spec?.containers?.[0];
    expect(container?.image).toBe("endian/sandbox:latest");
    expect(container?.readinessProbe?.httpGet?.path).toBe("/health");
    expect(container?.envFrom?.[0]?.secretRef?.name).toBe(`sandbox-${projectId}-secret`);
    expect(manifests.deployment.spec?.template?.spec?.volumes?.[0]?.persistentVolumeClaim?.claimName).toBe(
      `sandbox-${projectId}-pvc`,
    );

    expect(manifests.service.spec?.ports).toEqual([
      { name: "preview", port: 5173, targetPort: 5173 },
      { name: "agent", port: 3002, targetPort: 3002 },
    ]);

    const previewHost = `${projectId}.preview.example.com`;
    expect(manifests.ingress.spec?.rules?.[0]?.host).toBe(previewHost);
    expect(manifests.ingress.spec?.tls?.[0]?.hosts).toEqual([previewHost]);
    expect(manifests.ingress.spec?.rules?.[0]?.http?.paths?.[0]?.backend?.service?.name).toBe(
      `sandbox-${projectId}-service`,
    );
  });

  it("applies project labels to every resource", () => {
    const manifests = buildSandboxManifests(BASE_OPTIONS);
    const labels = sandboxLabels(BASE_OPTIONS.projectId);

    for (const resource of Object.values(manifests)) {
      expect(resource.metadata?.labels).toEqual(labels);
    }
  });
});
