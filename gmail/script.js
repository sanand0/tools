// @ts-check
import { bootstrapAlert } from "https://cdn.jsdelivr.net/npm/bootstrap-alert@1";

const bookmarklet = document.querySelector('[data-bookmarklet="gmail-header"]');
const statusText = document.getElementById("bookmarklet-status-text");
const spinner = document.getElementById("bookmarklet-spinner");
const errorText = document.getElementById("bookmarklet-error");

const loadBookmarklet = async () => {
  try {
    const response = await fetch("gmail.js", { cache: "no-store" });
    if (!response.ok) throw new Error(`Unable to load GMail header bookmarklet (${response.status})`);
    const code = await response.text();
    if (bookmarklet) bookmarklet.href = `javascript:${encodeURIComponent(`${code};gmail.copyHeader();`)}`;
    if (statusText) statusText.textContent = "Drag the button to your bookmarks bar, then click it in an open email.";
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (statusText) statusText.textContent = "Unable to load bookmarklet.";
    if (errorText) errorText.textContent = message;
    bootstrapAlert({ title: "Load error", body: message, color: "danger" });
  } finally {
    spinner?.classList.add("d-none");
  }
};

loadBookmarklet();
