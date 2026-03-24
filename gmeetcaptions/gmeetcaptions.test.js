import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Browser } from "happy-dom";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scriptPath = path.join(__dirname, "gmeetcaptions.js");
const fixturePath = path.join(__dirname, "__fixtures__/captions-anonymized.html");

const browser = new Browser({ console });

async function loadBookmarklet(window) {
  window.eval(await fs.readFile(scriptPath, "utf8"));
  return window.gmeetcaptions;
}

describe("gmeetcaptions bookmarklet", () => {
  let page;
  let window;
  let document;
  let clipboardMock;

  beforeEach(async () => {
    page = browser.newPage();
    const frame = page.mainFrame;
    frame.document.open();
    frame.document.write(await fs.readFile(fixturePath, "utf8"));
    frame.document.close();
    await page.waitUntilComplete();
    ({ window, document } = frame);
    window.alert = vi.fn();
    clipboardMock = { writeText: vi.fn().mockResolvedValue() };
    Object.defineProperty(window.navigator, "clipboard", { value: clipboardMock, configurable: true });
  });

  afterEach(() => {
    if (typeof page?.close === "function") page.close();
  });

  it("extracts anonymized Meet captions as Markdown", async () => {
    const { extractCaptions } = await loadBookmarklet(window);

    expect(extractCaptions(document)).toBe(
      [
        "# Google Meet Captions",
        "",
        "## Avery Chen",
        "",
        "Kickoff is at 10 AM.",
        "",
        "Please review the draft \\*today\\*.",
        "",
        "## You",
        "",
        "I'll post notes in \\[launch-doc\\].",
        "",
        "## Riley \\[Ops\\]",
        "",
        "Use \\`logs\\` and the checklist.",
      ].join("\n"),
    );
  });

  it("keeps the longest progressive caption update for the same speaker", async () => {
    const { extractCaptions } = await loadBookmarklet(window);

    document.querySelector('[aria-label="Captions"]').insertAdjacentHTML(
      "beforeend",
      `
        <div class="nMcdL bj4p3b">
          <div class="adE6rb">
            <div class="KcIKyf jxFHg">
              <span class="NWpY1d">Morgan Lee</span>
            </div>
          </div>
          <div class="ygicle VbkSUe">We should ship</div>
        </div>
        <div class="nMcdL bj4p3b">
          <div class="adE6rb">
            <div class="KcIKyf jxFHg">
              <span class="NWpY1d">Morgan Lee</span>
            </div>
          </div>
          <div class="ygicle VbkSUe">We should ship next Tuesday.</div>
        </div>
      `,
    );

    const markdown = extractCaptions(document);
    expect(markdown).toContain("## Morgan Lee\n\nWe should ship next Tuesday.");
    expect(markdown).not.toContain("We should ship\n\nWe should ship next Tuesday.");
  });

  it("copies Markdown to the clipboard and alerts on success", async () => {
    const { copyCaptions } = await loadBookmarklet(window);

    const markdown = await copyCaptions(document, window, window.navigator);

    expect(clipboardMock.writeText).toHaveBeenCalledWith(markdown);
    expect(window.alert).toHaveBeenCalledWith("Google Meet captions copied to clipboard as Markdown.");
  });

  it("alerts when no captions are available", async () => {
    const { copyCaptions } = await loadBookmarklet(window);

    document.querySelector('[aria-label="Captions"]').remove();
    const markdown = await copyCaptions(document, window, window.navigator);

    expect(markdown).toBe("");
    expect(clipboardMock.writeText).not.toHaveBeenCalled();
    expect(window.alert).toHaveBeenCalledWith("No Google Meet captions found.");
  });
});
