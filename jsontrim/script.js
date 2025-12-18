import saveform from "https://cdn.jsdelivr.net/npm/saveform@1.2";
import { copyText } from "../common/clipboard-utils.js";
import { loadConfigJson, readIntParam, readParam } from "../common/demo.js";
// Get DOM elements
const inputJson = document.getElementById("inputJson");
const outputJson = document.getElementById("outputJson");
const maxLength = document.getElementById("maxLength");
const trimButton = document.getElementById("trimButton");
const copyButton = document.getElementById("copyButton");
const errorContainer = document.getElementById("error-container");
const sampleContainer = document.getElementById("sampleContainer");
saveform("#jsontrim-form");
let config;

const alert = ({ title = "", body = "", color = "danger" } = {}) => {
  if (!errorContainer) return;
  const alertElement = document.createElement("div");
  alertElement.className = `alert alert-${color}`;
  alertElement.role = "alert";
  if (title) {
    const titleElement = document.createElement("div");
    titleElement.className = "fw-semibold";
    titleElement.textContent = title;
    alertElement.appendChild(titleElement);
  }
  if (body) {
    const bodyElement = document.createElement("div");
    bodyElement.textContent = body;
    alertElement.appendChild(bodyElement);
  }
  errorContainer.replaceChildren(alertElement);
};

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
function runTrim() {
  errorContainer?.replaceChildren();
  const max = Number.parseInt(maxLength.value, 10);

  if (max < 1) {
    alert({ title: "Invalid length", body: "Maximum length must be at least 1.", color: "danger" });
    return;
  }

  try {
    const json = JSON.parse(inputJson.value);
    const trimmed = trimStrings(json, max);
    outputJson.value = JSON.stringify(trimmed, null, 2);
    copyButton.disabled = false;
  } catch {
    alert({ title: "Invalid JSON", body: "Invalid JSON input", color: "danger" });
    outputJson.value = "";
    copyButton.disabled = true;
  }
}

trimButton.addEventListener("click", runTrim);

// Copy to clipboard
copyButton.addEventListener("click", async () => {
  try {
    const ok = await copyText(outputJson.value);
    if (!ok) throw new Error("copy failed");
    const originalText = copyButton.innerHTML;
    copyButton.innerHTML = '<i class="bi bi-check-lg"></i> Copied!';
    setTimeout(() => {
      copyButton.innerHTML = originalText;
    }, 2000);
  } catch {
    alert({ title: "Copy failed", body: "Unable to copy to clipboard.", color: "danger" });
  }
});

function renderSamples(presets) {
  if (!sampleContainer) return;
  if (!Array.isArray(presets) || !presets.length) {
    sampleContainer.replaceChildren();
    return;
  }
  const label = document.createElement("span");
  label.className = "text-secondary small fw-semibold me-1";
  label.textContent = "Examples";
  sampleContainer.replaceChildren(
    label,
    ...presets.map((preset) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "btn btn-sm btn-outline-secondary";
      button.textContent = preset.name || preset.id;
      button.addEventListener("click", () => void loadPreset(preset.id, { trim: true }));
      return button;
    }),
  );
}

async function loadPreset(id, { trim = false } = {}) {
  const preset = config?.presets?.find((item) => item.id === id);
  if (!preset?.path) return;
  const response = await fetch(preset.path);
  if (!response.ok) throw new Error(`Failed to load ${preset.path}: HTTP ${response.status}`);
  inputJson.value = await response.text();
  if (typeof preset.max === "number") maxLength.value = String(preset.max);
  outputJson.value = "";
  copyButton.disabled = true;
  errorContainer?.replaceChildren();
  if (trim) runTrim();
}

async function init() {
  try {
    config = await loadConfigJson("config.json");
    renderSamples(config.presets);
    const presetId = readParam("json", { fallback: "" });
    if (presetId) await loadPreset(presetId, { trim: true });
    const max = readIntParam("max", { fallback: null, min: 1, max: 100_000 });
    if (max !== null) maxLength.value = String(max);
  } catch (error) {
    alert({ title: "Config error", body: error.message, color: "danger" });
  }
}

void init();

// Backward-compatible persistence (pre-saveform versions).
const legacyKey = "jsonTrimmer.input";
if (!inputJson.value.trim()) {
  const savedJson = localStorage.getItem(legacyKey);
  if (savedJson) inputJson.value = savedJson;
}
inputJson.addEventListener("input", () => localStorage.setItem(legacyKey, inputJson.value));
