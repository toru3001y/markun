import DOMPurify from "dompurify";
import MarkdownIt from "markdown-it";
import { convertFileSrc, isTauri } from "@tauri-apps/api/core";
import { createJavaScriptRegexEngine } from "@shikijs/engine-javascript";
import bash from "@shikijs/langs/bash";
import groovy from "@shikijs/langs/groovy";
import java from "@shikijs/langs/java";
import javascript from "@shikijs/langs/javascript";
import json from "@shikijs/langs/json";
import markdownLanguage from "@shikijs/langs/markdown";
import properties from "@shikijs/langs/properties";
import typescript from "@shikijs/langs/typescript";
import xml from "@shikijs/langs/xml";
import yaml from "@shikijs/langs/yaml";
import githubDark from "@shikijs/themes/github-dark";
import githubLight from "@shikijs/themes/github-light";
import { createHighlighterCore } from "shiki/core";
import type { HeadingItem, RenderedMarkdown } from "../types";
import { resolveSiblingPath } from "./path";

type AppHighlighter = Awaited<ReturnType<typeof createHighlighterCore>>;

let highlighterPromise: Promise<AppHighlighter> | undefined;

function getHighlighter(): Promise<AppHighlighter> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighterCore({
      engine: createJavaScriptRegexEngine(),
      themes: [githubLight, githubDark],
      langs: [
        java,
        groovy,
        properties,
        json,
        xml,
        yaml,
        bash,
        typescript,
        javascript,
        markdownLanguage
      ]
    });
  }
  return highlighterPromise;
}

const languageAliases: Record<string, string> = {
  js: "javascript",
  ts: "typescript",
  shell: "bash",
  sh: "bash",
  yml: "yaml",
  md: "markdown",
  txt: "text",
  plain: "text",
  plaintext: "text"
};

function normalizeLanguage(raw: string, highlighter: AppHighlighter): string {
  const requested = languageAliases[raw.toLowerCase()] || raw.toLowerCase();
  return highlighter.getLoadedLanguages().includes(requested) ? requested : "text";
}

function slugify(value: string): string {
  return (
    value
      .trim()
      .toLocaleLowerCase("ja")
      .replace(/[`*_~()[\]{}<>]/g, "")
      .replace(/[^\p{L}\p{N}\s-]/gu, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "section"
  );
}

function inlineText(token: {
  children?: Array<{ content?: string; type: string }> | null;
}): string {
  return (token.children || [])
    .filter((child) => child.type !== "image")
    .map((child) => child.content || "")
    .join("")
    .trim();
}

function safeImageSource(source: string, basePath?: string): string | null {
  if (/^https?:\/\//i.test(source) || source.startsWith("data:image/")) {
    return source;
  }
  if (!basePath || !isTauri()) {
    return null;
  }
  const resolved = resolveSiblingPath(basePath, source);
  return resolved ? convertFileSrc(resolved) : null;
}

export async function renderMarkdown(
  markdown: string,
  basePath?: string
): Promise<RenderedMarkdown> {
  const highlighter = await getHighlighter();
  const headings: HeadingItem[] = [];
  const slugCounts = new Map<string, number>();

  const md = new MarkdownIt({
    html: false,
    linkify: true,
    typographer: false,
    breaks: false
  });

  const defaultFence =
    md.renderer.rules.fence ||
    ((tokens, index, options, _env, renderer) => renderer.renderToken(tokens, index, options));
  const defaultImage =
    md.renderer.rules.image ||
    ((tokens, index, options, _env, renderer) => renderer.renderToken(tokens, index, options));
  const defaultLinkOpen =
    md.renderer.rules.link_open ||
    ((tokens, index, options, _env, renderer) => renderer.renderToken(tokens, index, options));

  md.renderer.rules.heading_open = (tokens, index) => {
    const token = tokens[index];
    const next = tokens[index + 1];
    const level = Number(token.tag.slice(1));
    const text = inlineText(next);
    const baseSlug = slugify(text);
    const count = slugCounts.get(baseSlug) || 0;
    slugCounts.set(baseSlug, count + 1);
    const id = count === 0 ? baseSlug : `${baseSlug}-${count + 1}`;
    token.attrSet("id", id);
    headings.push({ id, level, text });
    return `<${token.tag} id="${md.utils.escapeHtml(id)}">`;
  };

  md.renderer.rules.fence = (tokens, index, options, env, renderer) => {
    const token = tokens[index];
    const rawLanguage = token.info.trim().split(/\s+/, 1)[0] || "text";
    const language = normalizeLanguage(rawLanguage, highlighter);

    try {
      const highlighted = highlighter.codeToHtml(token.content, {
        lang: language,
        themes: {
          light: "github-light",
          dark: "github-dark"
        },
        defaultColor: false
      });
      return [
        `<figure class="code-block" data-language="${md.utils.escapeHtml(language)}">`,
        '<figcaption class="code-block__meta">',
        `<span>${md.utils.escapeHtml(language === "text" ? "text" : language)}</span>`,
        '<button class="code-copy" type="button" data-copy-code aria-label="コードをコピー">コピー</button>',
        "</figcaption>",
        highlighted,
        "</figure>"
      ].join("");
    } catch {
      return defaultFence(tokens, index, options, env, renderer);
    }
  };

  md.renderer.rules.link_open = (tokens, index, options, env, renderer) => {
    const token = tokens[index];
    const href = token.attrGet("href") || "";
    token.attrSet("data-markun-link", href);
    if (/^https?:\/\//i.test(href)) {
      token.attrSet("rel", "noopener noreferrer");
      token.attrSet("target", "_blank");
    }
    return defaultLinkOpen(tokens, index, options, env, renderer);
  };

  md.renderer.rules.image = (tokens, index, options, env, renderer) => {
    const token = tokens[index];
    const source = token.attrGet("src") || "";
    const safeSource = safeImageSource(source, basePath);
    if (!safeSource) {
      const alt = token.content || "画像";
      return `<span class="image-unavailable" role="note">画像を表示できません: ${md.utils.escapeHtml(alt)}</span>`;
    }
    token.attrSet("src", safeSource);
    token.attrSet("loading", "lazy");
    return defaultImage(tokens, index, options, env, renderer);
  };

  const dirtyHtml = md.render(markdown);
  const html = DOMPurify.sanitize(dirtyHtml, {
    ADD_ATTR: ["data-copy-code", "data-language", "data-markun-link", "target"],
    ALLOW_DATA_ATTR: true
  });

  return { html, headings };
}
