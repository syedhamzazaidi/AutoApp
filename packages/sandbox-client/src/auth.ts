import { createHmac, timingSafeEqual } from "node:crypto";

export const SANDBOX_AUTH_HEADERS = {
  timestamp: "x-sandbox-timestamp",
  projectId: "x-sandbox-project-id",
  signature: "x-sandbox-signature",
} as const;

export function signSandboxRequest(
  secret: string,
  projectId: string,
  method: string,
  path: string,
  body: string,
  timestamp = Date.now(),
): { timestamp: string; projectId: string; signature: string } {
  const payload = `${timestamp}:${projectId}:${method.toUpperCase()}:${path}:${body}`;
  const signature = createHmac("sha256", secret).update(payload).digest("hex");
  return {
    timestamp: String(timestamp),
    projectId,
    signature,
  };
}

export function verifySandboxRequest(
  secret: string,
  projectId: string,
  method: string,
  path: string,
  body: string,
  timestampHeader: string | undefined,
  signatureHeader: string | undefined,
  maxAgeMs = 5 * 60 * 1000,
): boolean {
  if (!timestampHeader || !signatureHeader || !projectId) {
    return false;
  }

  const timestamp = Number(timestampHeader);
  if (!Number.isFinite(timestamp)) {
    return false;
  }

  if (Math.abs(Date.now() - timestamp) > maxAgeMs) {
    return false;
  }

  const expected = signSandboxRequest(secret, projectId, method, path, body, timestamp);
  const expectedBuf = Buffer.from(expected.signature, "hex");
  const actualBuf = Buffer.from(signatureHeader, "hex");

  if (expectedBuf.length !== actualBuf.length) {
    return false;
  }

  return timingSafeEqual(expectedBuf, actualBuf);
}
