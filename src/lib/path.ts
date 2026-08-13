export function fileNameFromPath(path: string): string {
  const segments = path.replaceAll("\\", "/").split("/");
  return segments.at(-1) || path;
}

export function directoryFromPath(path: string): string {
  const normalized = path.replaceAll("\\", "/");
  const index = normalized.lastIndexOf("/");
  return index >= 0 ? normalized.slice(0, index) : "";
}

export function isMarkdownPath(path: string): boolean {
  return /\.(?:md|markdown)$/i.test(path);
}

export function isHiddenName(name: string): boolean {
  return name.startsWith(".");
}

export function pathSeparator(path: string): "\\" | "/" {
  return path.includes("\\") ? "\\" : "/";
}

export function joinPathWith(separator: "\\" | "/", base: string, ...segments: string[]): string {
  const normalizedBase = separator === "\\" ? base.replaceAll("/", "\\") : base;
  const trimmedBase = normalizedBase.replace(/[\\/]+$/, "");
  const parts = segments.filter((segment) => segment && segment !== ".");
  return [trimmedBase, ...parts].join(separator);
}

export function joinPath(base: string, ...segments: string[]): string {
  return joinPathWith(pathSeparator(base), base, ...segments);
}

export function resolveSiblingPath(basePath: string, relativePath: string): string | null {
  if (!basePath || !relativePath || /^(?:[a-z]+:|#|\\\\)/i.test(relativePath)) {
    return null;
  }

  const cleanRelative = decodeURIComponent(relativePath.split(/[?#]/, 1)[0]).replaceAll("\\", "/");
  const segments = cleanRelative.split("/");
  if (segments.some((segment) => segment === "..")) {
    return null;
  }

  return joinPathWith(pathSeparator(basePath), directoryFromPath(basePath), ...segments);
}
