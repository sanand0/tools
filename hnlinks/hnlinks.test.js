import { describe, it, expect, beforeEach } from "vitest";
import { loadFrom } from "../common/testutils.js";

describe("HN Links tests", async () => {
  let page, window, document, scrapeButton, linksTextArea, copyButton;

  beforeEach(async () => {
    ({ page, window, document } = await loadFrom(import.meta.dirname));
    scrapeButton = document.getElementById("scrapeButton");
    linksTextArea = document.getElementById("linksTextArea");
    copyButton = document.getElementById("copyButton");
  });

  // Encode Test
  it("should scrape Hacker News links correctly", { timeout: 5_000 }, async () => {
    // The textarea is initially empty
    expect(linksTextArea.value).toBe("");

    // Clicking on the scrape button should populate the textarea
    scrapeButton.click();
    await page.waitUntilComplete();

    // There should be 10+ lines
    expect(linksTextArea.value.split("\n").length).toBeGreaterThan(10);
    // ... each is a Markdown link of the form [...](http...)
    expect(linksTextArea.value.split("\n").every((line) => line.match(/^\[.*\]\(http/))).toBe(true);
    // Copy button should be enabled
    expect(copyButton.disabled).toBe(false);

    // Copying should work
    copyButton.click();
    expect(await window.navigator.clipboard.readText()).toBe(linksTextArea.value);
  });

  it("should scrape HN Top Links correctly", { timeout: 5_000 }, async () => {
    // Change the source to HN Top Links and scrape again
    const sourceSelect = document.getElementById("sourceUrl");
    sourceSelect.value = "https://www.hntoplinks.com/week";
    scrapeButton.click();
    await page.waitUntilComplete();
    expect(linksTextArea.value.split("\n").length).toBeGreaterThan(10);
    expect(linksTextArea.value.split("\n").every((line) => line.match(/^\[.*\]\(http/))).toBe(true);
    expect(copyButton.disabled).toBe(false);

    copyButton.click();
    expect(await window.navigator.clipboard.readText()).toBe(linksTextArea.value);
  });
});
