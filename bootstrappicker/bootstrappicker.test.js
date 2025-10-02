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

  it("updates css variables when users tweak colors", async () => {
    const { window, document: doc } = await loadFrom(toolDir);
    doc.documentElement.style.cssText = "";
    window.bootstrapThemePicker.open();
    const modal = doc.getElementById("bootstrap-theme-picker");
    expect(modal).toBeTruthy();

    const select = /** @type {HTMLSelectElement | null} */ (doc.getElementById("theme-select"));
    expect(select).toBeTruthy();
    if (!select) throw new Error("theme select missing");
    select.value = select.options[1]?.value ?? "";
    select.dispatchEvent(new window.Event("change", { bubbles: true }));

    const root = doc.documentElement;
    const afterPreset = root.style.getPropertyValue("--bs-primary");
    expect(afterPreset).toBeTruthy();

    const primaryText = /** @type {HTMLInputElement | null} */ (
      doc.querySelector('input[data-token="primary"][data-role="text"]')
    );
    expect(primaryText).toBeTruthy();
    if (!primaryText) throw new Error("primary text input missing");
    primaryText.value = "#123456";
    primaryText.dispatchEvent(new window.Event("input", { bubbles: true }));

    expect(root.style.getPropertyValue("--bs-primary")).toBe("#123456");
  });
});
