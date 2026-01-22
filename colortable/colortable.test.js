import { describe, it, expect, beforeEach } from "vitest";
import { loadFrom, sleep } from "../common/testutils.js";

describe("Color Table Builder", async () => {
  let window;
  let document;
  let tableInput;
  let delimiterInput;
  let preview;
  let copyButton;

  beforeEach(async () => {
    ({ window, document } = await loadFrom(import.meta.dirname));
    tableInput = document.getElementById("table-input");
    delimiterInput = document.getElementById("delimiter-input");
    preview = document.getElementById("table-preview");
    copyButton = document.getElementById("copy-html");
  });

  const setTableInput = (value) => {
    tableInput.value = value;
    tableInput.dispatchEvent(new window.Event("input", { bubbles: true }));
  };

  it("renders a trimmed table with row headers", () => {
    setTableInput("Name, Score , Rate\nAlpha , 10 , 45%\nBeta, 5 , 60%");

    const table = preview.querySelector("table");
    expect(table).not.toBeNull();

    const headers = table.querySelectorAll("thead th");
    expect(headers).toHaveLength(3);
    expect(headers[1].textContent).toBe("Score");

    const firstRowHeader = table.querySelector("tbody tr th");
    expect(firstRowHeader).not.toBeNull();
    expect(firstRowHeader.getAttribute("scope")).toBe("row");
    expect(firstRowHeader.textContent).toBe("Alpha");

    const numericCell = table.querySelector("tbody tr td");
    expect(numericCell.style.textAlign).toBe("right");
    expect(numericCell.style.backgroundColor).not.toBe("");

    const percentCell = table.querySelectorAll("tbody tr td")[1];
    expect(percentCell.textContent).toBe("45%");
  });

  it("supports pipe-delimited tables", () => {
    delimiterInput.value = "pipe";
    delimiterInput.dispatchEvent(new window.Event("input", { bubbles: true }));
    setTableInput("Name|Value\nA|1\nB|2");

    const rows = preview.querySelectorAll("tbody tr");
    expect(rows).toHaveLength(2);
    expect(rows[1].textContent).toContain("B");
  });

  it("copies the generated HTML", async () => {
    setTableInput("Name,Value\nAlpha,10");
    copyButton.click();
    await sleep(20);

    const html = await window.navigator.clipboard.readText();
    expect(html).toContain("<table");
    expect(html).toContain("scope=\"col\"");
  });
});
