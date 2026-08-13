import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { renderMarkdown } from "../src/lib/markdown";

const basicsPath =
  "D:/MyProjects/java-practice/study/docs/phase5/ch51/java-ch51-basics.md";
const problemsPath =
  "D:/MyProjects/java-practice/study/docs/phase5/ch51/java-ch51-problems.md";
const itWithSamples = existsSync(basicsPath) && existsSync(problemsPath) ? it : it.skip;

/**
 * 原文のうち、非インデントのコードフェンスに囲まれた `#` 行を集める。
 * これらは見出しとして扱われてはならない。件数を固定せず原文から導くため、
 * サンプル文書が書き換わっても期待値が陳腐化しない。
 */
function fencedCommentLines(markdown: string): string[] {
  const collected: string[] = [];
  let insideFence = false;
  for (const line of markdown.split(/\r?\n/)) {
    if (line.startsWith("```")) {
      insideFence = !insideFence;
      continue;
    }
    if (insideFence && /^#{1,6}\s/.test(line)) {
      collected.push(line.replace(/^#{1,6}\s+/, "").trim());
    }
  }
  return collected;
}

function hasTableSyntax(markdown: string): boolean {
  return /^\s*\|[\s:|-]+\|\s*$/m.test(markdown);
}

function textOf(element: Element): string {
  return (element.textContent ?? "").trim();
}

describe("Markdown renderer", () => {
  it("does not treat code comments as headings and disables raw HTML", async () => {
    const markdown = [
      "# 実見出し",
      "",
      "```properties",
      "# コード内コメント",
      "server.port=8080",
      "```",
      "",
      "<script>window.bad = true</script>"
    ].join("\n");

    const rendered = await renderMarkdown(markdown, "D:/docs/sample.md");
    const document = new DOMParser().parseFromString(rendered.html, "text/html");

    expect(rendered.headings.map((heading) => heading.text)).toEqual(["実見出し"]);
    expect(document.querySelector("script")).toBeNull();
    expect(document.body.textContent).toContain("<script>window.bad = true</script>");
    expect(document.querySelectorAll(".code-block")).toHaveLength(1);
  });

  it("emits a readable dark-palette color for every highlighted Java token", async () => {
    const rendered = await renderMarkdown(
      [
        "```java",
        "OrderRepository repo = new InMemoryOrderRepository();",
        "```"
      ].join("\n")
    );
    const document = new DOMParser().parseFromString(rendered.html, "text/html");
    const tokenSpans = [...document.querySelectorAll<HTMLElement>(".shiki code span[style]")];

    expect(tokenSpans.length).toBeGreaterThan(0);
    expect(
      tokenSpans.every((span) => span.style.getPropertyValue("--shiki-dark").trim().length > 0)
    ).toBe(true);
  });

  itWithSamples("builds a usable outline from the supplied basics document", async () => {
    const markdown = readFileSync(basicsPath, "utf8");
    const rendered = await renderMarkdown(markdown, basicsPath);
    const headingTexts = rendered.headings.map((heading) => heading.text);

    expect(rendered.headings.length).toBeGreaterThan(0);
    // 目次のジャンプ先が壊れない条件: idが空でなく、重複しない。
    expect(rendered.headings.every((heading) => heading.text.trim().length > 0)).toBe(true);
    expect(rendered.headings.every((heading) => heading.id.length > 0)).toBe(true);
    expect(new Set(rendered.headings.map((heading) => heading.id)).size).toBe(
      rendered.headings.length
    );

    // properties等のコード内コメントを見出しに拾わない。対象は原文から導く。
    for (const comment of fencedCommentLines(markdown)) {
      expect(headingTexts).not.toContain(comment);
    }
  });

  itWithSamples("renders the tables, code and highlighting the basics document contains", async () => {
    const markdown = readFileSync(basicsPath, "utf8");
    const rendered = await renderMarkdown(markdown, basicsPath);
    const document = new DOMParser().parseFromString(rendered.html, "text/html");
    const codeBlocks = [...document.querySelectorAll(".code-block")];

    expect(codeBlocks.length).toBeGreaterThan(0);
    expect(codeBlocks.every((block) => textOf(block).length > 0)).toBe(true);
    expect(document.querySelector('code span[style*="--shiki"]')).toBeTruthy();
    expect(document.querySelector("script")).toBeNull();

    // 原文に表があるときだけ、表として描画されていることを求める。
    expect(document.querySelectorAll("table").length > 0).toBe(hasTableSyntax(markdown));
  });

  itWithSamples("keeps nested output fences inside the supplied problems document", async () => {
    const markdown = readFileSync(problemsPath, "utf8");
    const rendered = await renderMarkdown(markdown, problemsPath);
    const document = new DOMParser().parseFromString(rendered.html, "text/html");
    const nestedBlocks = [...document.querySelectorAll("li .code-block")];

    // インデントされたフェンスがリスト項目の中でコードブロックとして残ること。
    // 入れ子が崩れると本文へ流れ出し、li配下のコードブロックが消える。
    expect(nestedBlocks.length).toBeGreaterThan(0);
    expect(nestedBlocks.every((block) => textOf(block).length > 0)).toBe(true);

    expect(rendered.headings.length).toBeGreaterThan(0);
    expect(document.querySelector("script")).toBeNull();
  });
});
