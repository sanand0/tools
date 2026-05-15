import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Browser } from "happy-dom";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scriptPath = path.join(__dirname, "gmeetcaptions.js");
const fixturePath = path.join(__dirname, "__fixtures__/captions-anonymized.html");
const fixtureSource = await fs.readFile(fixturePath, "utf8");
const scriptSource = await fs.readFile(scriptPath, "utf8");

const browser = new Browser({ console });

async function loadFixture(page) {
  const frame = page.mainFrame;
  frame.document.open();
  frame.document.write(fixtureSource);
  frame.document.close();
  await page.waitUntilComplete();
  return frame;
}

function makeWritable() {
  let buffer = "";
  let pos = 0;
  const seek = (p) => {
    pos = p;
  };
  const truncate = (size) => {
    buffer = buffer.slice(0, size);
    pos = Math.min(pos, size);
  };
  return {
    write: vi.fn((chunk) => {
      if (typeof chunk === "string") {
        buffer = buffer.slice(0, pos) + chunk + buffer.slice(pos + chunk.length);
        pos += chunk.length;
      } else if (chunk?.type === "seek") {
        seek(chunk.position);
      } else if (chunk?.type === "truncate") {
        truncate(chunk.size);
      }
      return Promise.resolve();
    }),
    seek: vi.fn((p) => {
      seek(p);
      return Promise.resolve();
    }),
    truncate: vi.fn((size) => {
      truncate(size);
      return Promise.resolve();
    }),
    close: vi.fn(() => Promise.resolve()),
    get written() {
      return buffer;
    },
  };
}

function makeFilePicker(writable) {
  return vi.fn(() => Promise.resolve({ createWritable: vi.fn(() => Promise.resolve(writable)) }));
}

describe("gmeetcaptions bookmarklet", () => {
  let page;
  let window;
  let document;
  let clipboardMock;

  beforeEach(async () => {
    page = browser.newPage();
    const frame = await loadFixture(page);
    ({ window, document } = frame);
    window.alert = vi.fn();
    clipboardMock = { writeText: vi.fn().mockResolvedValue() };
    Object.defineProperty(window.navigator, "clipboard", { value: clipboardMock, configurable: true });
  });

  afterEach(() => {
    if (typeof page?.close === "function") page.close();
  });

  async function load() {
    window.eval(scriptSource);
    return window.gmeetcaptions;
  }

  it("extracts anonymized Meet captions as Markdown", async () => {
    const { extractCaptions } = await load();

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
    const { extractCaptions } = await load();

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
    const { copyCaptions } = await load();

    const markdown = await copyCaptions(document, window, window.navigator);

    expect(clipboardMock.writeText).toHaveBeenCalledWith(markdown);
    expect(window.alert).toHaveBeenCalledWith("Google Meet captions copied to clipboard as Markdown.");
  });

  it("alerts when no captions are available", async () => {
    const { copyCaptions } = await load();

    document.querySelector('[aria-label="Captions"]').remove();
    const markdown = await copyCaptions(document, window, window.navigator);

    expect(markdown).toBe("");
    expect(clipboardMock.writeText).not.toHaveBeenCalled();
    expect(window.alert).toHaveBeenCalledWith("No Google Meet captions found.");
  });

  it("extracts captions using structural fallbacks when class names are absent", async () => {
    const { extractCaptions } = await load();

    // Replace region contents with classless elements that match structural pattern:
    // avatar img with data-iml, only span = speaker, last div without img = text
    const region = document.querySelector('[aria-label="Captions"]');
    region.innerHTML = "";
    const item = document.createElement("div"); // no class
    const avatarDiv = document.createElement("div");
    const img = document.createElement("img");
    img.setAttribute("data-iml", "12345");
    img.setAttribute("src", "https://lh3.googleusercontent.com/a/photo");
    avatarDiv.appendChild(img);
    const nameSpan = document.createElement("span"); // only span = speaker
    nameSpan.textContent = "Structural Speaker";
    avatarDiv.appendChild(nameSpan);
    const textDiv = document.createElement("div"); // last div without img = text
    textDiv.textContent = "Hello from fallback";
    item.append(avatarDiv, textDiv);
    region.appendChild(item);

    const markdown = extractCaptions(document);
    expect(markdown).toContain("## Structural Speaker");
    expect(markdown).toContain("Hello from fallback");
  });
});

