import pg from "pg";

const { Pool } = pg;

export type ProjectStatus = "active" | "archived";
export type SandboxStatus = "pending" | "starting" | "ready" | "failed" | "unknown";

export interface ProjectRow {
  id: string;
  owner_id: string;
  name: string;
  status: ProjectStatus;
  preview_url: string | null;
  sandbox_status: SandboxStatus;
  created_at: Date;
  updated_at: Date;
}

export interface MessageRow {
  id: string;
  project_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: Date;
}

export interface ProjectMemberRow {
  project_id: string;
  user_id: string;
  role: string;
}

interface MemoryStore {
  projects: Map<string, ProjectRow>;
  messages: Map<string, MessageRow[]>;
  members: Map<string, ProjectMemberRow[]>;
}

const memoryStore: MemoryStore = {
  projects: new Map(),
  messages: new Map(),
  members: new Map(),
};

let pool: pg.Pool | null = null;
let useMemory = false;

export function initDb(): void {
  const connectionString = process.env.DATABASE_URL?.trim();

  if (!connectionString) {
    if (process.env.VITEST === "true" || process.env.BUILDER_AUTH_DISABLED === "1") {
      useMemory = true;
      return;
    }
    throw new Error("DATABASE_URL is required");
  }

  pool = new Pool({ connectionString });
}

export async function runMigrations(): Promise<void> {
  if (useMemory || !pool) {
    return;
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS projects (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_id TEXT NOT NULL,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      preview_url TEXT,
      sandbox_status TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS project_members (
      project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'owner',
      PRIMARY KEY (project_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS messages_project_id_created_at_idx
      ON messages (project_id, created_at);
  `);
}

export async function createProject(input: {
  ownerId: string;
  name: string;
  previewUrl?: string;
  sandboxStatus?: SandboxStatus;
  id?: string;
}): Promise<ProjectRow> {
  if (useMemory) {
    const id = input.id ?? crypto.randomUUID();
    const now = new Date();
    const row: ProjectRow = {
      id,
      owner_id: input.ownerId,
      name: input.name,
      status: "active",
      preview_url: input.previewUrl ?? null,
      sandbox_status: input.sandboxStatus ?? "pending",
      created_at: now,
      updated_at: now,
    };
    memoryStore.projects.set(id, row);
    memoryStore.members.set(id, [{ project_id: id, user_id: input.ownerId, role: "owner" }]);
    memoryStore.messages.set(id, []);
    return row;
  }

  const result = await pool!.query<ProjectRow>(
    `INSERT INTO projects (id, owner_id, name, preview_url, sandbox_status)
     VALUES (COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5)
     RETURNING *`,
    [input.id ?? null, input.ownerId, input.name, input.previewUrl ?? null, input.sandboxStatus ?? "pending"],
  );

  const project = result.rows[0];
  await pool!.query(
    `INSERT INTO project_members (project_id, user_id, role) VALUES ($1, $2, 'owner')`,
    [project.id, input.ownerId],
  );

  return project;
}

export async function listProjectsForUser(userId: string): Promise<ProjectRow[]> {
  if (useMemory) {
    return [...memoryStore.projects.values()].filter((project) => {
      const members = memoryStore.members.get(project.id) ?? [];
      return members.some((member) => member.user_id === userId);
    });
  }

  const result = await pool!.query<ProjectRow>(
    `SELECT p.* FROM projects p
     INNER JOIN project_members pm ON pm.project_id = p.id
     WHERE pm.user_id = $1
     ORDER BY p.created_at DESC`,
    [userId],
  );
  return result.rows;
}

export async function getProjectById(projectId: string): Promise<ProjectRow | null> {
  if (useMemory) {
    return memoryStore.projects.get(projectId) ?? null;
  }

  const result = await pool!.query<ProjectRow>(`SELECT * FROM projects WHERE id = $1`, [projectId]);
  return result.rows[0] ?? null;
}

export async function userHasProjectAccess(userId: string, projectId: string): Promise<boolean> {
  if (useMemory) {
    const members = memoryStore.members.get(projectId) ?? [];
    return members.some((member) => member.user_id === userId);
  }

  const result = await pool!.query(
    `SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2 LIMIT 1`,
    [projectId, userId],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function updateProjectSandboxStatus(
  projectId: string,
  sandboxStatus: SandboxStatus,
  previewUrl?: string,
): Promise<void> {
  if (useMemory) {
    const project = memoryStore.projects.get(projectId);
    if (!project) return;
    project.sandbox_status = sandboxStatus;
    if (previewUrl) project.preview_url = previewUrl;
    project.updated_at = new Date();
    return;
  }

  if (previewUrl) {
    await pool!.query(
      `UPDATE projects SET sandbox_status = $2, preview_url = $3, updated_at = NOW() WHERE id = $1`,
      [projectId, sandboxStatus, previewUrl],
    );
    return;
  }

  await pool!.query(
    `UPDATE projects SET sandbox_status = $2, updated_at = NOW() WHERE id = $1`,
    [projectId, sandboxStatus],
  );
}

export async function deleteProject(projectId: string): Promise<void> {
  if (useMemory) {
    memoryStore.projects.delete(projectId);
    memoryStore.messages.delete(projectId);
    memoryStore.members.delete(projectId);
    return;
  }

  await pool!.query(`DELETE FROM projects WHERE id = $1`, [projectId]);
}

export async function listMessages(projectId: string): Promise<MessageRow[]> {
  if (useMemory) {
    return memoryStore.messages.get(projectId) ?? [];
  }

  const result = await pool!.query<MessageRow>(
    `SELECT * FROM messages WHERE project_id = $1 ORDER BY created_at ASC`,
    [projectId],
  );
  return result.rows;
}

export async function addMessage(input: {
  projectId: string;
  role: "user" | "assistant";
  content: string;
}): Promise<MessageRow> {
  if (useMemory) {
    const row: MessageRow = {
      id: crypto.randomUUID(),
      project_id: input.projectId,
      role: input.role,
      content: input.content,
      created_at: new Date(),
    };
    const messages = memoryStore.messages.get(input.projectId) ?? [];
    messages.push(row);
    memoryStore.messages.set(input.projectId, messages);
    return row;
  }

  const result = await pool!.query<MessageRow>(
    `INSERT INTO messages (project_id, role, content) VALUES ($1, $2, $3) RETURNING *`,
    [input.projectId, input.role, input.content],
  );
  return result.rows[0];
}

export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

export function isMemoryDb(): boolean {
  return useMemory;
}
