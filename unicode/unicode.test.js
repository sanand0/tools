import { describe, it, expect, beforeEach } from "vitest";
import { loadFrom, sleep } from "../common/testutils.js";

describe("Unicode Character Extractor tests", async () => {
  let window, document, textInput, readTextBtn, readClipboardBtn, charContainer, spinner;

  beforeEach(async () => {
    ({ window, document } = await loadFrom(import.meta.dirname));

    textInput = document.getElementById("textInput");
    readTextBtn = document.getElementById("readText");
    readClipboardBtn = document.getElementById("readClipboard");
    charContainer = document.getElementById("charContainer");
    spinner = document.getElementById("spinner");
  });

  it("should extract non-ASCII characters from text input", async () => {
    textInput.value = "Hello 😊 World αβγ";
    readTextBtn.click();

    const buttons = charContainer.querySelectorAll(".char-btn");
    expect(buttons.length).toBe(4); // 😊, α, β, γ
    const chars = Array.from(buttons).map((btn) => btn.querySelector(".char-display").textContent);
    expect(chars).toEqual(["😊", "α", "β", "γ"]);
  });

  it("should display 'No non-ASCII characters found' if none are present in text input", async () => {
    textInput.value = "Hello World 123";
    readTextBtn.click();

    expect(charContainer.textContent).toContain("No non-ASCII characters found.");
    expect(charContainer.querySelectorAll(".char-btn").length).toBe(0);
  });

  it("should extract non-ASCII characters from clipboard", async () => {
    await window.navigator.clipboard.writeText("Clipboard test: 😊 Σ Ω");
    readClipboardBtn.click();

    // Wait for spinner to disappear and clipboard read to complete
    await sleep(100); // Adjust if needed

    expect(spinner.classList.contains("d-none")).toBe(true);
    expect(readClipboardBtn.disabled).toBe(false);

    const buttons = charContainer.querySelectorAll(".char-btn");
    expect(buttons.length).toBe(3); // 😊, Σ, Ω
    const chars = Array.from(buttons).map((btn) => btn.querySelector(".char-display").textContent);
    expect(chars).toEqual(["😊", "Σ", "Ω"]);
  });

  it("should copy character to clipboard when a char button is clicked", async () => {
    textInput.value = "Test: α";
    readTextBtn.click();

    const charButton = charContainer.querySelector(".char-btn");
    expect(charButton).not.toBeNull();

    charButton.click();
    await sleep(50); // For async clipboard op and UI update

    expect(await window.navigator.clipboard.readText()).toBe("α");
    expect(charButton.classList.contains("btn-success")).toBe(true);

    // Wait for the success class to be removed
    await sleep(550); // script uses 500ms timeout
    expect(charButton.classList.contains("btn-success")).toBe(false);
  });
});
