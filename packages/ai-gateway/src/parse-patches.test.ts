import { describe, expect, it } from "vitest";
import { parsePatchesFromModelOutput } from "./parse-patches.js";

describe("parsePatchesFromModelOutput", () => {
  it("parses a bare JSON array", () => {
    const patches = parsePatchesFromModelOutput(
      `[{"path":"src/pages/Foo.tsx","action":"create","content":"export default function Foo(){return null;}"}]`,
    );

    expect(patches).toEqual([
      {
        path: "src/pages/Foo.tsx",
        action: "create",
        content: "export default function Foo(){return null;}",
      },
    ]);
  });

  it("parses fenced JSON", () => {
    const patches = parsePatchesFromModelOutput(
      "```json\n[{\"path\":\"src/pages/Bar.tsx\",\"action\":\"update\",\"content\":\"// updated\"}]\n```",
    );

    expect(patches[0]?.path).toBe("src/pages/Bar.tsx");
    expect(patches[0]?.action).toBe("update");
  });

  it("parses a single patch object", () => {
    const patches = parsePatchesFromModelOutput(
      `{"path":"src/pages/AboutPage.tsx","action":"create","content":"export default function AboutPage(){return null;}"}`,
    );

    expect(patches).toHaveLength(1);
    expect(patches[0]?.path).toBe("src/pages/AboutPage.tsx");
  });

  it("parses wrapped patch arrays", () => {
    const patches = parsePatchesFromModelOutput(
      `{"patches":[{"path":"src/pages/Baz.tsx","action":"create","content":"export default function Baz(){return null;}"}]}`,
    );

    expect(patches[0]?.path).toBe("src/pages/Baz.tsx");
  });

  it("parses loose object output with multiline content", () => {
    const patches = parsePatchesFromModelOutput(`{
  "path": "src/pages/AboutPage.tsx",
  "action": "create",
  "content": "import React from 'react';

const AboutPage = () => <div>About</div>;

export default AboutPage;
"
}`);

    expect(patches).toHaveLength(1);
    expect(patches[0]?.path).toBe("src/pages/AboutPage.tsx");
    expect(patches[0]?.content).toContain("AboutPage");
  });

  it("accepts alternate field names", () => {
    const patches = parsePatchesFromModelOutput(
      `[{"file":"src/pages/Qux.tsx","operation":"create","code":"export default function Qux(){return null;}"}]`,
    );

    expect(patches[0]?.path).toBe("src/pages/Qux.tsx");
    expect(patches[0]?.action).toBe("create");
  });

  it("rejects invalid actions", () => {
    expect(() =>
      parsePatchesFromModelOutput(
        `[{"path":"src/pages/Foo.tsx","action":"rename","content":"x"}]`,
      ),
    ).toThrow(/invalid action/i);
  });

  it("unescapes double-escaped newlines in JSON patch content", () => {
    const patches = parsePatchesFromModelOutput(
      `[{"path":"src/pages/HomePage.tsx","action":"update","content":"export default function HomePage() {\\n  return <div>hi</div>;\\n}"}]`,
    );

    expect(patches[0]?.content).toBe(
      "export default function HomePage() {\n  return <div>hi</div>;\n}",
    );
  });

  it("parses hero Index patch with Link import escapes", () => {
    const patches = parsePatchesFromModelOutput(
      `[{"path":"src/pages/Index.tsx","action":"update","content":"import { Link } from \\"react-router-dom\\";\\n\\nexport default function Home(){\\n  return <Link to=\\"/menu\\">Menu</Link>;\\n}"}]`,
    );

    expect(patches[0]?.path).toBe("src/pages/Index.tsx");
    expect(patches[0]?.content).toContain('import { Link } from "react-router-dom"');
    expect(patches[0]?.content).toContain('to="/menu"');
  });
});
