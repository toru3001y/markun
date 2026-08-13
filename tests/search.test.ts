import { describe, expect, it } from "vitest";
import {
  activateSearchResult,
  applySearchHighlights,
  clearSearchHighlights
} from "../src/lib/search";

describe("document search", () => {
  it("highlights text matches without touching button labels", () => {
    const container = document.createElement("article");
    container.innerHTML = "<p>Bean bean BEAN</p><button>Bean</button>";

    expect(applySearchHighlights(container, "bean")).toBe(3);
    expect(container.querySelectorAll("mark[data-markun-search]")).toHaveLength(3);
    expect(container.querySelector("button mark")).toBeNull();

    activateSearchResult(container, 1);
    expect(container.querySelectorAll("mark")[1]).toHaveClass("is-active");

    clearSearchHighlights(container);
    expect(container.querySelector("mark")).toBeNull();
    expect(container.querySelector("p")?.textContent).toBe("Bean bean BEAN");
  });
});

