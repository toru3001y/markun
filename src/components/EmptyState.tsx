import { BookOpenText, Clock3, FilePlus2, FolderOpen } from "lucide-react";

interface EmptyStateProps {
  recentFiles: string[];
  canOpenFolder: boolean;
  onOpen: () => void;
  onOpenFolder: () => void;
  onOpenRecent: (path: string) => void;
}

export function EmptyState({
  recentFiles,
  canOpenFolder,
  onOpen,
  onOpenFolder,
  onOpenRecent
}: EmptyStateProps) {
  return (
    <main className="empty-state">
      <div className="empty-state__mark" aria-hidden="true">
        <BookOpenText size={32} strokeWidth={1.45} />
      </div>
      <p className="empty-state__eyebrow">LOCAL MARKDOWN READER</p>
      <h1>読むための余白を、文書に。</h1>
      <p className="empty-state__lead">
        技術文書の見出し、表、コードを整え、内容そのものに集中できる紙面として表示します。
      </p>
      <div className="empty-state__actions">
        <button className="open-document-button" type="button" onClick={onOpen}>
          <FilePlus2 aria-hidden="true" size={19} />
          Markdownを開く
          <kbd>Ctrl O</kbd>
        </button>
        {canOpenFolder && (
          <button
            className="open-document-button open-document-button--secondary"
            type="button"
            onClick={onOpenFolder}
          >
            <FolderOpen aria-hidden="true" size={19} />
            フォルダーを開く
            <kbd>Ctrl Shift O</kbd>
          </button>
        )}
      </div>

      {recentFiles.length > 0 && (
        <section className="recent-files" aria-labelledby="recent-heading">
          <div className="recent-files__heading">
            <Clock3 aria-hidden="true" size={16} />
            <h2 id="recent-heading">最近開いた文書</h2>
          </div>
          <ul>
            {recentFiles.slice(0, 5).map((path) => (
              <li key={path}>
                <button type="button" onClick={() => onOpenRecent(path)} title={path}>
                  <span>{path.replaceAll("\\", "/").split("/").at(-1)}</span>
                  <small>{path}</small>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

