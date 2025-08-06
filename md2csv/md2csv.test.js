import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest";
import { loadFrom } from "../common/testutils.js";

describe("md2csv", () => {
  let window, document, input, extractBtn, output, copyBtn;

  beforeAll(() => vi.useFakeTimers());
  afterAll(() => vi.useRealTimers());

  beforeEach(async () => {
    ({ window, document } = await loadFrom(import.meta.dirname));
    window.setTimeout = setTimeout;
    input = document.getElementById("markdownInput");
    extractBtn = document.getElementById("extractBtn");
    output = document.getElementById("output");
    copyBtn = document.getElementById("copyBtn");
  });
  afterEach(() => vi.restoreAllMocks());

  it("converts markdown table", async () => {
    input.value = `|a|b|\n|-|-|\n|1|2|`;
    extractBtn.click();
    const cells = Array.from(output.querySelectorAll("td")).map((c) => c.textContent);
    expect(cells).toEqual(["1", "2"]);
    copyBtn.click();
    expect(await window.navigator.clipboard.readText()).toBe("a\tb\n1\t2");
  });

  it("shows error on missing table", () => {
    input.value = "no table";
    extractBtn.click();
    expect(document.querySelector(".alert")).not.toBeNull();
  });
});
