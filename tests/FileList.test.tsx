import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FileList } from "../src/components/FileList";
import type { ScanResult, WorkspaceFile } from "../src/types";

afterEach(cleanup);

function workspaceFile(relativePath: string, rootPath = "/docs"): WorkspaceFile {
  const name = relativePath.split("/").at(-1) as string;
  return { path: `${rootPath}/${relativePath}`, name, rootPath, relativePath };
}

function scanResult(files: WorkspaceFile[]): ScanResult {
  return {
    roots: [...new Set(files.map((file) => file.rootPath))],
    files,
    scannedEntries: files.length,
    unreadableDirs: [],
    reachedDepthLimit: false,
    reachedFileLimit: false,
    reachedEntryLimit: false
  };
}

describe("FileList", () => {
  it("invites the user to open a folder when nothing has been scanned", () => {
    render(<FileList workspace={null} limitNotice="" onOpenFile={vi.fn()} />);

    expect(screen.getByText(/フォルダーを開くと/)).toBeInTheDocument();
  });

  it("shows the file name with its parent folder and the full path as a tooltip", () => {
    const workspace = scanResult([workspaceFile("phase5/ch51/basics.md")]);

    render(<FileList workspace={workspace} limitNotice="" onOpenFile={vi.fn()} />);

    const button = screen.getByRole("button", { name: /basics\.md/ });
    expect(button).toHaveAttribute("title", "/docs/phase5/ch51/basics.md");
    expect(button).toHaveTextContent("phase5/ch51");
  });

  it("opens exactly one file per click", () => {
    const onOpenFile = vi.fn();
    const workspace = scanResult([workspaceFile("a.md"), workspaceFile("b.md")]);

    render(<FileList workspace={workspace} limitNotice="" onOpenFile={onOpenFile} />);
    fireEvent.click(screen.getByRole("button", { name: /a\.md/ }));

    expect(onOpenFile).toHaveBeenCalledTimes(1);
    expect(onOpenFile).toHaveBeenCalledWith("/docs/a.md");
  });

  it("marks the file shown in the active tab", () => {
    const workspace = scanResult([workspaceFile("a.md"), workspaceFile("b.md")]);

    render(
      <FileList workspace={workspace} activePath="/docs/b.md" limitNotice="" onOpenFile={vi.fn()} />
    );

    expect(screen.getByRole("button", { name: /b\.md/ })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: /a\.md/ })).not.toHaveAttribute("aria-current");
  });

  it("groups files under each scanned root", () => {
    const workspace = scanResult([
      workspaceFile("a.md", "/docs"),
      workspaceFile("b.md", "/notes")
    ]);

    render(<FileList workspace={workspace} limitNotice="" onOpenFile={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "docs" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "notes" })).toBeInTheDocument();
  });

  it("surfaces the limit notice above the list", () => {
    const workspace = scanResult([workspaceFile("a.md")]);

    render(
      <FileList
        workspace={workspace}
        limitNotice="200件を表示しています。上限に達したため残りは未探索です。"
        onOpenFile={vi.fn()}
      />
    );

    expect(screen.getByText(/200件を表示しています/)).toBeInTheDocument();
  });
});
