// @ts-check
import { bootstrapAlert } from "https://cdn.jsdelivr.net/npm/bootstrap-alert@1";

const bookmarkletButton = document.getElementById("bookmarklet");
const statusText = document.getElementById("bookmarklet-status-text");
const spinner = document.getElementById("bookmarklet-spinner");
const errorText = document.getElementById("bookmarklet-error");

const setLoading = (isLoading) => {
  if (spinner) spinner.classList.toggle("d-none", !isLoading);
};

const updateStatus = (text) => {
  if (statusText) statusText.textContent = text;
};

const showError = (message) => {
  if (errorText) errorText.textContent = message;
};

async function loadBookmarklet() {
  setLoading(true);
  updateStatus("Loading bookmarklet...");
  showError("");
  try {
    const response = await fetch("gmeetcaptions.js", { cache: "no-store" });
    if (!response.ok) throw new Error(`Unable to load bookmarklet (${response.status})`);
    const code = await response.text();
    const bookmarkletCode = `${code};gmeetcaptions.scrape();`;
    if (bookmarkletButton) bookmarkletButton.href = `javascript:${encodeURIComponent(bookmarkletCode)}`;
    updateStatus("Drag the button to your bookmarks bar, then click it inside Google Meet.");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    updateStatus("Unable to load bookmarklet.");
    showError(message);
    bootstrapAlert({ title: "Load error", body: message, color: "danger" });
  } finally {
    setLoading(false);
  }
}

loadBookmarklet();
