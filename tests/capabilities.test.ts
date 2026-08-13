import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

interface ScopedPermission {
  identifier: string;
  allow?: { path: string }[];
  deny?: { path: string }[];
}

type Permission = string | ScopedPermission;

const capability = JSON.parse(
  readFileSync(resolve(process.cwd(), "src-tauri/capabilities/default.json"), "utf8")
) as { permissions: Permission[] };

const identifiers = capability.permissions.map((permission) =>
  typeof permission === "string" ? permission : permission.identifier
);

const scoped = capability.permissions.filter(
  (permission): permission is ScopedPermission => typeof permission !== "string"
);

describe("Tauri capabilities", () => {
  it("grants the commands needed to browse a folder", () => {
    expect(identifiers).toContain("dialog:allow-open");
    expect(identifiers).toContain("fs:allow-read-dir");
    expect(identifiers).toContain("fs:allow-lstat");
    expect(identifiers).toContain("fs:allow-read-text-file");
  });

  it("does not grant blanket filesystem access", () => {
    for (const forbidden of ["fs:default", "fs:read-all", "fs:allow-read", "fs:scope"]) {
      expect(identifiers).not.toContain(forbidden);
    }
  });

  it("grants no write, delete or execute capability", () => {
    const mutating = identifiers.filter((identifier) =>
      /write|create|remove|rename|copy|mkdir|truncate|shell|process/i.test(identifier)
    );
    expect(mutating).toEqual([]);
  });

  it("keeps the static read scope limited to Markdown files", () => {
    expect(scoped.map((permission) => permission.identifier)).toEqual([
      "fs:allow-read-text-file"
    ]);
    expect(scoped[0].allow?.map((entry) => entry.path)).toEqual(["**/*.md", "**/*.markdown"]);
  });

  it("never widens a scope to every path", () => {
    const paths = scoped.flatMap((permission) => permission.allow?.map((entry) => entry.path) ?? []);
    for (const path of paths) {
      expect(path).not.toBe("**");
      expect(path).not.toBe("**/*");
    }
  });

  it("leaves read-dir and lstat without a static path scope", () => {
    // ダイアログ選択・ドラッグ＆ドロップで付与されるランタイムスコープだけで通す。
    for (const identifier of ["fs:allow-read-dir", "fs:allow-lstat"]) {
      expect(capability.permissions).toContain(identifier);
    }
  });
});
