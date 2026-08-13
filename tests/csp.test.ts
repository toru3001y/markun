import { afterEach, describe, expect, it, vi } from "vitest";

describe("CSP compatibility", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("highlights code without compiling or instantiating WebAssembly", async () => {
    const compile = vi
      .spyOn(WebAssembly, "compile")
      .mockImplementation(async () => {
        throw new Error("WebAssembly compilation is blocked by CSP");
      });
    const instantiate = vi
      .spyOn(WebAssembly, "instantiate")
      .mockImplementation(async () => {
        throw new Error("WebAssembly instantiation is blocked by CSP");
      });

    const { renderMarkdown } = await import("../src/lib/markdown");
    const rendered = await renderMarkdown(
      ["# CSP test", "", "```java", "class App {}", "```"].join("\n")
    );

    expect(rendered.html).toContain('data-language="java"');
    expect(rendered.html).toContain('class="shiki');
    expect(compile).not.toHaveBeenCalled();
    expect(instantiate).not.toHaveBeenCalled();
  });
});
