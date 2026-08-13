import type { HeadingItem } from "../types";

interface OutlineProps {
  headings: HeadingItem[];
  activeHeading: string;
  hasDocument: boolean;
  onNavigate: (id: string) => void;
}

export function Outline({ headings, activeHeading, hasDocument, onNavigate }: OutlineProps) {
  return (
    <div className="sidebar-nav">
      {headings.length > 0 ? (
        <ol>
          {headings.map((heading) => (
            <li key={heading.id} data-level={heading.level}>
              <button
                type="button"
                className={activeHeading === heading.id ? "is-active" : ""}
                aria-current={activeHeading === heading.id ? "location" : undefined}
                onClick={() => onNavigate(heading.id)}
              >
                {heading.text}
              </button>
            </li>
          ))}
        </ol>
      ) : (
        <p className="sidebar-empty">
          {hasDocument ? "見出しのない文書です。" : "文書を開くと、ここに目次が出ます。"}
        </p>
      )}
    </div>
  );
}
