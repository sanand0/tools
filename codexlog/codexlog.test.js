import { describe, it, expect, beforeEach } from "vitest";
import { loadFrom, sleep } from "../common/testutils.js";

describe("codexlog", async () => {
  let document, sampleContainer, preview, copyButton, downloadButton;

  beforeEach(async () => {
    ({ document } = await loadFrom(import.meta.dirname));
    sampleContainer = document.getElementById("sampleContainer");
    preview = document.getElementById("markdownPreview");
    copyButton = document.getElementById("copyButton");
    downloadButton = document.getElementById("downloadButton");
  });

  it("loads a sample log and enables actions", async () => {
    const buttons = sampleContainer.querySelectorAll("button");
    expect(buttons.length).toBeGreaterThan(0);
    buttons[0].click();
    await sleep(100);

    expect(preview.textContent).toContain("user_message");
    expect(copyButton.disabled).toBe(false);
    expect(downloadButton.disabled).toBe(false);
  });

  it("autoloads a sample from the URL", async () => {
    ({ document } = await loadFrom(import.meta.dirname, "index.html?log=short"));
    preview = document.getElementById("markdownPreview");
    copyButton = document.getElementById("copyButton");
    downloadButton = document.getElementById("downloadButton");

    await sleep(100);
    expect(preview.textContent).toContain("user_message");
    expect(copyButton.disabled).toBe(false);
    expect(downloadButton.disabled).toBe(false);
  });
});
