import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GenerateContentResult } from "./gemini.js";
import type { SandboxClient } from "@app/sandbox-client";
import type { Content, FunctionCall, GenerateContentResponse } from "@google/genai";

vi.mock("./gemini.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./gemini.js")>();
  return {
    ...actual,
    generateContent: vi.fn(),
    generateContentStream: vi.fn(),
    getVertexModel: () => "gemini-2.5-flash-lite",
  };
});

vi.mock("./usage-tracker.js", () => ({
  recordAiUsage: vi.fn().mockResolvedValue(undefined),
}));

import { generateContent, generateContentStream } from "./gemini.js";
import { recordAiUsage } from "./usage-tracker.js";
import { runBuilderAgent, __test } from "./builder-agent.js";

function mockGenerateResult(options: {
  text?: string;
  functionCalls?: FunctionCall[];
  promptTokens?: number;
  completionTokens?: number;
}): GenerateContentResult {
  const functionCalls = options.functionCalls;
  const text = options.text ?? "";
  const parts = functionCalls?.length
    ? functionCalls.map((call) => ({ functionCall: call }))
    : [{ text }];

  const response = {
    text,
    functionCalls,
    candidates: [
      {
        content: {
          role: "model",
          parts,
        },
      },
    ],
    usageMetadata: {
      promptTokenCount: options.promptTokens ?? 10,
      candidatesTokenCount: options.completionTokens ?? 5,
      totalTokenCount: (options.promptTokens ?? 10) + (options.completionTokens ?? 5),
    },
  } as unknown as GenerateContentResponse;

  return {
    text,
    response,
    model: "gemini-2.5-flash-lite",
    promptTokens: options.promptTokens ?? 10,
    completionTokens: options.completionTokens ?? 5,
    latencyMs: 1,
  };
}

function createMockSandbox(overrides: Partial<SandboxClient> = {}): SandboxClient {
  return {
    getServiceUrl: (projectId) => `http://sandbox-${projectId}.test`,
    getHealth: vi.fn().mockResolvedValue({ status: "ok", workspaceReady: true }),
    getManifest: vi.fn().mockResolvedValue({ manifest: { blocks: {} } }),
    getContext: vi.fn().mockResolvedValue({
      fileTree: ["src/pages/Index.tsx", "src/services/api.ts"],
      editableFiles: {},
      manifest: { blocks: { auth: { enabled: true } } },
      protectedPaths: ["src/features/auth/**"],
    }),
    readFile: vi.fn().mockResolvedValue({
      path: "src/pages/Index.tsx",
      content: "export default function Index() { return null; }",
    }),
    applyPatches: vi.fn().mockResolvedValue({
      workType: "feature_generation",
      patches: [
        {
          path: "src/pages/TodoPage.tsx",
          action: "create",
          content: "export default function TodoPage() { return null; }",
        },
      ],
      buildOutput: "ok",
      buildFailed: false,
    }),
    ...overrides,
  };
}

describe("builder-agent helpers", () => {
  it("normalizePlan parses JSON plan", () => {
    const plan = __test.normalizePlan(
      JSON.stringify({
        goal: "Add todos",
        steps: ["inspect", "patch"],
        filesToTouch: ["src/pages/TodoPage.tsx"],
        notes: "keep it small",
      }),
      "add todos",
    );

    expect(plan.goal).toBe("Add todos");
    expect(plan.steps).toEqual(["inspect", "patch"]);
    expect(plan.filesToTouch).toEqual(["src/pages/TodoPage.tsx"]);
  });

  it("normalizePlan falls back on invalid JSON", () => {
    const plan = __test.normalizePlan("not json", "build a page");
    expect(plan.goal).toBe("build a page");
    expect(plan.steps.length).toBeGreaterThan(0);
    expect(plan.notes).toContain("fallback");
  });

  it("asFilePatches validates patch shape", () => {
    expect(() => __test.asFilePatches("nope")).toThrow(/patches array/);
    expect(
      __test.asFilePatches([
        { path: "src/pages/A.tsx", action: "create", content: "x" },
      ]),
    ).toEqual([{ path: "src/pages/A.tsx", action: "create", content: "x" }]);
  });

  it("rejects protected paths in apply_patches tool", async () => {
    const sandbox = createMockSandbox();
    const result = await __test.executeTool(
      "apply_patches",
      {
        patches: [
          {
            path: "src/features/auth/AuthProvider.tsx",
            action: "update",
            content: "hacked",
          },
        ],
      },
      {
        options: {
          prompt: "x",
          projectId: "p1",
          customerId: "c1",
          sandboxClient: sandbox,
        },
        protectedPaths: ["src/features/auth/**"],
        existingPaths: new Set(),
        appliedPatches: [],
        workType: "feature_generation",
      },
    );

    expect(result.response.error).toMatch(/Protected path/);
    expect(sandbox.applyPatches).not.toHaveBeenCalled();
  });

  it("coerces create→update when path already exists", async () => {
    const sandbox = createMockSandbox({
      applyPatches: vi.fn().mockResolvedValue({
        workType: "feature_generation",
        patches: [
          { path: "src/pages/Index.tsx", action: "update", content: "updated" },
        ],
        buildOutput: "ok",
      }),
    });

    await __test.executeTool(
      "apply_patches",
      {
        patches: [
          { path: "src/pages/Index.tsx", action: "create", content: "updated" },
        ],
      },
      {
        options: {
          prompt: "x",
          projectId: "p1",
          customerId: "c1",
          sandboxClient: sandbox,
        },
        protectedPaths: ["src/features/auth/**"],
        existingPaths: new Set(["src/pages/Index.tsx"]),
        appliedPatches: [],
        workType: "feature_generation",
      },
    );

    expect(sandbox.applyPatches).toHaveBeenCalledWith("p1", {
      patches: [
        { path: "src/pages/Index.tsx", action: "update", content: "updated" },
      ],
    });
  });
});

