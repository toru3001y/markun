import { ChevronDown, ChevronUp, Search, X } from "lucide-react";
import { useEffect, useRef } from "react";

interface SearchPanelProps {
  open: boolean;
  query: string;
  activeIndex: number;
  resultCount: number;
  onQueryChange: (value: string) => void;
  onMove: (direction: 1 | -1) => void;
  onClose: () => void;
}

export function SearchPanel({
  open,
  query,
  activeIndex,
  resultCount,
  onQueryChange,
  onMove,
  onClose
}: SearchPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <section className="search-panel" role="search" aria-label="文書内検索">
      <Search aria-hidden="true" size={18} />
      <label className="sr-only" htmlFor="document-search">
        文書内を検索
      </label>
      <input
        id="document-search"
        ref={inputRef}
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            onMove(event.shiftKey ? -1 : 1);
          }
          if (event.key === "Escape") {
            onClose();
          }
        }}
        placeholder="例: ApplicationContext"
        autoComplete="off"
        spellCheck="false"
      />
      <output aria-live="polite">
        {query.trim() ? (resultCount ? `${activeIndex + 1} / ${resultCount}` : "一致なし") : "—"}
      </output>
      <button
        className="icon-button"
        type="button"
        aria-label="前の一致"
        disabled={resultCount === 0}
        onClick={() => onMove(-1)}
      >
        <ChevronUp aria-hidden="true" size={18} />
      </button>
      <button
        className="icon-button"
        type="button"
        aria-label="次の一致"
        disabled={resultCount === 0}
        onClick={() => onMove(1)}
      >
        <ChevronDown aria-hidden="true" size={18} />
      </button>
      <button className="icon-button" type="button" aria-label="検索を閉じる" onClick={onClose}>
        <X aria-hidden="true" size={18} />
      </button>
    </section>
  );
}

