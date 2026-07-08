// @ts-check
import { bootstrapAlert } from "https://cdn.jsdelivr.net/npm/bootstrap-alert@1";

const bookmarkletButtons = Array.from(document.querySelectorAll("[data-captions-provider]"));
const statusText = document.getElementById("bookmarklet-status-text");
const spinner = document.getElementById("bookmarklet-spinner");
const errorText = document.getElementById("bookmarklet-error");

const providers = {
  "google-meet": {
    label: "Google Meet",
    call: "meetcaptions.googleMeet.scrape();",
  },
  teams: {
    label: "Teams",
    call: "meetcaptions.teams.scrape();",
  },
};

const setLoading = (isLoading) => {
  if (spinner) spinner.classList.toggle("d-none", !isLoading);
};

const updateStatus = (text) => {
  if (statusText) statusText.textContent = text;
};

const showError = (message) => {
  if (errorText) errorText.textContent = message;
};

const loadBookmarklet = async (provider) => {
  const response = await fetch("meetcaptions.js", { cache: "no-store" });
  if (!response.ok) throw new Error(`Unable to load ${provider.label} bookmarklet (${response.status})`);
  const code = await response.text();
  return `javascript:${encodeURIComponent(`${code};${provider.call}`)}`;
};

async function loadBookmarklets() {
  setLoading(true);
  updateStatus("Loading bookmarklets...");
  showError("");
  try {
    await Promise.all(
      bookmarkletButtons.map(async (button) => {
        const provider = providers[button.dataset.captionsProvider];
        if (!provider) return;
        button.href = await loadBookmarklet(provider);
      }),
    );
    updateStatus("Drag a button to your bookmarks bar, then click it inside the matching meeting.");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    updateStatus("Unable to load bookmarklets.");
    showError(message);
    bootstrapAlert({ title: "Load error", body: message, color: "danger" });
  } finally {
    setLoading(false);
  }
}

loadBookmarklets();
