import saveform from "https://cdn.jsdelivr.net/npm/saveform@1.2";
// Get DOM elements
const inputJson = document.getElementById("inputJson");
const outputJson = document.getElementById("outputJson");
const maxLength = document.getElementById("maxLength");
const trimButton = document.getElementById("trimButton");
const copyButton = document.getElementById("copyButton");
const errorContainer = document.getElementById("error-container");
saveform("#jsontrim-form");

// Show error message
function showError(message) {
  errorContainer.innerHTML = `
              <div class="alert alert-danger alert-dismissible fade show" role="alert">
                  <i class="bi bi-exclamation-triangle-fill"></i> ${message}
                  <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
              </div>
          `;
}

// Clear error message
function clearError() {
  errorContainer.innerHTML = "";
}

// Recursively trim strings in JSON
function trimStrings(obj, maxLen) {
  if (typeof obj === "string") {
    return obj.slice(0, maxLen);
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => trimStrings(item, maxLen));
  }
  if (typeof obj === "object" && obj !== null) {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = trimStrings(value, maxLen);
    }
    return result;
  }
  return obj;
}

// Process JSON
trimButton.addEventListener("click", () => {
  clearError();
  const max = parseInt(maxLength.value);

  if (max < 1) {
    showError("Maximum length must be at least 1");
    return;
  }

  try {
    const json = JSON.parse(inputJson.value);
    const trimmed = trimStrings(json, max);
    outputJson.value = JSON.stringify(trimmed, null, 2);
    copyButton.disabled = false;
  } catch {
    showError("Invalid JSON input");
    outputJson.value = "";
    copyButton.disabled = true;
  }
});

// Copy to clipboard
copyButton.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(outputJson.value);
    const originalText = copyButton.innerHTML;
    copyButton.innerHTML = '<i class="bi bi-check-lg"></i> Copied!';
    setTimeout(() => {
      copyButton.innerHTML = originalText;
    }, 2000);
  } catch {
    showError("Failed to copy to clipboard");
  }
});

// Load saved JSON from localStorage
window.addEventListener("load", () => {
  const savedJson = localStorage.getItem("jsonTrimmer.input");
  if (savedJson) {
    inputJson.value = savedJson;
  }
});

// Save JSON to localStorage
inputJson.addEventListener("input", () => {
  localStorage.setItem("jsonTrimmer.input", inputJson.value);
});
