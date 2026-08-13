export type ThemePreference = "system" | "light" | "dark";
export type ReadingWidth = "standard" | "wide";
export type SidebarTab = "files" | "outline";

export interface HeadingItem {
  id: string;
  level: number;
  text: string;
}

export interface RenderedMarkdown {
  html: string;
  headings: HeadingItem[];
}

export interface MarkdownFile {
  path: string;
  name: string;
  content: string;
}

export interface WorkspaceFile {
  path: string;
  name: string;
  rootPath: string;
  relativePath: string;
}

export interface ScanLimits {
  maxDepth: number;
  maxFiles: number;
  maxEntries: number;
}

export interface ScanResult {
  roots: string[];
  files: WorkspaceFile[];
  scannedEntries: number;
  unreadableDirs: string[];
  reachedDepthLimit: boolean;
  reachedFileLimit: boolean;
  reachedEntryLimit: boolean;
}

export interface DocumentTab extends MarkdownFile, RenderedMarkdown {
  id: string;
  scrollTop: number;
  state: "ready" | "loading" | "error";
  error?: string;
}

export interface ReaderSettings {
  theme: ThemePreference;
  fontScale: number;
  lineHeight: number;
  wrapCode: boolean;
  readingWidth: ReadingWidth;
}
