import { Folder } from "lucide-react";
import { fileNameFromPath } from "../lib/path";
import { groupFilesByRoot } from "../lib/scan";
import type { ScanResult } from "../types";

interface FileListProps {
  workspace: ScanResult | null;
  activePath?: string;
  limitNotice: string;
  onOpenFile: (path: string) => void;
}

function parentOf(relativePath: string, name: string): string {
  return relativePath.slice(0, relativePath.length - name.length).replace(/\/$/, "");
}

export function FileList({ workspace, activePath, limitNotice, onOpenFile }: FileListProps) {
  if (!workspace || workspace.files.length === 0) {
    return (
      <div className="sidebar-nav">
        <p className="sidebar-empty">
          フォルダーを開くと、その中のMarkdownがここに並びます。
        </p>
      </div>
    );
  }

  return (
    <div className="sidebar-nav">
      {limitNotice && <p className="sidebar-nav__notice">{limitNotice}</p>}
      {groupFilesByRoot(workspace.files).map((group) => (
        <section key={group.rootPath}>
          <h2 className="sidebar-nav__group" title={group.rootPath}>
            <Folder aria-hidden="true" size={13} />
            <span>{fileNameFromPath(group.rootPath)}</span>
          </h2>
          <ul>
            {group.files.map((file) => {
              const isActive = file.path === activePath;
              const parent = parentOf(file.relativePath, file.name);
              return (
                <li key={file.path}>
                  <button
                    type="button"
                    className={isActive ? "is-active" : ""}
                    aria-current={isActive ? "page" : undefined}
                    title={file.path}
                    onClick={() => onOpenFile(file.path)}
                  >
                    <span>{file.name}</span>
                    {parent && <small>{parent}</small>}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
