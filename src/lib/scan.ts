import type { ScanLimits, ScanResult, WorkspaceFile } from "../types";
import { isHiddenName, isMarkdownPath, joinPath } from "./path";

export interface ScanEntry {
  name: string;
  isDirectory: boolean;
  isFile: boolean;
  isSymlink: boolean;
}

export interface FsAdapter {
  readDir(path: string): Promise<ScanEntry[]>;
  isDirectory(path: string): Promise<boolean>;
}

export interface PathClassification {
  files: string[];
  directories: string[];
  ignored: string[];
  /** 種別を判定できなかったパス。権限やスコープの問題で lstat に失敗した場合など。 */
  unreadable: string[];
}

export const defaultScanLimits: ScanLimits = {
  maxDepth: 5,
  maxFiles: 200,
  maxEntries: 5_000
};

const nameCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

interface PendingDirectory {
  path: string;
  depth: number;
  rootPath: string;
  relativePath: string;
}

function childRelativePath(parent: string, name: string): string {
  return parent ? `${parent}/${name}` : name;
}

/**
 * 幅優先でルート配下のMarkdownを集める。本文は読まず、一覧に必要な情報だけを返す。
 * 上限は1回の操作全体（複数ルートの合計）に対して適用する。
 */
export async function scanMarkdownRoots(
  roots: string[],
  fs: FsAdapter,
  limits: ScanLimits = defaultScanLimits
): Promise<ScanResult> {
  const result: ScanResult = {
    roots: [...new Set(roots)],
    files: [],
    scannedEntries: 0,
    unreadableDirs: [],
    reachedDepthLimit: false,
    reachedFileLimit: false,
    reachedEntryLimit: false
  };

  const seenFiles = new Set<string>();
  const queue: PendingDirectory[] = result.roots.map((path) => ({
    path,
    depth: 0,
    rootPath: path,
    relativePath: ""
  }));

  while (queue.length > 0 && !result.reachedFileLimit && !result.reachedEntryLimit) {
    const current = queue.shift() as PendingDirectory;

    let entries: ScanEntry[];
    try {
      entries = await fs.readDir(current.path);
    } catch {
      result.unreadableDirs.push(current.path);
      continue;
    }

    const sorted = [...entries].sort((a, b) => nameCollator.compare(a.name, b.name));

    for (const entry of sorted) {
      if (result.scannedEntries >= limits.maxEntries) {
        result.reachedEntryLimit = true;
        break;
      }
      result.scannedEntries += 1;

      // シンボリックリンクは辿らない。リンク先が探索対象の外へ抜ける可能性があるため一覧にも載せない。
      if (entry.isSymlink) {
        continue;
      }

      if (entry.isDirectory) {
        if (isHiddenName(entry.name)) {
          continue;
        }
        if (current.depth >= limits.maxDepth) {
          result.reachedDepthLimit = true;
          continue;
        }
        queue.push({
          path: joinPath(current.path, entry.name),
          depth: current.depth + 1,
          rootPath: current.rootPath,
          relativePath: childRelativePath(current.relativePath, entry.name)
        });
        continue;
      }

      if (!entry.isFile || !isMarkdownPath(entry.name)) {
        continue;
      }

      if (result.files.length >= limits.maxFiles) {
        result.reachedFileLimit = true;
        break;
      }

      const path = joinPath(current.path, entry.name);
      if (seenFiles.has(path)) {
        continue;
      }
      seenFiles.add(path);
      result.files.push({
        path,
        name: entry.name,
        rootPath: current.rootPath,
        relativePath: childRelativePath(current.relativePath, entry.name)
      });
    }
  }

  return result;
}

/** ドロップ・選択で渡ってきたトップレベルのパスをファイル／フォルダー／対象外に振り分ける。 */
export async function classifyPaths(paths: string[], fs: FsAdapter): Promise<PathClassification> {
  const classification: PathClassification = {
    files: [],
    directories: [],
    ignored: [],
    unreadable: []
  };

  for (const path of new Set(paths)) {
    let isDirectory = false;
    try {
      isDirectory = await fs.isDirectory(path);
    } catch {
      // 種別を判定できなくても、拡張子でMarkdownと分かるものは従来どおり開く。
      // 本文の読込はcapabilitiesの静的スコープ（**/*.md）で通るため、ここで諦めない。
      if (isMarkdownPath(path)) {
        classification.files.push(path);
      } else {
        classification.unreadable.push(path);
      }
      continue;
    }

    if (isDirectory) {
      classification.directories.push(path);
    } else if (isMarkdownPath(path)) {
      classification.files.push(path);
    } else {
      classification.ignored.push(path);
    }
  }

  return classification;
}

/** 探索結果から、部分的にしか集められなかったことを伝える文言を組み立てる。 */
export function describeScanLimits(
  result: ScanResult,
  limits: ScanLimits = defaultScanLimits
): string {
  const notices: string[] = [];

  if (result.reachedFileLimit) {
    notices.push(
      `${limits.maxFiles.toLocaleString()}件を表示しています。上限に達したため残りは未探索です。`
    );
  }
  if (result.reachedEntryLimit) {
    notices.push(`${limits.maxEntries.toLocaleString()}項目を確認したため探索を停止しました。`);
  }
  if (result.reachedDepthLimit) {
    notices.push(`深さ${limits.maxDepth}まで探索しました。より深いサブフォルダーは省略されています。`);
  }
  if (result.unreadableDirs.length > 0) {
    notices.push(`${result.unreadableDirs.length}個のフォルダーを読み取れませんでした。`);
  }

  return notices.join(" ");
}

/** 一覧をルートごとにまとめる。表示順は探索順（ルート指定順・名前順）を保つ。 */
export function groupFilesByRoot(files: WorkspaceFile[]): { rootPath: string; files: WorkspaceFile[] }[] {
  const groups = new Map<string, WorkspaceFile[]>();
  for (const file of files) {
    const group = groups.get(file.rootPath);
    if (group) {
      group.push(file);
    } else {
      groups.set(file.rootPath, [file]);
    }
  }
  return [...groups].map(([rootPath, groupFiles]) => ({ rootPath, files: groupFiles }));
}
