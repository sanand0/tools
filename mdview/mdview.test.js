import { beforeEach, describe, expect, it, vi } from "vitest";
import { Browser } from "happy-dom";
import {
  buildBookmarkletHref,
  buildPopupHtml,
  extractMarkdownSource,
  openPopup,
  showPopup,
} from "./bookmarklet-core.js";

const sampleHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Sample Markdown Page</title>
  </head>
  <body>
    <main>
      <h1>Docs</h1>
      <pre><code>const answer = 42;</code></pre>
      <p>Paragraph text.</p>
    </main>
  </body>
</html>
`;

describe("mdview bookmarklet", () => {
  const browser = new Browser({ console });
  let page;
  let document;

  beforeEach(async () => {
    page = browser.newPage();
    const frame = page.mainFrame;
    frame.document.open();
    frame.document.write(sampleHtml);
    frame.document.close();
    await page.waitUntilComplete();
    ({ document } = frame);
    document.title = "Sample Markdown Page";
  });

  it("uses selected text when available", () => {
    const fakeWindow = {
      getSelection: () => ({
        toString: () => "# Selected Heading\n\n```js\nconsole.log('picked');\n```",
      }),
      location: { href: "https://example.com/docs" },
    };

    const source = extractMarkdownSource(document, fakeWindow);
    expect(source).toEqual({
      markdown: "# Selected Heading\n\n```js\nconsole.log('picked');\n```",
      isSelection: true,
      sourceUrl: "https://example.com/docs",
      title: "Sample Markdown Page",
    });
  });

  it("falls back to page text when no selection exists", () => {
    const fakeWindow = {
      getSelection: () => ({
        toString: () => "   ",
      }),
      location: { href: "https://example.com/docs" },
    };
    Object.defineProperty(document.body, "innerText", {
      value: "# Full Page\n\n```js\nconst answer = 42;\n```",
      configurable: true,
    });

    const source = extractMarkdownSource(document, fakeWindow);
    expect(source.markdown).toBe("# Full Page\n\n```js\nconst answer = 42;\n```");
    expect(source.isSelection).toBe(false);
  });

  it("builds popup HTML with markdown rendering and syntax highlighting assets", () => {
    const html = buildPopupHtml({
      markdown: "# Demo\n\n```js\nconst x = 1;\n```",
      title: "Sample Markdown Page",
      sourceUrl: "https://example.com/docs",
      isSelection: true,
    });

    expect(html).toContain("marked");
    expect(html).toContain("highlight.js");
    expect(html).toContain("hljs.highlightElement(block)");
    expect(html).toContain("Selection rendered as Markdown");
    expect(html).toContain("https://example.com/docs");
  });

  it("opens a popup and writes the rendered shell into it", () => {
    const popupDocument = { open: vi.fn(), write: vi.fn(), close: vi.fn() };
    const popup = { document: popupDocument, focus: vi.fn() };
    const fakeWindow = {
      open: vi.fn(() => popup),
    };

    const result = openPopup(
      {
        markdown: "# Demo",
        title: "Sample Markdown Page",
        sourceUrl: "https://example.com/docs",
        isSelection: false,
      },
      fakeWindow,
    );

    expect(result).toBe(popup);
    expect(fakeWindow.open).toHaveBeenCalledWith("", "_blank", expect.stringContaining("popup=yes"));
    expect(popupDocument.open).toHaveBeenCalledTimes(1);
    expect(popupDocument.write).toHaveBeenCalledWith(expect.stringContaining("Page rendered as Markdown"));
    expect(popupDocument.close).toHaveBeenCalledTimes(1);
    expect(popup.focus).toHaveBeenCalledTimes(1);
  });

  it("returns null if the popup is blocked", () => {
    const fakeWindow = {
      open: vi.fn(() => null),
    };

    expect(
      openPopup(
        {
          markdown: "# Demo",
          title: "Sample Markdown Page",
          sourceUrl: "https://example.com/docs",
          isSelection: false,
        },
        fakeWindow,
      ),
    ).toBeNull();
  });

  it("generates a bookmarklet href that runs the popup flow", () => {
    const href = buildBookmarkletHref("window.mdview={showPopup(){}}");
    expect(href.startsWith("javascript:")).toBe(true);
    expect(decodeURIComponent(href.slice("javascript:".length))).toContain("mdview.showPopup()");
  });

  it("extracts content and opens the popup in one call", () => {
    const popupDocument = { open: vi.fn(), write: vi.fn(), close: vi.fn() };
    const popup = { document: popupDocument, focus: vi.fn() };
    const fakeWindow = {
      getSelection: () => ({
        toString: () => "# Selected Heading\n\n```js\nconsole.log('picked');\n```",
      }),
      location: { href: "https://example.com/docs" },
      open: vi.fn(() => popup),
    };

    const result = showPopup(document, fakeWindow);
    expect(result).toBe(popup);
    expect(popupDocument.write).toHaveBeenCalledWith(expect.stringContaining("# Selected Heading"));
  });
});
