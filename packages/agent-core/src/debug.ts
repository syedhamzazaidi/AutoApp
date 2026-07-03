export function agentDebug(label: string, data?: unknown): void {
  if (process.env.AGENT_DEBUG !== "1") {
    return;
  }

  if (data === undefined) {
    console.error(`[agent-debug] ${label}`);
    return;
  }

  console.error(`[agent-debug] ${label}`, typeof data === "string" ? data : JSON.stringify(data, null, 2));
}

export function previewPatchContent(content: string, maxLen = 240): string {
  const oneLine = content.replace(/\s+/g, " ").trim();
  if (oneLine.length <= maxLen) {
    return oneLine;
  }

  return `${oneLine.slice(0, maxLen)}…`;
}
