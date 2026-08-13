import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Upload } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent
} from "react";
import { DocumentTabs } from "./components/DocumentTabs";
import { EmptyState } from "./components/EmptyState";
import { MarkdownView } from "./components/MarkdownView";
import { SearchPanel } from "./components/SearchPanel";
import { Sidebar } from "./components/Sidebar";
import { StatusBar } from "./components/StatusBar";
import { Toolbar } from "./components/Toolbar";
import {
  browserFilesToMarkdown,
  chooseMarkdownDirectory,
  chooseMarkdownFilePaths,
  openExternalUrl,
  readMarkdownFile,
  tauriFsAdapter
} from "./lib/files";
import { renderMarkdown } from "./lib/markdown";
import { isMarkdownPath, resolveSiblingPath } from "./lib/path";
import {
  classifyPaths,
  defaultScanLimits,
  describeScanLimits,
  scanMarkdownRoots
} from "./lib/scan";
import type {
  DocumentTab,
  MarkdownFile,
  ReaderSettings,
  ScanResult,
  SidebarTab
} from "./types";

const SETTINGS_KEY = "markun:settings";
const RECENT_KEY = "markun:recent-files";

const defaultSettings: ReaderSettings = {
  theme: "system",
  fontScale: 1,
  lineHeight: 1.72,
  wrapCode: false,
  readingWidth: "standard"
};

function readStoredSettings(): ReaderSettings {
  try {
    const value = localStorage.getItem(SETTINGS_KEY);
    return value ? { ...defaultSettings, ...JSON.parse(value) } : defaultSettings;
  } catch {
    return defaultSettings;
  }
}

function readStoredRecentFiles(): string[] {
  try {
    const value = localStorage.getItem(RECENT_KEY);
    return value ? JSON.parse(value) : [];
  } catch {
    return [];
  }
}

function uniqueTabId(path: string): string {
  const safePath = path.replace(/[^\p{L}\p{N}]+/gu, "-").slice(-48);
  return `${safePath}-${crypto.randomUUID().slice(0, 8)}`;
}

function reasonMessage(reason: unknown, fallback: string): string {
  return reason instanceof Error ? reason.message : fallback;
}

