// @ts-check
import { bootstrapAlert } from "https://cdn.jsdelivr.net/npm/bootstrap-alert@1";
import { buildBookmarkletHref } from "./bookmarklet-core.js";

const bookmarkletButton = document.getElementById("bookmarklet");
const statusText = document.getElementById("bookmarklet-status-text");
const spinner = document.getElementById("bookmarklet-spinner");
const errorText = document.getElementById("bookmarklet-error");

const setLoading = (isLoading) => {
  spinner?.classList.toggle("d-none", !isLoading);
};

const updateStatus = (text) => {
  if (statusText) statusText.textContent = text;
};

const showError = (message) => {
  if (errorText) errorText.textContent = message;
};

export const loadBookmarklet = async () => {
  setLoading(true);
  updateStatus("Loading bookmarklet...");
  showError("");
  try {
    const response = await fetch("bookmarklet.js", { cache: "no-store" });
    if (!response.ok) throw new Error(`Unable to load bookmarklet (${response.status})`);
    const code = await response.text();
    if (bookmarkletButton) bookmarkletButton.href = buildBookmarkletHref(code);
    updateStatus("Drag the button to your bookmarks bar, then click it on a page with Markdown text.");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    updateStatus("Unable to load bookmarklet.");
    showError(message);
    bootstrapAlert({ title: "Load error", body: message, color: "danger" });
  } finally {
    setLoading(false);
  }
};

if (!globalThis.__mdviewDisableAutoload) loadBookmarklet();
