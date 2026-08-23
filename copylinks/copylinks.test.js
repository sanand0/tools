import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import { Browser } from "happy-dom";
import { loadFrom } from "../common/testutils.js";

const scriptSource = await fs.readFile(
  path.join(import.meta.dirname, "copylinks.js"),
  "utf8",
);
const browser = new Browser({ console });

const selectText = (window, node, start, end) => {
  const range = window.document.createRange();
  range.setStart(node, start);
  range.setEnd(node, end);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
};

describe("Copy URL with text fragment bookmarklet", () => {
  let page;
  let window;
  let document;

  beforeEach(async () => {
    page = browser.newPage();
    window = page.mainFrame.window;
    document = page.mainFrame.document;
    document.write("<!doctype html><html><body></body></html>");
    document.close();
    await page.waitUntilComplete();
    window.eval(scriptSource);
  });

  afterEach(() => page.close());

  it("copies the current URL unchanged when no text is selected", async () => {
    const bookmarkletWindow = {
      location: { href: "https://example.com/report?year=2026#results" },
      getSelection: () => window.getSelection(),
      alert: vi.fn(),
    };
    Object.defineProperty(window.navigator, "clipboard", {
      value: { writeText: vi.fn().mockResolvedValue() },
      configurable: true,
    });

    const output = await window.copylinks.copyTextFragment(
      document,
      bookmarkletWindow,
      window.navigator,
    );

    expect(output).toBe("https://example.com/report?year=2026#results");
    expect(window.navigator.clipboard.writeText).toHaveBeenCalledWith(output);
  });

  it("falls back to a temporary textarea when the Clipboard API is unavailable", async () => {
    const bookmarkletWindow = {
      location: { href: "http://intranet.example/handbook" },
      getSelection: () => window.getSelection(),
      alert: vi.fn(),
    };
    document.execCommand = vi.fn(() => true);

    const output = await window.copylinks.copyTextFragment(
      document,
      bookmarkletWindow,
      {},
    );

    expect(output).toBe("http://intranet.example/handbook");
    expect(document.execCommand).toHaveBeenCalledWith("copy");
    expect(document.querySelector("textarea")).toBeNull();
    expect(bookmarkletWindow.alert).toHaveBeenCalledWith(
      "URL copied to clipboard.",
    );
  });

  it("uses an exact fragment for a unique sentence and normalizes copied whitespace", () => {
    const paragraph = document.createElement("p");
    paragraph.textContent =
      "The  evidence shows that small\n teams ship reliable software faster. ";
    document.body.append(paragraph);
    selectText(
      window,
      paragraph.firstChild,
      4,
      paragraph.textContent.lastIndexOf("."),
    );

    expect(
      window.copylinks.buildTextFragmentUrl(
        document,
        window,
        "https://example.com/article",
      ),
    ).toBe(
      "https://example.com/article#:~:text=evidence%20shows%20that%20small%20teams%20ship%20reliable%20software%20faster",
    );
  });

  it("adds nearby context when a short selection appears more than once", () => {
    document.body.innerHTML = `
      <article><p>Oak desk lamp. <span>Read more</span> about dimensions.</p></article>
      <article><p>Brass floor lamp. <span>Read more</span> about delivery.</p></article>`;
    const target = document.querySelectorAll("span")[1].firstChild;
    selectText(window, target, 0, target.textContent.length);

    expect(
      window.copylinks.buildTextFragmentUrl(
        document,
        window,
        "https://shop.example/search?q=lamp",
      ),
    ).toBe(
      "https://shop.example/search?q=lamp#:~:text=Brass%20floor%20lamp.-,Read%20more,-about%20delivery.",
    );
  });

  it("uses start and end terms for a long multi-paragraph selection", () => {
    const first = document.createElement("p");
    const middle = document.createElement("p");
    const last = document.createElement("p");
    const section = document.createElement("section");
    section.id = "chapter-2";
    first.textContent = `Introductory context. ${"alpha ".repeat(45)}first conclusion.`;
    middle.textContent =
      "A middle paragraph that must remain inside the highlighted range.";
    last.textContent = `Final evidence begins here ${"omega ".repeat(45)}and resolves the question.`;
    section.append(first, middle, last);
    document.body.append(section);
    const range = document.createRange();
    range.setStart(first.firstChild, "Introductory context. ".length);
    range.setEnd(last.firstChild, last.textContent.length);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);

    const output = window.copylinks.buildTextFragmentUrl(
      document,
      window,
      "https://example.com/guide#chapter-2",
    );
    const directive = output.split(":~:text=")[1];
    const [start, end] = directive.split(",").map(decodeURIComponent);

    expect(output).toContain("https://example.com/guide#chapter-2:~:text=");
    expect(start).toMatch(/^alpha alpha alpha/);
    expect(end).toMatch(/omega omega omega and resolves the question\.$/);
    expect(start.length).toBeLessThanOrEqual(120);
    expect(end.length).toBeLessThanOrEqual(120);
  });

  it("percent-encodes fragment delimiters inside selected text", () => {
    const paragraph = document.createElement("p");
    paragraph.textContent = "Choose red-orange, blue & green for the palette.";
    document.body.append(paragraph);
    selectText(window, paragraph.firstChild, 7, 31);

    expect(
      window.copylinks.buildTextFragmentUrl(
        document,
        window,
        "https://example.com/spec",
      ),
    ).toContain("text=red%2Dorange%2C%20blue%20%26%20green");
  });

  it("expands a mid-word drag to complete words and drops an unrelated hash", () => {
    const paragraph = document.createElement("p");
    paragraph.textContent =
      "A browser bookmarklet makes sharing precise quotes easier.";
    document.body.append(paragraph);
    const text = paragraph.firstChild;
    selectText(
      window,
      text,
      text.data.indexOf("marklet"),
      text.data.indexOf("quotes") + 3,
    );

    expect(
      window.copylinks.buildTextFragmentUrl(
        document,
        window,
        "https://example.com/tips#old-news",
      ),
    ).toBe(
      "https://example.com/tips#:~:text=bookmarklet%20makes%20sharing%20precise%20quotes",
    );
  });
});

describe("Copy Links bookmarklets page", () => {
  it("loads both draggable bookmarklets", async () => {
    const { document } = await loadFrom(import.meta.dirname);
    const copyLinks = document.querySelector('[data-bookmarklet="links"]');
    const copyFragment = document.querySelector(
      '[data-bookmarklet="text-fragment"]',
    );

    expect(copyLinks?.getAttribute("href")).toMatch(/^javascript:/);
    expect(decodeURIComponent(copyLinks.href)).toContain("copylinks.scrape();");
    expect(copyFragment?.textContent).toContain("Text Fragment");
    expect(copyFragment?.getAttribute("href")).toMatch(/^javascript:/);
    expect(decodeURIComponent(copyFragment.href)).toContain(
      "copylinks.copyTextFragment();",
    );
    expect(document.getElementById("bookmarklet-spinner")?.classList).toContain(
      "d-none",
    );
  });
});
