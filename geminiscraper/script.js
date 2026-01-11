// @ts-check
import hljs from "https://cdn.jsdelivr.net/npm/highlight.js@11.9.0/+esm";
import { bootstrapAlert } from "https://cdn.jsdelivr.net/npm/bootstrap-alert@1";

const codeEl = document.getElementById("script-code");
const codeContainer = document.getElementById("script-container");
const loadingEl = document.getElementById("script-loading");
const copyButton = document.getElementById("copy-script");

let scriptText = "";

const loadConfig = async () => {
  const response = await fetch("config.json", { cache: "no-store" });
  if (!response.ok) throw new Error(`Unable to load config (${response.status})`);
  return response.json();
};

const setLoading = (isLoading) => {
  if (loadingEl) loadingEl.classList.toggle("d-none", !isLoading);
  if (codeContainer) codeContainer.classList.toggle("d-none", isLoading);
  if (copyButton) copyButton.disabled = isLoading;
};

const updateCopyState = (label, highlight = false) => {
  if (!copyButton) return;
  const baseClass = "btn-accent";
  copyButton.textContent = label;
  copyButton.classList.toggle("btn-success", highlight);
  copyButton.classList.toggle(baseClass, !highlight);
};

const fallbackCopy = (text) => {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "absolute";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  const ok = document.execCommand("copy");
  textarea.remove();
  if (!ok) throw new Error("Copy failed");
};

const copyToClipboard = async (text) => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  fallbackCopy(text);
};

const loadScript = async () => {
  setLoading(true);
  try {
    let scriptPath = "geminiscraper.js";
    try {
      const config = await loadConfig();
      if (config?.scriptPath) scriptPath = config.scriptPath;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load config";
      bootstrapAlert({ title: "Config warning", body: message, color: "warning" });
    }

    const response = await fetch(scriptPath, { cache: "no-store" });
    if (!response.ok) throw new Error(`Unable to load script (${response.status})`);
    scriptText = await response.text();
    if (!codeEl) return;
    codeEl.replaceChildren(document.createTextNode(scriptText));
    hljs.highlightElement(codeEl);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    bootstrapAlert({ title: "Load error", body: message, color: "danger" });
  } finally {
    setLoading(false);
  }
};

const handleCopy = async () => {
  if (!scriptText) {
    bootstrapAlert({ title: "Copy unavailable", body: "Script not loaded yet.", color: "warning" });
    return;
  }
  try {
    updateCopyState("Copying...");
    await copyToClipboard(scriptText);
    updateCopyState("Copied", true);
    setTimeout(() => updateCopyState("Copy script"), 1600);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to copy";
    bootstrapAlert({ title: "Copy error", body: message, color: "danger" });
    updateCopyState("Copy script");
  }
};

if (copyButton) copyButton.addEventListener("click", handleCopy);
loadScript();
