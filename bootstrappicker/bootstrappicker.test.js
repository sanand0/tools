// @ts-check
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadFrom } from "../common/testutils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const toolDir = path.join(__dirname);

const minPath = path.join(toolDir, "bootstrappicker.min.js");

/** @returns {Promise<string>} */
const readMinified = async () => fs.promises.readFile(minPath, "utf8");

describe("bootstrap theme picker page", () => {
  it("sets bookmarklet href using bundled script", async () => {
    const { document: doc } = await loadFrom(toolDir);
    const link = doc.getElementById("bookmarklet");
    if (!link) throw new Error("bookmarklet link missing");
    const encoded = link.getAttribute("href");
    expect(encoded).toBeDefined();
    const minified = (await readMinified()).trim();
    const expected = "javascript:" + encodeURIComponent(`${minified};bootstrapThemePicker.open();`);
    expect(encoded).toBe(expected);
  });

  it("shows a single picker per token and updates the UI instantly", async () => {
    const { window, document: doc } = await loadFrom(toolDir);
    doc.documentElement.style.cssText = "";
    window.bootstrapThemePicker.open();
    const modal = doc.getElementById("bootstrap-theme-picker");
    expect(modal).toBeTruthy();
    if (!modal) throw new Error("modal missing");

    const colorInputs = modal.querySelectorAll('input[data-role="color"]');
    expect(colorInputs.length).toBe(7);
    colorInputs.forEach((input) => expect(input.getAttribute("type")).toBe("color"));

    const select = /** @type {HTMLSelectElement | null} */ (doc.getElementById("theme-select"));
    expect(select).toBeTruthy();
    if (!select) throw new Error("theme select missing");
    const originalPrimary = window
      .getComputedStyle(doc.documentElement)
      .getPropertyValue("--bs-primary")
      .trim()
      .toLowerCase();
    select.value = select.options[1]?.value ?? "";
    select.dispatchEvent(new window.Event("change", { bubbles: true }));

    const updatedPrimary = window
      .getComputedStyle(doc.documentElement)
      .getPropertyValue("--bs-primary")
      .trim()
      .toLowerCase();
    expect(updatedPrimary).not.toBe(originalPrimary);

    const previewButton = /** @type {HTMLButtonElement | null} */ (modal.querySelector(".btn.btn-primary"));
    expect(previewButton).toBeTruthy();
    if (!previewButton) throw new Error("preview button missing");
    const normalize = (value) => value.trim().toLowerCase();
    const presetColor = normalize(window.getComputedStyle(previewButton).backgroundColor);
    expect(presetColor).toBe(normalize(updatedPrimary));

    const sampleButton = doc.createElement("button");
    sampleButton.className = "btn btn-primary";
    doc.body.append(sampleButton);

    const primaryInput = /** @type {HTMLInputElement | null} */ (
      modal.querySelector('input[data-role="color"][data-token="primary"]')
    );
    expect(primaryInput).toBeTruthy();
    if (!primaryInput) throw new Error("primary input missing");
    primaryInput.value = "#123456";
    primaryInput.dispatchEvent(new window.Event("input", { bubbles: true }));

    expect(window.getComputedStyle(doc.documentElement).getPropertyValue("--bs-primary").trim().toLowerCase()).toBe(
      "#123456",
    );
    expect(window.getComputedStyle(sampleButton).backgroundColor.toLowerCase()).toBe("#123456");
  });
});
