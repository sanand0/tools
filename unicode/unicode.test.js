import { describe, it, expect, beforeEach, vi } from "vitest";
import { loadFrom } from "../common/testutils.js";

describe("Unicode Character Extractor tests", async () => {
  let page, window, document, textInput, readTextBtn, readClipboardBtn, charContainer, spinner;

  beforeEach(async () => {
    ({ page, window, document } = await loadFrom(import.meta.dirname));

    textInput = document.getElementById("textInput");
    readTextBtn = document.getElementById("readText");
    readClipboardBtn = document.getElementById("readClipboard");
    charContainer = document.getElementById("charContainer");
    spinner = document.getElementById("spinner");

    // Ensure navigator.clipboard exists, then spy on its methods
    if (!window.navigator.clipboard) {
      // If happy-dom doesn't provide a clipboard object by default,
      // we might need to define it, but this is less likely.
      // More likely, it's defined but read-only.
      Object.defineProperty(window.navigator, 'clipboard', {
        value: {
          readText: vi.fn(async () => ""),
          writeText: vi.fn(async () => Promise.resolve()),
        },
        configurable: true, // Allow spies to modify it
        writable: true // Allow spies to modify it (though spyOn is better)
      });
    }
    // Set up default spies for tests that don't need specific mock implementations
    vi.spyOn(window.navigator.clipboard, 'readText').mockImplementation(async () => "");
    vi.spyOn(window.navigator.clipboard, 'writeText').mockImplementation(async () => Promise.resolve());
  });

  it("should extract non-ASCII characters from text input", async () => {
    textInput.value = "Hello 😊 World αβγ";
    readTextBtn.click();
    // No need for waitUntilComplete as operations are synchronous for text input

    const buttons = charContainer.querySelectorAll(".char-btn");
    expect(buttons.length).toBe(4); // 😊, α, β, γ
    const chars = Array.from(buttons).map(btn => btn.querySelector(".char-display").textContent);
    expect(chars).toEqual(["😊", "α", "β", "γ"]);
  });

  it("should display 'No non-ASCII characters found' if none are present in text input", async () => {
    textInput.value = "Hello World 123";
    readTextBtn.click();

    expect(charContainer.textContent).toContain("No non-ASCII characters found.");
    expect(charContainer.querySelectorAll(".char-btn").length).toBe(0);
  });

  it("should extract non-ASCII characters from clipboard", async () => {
    const clipboardText = "Clipboard test: 😊 Σ Ω";
    // Override the default spy for this specific test
    vi.spyOn(window.navigator.clipboard, 'readText').mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
      return clipboardText;
    });

    readClipboardBtn.click();

    // Wait for spinner to disappear and clipboard read to complete
    await new Promise(resolve => setTimeout(resolve, 100)); // Adjust if needed

    expect(spinner.classList.contains("d-none")).toBe(true);
    expect(readClipboardBtn.disabled).toBe(false);

    const buttons = charContainer.querySelectorAll(".char-btn");
    expect(buttons.length).toBe(3); // 😊, Σ, Ω
    const chars = Array.from(buttons).map(btn => btn.querySelector(".char-display").textContent);
    expect(chars).toEqual(["😊", "Σ", "Ω"]);
  });

  it("should show error toast if clipboard read fails", async () => {
    // Override the default spy for this specific test
    vi.spyOn(window.navigator.clipboard, 'readText').mockRejectedValue(new Error("Clipboard read failed"));

    readClipboardBtn.click();
    await new Promise(resolve => setTimeout(resolve, 100)); // Wait for async operations

    const errorToastElement = document.getElementById("errorToast");
    const errorToastBody = errorToastElement.querySelector(".toast-body");

    // Check if the toast content was set, implying showError was called.
    // Note: We are not checking if errorToastMock.show was called because
    // we can't guarantee the script's errorToast instance is our mock.
    expect(errorToastBody.textContent).toContain("Failed to read clipboard");
    // We could also check if the actual toast element is made visible if it has a specific class for that.
    // For example, if bootstrap adds 'show': expect(errorToastElement.classList.contains('show')).toBe(true);
    // However, JSDOM doesn't fully implement visual aspects like 'show'. Text content is more reliable here.

    expect(spinner.classList.contains("d-none")).toBe(true);
    expect(readClipboardBtn.disabled).toBe(false);
  });

  it("should copy character to clipboard when a char button is clicked", async () => {
    textInput.value = "Test: α";
    readTextBtn.click();

    const charButton = charContainer.querySelector(".char-btn");
    expect(charButton).not.toBeNull();

    const writeTextSpy = vi.spyOn(window.navigator.clipboard, 'writeText');
    // Override the default spy for this specific test for capturing
    let capturedCopiedText = "";
    writeTextSpy.mockImplementation(async (text) => {
      capturedCopiedText = text;
      return Promise.resolve();
    });

    charButton.click();
    await new Promise(resolve => setTimeout(resolve, 50)); // For async clipboard op and UI update

    expect(writeTextSpy).toHaveBeenCalledWith("α");
    expect(capturedCopiedText).toBe("α");
    expect(charButton.classList.contains("btn-success")).toBe(true);

    // Wait for the success class to be removed
    await new Promise(resolve => setTimeout(resolve, 550)); // script uses 500ms timeout
    expect(charButton.classList.contains("btn-success")).toBe(false);
  });
});
