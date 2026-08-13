import { useEffect, useLayoutEffect, useRef } from "react";
import type { DocumentTab, ReadingWidth } from "../types";
import {
  activateSearchResult,
  applySearchHighlights,
  clearSearchHighlights
} from "../lib/search";

interface MarkdownViewProps {
  tab: DocumentTab;
  searchQuery: string;
  searchIndex: number;
  fontScale: number;
  lineHeight: number;
  wrapCode: boolean;
  readingWidth: ReadingWidth;
  onSearchCount: (count: number) => void;
  onActiveHeading: (id: string) => void;
  onScroll: (top: number) => void;
  onLink: (href: string) => void;
}

export function MarkdownView({
  tab,
  searchQuery,
  searchIndex,
  fontScale,
  lineHeight,
  wrapCode,
  readingWidth,
  onSearchCount,
  onActiveHeading,
  onScroll,
  onLink
}: MarkdownViewProps) {
  const articleRef = useRef<HTMLElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollFrame = useRef<number | null>(null);

  useLayoutEffect(() => {
    if (articleRef.current) {
      articleRef.current.innerHTML = tab.html;
    }
  }, [tab.html]);

  useEffect(() => {
    const article = articleRef.current;
    if (!article) return;
    const count = applySearchHighlights(article, searchQuery);
    onSearchCount(count);
    if (count > 0) {
      activateSearchResult(article, Math.min(searchIndex, count - 1));
    }
    return () => clearSearchHighlights(article);
  }, [tab.html, searchQuery, onSearchCount]);

  useEffect(() => {
    if (articleRef.current && searchQuery.trim()) {
      activateSearchResult(articleRef.current, searchIndex);
    }
  }, [searchIndex, searchQuery]);

  useEffect(() => {
    const article = articleRef.current;
    const root = scrollRef.current;
    if (!article || !root) return;

    const headings = Array.from(article.querySelectorAll<HTMLElement>("h1[id], h2[id], h3[id]"));
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]?.target.id) {
          onActiveHeading(visible[0].target.id);
        }
      },
      { root, rootMargin: "-10% 0px -75% 0px", threshold: [0, 1] }
    );
    headings.forEach((heading) => observer.observe(heading));
    return () => observer.disconnect();
  }, [tab.html, onActiveHeading]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = tab.scrollTop;
    }
  }, [tab.id]);

  return (
    <div
      className="reader-scroll"
      ref={scrollRef}
      id={`panel-${tab.id}`}
      role="tabpanel"
      aria-labelledby={`tab-${tab.id}`}
      onScroll={(event) => {
        if (scrollFrame.current !== null) {
          cancelAnimationFrame(scrollFrame.current);
        }
        const top = event.currentTarget.scrollTop;
        scrollFrame.current = requestAnimationFrame(() => onScroll(top));
      }}
    >
      <article
        ref={articleRef}
        className={`markdown-body ${wrapCode ? "wrap-code" : ""} ${
          readingWidth === "wide" ? "is-wide" : ""
        }`}
        style={
          {
            "--reader-scale": fontScale,
            "--reader-leading": lineHeight
          } as React.CSSProperties
        }
        onClick={(event) => {
          const target = event.target as HTMLElement;
          const copyButton = target.closest<HTMLButtonElement>("[data-copy-code]");
          if (copyButton) {
            const code = copyButton.closest(".code-block")?.querySelector("code")?.textContent || "";
            void navigator.clipboard.writeText(code).then(() => {
              copyButton.textContent = "コピー済み";
              copyButton.dataset.state = "success";
              window.setTimeout(() => {
                copyButton.textContent = "コピー";
                delete copyButton.dataset.state;
              }, 1600);
            });
            return;
          }

          const link = target.closest<HTMLAnchorElement>("a[data-markun-link]");
          if (link) {
            event.preventDefault();
            onLink(link.dataset.markunLink || link.href);
          }
        }}
      />
    </div>
  );
}
