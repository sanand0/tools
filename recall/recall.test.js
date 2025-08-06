import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest";
import { loadFrom } from "../common/testutils.js";

const markdown = `- first\n- second\n- ⭐ star`;

describe("recall", () => {
  let window, document, content, starBtn;

  beforeAll(() => vi.useFakeTimers());
  afterAll(() => vi.useRealTimers());

  beforeEach(async () => {
    const realFetch = fetch;
    vi.stubGlobal("fetch", (url) => Promise.resolve({ ok: true, text: () => Promise.resolve(markdown) }));
    ({ window, document } = await loadFrom(import.meta.dirname));
    window.setTimeout = setTimeout;
    content = document.getElementById("content");
    starBtn = document.getElementById("star-btn");
    fetch = realFetch;
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("loads markdown and filters stars", () => {
    expect(content.textContent.trim()).not.toBe("");
    starBtn.click();
    expect(content.textContent.trim()).toBe("⭐ star");
  });
});
