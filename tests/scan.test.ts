import { describe, expect, it } from "vitest";
import {
  classifyPaths,
  describeScanLimits,
  scanMarkdownRoots,
  type FsAdapter,
  type ScanEntry
} from "../src/lib/scan";
import type { ScanLimits } from "../src/types";

function dir(name: string): ScanEntry {
  return { name, isDirectory: true, isFile: false, isSymlink: false };
}

function file(name: string): ScanEntry {
  return { name, isDirectory: false, isFile: true, isSymlink: false };
}

function symlink(name: string, isDirectory = false): ScanEntry {
  return { name, isDirectory, isFile: !isDirectory, isSymlink: true };
}

function createFs(tree: Record<string, ScanEntry[]>, unreadable: string[] = []): FsAdapter {
  return {
    async readDir(path) {
      if (unreadable.includes(path)) {
        throw new Error(`forbidden path: ${path}`);
      }
      const entries = tree[path];
      if (!entries) {
        throw new Error(`no such directory: ${path}`);
      }
      return entries;
    },
    async isDirectory(path) {
      return Object.prototype.hasOwnProperty.call(tree, path);
    }
  };
}

const generousLimits: ScanLimits = { maxDepth: 16, maxFiles: 1000, maxEntries: 100_000 };

function limits(overrides: Partial<ScanLimits>): ScanLimits {
  return { ...generousLimits, ...overrides };
}

describe("scanMarkdownRoots", () => {
  it("collects Markdown regardless of case and skips other files", async () => {
    const fs = createFs({
      "/root": [file("a.md"), file("B.MARKDOWN"), file("notes.txt"), file("image.png")]
    });

    const result = await scanMarkdownRoots(["/root"], fs, generousLimits);

    expect(result.files.map((entry) => entry.name)).toEqual(["a.md", "B.MARKDOWN"]);
    expect(result.scannedEntries).toBe(4);
    expect(result.reachedFileLimit).toBe(false);
  });

  it("returns a stable order and keeps root-relative paths for display", async () => {
    const fs = createFs({
      "/root": [dir("zeta"), file("chapter10.md"), file("chapter2.md"), dir("alpha")],
      "/root/alpha": [file("intro.md")],
      "/root/zeta": [file("outro.md")]
    });

    const result = await scanMarkdownRoots(["/root"], fs, generousLimits);

    expect(result.files.map((entry) => entry.relativePath)).toEqual([
      "chapter2.md",
      "chapter10.md",
      "alpha/intro.md",
      "zeta/outro.md"
    ]);
    expect(result.files[2].path).toBe("/root/alpha/intro.md");
    expect(result.files[2].rootPath).toBe("/root");
  });

  it("joins Windows paths with backslashes", async () => {
    const fs = createFs({
      "D:\\docs": [dir("phase5")],
      "D:\\docs\\phase5": [file("chapter.md")]
    });

    const result = await scanMarkdownRoots(["D:\\docs"], fs, generousLimits);

    expect(result.files[0].path).toBe("D:\\docs\\phase5\\chapter.md");
    expect(result.files[0].relativePath).toBe("phase5/chapter.md");
  });

  it("collects files inside the deepest allowed directory but does not descend past it", async () => {
    const fs = createFs({
      "/root": [file("a.md"), dir("d1")],
      "/root/d1": [file("b.md"), dir("d2")],
      "/root/d1/d2": [file("c.md"), dir("d3")],
      "/root/d1/d2/d3": [file("d.md")]
    });

    const result = await scanMarkdownRoots(["/root"], fs, limits({ maxDepth: 2 }));

    expect(result.files.map((entry) => entry.name)).toEqual(["a.md", "b.md", "c.md"]);
    expect(result.reachedDepthLimit).toBe(true);
  });

  it("does not flag the depth limit when nothing was cut off", async () => {
    const fs = createFs({
      "/root": [file("a.md"), dir("d1")],
      "/root/d1": [file("b.md")]
    });

    const result = await scanMarkdownRoots(["/root"], fs, limits({ maxDepth: 2 }));

    expect(result.reachedDepthLimit).toBe(false);
  });

  it("stops at the file limit", async () => {
    const fs = createFs({
      "/root": [file("1.md"), file("2.md"), file("3.md"), file("4.md"), file("5.md")]
    });

    const result = await scanMarkdownRoots(["/root"], fs, limits({ maxFiles: 2 }));

    expect(result.files).toHaveLength(2);
    expect(result.reachedFileLimit).toBe(true);
    expect(result.reachedEntryLimit).toBe(false);
  });

  it("stops at the entry limit even when few Markdown files exist", async () => {
    const fs = createFs({
      "/root": [file("a.txt"), file("b.txt"), file("c.txt"), file("late.md")]
    });

    const result = await scanMarkdownRoots(["/root"], fs, limits({ maxEntries: 3 }));

    expect(result.scannedEntries).toBe(3);
    expect(result.files).toHaveLength(0);
    expect(result.reachedEntryLimit).toBe(true);
  });

  it("applies limits across all roots of a single operation", async () => {
    const fs = createFs({
      "/one": [file("a.md"), file("b.md")],
      "/two": [file("c.md"), file("d.md")]
    });

    const result = await scanMarkdownRoots(["/one", "/two"], fs, limits({ maxFiles: 3 }));

    expect(result.files.map((entry) => entry.name)).toEqual(["a.md", "b.md", "c.md"]);
    expect(result.reachedFileLimit).toBe(true);
  });

  it("never follows symlinks", async () => {
    const fs = createFs({
      "/root": [file("real.md"), symlink("linked.md"), symlink("elsewhere", true)],
      "/root/elsewhere": [file("hidden-target.md")]
    });

    const result = await scanMarkdownRoots(["/root"], fs, generousLimits);

    expect(result.files.map((entry) => entry.name)).toEqual(["real.md"]);
  });

  it("skips dot-prefixed directories", async () => {
    const fs = createFs({
      "/root": [dir(".git"), dir("docs"), file(".hidden.md")],
      "/root/.git": [file("notes.md")],
      "/root/docs": [file("guide.md")]
    });

    const result = await scanMarkdownRoots(["/root"], fs, generousLimits);

    expect(result.files.map((entry) => entry.relativePath)).toEqual([
      ".hidden.md",
      "docs/guide.md"
    ]);
  });

  it("keeps going when a subdirectory cannot be read", async () => {
    const fs = createFs(
      {
        "/root": [dir("blocked"), dir("open")],
        "/root/blocked": [file("secret.md")],
        "/root/open": [file("guide.md")]
      },
      ["/root/blocked"]
    );

    const result = await scanMarkdownRoots(["/root"], fs, generousLimits);

    expect(result.files.map((entry) => entry.name)).toEqual(["guide.md"]);
    expect(result.unreadableDirs).toEqual(["/root/blocked"]);
  });

  it("reports an unreadable root without throwing", async () => {
    const fs = createFs({ "/root": [file("a.md")] }, ["/root"]);

    const result = await scanMarkdownRoots(["/root"], fs, generousLimits);

    expect(result.files).toHaveLength(0);
    expect(result.unreadableDirs).toEqual(["/root"]);
  });
});

