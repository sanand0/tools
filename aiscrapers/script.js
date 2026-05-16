// @ts-check
import { bootstrapAlert } from "https://cdn.jsdelivr.net/npm/bootstrap-alert@1";

const bookmarkletButtons = Array.from(document.querySelectorAll("[data-scraper]"));
const statusText = document.getElementById("bookmarklet-status-text");
const spinner = document.getElementById("bookmarklet-spinner");
const errorText = document.getElementById("bookmarklet-error");

const scrapers = {
  gemini: {
    label: "Gemini",
    scriptPath: "geminiscraper.js",
    call: "geminiscraper.scrape();",
  },
  claude: {
    label: "Claude",
    scriptPath: "claudescraper.js",
    call: "claudescraper.scrape();",
  },
  chatgpt: {
    label: "ChatGPT",
    scriptPath: "chatgptscraper.js",
    call: "chatgptscraper.scrape();",
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

const loadConfig = async () => {
  const response = await fetch("config.json", { cache: "no-store" });
  if (!response.ok) throw new Error(`Unable to load config (${response.status})`);
  return response.json();
};

const loadScraper = async (scraper) => {
  const response = await fetch(scraper.scriptPath, { cache: "no-store" });
  if (!response.ok) throw new Error(`Unable to load ${scraper.label} bookmarklet (${response.status})`);
  const code = await response.text();
  return `javascript:${encodeURIComponent(`${code};${scraper.call}`)}`;
};

const loadBookmarklet = async () => {
  setLoading(true);
  updateStatus("Loading bookmarklets...");
  showError("");
  try {
    try {
      const config = await loadConfig();
      Object.entries(config?.scrapers || {}).forEach(([key, value]) => {
        if (scrapers[key] && value?.scriptPath) scrapers[key].scriptPath = value.scriptPath;
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load config";
      bootstrapAlert({ title: "Config warning", body: message, color: "warning" });
    }

    await Promise.all(
      bookmarkletButtons.map(async (button) => {
        const scraper = scrapers[button.dataset.scraper];
        if (!scraper) return;
        button.href = await loadScraper(scraper);
      }),
    );
    updateStatus("Drag a button to your bookmarks bar, then click it on the matching AI conversation.");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    updateStatus("Unable to load bookmarklets.");
    showError(message);
    bootstrapAlert({ title: "Load error", body: message, color: "danger" });
  } finally {
    setLoading(false);
  }
};

loadBookmarklet();
