const SEARCH_MARK_SELECTOR = "mark[data-markun-search]";

export function clearSearchHighlights(container: HTMLElement): void {
  container.querySelectorAll(SEARCH_MARK_SELECTOR).forEach((mark) => {
    mark.replaceWith(document.createTextNode(mark.textContent || ""));
  });
  container.normalize();
}

export function applySearchHighlights(container: HTMLElement, query: string): number {
  clearSearchHighlights(container);
  const normalizedQuery = query.trim().toLocaleLowerCase("ja");
  if (!normalizedQuery) {
    return 0;
  }

  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (
        !node.textContent?.trim() ||
        parent?.closest("button, script, style, [aria-hidden='true']")
      ) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    }
  });

  const textNodes: Text[] = [];
  while (walker.nextNode()) {
    textNodes.push(walker.currentNode as Text);
  }

  let count = 0;
  textNodes.forEach((textNode) => {
    const text = textNode.data;
    const lowerText = text.toLocaleLowerCase("ja");
    let cursor = 0;
    let matchIndex = lowerText.indexOf(normalizedQuery);
    if (matchIndex < 0) {
      return;
    }

    const fragment = document.createDocumentFragment();
    while (matchIndex >= 0) {
      fragment.append(text.slice(cursor, matchIndex));
      const mark = document.createElement("mark");
      mark.dataset.markunSearch = String(count);
      mark.textContent = text.slice(matchIndex, matchIndex + normalizedQuery.length);
      fragment.append(mark);
      count += 1;
      cursor = matchIndex + normalizedQuery.length;
      matchIndex = lowerText.indexOf(normalizedQuery, cursor);
    }
    fragment.append(text.slice(cursor));
    textNode.replaceWith(fragment);
  });

  return count;
}

export function activateSearchResult(container: HTMLElement, index: number): void {
  const marks = Array.from(container.querySelectorAll<HTMLElement>(SEARCH_MARK_SELECTOR));
  marks.forEach((mark, markIndex) => {
    mark.classList.toggle("is-active", markIndex === index);
    mark.removeAttribute("aria-current");
  });
  const active = marks[index];
  if (active) {
    active.setAttribute("aria-current", "true");
    active.scrollIntoView({ block: "center", behavior: "smooth" });
  }
}