describe("getMeta", () => {
  let page;
  let window;
  let document;

  beforeEach(async () => {
    page = browser.newPage();
    const frame = await loadFixture(page);
    ({ window, document } = frame);
  });

  afterEach(() => page?.close());

  it("extracts title from document.title when no data attribute", async () => {
    window.eval(scriptSource);
    const { getMeta } = window.gmeetcaptions;
    // fixture title: "Weekly Product Sync - Google Meet" — no "Meet - " prefix, kept as-is
    expect(getMeta(document, window).title).toBe("Weekly Product Sync - Google Meet");
  });

  it("strips Meet prefix from document.title", async () => {
    window.eval(scriptSource);
    const { getMeta } = window.gmeetcaptions;
    document.title = "Meet - Weekly Sync";
    expect(getMeta(document, window).title).toBe("Weekly Sync");
  });

  it("prefers data-meeting-title attribute over document.title", async () => {
    window.eval(scriptSource);
    const { getMeta } = window.gmeetcaptions;
    const el = document.createElement("div");
    el.setAttribute("data-meeting-title", "Q1 Planning");
    document.body.appendChild(el);
    expect(getMeta(document, window).title).toBe("Q1 Planning");
  });

  it("returns empty participants when none present in DOM", async () => {
    window.eval(scriptSource);
    const { getMeta } = window.gmeetcaptions;
    expect(getMeta(document, window).participants).toEqual([]);
  });

  it("extracts deduplicated participant names from buttons", async () => {
    window.eval(scriptSource);
    const { getMeta } = window.gmeetcaptions;
    ["Alex Kim", "Alex Kim", "Jordan Rivera"].forEach((name) => {
      const btn = document.createElement("button");
      btn.setAttribute("aria-label", `More options for ${name}`);
      document.body.appendChild(btn);
    });
    expect(getMeta(document, window).participants).toEqual(["Alex Kim", "Jordan Rivera"]);
  });
});

describe("showPanel", () => {
  let page;
  let window;
  let document;

  beforeEach(async () => {
    page = browser.newPage();
    const frame = await loadFixture(page);
    ({ window, document } = frame);
    window.eval(scriptSource);
  });

  afterEach(() => page?.close());

  it("injects the panel into the document", () => {
    window.gmeetcaptions.showPanel(document, window, window.navigator);
    expect(document.getElementById("gmeetcaptions-panel")).not.toBeNull();
  });

  it("toggles panel visibility on repeated calls", () => {
    const { showPanel } = window.gmeetcaptions;
    showPanel(document, window, window.navigator);
    showPanel(document, window, window.navigator); // hides
    expect(document.getElementById("gmeetcaptions-panel").style.display).toBe("none");
    showPanel(document, window, window.navigator); // shows again
    expect(document.getElementById("gmeetcaptions-panel").style.display).toBe("");
  });

  it("panel contains Start Recording and Copy buttons", () => {
    window.gmeetcaptions.showPanel(document, window, window.navigator);
    expect(document.getElementById("gmeetcaptions-record")?.textContent?.trim()).toMatch(/Start Recording/);
    expect(document.getElementById("gmeetcaptions-copy")).not.toBeNull();
  });

  it("close button removes the panel", () => {
    window.gmeetcaptions.showPanel(document, window, window.navigator);
    document.getElementById("gmeetcaptions-close").click();
    expect(document.getElementById("gmeetcaptions-panel")).toBeNull();
  });
});

