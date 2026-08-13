import {
  BookOpenText,
  Columns2,
  FilePlus2,
  FolderOpen,
  PanelLeft,
  RefreshCw,
  Search,
  SunMoon,
  Text,
  WrapText
} from "lucide-react";
import type { ReaderSettings } from "../types";

interface ToolbarProps {
  hasDocument: boolean;
  hasSidebarContent: boolean;
  canOpenFolder: boolean;
  isBusy: boolean;
  sidebarVisible: boolean;
  settings: ReaderSettings;
  onOpen: () => void;
  onOpenFolder: () => void;
  onReload: () => void;
  onSearch: () => void;
  onToggleSidebar: () => void;
  onCycleTheme: () => void;
  onToggleCodeWrap: () => void;
  onToggleReadingWidth: () => void;
  onChangeFontScale: (amount: number) => void;
}

export function Toolbar({
  hasDocument,
  hasSidebarContent,
  canOpenFolder,
  isBusy,
  sidebarVisible,
  settings,
  onOpen,
  onOpenFolder,
  onReload,
  onSearch,
  onToggleSidebar,
  onCycleTheme,
  onToggleCodeWrap,
  onToggleReadingWidth,
  onChangeFontScale
}: ToolbarProps) {
  const themeLabel = {
    system: "OS配色",
    light: "明るい配色",
    dark: "暗い配色"
  }[settings.theme];

  return (
    <header className="toolbar" aria-label="文書ツール">
      <div className="wordmark" aria-label="Markun">
        <BookOpenText aria-hidden="true" size={21} strokeWidth={1.7} />
        <span>Markun</span>
      </div>

      <div className="toolbar__primary">
        <button className="tool-button tool-button--primary" type="button" onClick={onOpen}>
          <FilePlus2 aria-hidden="true" size={18} />
          <span>開く</span>
          <kbd>Ctrl O</kbd>
        </button>
        {canOpenFolder && (
          <button className="tool-button" type="button" onClick={onOpenFolder} disabled={isBusy}>
            <FolderOpen aria-hidden="true" size={17} />
            <span>フォルダー</span>
            <kbd>Ctrl Shift O</kbd>
          </button>
        )}
        <button
          className="tool-button"
          type="button"
          onClick={onReload}
          disabled={!hasDocument || isBusy}
          aria-disabled={!hasDocument || isBusy}
        >
          <RefreshCw aria-hidden="true" size={17} className={isBusy ? "is-spinning" : ""} />
          <span>{isBusy ? "読込中" : "再読込"}</span>
        </button>
        <button
          className="tool-button"
          type="button"
          onClick={onSearch}
          disabled={!hasDocument}
          aria-disabled={!hasDocument}
        >
          <Search aria-hidden="true" size={17} />
          <span>検索</span>
          <kbd>Ctrl F</kbd>
        </button>
      </div>

      <div className="toolbar__display" aria-label="表示設定">
        <button
          className={`icon-button ${sidebarVisible ? "is-active" : ""}`}
          type="button"
          onClick={onToggleSidebar}
          aria-label={sidebarVisible ? "サイドバーを閉じる" : "サイドバーを開く"}
          aria-pressed={sidebarVisible}
          disabled={!hasSidebarContent}
        >
          <PanelLeft aria-hidden="true" size={18} />
        </button>
        <button
          className={`icon-button ${settings.wrapCode ? "is-active" : ""}`}
          type="button"
          onClick={onToggleCodeWrap}
          aria-label={settings.wrapCode ? "コードを折り返さない" : "コードを折り返す"}
          aria-pressed={settings.wrapCode}
        >
          <WrapText aria-hidden="true" size={18} />
        </button>
        <button
          className={`width-button ${settings.readingWidth === "wide" ? "is-active" : ""}`}
          type="button"
          onClick={onToggleReadingWidth}
          aria-label={`本文幅は${settings.readingWidth === "wide" ? "ワイド" : "標準"}。切り替える`}
          aria-pressed={settings.readingWidth === "wide"}
          disabled={!hasDocument}
        >
          <Columns2 aria-hidden="true" size={18} />
          <span>{settings.readingWidth === "wide" ? "ワイド" : "標準"}</span>
        </button>
        <div className="font-controls" aria-label="本文サイズ">
          <button
            className="icon-button"
            type="button"
            onClick={() => onChangeFontScale(-0.05)}
            aria-label="本文を小さくする"
            disabled={settings.fontScale <= 0.85}
          >
            <Text aria-hidden="true" size={15} />
          </button>
          <span aria-live="polite">{Math.round(settings.fontScale * 100)}%</span>
          <button
            className="icon-button"
            type="button"
            onClick={() => onChangeFontScale(0.05)}
            aria-label="本文を大きくする"
            disabled={settings.fontScale >= 1.3}
          >
            <Text aria-hidden="true" size={19} />
          </button>
        </div>
        <button
          className="theme-button"
          type="button"
          onClick={onCycleTheme}
          aria-label={`現在は${themeLabel}。配色を切り替える`}
        >
          <SunMoon aria-hidden="true" size={18} />
          <span>{themeLabel}</span>
        </button>
      </div>
    </header>
  );
}
