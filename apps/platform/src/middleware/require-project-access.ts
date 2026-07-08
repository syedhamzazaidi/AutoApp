import type { NextFunction, Request, Response } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../auth.js";
import { getProjectById, userHasProjectAccess } from "../db.js";
import { isAuthDisabled } from "./require-auth.js";

export interface ProjectRequest extends Request {
  projectId?: string;
  project?: NonNullable<Awaited<ReturnType<typeof getProjectById>>>;
}

async function resolveUserId(req: Request): Promise<string | null> {
  if (isAuthDisabled()) {
    return "dev@local";
  }

  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  return session?.user?.id ?? null;
}

export async function requireProjectAccess(
  req: ProjectRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const rawId = req.params.id ?? req.params.projectId;
  const projectId = Array.isArray(rawId) ? rawId[0] : rawId;
  if (!projectId) {
    res.status(400).json({ error: "project id is required" });
    return;
  }

  const userId = await resolveUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const project = await getProjectById(projectId);
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const hasAccess = await userHasProjectAccess(userId, projectId);
  if (!hasAccess) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  req.projectId = projectId;
  req.project = project;
  next();
}