describe("streaming", () => {
  let page;
  let window;
  let document;

  beforeAll(() => vi.useFakeTimers());
  afterAll(() => vi.useRealTimers());

  beforeEach(async () => {
    page = browser.newPage();
    const frame = await loadFixture(page);
    ({ window, document } = frame);
    window.setTimeout = setTimeout;
    window.setInterval = setInterval;
    window.clearInterval = clearInterval;
    window.eval(scriptSource);
  });

  afterEach(async () => {
    // ensure streaming is stopped between tests
    if (window.__gmeetcaptionsState?.running) await window.gmeetcaptions.stopStreaming(document, window);
    page?.close();
  });

  it("writes a Markdown header when recording starts", async () => {
    const writable = makeWritable();
    window.showSaveFilePicker = makeFilePicker(writable);

    await window.gmeetcaptions.startStreaming(document, window);

    expect(writable.written).toContain("# Weekly Product Sync");
    expect(writable.written).toContain("---");
  });

  it("does not start when showSaveFilePicker is unavailable", async () => {
    window.alert = vi.fn();
    delete window.showSaveFilePicker;

    await window.gmeetcaptions.startStreaming(document, window);

    expect(window.alert).toHaveBeenCalledWith("File saving is not supported in this browser.");
    expect(window.__gmeetcaptionsState).toBeFalsy();
  });

  it("finalizes a turn when its DOM element is removed", async () => {
    const writable = makeWritable();
    window.showSaveFilePicker = makeFilePicker(writable);
    await window.gmeetcaptions.startStreaming(document, window);

    const item = document.querySelector(".nMcdL");
    item.remove();
    // Let MutationObserver microtasks and the async write settle
    await vi.advanceTimersByTimeAsync(50);

    expect(writable.written).toContain("## Avery Chen");
    expect(writable.written).toContain("Kickoff is at 10 AM.");
  });

  it("finalizes a stable turn after STABILITY_POLLS via the interval", async () => {
    const writable = makeWritable();
    window.showSaveFilePicker = makeFilePicker(writable);
    await window.gmeetcaptions.startStreaming(document, window);

    // Advance past 4 poll cycles (STABILITY_POLLS = 4, interval = 1000ms)
    await vi.advanceTimersByTimeAsync(5000);

    expect(writable.written).toContain("## Avery Chen");
  });

  it("stopStreaming flushes remaining turns and closes the file", async () => {
    const writable = makeWritable();
    window.showSaveFilePicker = makeFilePicker(writable);
    await window.gmeetcaptions.startStreaming(document, window);
    await window.gmeetcaptions.stopStreaming(document, window);

    expect(writable.written).toContain("## Avery Chen");
    expect(writable.written).toContain("---");
    expect(writable.close).toHaveBeenCalled();
    expect(window.__gmeetcaptionsState).toBeNull();
  });

  it("overwrites the last entry in-place when more text arrives after stability-write", async () => {
    const writable = makeWritable();
    window.showSaveFilePicker = makeFilePicker(writable);
    await window.gmeetcaptions.startStreaming(document, window);

    // Dynamically add a single item (mimics Google Meet adding a new speaker turn)
    const region = document.querySelector('[role="region"][aria-label="Captions"]');
    const item = document.createElement("div");
    item.className = "nMcdL";
    const nameEl = document.createElement("div");
    nameEl.className = "NWpY1d";
    nameEl.textContent = "Test Speaker";
    const textEl = document.createElement("div");
    textEl.className = "ygicle";
    textEl.textContent = "Hello world";
    item.append(nameEl, textEl);
    region.appendChild(item);

    // Stabilise — item gets written
    await vi.advanceTimersByTimeAsync(5000);
    expect(writable.written).toContain("Hello world");

    // More text arrives on the same element (ongoing speech / Gemini corrections)
    textEl.textContent = "Hello world, how are you?";
    await vi.advanceTimersByTimeAsync(5000);

    const content = writable.written;
    expect(content).toContain("how are you?");
    // Must be updated in-place — only one header for this turn
    expect(content.match(/## Test Speaker/g)?.length).toBe(1);
  });

  it("panel record button updates to show recording state", async () => {
    const writable = makeWritable();
    window.showSaveFilePicker = makeFilePicker(writable);
    window.gmeetcaptions.showPanel(document, window, window.navigator);
    await window.gmeetcaptions.startStreaming(document, window);

    expect(document.getElementById("gmeetcaptions-record")?.textContent?.trim()).toMatch(/Stop Recording/);

    await window.gmeetcaptions.stopStreaming(document, window);
    expect(document.getElementById("gmeetcaptions-record")?.textContent?.trim()).toMatch(/Start Recording/);
  });
});
