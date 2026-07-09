import { signSandboxRequest, SANDBOX_AUTH_HEADERS } from "./auth.js";
import type {
  ApplyPatchesRequest,
  ApplyPatchesResponse,
  SandboxClient,
  SandboxClientOptions,
  SandboxContext,
  SandboxFileContent,
  SandboxHealth,
  SandboxManifestResponse,
} from "./types.js";

const DEFAULT_NAMESPACE = "endian-sandboxes";

function sandboxServiceName(projectId: string): string {
  return `sandbox-${projectId}-service`;
}

export function resolveSandboxServiceUrl(
  projectId: string,
  options: Pick<SandboxClientOptions, "namespace" | "urlOverride"> = {},
): string {
  if (options.urlOverride) {
    return options.urlOverride.replace("{projectId}", projectId);
  }

  const namespace = options.namespace ?? process.env.SANDBOX_NAMESPACE ?? DEFAULT_NAMESPACE;
  return `http://${sandboxServiceName(projectId)}.${namespace}.svc.cluster.local:3002`;
}

export function createSandboxClient(options: SandboxClientOptions): SandboxClient {
  const fetchImpl = options.fetchImpl ?? fetch;
  const namespace = options.namespace ?? process.env.SANDBOX_NAMESPACE ?? DEFAULT_NAMESPACE;
  const urlOverride = options.urlOverride ?? process.env.SANDBOX_URL_OVERRIDE;

  async function signedFetch(
    projectId: string,
    path: string,
    init: RequestInit = {},
  ): Promise<Response> {
    const baseUrl = resolveSandboxServiceUrl(projectId, { namespace, urlOverride });
    const url = `${baseUrl}${path}`;
    const method = init.method ?? "GET";
    const body = typeof init.body === "string" ? init.body : "";
    // HMAC covers pathname only; query strings (e.g. ?path=) are not part of the signature.
    const signPath = path.includes("?") ? path.slice(0, path.indexOf("?")) : path;
    const auth = signSandboxRequest(options.authSecret, projectId, method, signPath, body);

    const headers = new Headers(init.headers);
    headers.set(SANDBOX_AUTH_HEADERS.timestamp, auth.timestamp);
    headers.set(SANDBOX_AUTH_HEADERS.projectId, auth.projectId);
    headers.set(SANDBOX_AUTH_HEADERS.signature, auth.signature);
    if (body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    return fetchImpl(url, { ...init, headers });
  }

  return {
    getServiceUrl(projectId: string) {
      return resolveSandboxServiceUrl(projectId, { namespace, urlOverride });
    },

    async getHealth(projectId: string): Promise<SandboxHealth> {
      const res = await signedFetch(projectId, "/health");
      if (!res.ok) {
        throw new Error(`Sandbox health check failed (${res.status})`);
      }
      return res.json() as Promise<SandboxHealth>;
    },

    async getContext(projectId: string): Promise<SandboxContext> {
      const res = await signedFetch(projectId, "/api/files");
      if (!res.ok) {
        throw new Error(`Sandbox context fetch failed (${res.status})`);
      }
      return res.json() as Promise<SandboxContext>;
    },

    async readFile(projectId: string, path: string): Promise<SandboxFileContent> {
      const res = await signedFetch(
        projectId,
        `/api/file?path=${encodeURIComponent(path)}`,
      );
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Sandbox readFile failed (${res.status}): ${text}`);
      }
      return res.json() as Promise<SandboxFileContent>;
    },

    async getManifest(projectId: string): Promise<SandboxManifestResponse> {
      const res = await signedFetch(projectId, "/api/manifest");
      if (!res.ok) {
        throw new Error(`Sandbox manifest fetch failed (${res.status})`);
      }
      return res.json() as Promise<SandboxManifestResponse>;
    },

    async applyPatches(
      projectId: string,
      request: ApplyPatchesRequest,
    ): Promise<ApplyPatchesResponse> {
      const body = JSON.stringify(request);
      const res = await signedFetch(projectId, "/api/patches", {
        method: "POST",
        body,
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Sandbox apply failed (${res.status}): ${text}`);
      }

      return res.json() as Promise<ApplyPatchesResponse>;
    },
  };
}
