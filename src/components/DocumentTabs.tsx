import { FileText, X } from "lucide-react";
import type { DocumentTab } from "../types";

interface DocumentTabsProps {
  tabs: DocumentTab[];
  activeId: string | null;
  onActivate: (id: string) => void;
  onClose: (id: string) => void;
}

export function DocumentTabs({ tabs, activeId, onActivate, onClose }: DocumentTabsProps) {
  if (tabs.length === 0) {
    return <div className="tabbar tabbar--empty" aria-hidden="true" />;
  }

  return (
    <div className="tabbar" role="tablist" aria-label="開いている文書">
      {tabs.map((tab) => {
        const active = tab.id === activeId;
        return (
          <div className={`document-tab ${active ? "is-active" : ""}`} key={tab.id}>
            <button
              className="document-tab__label"
              type="button"
              role="tab"
              id={`tab-${tab.id}`}
              aria-controls={`panel-${tab.id}`}
              aria-selected={active}
              tabIndex={active ? 0 : -1}
              title={tab.path}
              onClick={() => onActivate(tab.id)}
            >
              <FileText aria-hidden="true" size={15} />
              <span>{tab.name}</span>
              {tab.state === "loading" && <span className="status-dot" aria-label="読込中" />}
              {tab.state === "error" && (
                <span className="status-dot status-dot--error" aria-label="読込エラー" />
              )}
            </button>
            <button
              className="document-tab__close"
              type="button"
              aria-label={`${tab.name}を閉じる`}
              onClick={() => onClose(tab.id)}
            >
              <X aria-hidden="true" size={15} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

