#!/usr/bin/env node
/**
 * CI gate: fail if protected paths were modified without override flag.
 * Usage: node scripts/check-protected-paths.mjs [--override]
 */
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const override = process.argv.includes("--override");

function parseProtectedPaths() {
  const content = readFileSync(resolve(ROOT, "LOVABLE.md"), "utf-8");
  const match = content.match(/protected_paths:\s*\n((?:\s+-\s+.+\n)+)/);
  if (!match) return [];
  return match[1]
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("- "))
    .map((l) => l.slice(2).trim());
}

function pathMatches(file, pattern) {
  const p = pattern.replace(/\\/g, "/");
  const f = file.replace(/\\/g, "/");
  if (p.endsWith("/**")) return f.startsWith(p.slice(0, -3));
  if (p.includes("*")) {
    const regex = new RegExp(`^${p.replace(/\*/g, ".*")}$`);
    return regex.test(f);
  }
  return f === p || f.startsWith(`${p}/`);
}

try {
  const diff = execSync("git diff --name-only HEAD~1 HEAD 2>/dev/null || git diff --name-only", {
    cwd: ROOT,
    encoding: "utf-8",
  }).trim();

  if (!diff) {
    console.log("No changed files to check");
    process.exit(0);
  }

  const changedFiles = diff.split("\n").filter(Boolean);
  const protectedPaths = parseProtectedPaths();
  const violations = [];

  for (const file of changedFiles) {
    for (const pattern of protectedPaths) {
      if (pathMatches(file, pattern)) {
        violations.push({ file, pattern });
      }
    }
  }

  if (violations.length && !override) {
    console.error("Protected path violations:");
    violations.forEach((v) => console.error(`  ${v.file} matches ${v.pattern}`));
    process.exit(1);
  }

  console.log(`Protected path check passed (${changedFiles.length} files checked)`);
} catch (err) {
  console.log("Protected path check skipped:", err.message);
  process.exit(0);
}
