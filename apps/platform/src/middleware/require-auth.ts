import type { NextFunction, Request, Response } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../auth.js";

export function isAuthDisabled(): boolean {
  return (
    process.env.BUILDER_AUTH_DISABLED === "1" ||
    process.env.BUILDER_AUTH_DISABLED === "true"
  );
}

function isPublicApi(path: string): boolean {
  return path === "/api/health" || path.startsWith("/api/auth");
}

export function requiresAuth(path: string): boolean {
  if (isAuthDisabled()) {
    return false;
  }

  return (
    path === "/builder" ||
    path === "/builder.html" ||
    path === "/builder.js" ||
    path === "/builder.css" ||
    (path.startsWith("/api/") && !isPublicApi(path))
  );
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (!requiresAuth(req.path)) {
    next();
    return;
  }

  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  if (!session) {
    if (req.path.startsWith("/api/")) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const redirect = encodeURIComponent(req.originalUrl);
    res.redirect(`/login?redirect=${redirect}`);
    return;
  }

  next();
}
