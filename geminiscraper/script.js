// @ts-check
import { bootstrapAlert } from "https://cdn.jsdelivr.net/npm/bootstrap-alert@1";

const bookmarkletButton = document.getElementById("bookmarklet");
const statusText = document.getElementById("bookmarklet-status-text");
const spinner = document.getElementById("bookmarklet-spinner");
const errorText = document.getElementById("bookmarklet-error");

let bookmarkletHref = "";

const setLoading = (isLoading) => {
  if (spinner) spinner.classList.toggle("d-none", !isLoading);
};

const updateStatus = (text) => {
  if (statusText) statusText.textContent = text;
};

const showError = (message) => {
  if (errorText) errorText.textContent = message;
};

const loadConfig = async () => {
  const response = await fetch("config.json", { cache: "no-store" });
  if (!response.ok) throw new Error(`Unable to load config (${response.status})`);
  return response.json();
};

const loadBookmarklet = async () => {
  setLoading(true);
  updateStatus("Loading bookmarklet...");
  showError("");
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
    if (!response.ok) throw new Error(`Unable to load bookmarklet (${response.status})`);
    const code = await response.text();
    const bookmarkletCode = `${code};geminiscraper.scrape();`;
    bookmarkletHref = `javascript:${encodeURIComponent(bookmarkletCode)}`;
    if (bookmarkletButton) bookmarkletButton.href = bookmarkletHref;
    updateStatus("Drag the button to your bookmarks bar, then click it on a Gemini conversation.");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    updateStatus("Unable to load bookmarklet.");
    showError(message);
    bootstrapAlert({ title: "Load error", body: message, color: "danger" });
  } finally {
    setLoading(false);
  }
};

loadBookmarklet();
