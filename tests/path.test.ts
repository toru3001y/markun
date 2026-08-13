import { describe, expect, it } from "vitest";
import {
  directoryFromPath,
  fileNameFromPath,
  isHiddenName,
  isMarkdownPath,
  joinPath,
  resolveSiblingPath
} from "../src/lib/path";

describe("path utilities", () => {
  it("handles Windows paths without changing the source", () => {
    const path = String.raw`D:\docs\phase5\chapter.md`;
    expect(fileNameFromPath(path)).toBe("chapter.md");
    expect(directoryFromPath(path)).toBe("D:/docs/phase5");
    expect(resolveSiblingPath(path, "next.md")).toBe(String.raw`D:\docs\phase5\next.md`);
  });

  it("accepts Markdown extensions and rejects parent traversal", () => {
    expect(isMarkdownPath("README.md")).toBe(true);
    expect(isMarkdownPath("guide.MARKDOWN")).toBe(true);
    expect(isMarkdownPath("notes.txt")).toBe(false);
    expect(resolveSiblingPath("D:/docs/readme.md", "../secret.md")).toBeNull();
  });

  it("joins paths with the separator already used by the base", () => {
    expect(joinPath(String.raw`D:\docs`, "phase5", "chapter.md")).toBe(
      String.raw`D:\docs\phase5\chapter.md`
    );
    expect(joinPath("/home/docs", "phase5", "chapter.md")).toBe("/home/docs/phase5/chapter.md");
  });

  it("normalises trailing separators and skips empty segments when joining", () => {
    expect(joinPath("D:\\", "chapter.md")).toBe(String.raw`D:\chapter.md`);
    expect(joinPath("/home/docs/", "chapter.md")).toBe("/home/docs/chapter.md");
    expect(joinPath(String.raw`D:\docs`, "", ".", "chapter.md")).toBe(
      String.raw`D:\docs\chapter.md`
    );
  });

  it("detects dot-prefixed names", () => {
    expect(isHiddenName(".git")).toBe(true);
    expect(isHiddenName("docs")).toBe(false);
  });
});
