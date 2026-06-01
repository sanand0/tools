import { describe, it, expect, beforeEach } from "vitest";
import { loadFrom, sleep } from "../common/testutils.js";

describe("Color Table Builder", async () => {
  let window;
  let document;
  let tableInput;
  let delimiterInput;
  let colorModeSelect;
  let rangeMinInput;
  let rangeMaxInput;
  let customToggle;
  let lowColorInput;
  let highColorInput;
  let preview;
  let copyButton;

  beforeEach(async () => {
    ({ window, document } = await loadFrom(import.meta.dirname));
    tableInput = document.getElementById("table-input");
    delimiterInput = document.getElementById("delimiter-input");
    colorModeSelect = document.getElementById("color-mode");
    rangeMinInput = document.getElementById("range-min");
    rangeMaxInput = document.getElementById("range-max");
    customToggle = document.getElementById("use-custom-colors");
    lowColorInput = document.getElementById("low-color");
    highColorInput = document.getElementById("high-color");
    preview = document.getElementById("table-preview");
    copyButton = document.getElementById("copy-html");
  });

  const setTableInput = (value) => {
    tableInput.value = value;
    tableInput.dispatchEvent(new window.Event("input", { bubbles: true }));
  };

  const setColorMode = (value) => {
    colorModeSelect.value = value;
    colorModeSelect.dispatchEvent(new window.Event("change", { bubbles: true }));
  };

  const enableCustomColors = (low, high) => {
    customToggle.checked = true;
    customToggle.dispatchEvent(new window.Event("input", { bubbles: true }));
    lowColorInput.value = low;
    lowColorInput.dispatchEvent(new window.Event("input", { bubbles: true }));
    highColorInput.value = high;
    highColorInput.dispatchEvent(new window.Event("input", { bubbles: true }));
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

  it("lists D3 continuous color scales by type", () => {
    const groups = [...document.querySelectorAll("#gradient-select optgroup")];
    const groupLabels = groups.map((group) => group.label);
    const options = [...document.querySelectorAll("#gradient-select option")];

    expect(groupLabels).toEqual(["Sequential", "Diverging", "Cyclical"]);
    expect(document.getElementById("gradient-select").value).toBe("rdylgn");
    expect(options).toHaveLength(38);
    expect(groups[0].querySelector('option[value="reds"]').textContent).toBe("Reds");
    expect(groups[1].querySelector('option[value="rdbu"]').textContent).toBe("Red-Blue");
    expect(groups[2].querySelector('option[value="rainbow"]').textContent).toBe("Rainbow");
  });

  it("supports Markdown tables", () => {
    delimiterInput.value = "pipe";
    delimiterInput.dispatchEvent(new window.Event("input", { bubbles: true }));
    setTableInput("| Name | Value |\n| --- | ---: |\n| Alpha | 1 |\n| Beta | 2 |");

    const headers = [...preview.querySelectorAll("thead th")].map((cell) => cell.textContent);
    const rows = [...preview.querySelectorAll("tbody tr")].map((row) =>
      [...row.children].map((cell) => cell.textContent),
    );

    expect(headers).toEqual(["Name", "Value"]);
    expect(rows).toEqual([
      ["Alpha", "1"],
      ["Beta", "2"],
    ]);
  });

  it("treats consistent currency prefixes as numeric values", () => {
    delimiterInput.value = "pipe";
    delimiterInput.dispatchEvent(new window.Event("input", { bubbles: true }));
    setTableInput("Name|Revenue\nA|$1,000\nB|$2,500\nC|");

    expect(rangeMinInput.value).toBe("1000");
    expect(rangeMaxInput.value).toBe("2500");

    const cells = preview.querySelectorAll("tbody tr td");
    expect(cells[0].textContent).toBe("$1,000");
    expect(cells[0].style.textAlign).toBe("right");
    expect(cells[0].style.backgroundColor).not.toBe("");
    expect(cells[2].style.backgroundColor).toBe("");
  });

  it("does not parse columns with mixed currency prefixes", () => {
    delimiterInput.value = "pipe";
    delimiterInput.dispatchEvent(new window.Event("input", { bubbles: true }));
    setTableInput("Name|Revenue\nA|$1,000\nB|INR 2,500");

    const cells = preview.querySelectorAll("tbody tr td");
    expect(cells[0].style.textAlign).toBe("left");
    expect(cells[0].style.backgroundColor).toBe("");
    expect(rangeMinInput.value).toBe("");
    expect(rangeMaxInput.value).toBe("");
  });

  it("treats consistent optional suffixes and approximation prefixes as numeric values", () => {
    setTableInput("Name,Estimate\nA,~1.2M\nB,2.4M");

    expect(rangeMinInput.value).toBe("1.2");
    expect(rangeMaxInput.value).toBe("2.4");

    const cells = preview.querySelectorAll("tbody tr td");
    expect(cells[0].style.backgroundColor).not.toBe("");
    expect(cells[1].style.backgroundColor).not.toBe("");
  });

  it("reverses the color scale", () => {
    setTableInput("Name,Value\nA,0\nB,100");
    enableCustomColors("#000000", "#ffffff");

    const before = [...preview.querySelectorAll("tbody tr td")].map((cell) => cell.style.backgroundColor);
    const reverseScale = document.getElementById("reverse-scale");
    reverseScale.checked = true;
    reverseScale.dispatchEvent(new window.Event("input", { bubbles: true }));
    const after = [...preview.querySelectorAll("tbody tr td")].map((cell) => cell.style.backgroundColor);

    expect(before).toEqual(["rgb(0, 0, 0)", "rgb(255, 255, 255)"]);
    expect(after).toEqual(["rgb(255, 255, 255)", "rgb(0, 0, 0)"]);
  });

  it("colors each row independently in rows mode", () => {
    setTableInput("Name,A,B\nRow1,0,100\nRow2,0,1");
    enableCustomColors("#000000", "#ffffff");
    setColorMode("rows");

    expect(rangeMinInput.disabled).toBe(true);
    expect(rangeMaxInput.disabled).toBe(true);

    const rows = preview.querySelectorAll("tbody tr");
    const row1Cells = rows[0].querySelectorAll("td");
    const row2Cells = rows[1].querySelectorAll("td");
    const row1Max = row1Cells[1].style.backgroundColor;
    const row2Max = row2Cells[1].style.backgroundColor;

    expect(row1Max).not.toBe("");
    expect(row1Max).toBe(row2Max);
    expect(row2Cells[0].style.backgroundColor).not.toBe(row2Max);
  });

  it("colors each column independently in columns mode", () => {
    setTableInput("Name,A,B\nRow1,0,100\nRow2,1,200");
    enableCustomColors("#000000", "#ffffff");
    setColorMode("columns");

    expect(rangeMinInput.disabled).toBe(true);
    expect(rangeMaxInput.disabled).toBe(true);

    const rows = preview.querySelectorAll("tbody tr");
    const row1Cells = rows[0].querySelectorAll("td");
    const row2Cells = rows[1].querySelectorAll("td");
    const columnAMax = row2Cells[0].style.backgroundColor;
    const columnBMax = row2Cells[1].style.backgroundColor;

    expect(columnAMax).not.toBe("");
    expect(columnAMax).toBe(columnBMax);
    expect(row1Cells[0].style.backgroundColor).not.toBe(columnAMax);
  });

  it("copies the generated HTML", async () => {
    setTableInput("Name,Value\nAlpha,10");
    copyButton.click();
    await sleep(20);

    const html = await window.navigator.clipboard.readText();
    expect(html).toContain("<table");
    expect(html).toContain('scope="col"');
  });
});