export default function App() {
  const [tabs, setTabs] = useState<DocumentTab[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [workspace, setWorkspace] = useState<ScanResult | null>(null);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("outline");
  const [activeHeading, setActiveHeading] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchIndex, setSearchIndex] = useState(0);
  const [searchCount, setSearchCount] = useState(0);
  const [settings, setSettings] = useState<ReaderSettings>(readStoredSettings);
  const [recentFiles, setRecentFiles] = useState<string[]>(readStoredRecentFiles);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scanToken = useRef(0);

  const isDesktop = isTauri();

  const activeTab = useMemo(
    () => tabs.find((tab) => tab.id === activeId) || null,
    [tabs, activeId]
  );

  const hasWorkspace = Boolean(workspace && workspace.files.length > 0);

  const addRecentFiles = useCallback((paths: string[]) => {
    if (!isTauri()) return;
    setRecentFiles((previous) => {
      const next = [...paths, ...previous.filter((path) => !paths.includes(path))].slice(0, 10);
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const ingestFiles = useCallback(
    async (files: MarkdownFile[]) => {
      if (files.length === 0) return;
      setIsBusy(true);
      setError("");

      try {
        const renderedTabs = await Promise.all(
          files.map(async (file): Promise<DocumentTab> => {
            const rendered = await renderMarkdown(file.content, file.path);
            return {
              ...file,
              ...rendered,
              id: uniqueTabId(file.path),
              scrollTop: 0,
              state: "ready"
            };
          })
        );

        setTabs((previous) => {
          const incomingPaths = new Set(renderedTabs.map((tab) => tab.path));
          return [...previous.filter((tab) => !incomingPaths.has(tab.path)), ...renderedTabs];
        });
        setActiveId(renderedTabs.at(-1)?.id || null);
        setActiveHeading(renderedTabs.at(-1)?.headings[0]?.id || "");
        addRecentFiles(files.map((file) => file.path));
      } catch (reason) {
        setError(reasonMessage(reason, "文書を読み込めませんでした。"));
      } finally {
        setIsBusy(false);
      }
    },
    [addRecentFiles]
  );

  const openFiles = useCallback(
    async (paths: string[]) => {
      const markdownPaths = paths.filter(isMarkdownPath);
      if (markdownPaths.length === 0) return;
      setIsBusy(true);
      setError("");
      try {
        const files = await Promise.all(markdownPaths.map(readMarkdownFile));
        await ingestFiles(files);
      } catch (reason) {
        setError(reasonMessage(reason, "ファイルを開けませんでした。"));
        setIsBusy(false);
      }
    },
    [ingestFiles]
  );

  const openFolders = useCallback(async (roots: string[]) => {
    if (roots.length === 0) return;
    const token = scanToken.current + 1;
    scanToken.current = token;
    setIsBusy(true);
    setError("");

    try {
      const result = await scanMarkdownRoots(roots, tauriFsAdapter, defaultScanLimits);
      if (scanToken.current !== token) return;

      setWorkspace(result);
      setSidebarTab("files");
      setSidebarVisible(true);
      setNotice(describeScanLimits(result, defaultScanLimits));

      if (result.files.length === 0) {
        setError(
          result.unreadableDirs.length > 0
            ? "フォルダーを読み取れませんでした。"
            : "このフォルダーにMarkdownファイルが見つかりませんでした。"
        );
      }
    } catch (reason) {
      if (scanToken.current !== token) return;
      setError(reasonMessage(reason, "フォルダーを読み取れませんでした。"));
    } finally {
      if (scanToken.current === token) setIsBusy(false);
    }
  }, []);

  /** ドロップやコマンドラインで渡されたパスを、種別ごとに振り分けて開く。 */
  const openDropped = useCallback(
    async (paths: string[]) => {
      setError("");
      setNotice("");

      let classified;
      try {
        classified = await classifyPaths(paths, tauriFsAdapter);
      } catch (reason) {
        setError(reasonMessage(reason, "渡されたパスを確認できませんでした。"));
        return;
      }

      if (classified.files.length === 0 && classified.directories.length === 0) {
        setError(
          classified.unreadable.length > 0
            ? "渡されたパスの種別を確認できませんでした。ツールバーの「フォルダー」から選び直してください。"
            : "Markdownファイル（.md / .markdown）かフォルダーを渡してください。"
        );
        return;
      }

      if (classified.files.length > 0) {
        await openFiles(classified.files);
      }
      if (classified.directories.length > 0) {
        await openFolders(classified.directories);
      }
    },
    [openFiles, openFolders]
  );

  const openWorkspaceFile = useCallback(
    async (path: string) => {
      const existing = tabs.find((tab) => tab.path === path);
      if (existing) {
        setActiveId(existing.id);
        setActiveHeading(existing.headings[0]?.id || "");
        return;
      }
      await openFiles([path]);
    },
    [openFiles, tabs]
  );

  const handleOpen = useCallback(async () => {
    setError("");
    if (!isTauri()) {
      fileInputRef.current?.click();
      return;
    }

    let paths: string[] = [];
    setIsBusy(true);
    try {
      paths = await chooseMarkdownFilePaths();
    } catch (reason) {
      setError(reasonMessage(reason, "ファイル選択を開始できませんでした。"));
    } finally {
      setIsBusy(false);
    }
    await openFiles(paths);
  }, [openFiles]);

  const handleOpenFolder = useCallback(async () => {
    if (!isTauri()) return;
    setError("");
    setNotice("");

    let root: string | null = null;
    setIsBusy(true);
    try {
      root = await chooseMarkdownDirectory();
    } catch (reason) {
      setError(reasonMessage(reason, "フォルダー選択を開始できませんでした。"));
    } finally {
      setIsBusy(false);
    }
    if (root) {
      await openFolders([root]);
    }
  }, [openFolders]);

  const handleReload = useCallback(async () => {
    if (!activeTab || !isTauri()) return;
    setIsBusy(true);
    setError("");
    try {
      const file = await readMarkdownFile(activeTab.path);
      const rendered = await renderMarkdown(file.content, file.path);
      setTabs((previous) =>
        previous.map((tab) =>
          tab.id === activeTab.id
            ? { ...tab, ...file, ...rendered, state: "ready", error: undefined }
            : tab
        )
      );
    } catch (reason) {
      setError(reasonMessage(reason, "再読込に失敗しました。"));
    } finally {
      setIsBusy(false);
    }
  }, [activeTab]);

  const handleClose = useCallback(
    (id: string) => {
      setTabs((previous) => {
        const index = previous.findIndex((tab) => tab.id === id);
        const next = previous.filter((tab) => tab.id !== id);
        if (id === activeId) {
          setActiveId(next[Math.min(index, next.length - 1)]?.id || null);
        }
        return next;
      });
    },
    [activeId]
  );

  const handleLink = useCallback(
    async (href: string) => {
      try {
        if (/^https?:\/\//i.test(href)) {
          await openExternalUrl(href);
          return;
        }
        if (href.startsWith("#")) {
          document.getElementById(decodeURIComponent(href.slice(1)))?.scrollIntoView({
            behavior: "smooth",
            block: "start"
          });
          return;
        }
        if (activeTab && isMarkdownPath(href)) {
          const resolved = resolveSiblingPath(activeTab.path, href);
          if (!resolved) {
            throw new Error("親フォルダー外の相対リンクは開けません。");
          }
          await openFiles([resolved]);
          return;
        }
        throw new Error("このリンク形式は安全のため開けません。");
      } catch (reason) {
        setError(reasonMessage(reason, "リンクを開けませんでした。"));
      }
    },
    [activeTab, openFiles]
  );

  const moveSearch = useCallback(
    (direction: 1 | -1) => {
      if (searchCount === 0) return;
      setSearchIndex((current) => (current + direction + searchCount) % searchCount);
    },
    [searchCount]
  );

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    document.documentElement.dataset.theme = settings.theme === "system" ? "" : settings.theme;
  }, [settings]);

  useEffect(() => {
    setSearchIndex(0);
  }, [searchQuery, activeId]);

  useEffect(() => {
    if (!isTauri()) return;
    let dispose: (() => void) | undefined;
    void getCurrentWindow()
      .onDragDropEvent((event) => {
        if (event.payload.type === "enter" || event.payload.type === "over") {
          setIsDragging(true);
        }
        if (event.payload.type === "leave") {
          setIsDragging(false);
        }
        if (event.payload.type === "drop") {
          setIsDragging(false);
          void openDropped(event.payload.paths);
        }
      })
      .then((unlisten) => {
        dispose = unlisten;
      });
    return () => dispose?.();
  }, [openDropped]);

  useEffect(() => {
    const handleKeyboard = (event: KeyboardEvent) => {
      const modifier = event.ctrlKey || event.metaKey;
      if (modifier && event.key.toLowerCase() === "o") {
        event.preventDefault();
        if (event.shiftKey) {
          void handleOpenFolder();
        } else {
          void handleOpen();
        }
      }
      if (modifier && event.key.toLowerCase() === "f" && activeTab) {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (modifier && event.key.toLowerCase() === "r" && activeTab) {
        event.preventDefault();
        void handleReload();
      }
      if (modifier && event.key.toLowerCase() === "w" && activeTab) {
        event.preventDefault();
        handleClose(activeTab.id);
      }
      if (modifier && event.key === "Tab" && tabs.length > 1) {
        event.preventDefault();
        const currentIndex = tabs.findIndex((tab) => tab.id === activeId);
        const direction = event.shiftKey ? -1 : 1;
        const nextIndex = (currentIndex + direction + tabs.length) % tabs.length;
        setActiveId(tabs[nextIndex].id);
      }
      if (event.key === "Escape") {
        setSearchOpen(false);
        setIsDragging(false);
      }
    };
    window.addEventListener("keydown", handleKeyboard);
    return () => window.removeEventListener("keydown", handleKeyboard);
  }, [
    activeId,
    activeTab,
    handleClose,
    handleOpen,
    handleOpenFolder,
    handleReload,
    tabs
  ]);

  const handleBrowserDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    if (!isTauri() && event.dataTransfer.files.length) {
      await ingestFiles(await browserFilesToMarkdown(event.dataTransfer.files));
    }
  };

  const handleBrowserFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      await ingestFiles(await browserFilesToMarkdown(event.target.files));
      event.target.value = "";
    }
  };

  return (
    <div
      className="app-shell"
      onDragEnter={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => {
        if (event.currentTarget === event.target) setIsDragging(false);
      }}
      onDrop={handleBrowserDrop}
    >
      <Toolbar
        hasDocument={Boolean(activeTab)}
        hasSidebarContent={Boolean(activeTab) || hasWorkspace}
        canOpenFolder={isDesktop}
        isBusy={isBusy}
        sidebarVisible={sidebarVisible}
        settings={settings}
        onOpen={() => void handleOpen()}
        onOpenFolder={() => void handleOpenFolder()}
        onReload={() => void handleReload()}
        onSearch={() => setSearchOpen(true)}
        onToggleSidebar={() => setSidebarVisible((visible) => !visible)}
        onCycleTheme={() =>
          setSettings((current) => ({
            ...current,
            theme:
              current.theme === "system" ? "light" : current.theme === "light" ? "dark" : "system"
          }))
        }
        onToggleCodeWrap={() =>
          setSettings((current) => ({ ...current, wrapCode: !current.wrapCode }))
        }
        onToggleReadingWidth={() =>
          setSettings((current) => ({
            ...current,
            readingWidth: current.readingWidth === "standard" ? "wide" : "standard"
          }))
        }
        onChangeFontScale={(amount) =>
          setSettings((current) => ({
            ...current,
            fontScale: Math.min(1.3, Math.max(0.85, Number((current.fontScale + amount).toFixed(2))))
          }))
        }
      />

      <DocumentTabs
        tabs={tabs}
        activeId={activeId}
        onActivate={(id) => setActiveId(id)}
        onClose={handleClose}
      />

      <SearchPanel
        open={searchOpen && Boolean(activeTab)}
        query={searchQuery}
        activeIndex={searchIndex}
        resultCount={searchCount}
        onQueryChange={setSearchQuery}
        onMove={moveSearch}
        onClose={() => setSearchOpen(false)}
      />

      {activeTab || hasWorkspace ? (
        <div className={`workspace ${sidebarVisible ? "has-sidebar" : ""}`}>
          <Sidebar
            visible={sidebarVisible}
            tab={sidebarTab}
            headings={activeTab?.headings ?? []}
            activeHeading={activeHeading}
            workspace={workspace}
            activePath={activeTab?.path}
            limitNotice={notice}
            onTabChange={setSidebarTab}
            onNavigate={(id) => {
              document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
              setActiveHeading(id);
            }}
            onOpenFile={(path) => void openWorkspaceFile(path)}
          />
          {activeTab ? (
            <MarkdownView
              key={activeTab.id}
              tab={activeTab}
              searchQuery={searchQuery}
              searchIndex={searchIndex}
              fontScale={settings.fontScale}
              lineHeight={settings.lineHeight}
              wrapCode={settings.wrapCode}
              readingWidth={settings.readingWidth}
              onSearchCount={setSearchCount}
              onActiveHeading={setActiveHeading}
              onScroll={(top) =>
                setTabs((previous) =>
                  previous.map((tab) => (tab.id === activeTab.id ? { ...tab, scrollTop: top } : tab))
                )
              }
              onLink={(href) => void handleLink(href)}
            />
          ) : (
            <div className="reader-placeholder">
              <p>左の一覧からMarkdownを選ぶと、ここに表示します。</p>
            </div>
          )}
        </div>
      ) : (
        <EmptyState
          recentFiles={recentFiles}
          canOpenFolder={isDesktop}
          onOpen={() => void handleOpen()}
          onOpenFolder={() => void handleOpenFolder()}
          onOpenRecent={(path) => void openFiles([path])}
        />
      )}

      <StatusBar
        path={activeTab?.path}
        error={error || activeTab?.error}
        notice={notice}
        isBusy={isBusy}
      />

      <input
        ref={fileInputRef}
        hidden
        aria-hidden="true"
        tabIndex={-1}
        type="file"
        accept=".md,.markdown,text/markdown"
        multiple
        onChange={handleBrowserFiles}
      />

      {isDragging && (
        <div className="drop-overlay" role="status">
          <div>
            <Upload aria-hidden="true" size={34} strokeWidth={1.5} />
            <strong>Markdownかフォルダーをここに置く</strong>
            <span>.md / .markdown / フォルダー</span>
          </div>
        </div>
      )}
    </div>
  );
}
