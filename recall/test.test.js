import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest";
import { loadFrom } from "../common/testutils.js";

const sampleMD = "- first item\n- second ⭐\n- something";
const originalFetch = globalThis.fetch;

let window, document, content, starBtn, searchInput, copyBtn, indexInput;
let randomSpy, consoleErrorSpy;
let clipboardText = "";

describe("Recall tests", () => {
  beforeAll(() => vi.useFakeTimers());
  afterAll(() => vi.useRealTimers());

  beforeEach(async () => {
    randomSpy = vi.spyOn(Math, "random").mockReturnValue(0);
    globalThis.fetch = (url) => {
      if (typeof url === "string" && url.startsWith("https://raw.githubusercontent.com"))
        return Promise.resolve(new Response(sampleMD));
      return originalFetch(url);
    };
    ({ window, document } = await loadFrom(import.meta.dirname));
    window.setTimeout = setTimeout;
    window.clearTimeout = clearTimeout;
    window.setInterval = setInterval;
    window.clearInterval = clearInterval;
    window.navigator.clipboard = {
      writeText: vi.fn((t) => (clipboardText = t)),
      readText: vi.fn(() => Promise.resolve(clipboardText)),
    };
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    content = document.getElementById("content");
    starBtn = document.getElementById("star-btn");
    searchInput = document.getElementById("search-input");
    copyBtn = document.getElementById("copy-btn");
    indexInput = document.getElementById("index-input");
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    randomSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it("loads first item on init", () => {
    expect(content.textContent.trim()).toBe("first item");
    expect(indexInput.value).toBe("1");
  });

  it("filters starred items", () => {
    starBtn.click();
    expect(content.textContent.trim()).toBe("second ⭐");
    expect(indexInput.value).toBe("1");
  });

  it("searches items", () => {
    searchInput.value = "something";
    searchInput.dispatchEvent(new window.Event("input", { bubbles: true }));
    expect(content.textContent.trim()).toBe("something");
  });

  it("copies current item", async () => {
    copyBtn.click();
    expect(await window.navigator.clipboard.readText()).toBe("first item");
  });
});
