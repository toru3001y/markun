import { isTauri } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { lstat, readDir as readDirectory, readTextFile } from "@tauri-apps/plugin-fs";
import { openUrl } from "@tauri-apps/plugin-opener";
import type { MarkdownFile } from "../types";
import { fileNameFromPath, isMarkdownPath } from "./path";
import type { FsAdapter } from "./scan";

/** 探索ロジックへ注入するTauri実装。lstatはシンボリックリンクを辿らないため種別判定に使う。 */
export const tauriFsAdapter: FsAdapter = {
  async readDir(path) {
    const entries = await readDirectory(path);
    return entries.map((entry) => ({
      name: entry.name,
      isDirectory: entry.isDirectory,
      isFile: entry.isFile,
      isSymlink: entry.isSymlink
    }));
  },
  async isDirectory(path) {
    return (await lstat(path)).isDirectory;
  }
};

export async function chooseMarkdownFilePaths(): Promise<string[]> {
  if (!isTauri()) {
    return [];
  }

  const selected = await open({
    multiple: true,
    directory: false,
    filters: [{ name: "Markdown", extensions: ["md", "markdown"] }]
  });

  return Array.isArray(selected) ? selected : selected ? [selected] : [];
}

export async function chooseMarkdownDirectory(): Promise<string | null> {
  if (!isTauri()) {
    return null;
  }

  // recursive:true がサブフォルダーをFSスコープへ含める。省くと配下のreadDirがスコープ外で失敗する。
  const selected = await open({
    title: "Markdownフォルダーを開く",
    directory: true,
    multiple: false,
    recursive: true
  });

  return typeof selected === "string" ? selected : null;
}

export async function readMarkdownFile(path: string): Promise<MarkdownFile> {
  if (!isMarkdownPath(path)) {
    throw new Error("Markdownファイル（.md / .markdown）を選択してください。");
  }

  const content = await readTextFile(path);
  return {
    path,
    name: fileNameFromPath(path),
    content
  };
}

export async function openExternalUrl(url: string): Promise<void> {
  if (!/^https?:\/\//i.test(url)) {
    throw new Error("安全なHTTP(S)リンクだけを開けます。");
  }

  if (isTauri()) {
    await openUrl(url);
    return;
  }

  window.open(url, "_blank", "noopener,noreferrer");
}

export async function browserFilesToMarkdown(files: FileList | File[]): Promise<MarkdownFile[]> {
  return Promise.all(
    Array.from(files)
      .filter((file) => isMarkdownPath(file.name))
      .map(async (file) => ({
        path: file.name,
        name: file.name,
        content: await file.text()
      }))
  );
}

