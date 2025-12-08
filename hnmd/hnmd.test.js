import { describe, it, expect, beforeEach, vi } from "vitest";
import { Browser } from "happy-dom";
import { extractThread, copyThread } from "./bookmarklet.js";

const sampleHtml = `
<!doctype html>
<html lang="en">
  <body>
    <table class="fatitem">
      <tr>
        <td class="titleline"><a href="https://example.com/story">Sample Story</a></td>
      </tr>
      <tr class="subtext">
        <td>
          <a class="hnuser">storyteller</a>
          <span class="age" title="2024-07-01T12:34:56"><a href="#">10 hours ago</a></span>
        </td>
      </tr>
      <tr>
        <td class="commtext c00">Story body<p>with extra details</p></td>
      </tr>
    </table>
    <table class="comment-tree">
      <tr class="athing comtr" id="c1">
        <td class="ind"><img src="s.gif" width="0" height="1"></td>
        <td class="default">
          <span class="comhead">
            <a class="hnuser">alice</a>
            <span class="age" title="2024-07-01T13:00:00"><a href="#">1 hour ago</a></span>
          </span>
          <div class="comment">
            <span class="commtext c00">First comment<p>with newline</p></span>
          </div>
        </td>
      </tr>
      <tr class="athing comtr" id="c2">
        <td class="ind"><img src="s.gif" width="40" height="1"></td>
        <td class="default">
          <span class="comhead">
            <a class="hnuser">bob</a>
            <span class="age" title="2024-07-01T14:05:00"><a href="#">1 minute ago</a></span>
          </span>
          <div class="comment">
            <span class="commtext c00">Reply comment</span>
          </div>
        </td>
      </tr>
      <tr class="athing comtr" id="c3">
        <td class="ind"><img src="s.gif" width="40" height="1"></td>
        <td class="default">
          <span class="comhead">
            <a class="hnuser">carol</a>
            <span class="age" title="2024-07-01T15:10:00"><a href="#">just now</a></span>
          </span>
          <div class="comment">
            <span class="commtext c00">
              Check this <a href="https://newsletter.semianalysis.com/p/tpuv7-google-takes-a-swing-at-the#long">https://newsletter.semianalysis.com/p/tpuv7-google-takes-a-s...</a>
            </span>
          </div>
        </td>
      </tr>
    </table>
  </body>
</html>
`;

describe("hnmd bookmarklet", () => {
  const browser = new Browser({ console });
  let page, window, document, clipboardMock;

  beforeEach(async () => {
    page = browser.newPage();
    const frame = page.mainFrame;
    frame.document.open();
    frame.document.write(sampleHtml);
    frame.document.close();
    await page.waitUntilComplete();
    ({ window, document } = frame);
    window.alert = vi.fn();
    clipboardMock = { writeText: vi.fn().mockResolvedValue() };
    Object.defineProperty(window.navigator, "clipboard", { value: clipboardMock, configurable: true });
  });

  it("formats story and comments as a nested Markdown list", () => {
    const markdown = extractThread(document);
    expect(markdown).toBe(
      [
        "- storyteller: Sample Story — Story body with extra details — https://example.com/story [storyteller @ 2024-07-01T12:34Z]",
        "  - alice: First comment with newline [alice @ 2024-07-01T13:00Z]",
        "    - bob: Reply comment [bob @ 2024-07-01T14:05Z]",
        "    - carol: Check this https://newsletter.semianalysis.com/p/tpuv7-google-takes-a-swing-at-the#long [carol @ 2024-07-01T15:10Z]",
      ].join("\n"),
    );
  });

  it("copies the Markdown output and alerts the user", async () => {
    const markdown = await copyThread(document, window);
    expect(clipboardMock.writeText).toHaveBeenCalledWith(markdown);
    expect(window.alert).toHaveBeenCalledWith("Hacker News thread copied to clipboard");
  });
});
