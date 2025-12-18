import { describe, it, expect, beforeEach } from "vitest";
import { loadFrom, sleep } from "../common/testutils.js";

describe("joincsv", async () => {
  let document, tables, joinBtn, output, downloadBtn, copyBtn, sampleContainer;

  beforeEach(async () => {
    ({ document } = await loadFrom(import.meta.dirname));
    tables = document.getElementById("tables");
    joinBtn = document.getElementById("joinBtn");
    output = document.getElementById("output");
    downloadBtn = document.getElementById("downloadBtn");
    copyBtn = document.getElementById("copyBtn");
    sampleContainer = document.getElementById("sampleContainer");
  });

  it("loads a preset from config buttons", async () => {
    const buttons = sampleContainer.querySelectorAll("button");
    expect(buttons.length).toBeGreaterThan(0);
    buttons[0].click();
    await sleep(50);
    expect(tables.value).toContain("Name,Age");

    joinBtn.click();
    expect(output.value).toContain("Name,Age,Score");
    expect(output.value).toContain("Alice,30,85");
    expect(downloadBtn.classList.contains("d-none")).toBe(false);
    expect(copyBtn.classList.contains("d-none")).toBe(false);
  });

  it("loads a preset from the URL and joins", async () => {
    ({ document } = await loadFrom(import.meta.dirname, "index.html?tables=basic"));
    tables = document.getElementById("tables");
    joinBtn = document.getElementById("joinBtn");
    output = document.getElementById("output");

    await sleep(50);
    expect(tables.value).toContain("Name,Age");

    joinBtn.click();
    expect(output.value).toContain("Name,Age,Score");
  });
});
