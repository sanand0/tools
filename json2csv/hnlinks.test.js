import { describe, it, expect, beforeEach } from "vitest";
import { loadFrom } from "../common/testutils.js";

describe("JSON to CSV tests", async () => {
  let window, document, jsonInput, convertBtn, output, downloadBtn, copyBtn;

  beforeEach(async () => {
    ({ window, document } = await loadFrom(import.meta.dirname));
    jsonInput = document.getElementById("jsonInput");
    convertBtn = document.getElementById("convertBtn");
    output = document.getElementById("output");
    downloadBtn = document.getElementById("downloadBtn");
    copyBtn = document.getElementById("copyBtn");
  });

  it("should convert simple JSON to CSV correctly", async () => {
    const json = [
      { name: "John", age: 30 },
      { name: "Jane", age: 25 },
    ];
    jsonInput.value = JSON.stringify(json);
    convertBtn.click();

    const table = output.querySelector("table");
    expect(table).not.toBeNull();
    const headers = Array.from(table.querySelectorAll("th")).map((th) => th.textContent);
    expect(headers).toEqual(["name", "age"]);
    const rows = Array.from(table.querySelectorAll("tbody tr"));
    expect(rows.length).toBe(2);
    const firstRowCells = Array.from(rows[0].querySelectorAll("td")).map((td) => td.textContent);
    expect(firstRowCells).toEqual(["John", "30"]);
    const secondRowCells = Array.from(rows[1].querySelectorAll("td")).map((td) => td.textContent);
    expect(secondRowCells).toEqual(["Jane", "25"]);
    expect(downloadBtn.classList.contains("d-none")).toBe(false);
    expect(copyBtn.classList.contains("d-none")).toBe(false);
  });

  it("should handle nested JSON and flatten it", async () => {
    const json = [{ name: "Peter", details: { age: 40, city: "New York" } }];
    jsonInput.value = JSON.stringify(json);
    convertBtn.click();

    const table = output.querySelector("table");
    expect(table).not.toBeNull();
    const headers = Array.from(table.querySelectorAll("th")).map((th) => th.textContent);
    expect(headers).toEqual(["name", "details.age", "details.city"]);
    const rows = Array.from(table.querySelectorAll("tbody tr"));
    expect(rows.length).toBe(1);
    const cells = Array.from(rows[0].querySelectorAll("td")).map((td) => td.textContent);
    expect(cells).toEqual(["Peter", "40", "New York"]);
  });

  it("should handle JSON object as input", async () => {
    const json = { name: "Alice", age: 25, place: { country: "Canada", city: "Ottawa" } };
    jsonInput.value = JSON.stringify(json);
    convertBtn.click();
    const table = output.querySelector("table");
    expect(table).not.toBeNull();
    const headers = Array.from(table.querySelectorAll("th")).map((th) => th.textContent);
    expect(headers).toEqual(["name", "age", "place.country", "place.city"]);
  });

  it("should show an error for invalid JSON", async () => {
    jsonInput.value = "invalid json";
    convertBtn.click();

    const toast = document.querySelector(".toast-body");
    expect(toast.textContent).toContain("Error: Invalid JSON input.");
    expect(downloadBtn.classList.contains("d-none")).toBe(true);
    expect(copyBtn.classList.contains("d-none")).toBe(true);
  });

  it("should show an error for empty input", async () => {
    jsonInput.value = "";
    convertBtn.click();

    const toast = document.querySelector(".toast-body");
    expect(toast.textContent).toContain("Error: Please enter some JSON data.");
    expect(downloadBtn.classList.contains("d-none")).toBe(true);
    expect(copyBtn.classList.contains("d-none")).toBe(true);
  });

  it("should copy CSV to clipboard (as TSV)", async () => {
    const json = [{ name: "Copy Test", value: 123 }];
    jsonInput.value = JSON.stringify(json);
    convertBtn.click();

    copyBtn.click();

    expect(await window.navigator.clipboard.readText()).toBe("name	value\nCopy Test	123");

    // Check for toast message
    const toastElement = document.querySelector(".toast-body");
    expect(toastElement.textContent).toBe("Copied to clipboard!");
  });

  // Note: Actual download functionality is hard to test in JSDOM.
  // We'll check if the download button is enabled and triggers a download attribute.
  it("should prepare for download", async () => {
    expect(downloadBtn.classList.contains("d-none")).toBe(true);

    const json = [{ name: "Download Test", value: 456 }];
    jsonInput.value = JSON.stringify(json);
    convertBtn.click();

    expect(downloadBtn.classList.contains("d-none")).toBe(false);
    // In a real browser, clicking downloadBtn would trigger a download.
    // We can't check the actual download here, but we know the button is active.
    // Spy on downloadCsv if possible or check attributes if any are set.
    // For now, just ensuring it's visible.
  });
});
