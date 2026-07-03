import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import type { AgentMessage, BlocksManifest } from "@app/shared";

const EDITABLE_PREFIXES = ["src/pages/", "src/components/", "src/services/"];

export interface ProjectContext {
  fileTree: string[];
  editableFiles: Record<string, string>;
  manifest: BlocksManifest;
  recentMessages: AgentMessage[];
  protectedPaths: string[];
}

export function buildFileTree(root: string, maxDepth = 4): string[] {
  const files: string[] = [];

  function walk(dir: string, depth: number) {
    if (depth > maxDepth) return;
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.startsWith(".") || entry === "node_modules" || entry === "dist") continue;
      const full = join(dir, entry);
      const rel = relative(root, full);
      if (statSync(full).isDirectory()) {
        walk(full, depth + 1);
      } else {
        files.push(rel);
      }
    }
  }

  walk(root, 0);
  return files.sort();
}

export function buildEditableFileContents(
  scaffoldRoot: string,
  fileTree: string[],
  maxFiles = 24,
  maxCharsPerFile = 8000,
): Record<string, string> {
  const contents: Record<string, string> = {};

  for (const rel of fileTree) {
    if (!EDITABLE_PREFIXES.some((prefix) => rel.startsWith(prefix))) {
      continue;
    }

    if (!rel.endsWith(".tsx") && !rel.endsWith(".ts")) {
      continue;
    }

    const content = snapshotFile(scaffoldRoot, rel);
    if (content === null) {
      continue;
    }

    contents[rel] =
      content.length > maxCharsPerFile
        ? `${content.slice(0, maxCharsPerFile)}\n… (truncated)`
        : content;

    if (Object.keys(contents).length >= maxFiles) {
      break;
    }
  }

  return contents;
}

export function buildContext(
  scaffoldRoot: string,
  manifest: BlocksManifest,
  messages: AgentMessage[],
  protectedPaths: string[],
): ProjectContext {
  const fileTree = buildFileTree(scaffoldRoot);

  return {
    fileTree,
    editableFiles: buildEditableFileContents(scaffoldRoot, fileTree),
    manifest,
    recentMessages: messages.slice(-10),
    protectedPaths,
  };
}

export function snapshotFile(scaffoldRoot: string, filePath: string): string | null {
  try {
    return readFileSync(join(scaffoldRoot, filePath), "utf-8");
  } catch {
    return null;
  }
}
