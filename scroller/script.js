// @ts-check
import { bootstrapAlert } from "https://cdn.jsdelivr.net/npm/bootstrap-alert@1";

const bookmarkletButton = document.getElementById("bookmarklet");
const previewButton = document.getElementById("launch-preview");
const statusText = document.getElementById("bookmarklet-status-text");
const spinner = document.getElementById("bookmarklet-spinner");
const errorText = document.getElementById("bookmarklet-error");

const setLoading = (isLoading) => {
  spinner?.classList.toggle("d-none", !isLoading);
};

const updateStatus = (text) => {
  if (statusText) statusText.textContent = text;
};

const showError = (text) => {
  if (errorText) errorText.textContent = text;
};

const buildBookmarkletHref = (code) =>
  `javascript:${encodeURIComponent(`${code};scroller.mount();`)}`;

async function loadBookmarklet() {
  setLoading(true);
  updateStatus("Loading bookmarklet...");
  showError("");
  try {
    const response = await fetch("scroller.min.js", { cache: "no-store" });
    if (!response.ok)
      throw new Error(`Unable to load bookmarklet (${response.status})`);
    const code = (await response.text()).trim();
    if (bookmarkletButton)
      bookmarkletButton.setAttribute("href", buildBookmarkletHref(code));
    updateStatus(
      "Drag the button to your bookmarks bar, then click it on any page you want to autoscroll.",
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    updateStatus("Unable to load bookmarklet.");
    showError(message);
    bootstrapAlert({ title: "Load error", body: message, color: "danger" });
  } finally {
    setLoading(false);
  }
}

previewButton?.addEventListener("click", () => {
  window.scroller?.mount();
});

loadBookmarklet();