describe("runBuilderAgent ReAct loop", () => {
  beforeEach(() => {
    vi.mocked(generateContent).mockReset();
    vi.mocked(generateContentStream).mockReset();
    vi.mocked(recordAiUsage).mockClear();
  });

  it("plans, executes tools, and finishes", async () => {
    const sandbox = createMockSandbox();
    const events: string[] = [];

    vi.mocked(generateContentStream).mockResolvedValueOnce(
      mockGenerateResult({
        text: JSON.stringify({
          goal: "Add a todo page",
          steps: ["inspect", "apply", "finish"],
          filesToTouch: ["src/pages/TodoPage.tsx"],
          notes: "",
        }),
      }),
    );

    vi.mocked(generateContent)
      .mockResolvedValueOnce(
        mockGenerateResult({
          functionCalls: [{ name: "inspect_project", args: {} }],
        }),
      )
      .mockResolvedValueOnce(
        mockGenerateResult({
          functionCalls: [
            {
              name: "apply_patches",
              args: {
                patches: [
                  {
                    path: "src/pages/TodoPage.tsx",
                    action: "create",
                    content: "export default function TodoPage(){return null}",
                  },
                ],
              },
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        mockGenerateResult({
          functionCalls: [
            { name: "finish", args: { summary: "Added TodoPage." } },
          ],
        }),
      );

    const result = await runBuilderAgent({
      prompt: "Add a todo page",
      projectId: "proj-1",
      customerId: "user-1",
      sandboxClient: sandbox,
      recentMessages: [{ role: "user", content: "hi" }],
      onEvent: (event) => events.push(event.type),
    });

    expect(result.reply).toBe("Added TodoPage.");
    expect(result.plan.goal).toBe("Add a todo page");
    expect(result.appliedPaths).toEqual(["src/pages/TodoPage.tsx"]);
    expect(result.stepsUsed).toBe(3);
    expect(events).toContain("plan");
    expect(events).toContain("tool");
    expect(sandbox.getContext).toHaveBeenCalledWith("proj-1");
    expect(sandbox.applyPatches).toHaveBeenCalled();
    expect(recordAiUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: "user-1",
        endpoint: "agent-turn",
        model: "gemini-2.5-flash-lite",
      }),
    );

    // Conversation should include model + functionResponse turns
    const reactCalls = vi.mocked(generateContent).mock.calls;
    expect(reactCalls.length).toBe(3);
    const lastContents = reactCalls[2]?.[0]?.contents as Content[];
    expect(lastContents.some((c) => c.role === "model")).toBe(true);
    expect(
      lastContents.some((c) =>
        c.parts?.some((p) => p.functionResponse !== undefined),
      ),
    ).toBe(true);
  });

  it("ends on text-only model response without finish", async () => {
    const sandbox = createMockSandbox();

    vi.mocked(generateContentStream).mockResolvedValueOnce(
      mockGenerateResult({
        text: JSON.stringify({
          goal: "noop",
          steps: ["done"],
          filesToTouch: [],
          notes: "",
        }),
      }),
    );

    vi.mocked(generateContent).mockResolvedValueOnce(
      mockGenerateResult({ text: "Nothing to change." }),
    );

    const result = await runBuilderAgent({
      prompt: "do nothing",
      projectId: "proj-1",
      customerId: "user-1",
      sandboxClient: sandbox,
    });

    expect(result.reply).toBe("Nothing to change.");
    expect(result.stepsUsed).toBe(1);
    expect(sandbox.applyPatches).not.toHaveBeenCalled();
  });
});
