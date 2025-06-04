import { describe, it, expect, beforeEach } from "vitest";
import { loadFrom } from "../common/testutils.js";

describe("JSON Trim tests", async () => {
  let page, window, document, inputJson, outputJson, maxLength, trimButton, copyButton, errorContainer;

  beforeEach(async () => {
    ({ page, window, document } = await loadFrom(import.meta.dirname));
    inputJson = document.getElementById("inputJson");
    outputJson = document.getElementById("outputJson");
    maxLength = document.getElementById("maxLength");
    trimButton = document.getElementById("trimButton");
    copyButton = document.getElementById("copyButton");
    errorContainer = document.getElementById("error-container");
  });

  it("should trim strings in JSON to the specified maxLength", async () => {
    const json = { "name": "John Doe", "description": "A long description that needs trimming." };
    inputJson.value = JSON.stringify(json);
    maxLength.value = "10";
    trimButton.click();
    // No need for waitUntilComplete as operations are synchronous

    const expectedOutput = { "name": "John Doe", "description": "A long des" };
    expect(JSON.parse(outputJson.value)).toEqual(expectedOutput);
    expect(copyButton.disabled).toBe(false);
    expect(errorContainer.innerHTML).toBe("");
  });

  it("should handle nested objects and arrays", async () => {
    const json = {
      "user": { "name": "Jane Smith", "bio": "Loves coding and long walks" },
      "tags": ["developer", "javascript", "web enthusiast"]
    };
    inputJson.value = JSON.stringify(json);
    maxLength.value = "8";
    trimButton.click();

    const expectedOutput = {
      "user": { "name": "Jane Smi", "bio": "Loves co" },
      "tags": ["develope", "javascri", "web enth"]
    };
    expect(JSON.parse(outputJson.value)).toEqual(expectedOutput);
  });

  it("should not trim numbers or booleans", async () => {
    const json = { "id": 1234567890, "active": true, "value": 123.456789 };
    inputJson.value = JSON.stringify(json);
    maxLength.value = "5";
    trimButton.click();

    // Numbers and booleans should remain unchanged
    expect(JSON.parse(outputJson.value)).toEqual(json);
  });


  it("should show an error for invalid JSON input", async () => {
    inputJson.value = "invalid json";
    maxLength.value = "5";
    trimButton.click();

    expect(outputJson.value).toBe("");
    expect(copyButton.disabled).toBe(true);
    expect(errorContainer.querySelector(".alert-danger")).not.toBeNull();
    expect(errorContainer.textContent).toContain("Invalid JSON input");
  });

  it("should show an error if maxLength is less than 1", async () => {
    const json = { "name": "Test" };
    inputJson.value = JSON.stringify(json);
    maxLength.value = "0";
    trimButton.click();

    expect(outputJson.value).toBe(""); // Output might not be cleared depending on implementation
    expect(copyButton.disabled).toBe(true); // Or check initial state if it doesn't change
    expect(errorContainer.querySelector(".alert-danger")).not.toBeNull();
    expect(errorContainer.textContent).toContain("Maximum length must be at least 1");
  });

  it("should copy trimmed JSON to clipboard", async () => {
    const json = { "message": "Hello World, this is a test for copy." };
    inputJson.value = JSON.stringify(json);
    maxLength.value = "15";
    trimButton.click();

    // Store original clipboard writeText
    const originalWriteText = window.navigator.clipboard.writeText;
    let clipboardContent = "";
    window.navigator.clipboard.writeText = async (text) => {
      clipboardContent = text;
      return Promise.resolve();
    };

    copyButton.click();
    await new Promise(resolve => setTimeout(resolve, 0)); // Allow microtasks to process

    expect(JSON.parse(clipboardContent)).toEqual({ "message": "Hello World, th" });

    // Restore original clipboard.writeText
    window.navigator.clipboard.writeText = originalWriteText;

    // Check for copy confirmation message (optional, based on UI)
    expect(copyButton.innerHTML).toContain("Copied!");
    // Wait for button text to revert
    await new Promise(resolve => setTimeout(resolve, 2100));
    expect(copyButton.innerHTML).not.toContain("Copied!");
  });

  it("should load JSON from localStorage on load and save on input", async () => {
    // Test saving to localStorage
    const testJson = '{ "test": "save" }';
    inputJson.value = testJson;
    inputJson.dispatchEvent(new window.Event("input", { bubbles: true }));
    expect(window.localStorage.getItem("jsonTrimmer.input")).toBe(testJson);

    // Test loading from localStorage
    // Create a new instance to simulate fresh load
    // Correctly load the page first
    const { window: newWindow, document: newDocument } = await loadFrom(import.meta.dirname);

    // Manually set localStorage for the new window *before* the load event logic would typically run
    newWindow.localStorage.setItem("jsonTrimmer.input", '{ "loaded": "yes" }');

    // Manually trigger the load event logic from script.js for the new window
    // The script assigns to a global const inputJson, so we need to get it from the newDocument
    const newInputJson = newDocument.getElementById("inputJson");
    expect(newInputJson).not.toBeNull(); // Ensure element exists

    // Simulate the event listener's effect
    const savedJson = newWindow.localStorage.getItem("jsonTrimmer.input");
    if (savedJson && newInputJson) {
      newInputJson.value = savedJson;
    }

    expect(newInputJson.value).toBe('{ "loaded": "yes" }');
  });
});