describe("classifyPaths", () => {
  it("splits dropped paths into files, directories and ignored entries", async () => {
    const fs = createFs({
      "/root": [file("a.md")],
      "/root/notes.md": []
    });

    const result = await classifyPaths(
      ["/root", "/elsewhere/guide.md", "/elsewhere/photo.png", "/root/notes.md"],
      fs
    );

    expect(result.directories).toEqual(["/root", "/root/notes.md"]);
    expect(result.files).toEqual(["/elsewhere/guide.md"]);
    expect(result.ignored).toEqual(["/elsewhere/photo.png"]);
  });

  it("removes duplicates", async () => {
    const fs = createFs({});

    const result = await classifyPaths(["/a.md", "/a.md"], fs);

    expect(result.files).toEqual(["/a.md"]);
  });

  it("still opens Markdown when the path type cannot be inspected", async () => {
    // ドロップ直後はランタイムスコープの登録が間に合わずlstatが失敗しうる。
    // 拡張子で判断できるMarkdownは、従来どおり開けなければならない。
    const fs: FsAdapter = {
      async readDir() {
        return [];
      },
      async isDirectory() {
        throw new Error("forbidden path");
      }
    };

    const result = await classifyPaths(["/dropped.md", "/dropped.bin"], fs);

    expect(result.files).toEqual(["/dropped.md"]);
    expect(result.unreadable).toEqual(["/dropped.bin"]);
    expect(result.ignored).toEqual([]);
  });
});

describe("describeScanLimits", () => {
  it("stays empty when nothing was cut off", async () => {
    const fs = createFs({ "/root": [file("a.md")] });
    const result = await scanMarkdownRoots(["/root"], fs, generousLimits);

    expect(describeScanLimits(result, generousLimits)).toBe("");
  });

  it("explains the file and depth limits together", async () => {
    const fs = createFs({
      "/root": [dir("adeep"), file("z1.md"), file("z2.md")],
      "/root/adeep": [file("x.md")]
    });
    const scanLimits = limits({ maxDepth: 0, maxFiles: 1 });
    const result = await scanMarkdownRoots(["/root"], fs, scanLimits);

    const notice = describeScanLimits(result, scanLimits);

    expect(notice).toContain("1件を表示しています");
    expect(notice).toContain("深さ0まで探索しました");
  });

  it("counts unreadable folders without listing their paths", async () => {
    const fs = createFs(
      { "/root": [dir("blocked")], "/root/blocked": [] },
      ["/root/blocked"]
    );
    const result = await scanMarkdownRoots(["/root"], fs, generousLimits);

    const notice = describeScanLimits(result, generousLimits);

    expect(notice).toBe("1個のフォルダーを読み取れませんでした。");
    expect(notice).not.toContain("/root/blocked");
  });
});
