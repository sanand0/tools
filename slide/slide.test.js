// @ts-check
import { beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "url";
import { Window } from "happy-dom";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
const faviconHref =
  html.match(
    /<link id="favicon" rel="icon" type="image\/svg\+xml" href="([^"]+)"/,
  )?.[1] || "";
const bodyMarkup =
  html.match(/<body>([\s\S]*?)<script src=/)?.[1]?.trim() || "";
const inlineScript =
  html.match(/<script>\s*([\s\S]*?)\s*<\/script>\s*<\/body>/)?.[1] || "";

function createWindow(hash = "") {
  const window = new Window({ url: `https://test/slide/${hash}` });
  window.marked = { parse: (text) => text };
  window.document.head.innerHTML = `<title>Slide Editor</title><link id="favicon" rel="icon" type="image/svg+xml" href="${faviconHref}">`;
  window.document.body.innerHTML = bodyMarkup;
  window.eval(inlineScript);
  return window;
}

function getFaviconSvg(document) {
  const href = document.getElementById("favicon")?.getAttribute("href") || "";
  return decodeURIComponent(href.split(",")[1] || "");
}

describe("slide favicon", () => {
  let window;
  let document;

  beforeEach(() => {
    window = createWindow("#?title=123%20!!%20alpha&bgColor=%230066cc");
    ({ document } = window);
  });

  it("uses the first alphabetic character from the title and the slide color", () => {
    const svg = getFaviconSvg(document);
    expect(svg).toContain('fill="#0066cc"');
    expect(svg).toContain(">A</text>");
  });

  it("updates the favicon when the title input changes", () => {
    document.getElementById("edit-icon")?.click();
    const titleInput = /** @type {HTMLTextAreaElement | null} */ (
      document.getElementById("title-input")
    );
    expect(titleInput).toBeTruthy();
    if (!titleInput) throw new Error("title input missing");

    titleInput.value = "!!! zebra crossing";
    titleInput.dispatchEvent(new window.Event("input", { bubbles: true }));

    const svg = getFaviconSvg(document);
    expect(svg).toContain(">Z</text>");
    expect(document.title).toBe("!!! zebra crossing - Slide Editor");
  });

  it("applies title and subtitle scales independently", () => {
    const sizedWindow = createWindow(
      "#?titleScale=2&subtitleScale=-1&title=Size%20Title&subtitle=Size%20Subtitle",
    );
    const sizedDocument = sizedWindow.document;
    const title = /** @type {HTMLElement | null} */ (
      sizedDocument.getElementById("title")
    );
    const subtitle = /** @type {HTMLElement | null} */ (
      sizedDocument.getElementById("subtitle")
    );

    expect(title).toBeTruthy();
    expect(subtitle).toBeTruthy();
    if (!title || !subtitle) throw new Error("slide content missing");

    expect(parseFloat(title.style.fontSize)).toBeCloseTo(
      4 * Math.pow(1.1, 2),
      5,
    );
    expect(parseFloat(subtitle.style.fontSize)).toBeCloseTo(
      2 * Math.pow(1.1, -1),
      5,
    );
  });
});
