import { describe, it, expect, beforeEach } from "vitest";
import { loadFrom, sleep } from "../common/testutils.js";

describe("Excel converter", async () => {
  let window, document, input, output, copyBtn, downloadBtn, format;

  beforeEach(async () => {
    ({ window, document } = await loadFrom(import.meta.dirname));
    input = document.getElementById("input");
    output = document.getElementById("output");
    copyBtn = document.getElementById("copy-btn");
    downloadBtn = document.getElementById("download-btn");
    format = document.getElementById("format-select");
  });

  it("converts TSV to JSONL", async () => {
    input.value = "name\tage\nJohn\t30\nJane\t25";
    input.dispatchEvent(new window.Event("input", { bubbles: true }));
    await sleep(100);
    expect(output.value).toBe('{"name":"John","age":"30"}\n{"name":"Jane","age":"25"}');
    expect(downloadBtn.disabled).toBe(false);
  });

  it("converts TSV to YAML", async () => {
    format.value = "yaml";
    format.dispatchEvent(new window.Event("change", { bubbles: true }));
    input.value = "a\tb\n1\t2\n3\t4";
    input.dispatchEvent(new window.Event("input", { bubbles: true }));
    await sleep(100);
    expect(output.value).toBe("- a: 1\n  b: 2\n- a: 3\n  b: 4");
  });

  it("copies output", async () => {
    input.value = "x\ty\n1\t2";
    input.dispatchEvent(new window.Event("input", { bubbles: true }));
    await sleep(100);
    copyBtn.click();
    expect(await window.navigator.clipboard.readText()).toBe('{"x":"1","y":"2"}');
  });
});
