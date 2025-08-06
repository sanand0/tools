import { describe, it, expect, beforeEach } from "vitest";
import { loadFrom } from "../common/testutils.js";

describe("Unicoder tests", async () => {
  let window, document, inputElement, outputElement, copyButton;

  beforeEach(async () => {
    ({ window, document } = await loadFrom(import.meta.dirname));
    inputElement = document.getElementById("markdown-input");
    outputElement = document.getElementById("output");
    copyButton = document.getElementById("copy-button");
  });

  function setValueAndTriggerInput(value) {
    inputElement.value = value;
    inputElement.dispatchEvent(new window.Event("input", { bubbles: true }));
  }

  it("should encode markdown to unicode correctly", () => {
    setValueAndTriggerInput("**bold** _italic_ `code`");
    expect(outputElement.textContent.trim()).toBe("𝗯𝗼𝗹𝗱 𝘪𝘵𝘢𝘭𝘪𝘤 𝚌𝚘𝚍𝚎");
  });

  it("should copy formatted output to clipboard when Copy button is clicked", async () => {
    setValueAndTriggerInput("**test content**");
    copyButton.click();

    // Wait for clipboard operation and verify clipboard content
    expect(await window.navigator.clipboard.readText()).toBe("𝘁𝗲𝘀𝘁 𝗰𝗼𝗻𝘁𝗲𝗻𝘁\n");
    // Verify button shows success state
    expect(copyButton.textContent).toBe("Copied!");
    expect(copyButton.classList.contains("btn-success")).toBe(true);
  });
});
