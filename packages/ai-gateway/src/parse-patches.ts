import type { FilePatch } from "@app/shared";

const PATCH_SCHEMA_HINT =
  'Each patch: { "path": string, "action": "create"|"update"|"delete", "content": string }';

export function parsePatchesFromModelOutput(raw: string): FilePatch[] {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error(`Model returned empty output. ${PATCH_SCHEMA_HINT}`);
  }

  const candidates = collectJsonCandidates(trimmed);
  for (const candidate of candidates) {
    const patches = tryParseCandidate(candidate);
    if (patches.length > 0) {
      return patches;
    }
  }

  const loose = extractLoosePatches(trimmed);
  if (loose.length > 0) {
    return loose;
  }

  throw new Error(`Model did not return valid JSON patches. ${PATCH_SCHEMA_HINT}`);
}

function tryParseCandidate(candidate: string): FilePatch[] {
  const repaired = repairJson(candidate);

  let parsed: unknown;
  try {
    parsed = JSON.parse(repaired);
  } catch {
    return [];
  }

  return normalizeParsedValue(parsed);
}

function collectJsonCandidates(text: string): string[] {
  const candidates = new Set<string>();

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/gi);
  if (fenced) {
    for (const block of fenced) {
      const inner = block.replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim();
      if (inner) candidates.add(inner);
    }
  }

  const array = extractBalancedJson(text, "[", "]");
  if (array) candidates.add(array);

  const object = extractBalancedJson(text, "{", "}");
  if (object) candidates.add(object);

  candidates.add(text.trim());
  return [...candidates];
}

function extractBalancedJson(text: string, open: string, close: string): string | null {
  const start = text.indexOf(open);
  if (start < 0) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i += 1) {
    const char = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === open) depth += 1;
    if (char === close) {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }

  return null;
}

function repairJson(text: string): string {
  return text
    .replace(/^\uFEFF/, "")
    .replace(/,\s*([}\]])/g, "$1")
    .trim();
}

function normalizeParsedValue(parsed: unknown): FilePatch[] {
  const entries = unwrapPatchEntries(parsed);
  if (!entries.length) {
    return [];
  }

  return entries.map((entry, index) => normalizePatch(entry, index));
}

function unwrapPatchEntries(parsed: unknown): unknown[] {
  if (Array.isArray(parsed)) {
    return parsed;
  }

  if (!parsed || typeof parsed !== "object") {
    return [];
  }

  const record = parsed as Record<string, unknown>;
  for (const key of ["patches", "files", "changes", "data", "result"]) {
    const value = record[key];
    if (Array.isArray(value)) {
      return value;
    }
  }

  if (typeof record.path === "string") {
    return [record];
  }

  return [];
}

function extractLoosePatches(text: string): FilePatch[] {
  const path = text.match(/"path"\s*:\s*"([^"]+)"/)?.[1];
  const action = text.match(/"action"\s*:\s*"(create|update|delete)"/)?.[1];
  if (!path || !action) {
    return [];
  }

  const content = extractLooseContent(text);
  if (action !== "delete" && content === null) {
    return [];
  }

  const safeContent = content ?? "";

  return [
    {
      path: path.replace(/^\/+/, ""),
      action: action as FilePatch["action"],
      content: action === "delete" ? "" : safeContent,
    },
  ];
}

function extractLooseContent(text: string): string | null {
  const marker = text.match(/"content"\s*:\s*"/);
  if (!marker || marker.index === undefined) {
    return null;
  }

  const start = marker.index + marker[0].length;
  let result = "";
  let escaped = false;

  for (let i = start; i < text.length; i += 1) {
    const char = text[i];

    if (escaped) {
      if (char === "n") result += "\n";
      else if (char === "t") result += "\t";
      else if (char === "r") result += "\r";
      else if (char === '"') result += '"';
      else if (char === "\\") result += "\\";
      else result += char;
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = true;
      continue;
    }

    if (char === '"') {
      const rest = text.slice(i + 1).trimStart();
      if (rest.startsWith("}") || rest.startsWith(",") || rest === "") {
        return result;
      }
    }

    result += char;
  }

  return result.trim() ? result : null;
}

function normalizePatch(entry: unknown, index: number): FilePatch {
  if (!entry || typeof entry !== "object") {
    throw new Error(`Patch at index ${index} is not an object. ${PATCH_SCHEMA_HINT}`);
  }

  const patch = entry as Record<string, unknown>;
  const path = patch.path ?? patch.file ?? patch.filepath ?? patch.filename;
  const action = normalizeAction(patch.action ?? patch.operation ?? patch.type);
  const content = patch.content ?? patch.code ?? patch.source ?? patch.body;

  if (typeof path !== "string" || !path.trim()) {
    throw new Error(`Patch at index ${index} is missing a valid path. ${PATCH_SCHEMA_HINT}`);
  }

  if (!action) {
    throw new Error(`Patch at index ${index} has invalid action "${String(patch.action)}". ${PATCH_SCHEMA_HINT}`);
  }

  if (action !== "delete" && typeof content !== "string") {
    throw new Error(`Patch at index ${index} requires string content. ${PATCH_SCHEMA_HINT}`);
  }

  return {
    path: (path as string).replace(/^\/+/, ""),
    action,
    content: action === "delete" ? "" : unescapePatchContent(content as string),
  };
}

/** Models often emit JSON with double-escaped newlines (`\\n`), which parse as literal `\n`. */
function unescapePatchContent(content: string): string {
  if (!content.includes("\\n") && !content.includes("\\t") && !content.includes('\\"')) {
    return content;
  }

  return content
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\r/g, "\r")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\");
}

function normalizeAction(value: unknown): FilePatch["action"] | null {
  if (value === "create" || value === "update" || value === "delete") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.toLowerCase();
    if (normalized === "add" || normalized === "new") return "create";
    if (normalized === "modify" || normalized === "edit") return "update";
    if (normalized === "remove") return "delete";
  }

  return null;
}
