import { FolderTree, ListTree } from "lucide-react";
import type { HeadingItem, ScanResult, SidebarTab } from "../types";
import { FileList } from "./FileList";
import { Outline } from "./Outline";

interface SidebarProps {
  visible: boolean;
  tab: SidebarTab;
  headings: HeadingItem[];
  activeHeading: string;
  workspace: ScanResult | null;
  activePath?: string;
  limitNotice: string;
  onTabChange: (tab: SidebarTab) => void;
  onNavigate: (id: string) => void;
  onOpenFile: (path: string) => void;
}

export function Sidebar({
  visible,
  tab,
  headings,
  activeHeading,
  workspace,
  activePath,
  limitNotice,
  onTabChange,
  onNavigate,
  onOpenFile
}: SidebarProps) {
  return (
    <aside className={`sidebar ${visible ? "is-visible" : ""}`}>
      <div className="sidebar__tabs" role="tablist" aria-label="サイドバー">
        <button
          className="sidebar__tab"
          type="button"
          role="tab"
          id="sidebar-tab-files"
          aria-controls="sidebar-panel-files"
          aria-selected={tab === "files"}
          onClick={() => onTabChange("files")}
        >
          <FolderTree aria-hidden="true" size={16} />
          <span>ファイル</span>
          <small>{workspace?.files.length ?? 0}</small>
        </button>
        <button
          className="sidebar__tab"
          type="button"
          role="tab"
          id="sidebar-tab-outline"
          aria-controls="sidebar-panel-outline"
          aria-selected={tab === "outline"}
          onClick={() => onTabChange("outline")}
        >
          <ListTree aria-hidden="true" size={16} />
          <span>目次</span>
          <small>{headings.length}</small>
        </button>
      </div>

      <div
        className="sidebar__panel"
        role="tabpanel"
        id={`sidebar-panel-${tab}`}
        aria-labelledby={`sidebar-tab-${tab}`}
      >
        {tab === "files" ? (
          <FileList
            workspace={workspace}
            activePath={activePath}
            limitNotice={limitNotice}
            onOpenFile={onOpenFile}
          />
        ) : (
          <Outline
            headings={headings}
            activeHeading={activeHeading}
            hasDocument={Boolean(activePath)}
            onNavigate={onNavigate}
          />
        )}
      </div>
    </aside>
  );
}
