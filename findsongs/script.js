// @ts-check
import { html, render } from "https://cdn.jsdelivr.net/npm/lit-html@3/+esm";
import { bootstrapAlert } from "https://cdn.jsdelivr.net/npm/bootstrap-alert@1";
import { openrouterHelp } from "../common/aiconfig.js";
import { copyText } from "../common/clipboard-utils.js";

const DEFAULT_BASE_URLS = ["https://openrouter.ai/api/v1", "https://aipipe.org/openrouter/v1"];
const MODEL = "gpt-4o-mini";
const SYSTEM_PROMPT = `You are a music curator who builds themed playlists based on a short brief.
Return only a JSON array of 10 diverse song titles with artist names, formatted as "Song Title — Artist".
Do not add numbering, commentary, or extra fields.`;

/** @typedef {"up" | "down" | null} Rating */
/** @typedef {{ title: string, rating: Rating }} PlaylistItem */

const ui = {
  form: /** @type {HTMLFormElement} */ (document.getElementById("preferences-form")),
  preferences: /** @type {HTMLTextAreaElement} */ (document.getElementById("song-preferences")),
  generateBtn: /** @type {HTMLButtonElement} */ (document.getElementById("generate-btn")),
  refineBtn: /** @type {HTMLButtonElement} */ (document.getElementById("refine-btn")),
  copyBtn: /** @type {HTMLButtonElement} */ (document.getElementById("copy-btn")),
  configBtn: /** @type {HTMLButtonElement} */ (document.getElementById("openai-config-btn")),
  statusText: document.getElementById("status-text"),
  spinner: document.getElementById("loading-indicator"),
  playlist: document.getElementById("playlist"),
  alertContainer: document.getElementById("alert-container"),
};

const defaultCopyLabel = ui.copyBtn.innerHTML;

const state = {
  playlist: /** @type {PlaylistItem[]} */ ([]),
  preferences: "",
};

let openaiConfigLoader;

async function loadOpenAIConfig() {
  if (typeof window.__testOpenAIConfig === "function") return window.__testOpenAIConfig;
  if (!openaiConfigLoader)
    openaiConfigLoader = import("https://cdn.jsdelivr.net/npm/bootstrap-llm-provider@1").then(
      (mod) => mod.openaiConfig,
    );
  return openaiConfigLoader;
}

const loadingTemplate = (message) =>
  html`<div class="list-group-item text-center text-secondary py-4">${message}</div>`;

/**
 * @returns {Promise<{ apiKey: string; baseUrl: string } | null>}
 */
async function requestCredentials() {
  const openaiConfig = await loadOpenAIConfig();
  const result = await openaiConfig({ defaultBaseUrls: DEFAULT_BASE_URLS, help: openrouterHelp });
  if (!result?.apiKey) return null;
  return result;
}

/**
 * @param {boolean} busy
 * @param {string} message
 */
function setLoading(busy, message) {
  if (busy) {
    ui.spinner?.classList.remove("d-none");
    ui.statusText.textContent = message;
    render(loadingTemplate(message), ui.playlist);
  } else {
    ui.spinner?.classList.add("d-none");
    ui.statusText.textContent = state.playlist.length
      ? "Tap a song to open it on YouTube."
      : "Enter your preferences to begin.";
  }
  ui.generateBtn.disabled = busy || !ui.preferences.value.trim();
  ui.refineBtn.disabled = busy || !state.playlist.length;
  ui.copyBtn.disabled = busy || !state.playlist.length;
}

/**
 * @param {string} raw
 * @returns {string[]}
 */
function parsePlaylist(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map((item) => String(item).trim()).filter(Boolean);
  } catch {
    // Fallback to line splitting
  }
  return raw
    .split(/\r?\n|,/) // handle common separators
    .map((line) => line.replace(/^[-\d.]\s*/, "").trim())
    .filter(Boolean);
}

/**
 * @param {boolean} withFeedback
 */
function buildUserPrompt(withFeedback) {
  const prefs = state.preferences;
  const liked = state.playlist.filter((item) => item.rating === "up");
  const disliked = state.playlist.filter((item) => item.rating === "down");
  const previous = state.playlist.map(
    (item, index) => `${index + 1}. ${item.title}${item.rating ? ` (${item.rating})` : ""}`,
  );

  const base = `Preferences:\n${prefs}\n\n`;
  if (!withFeedback || !state.playlist.length)
    return `${base}Return a JSON array as specified. Ensure a cohesive flow from track to track.`;

  const likedBlock = liked.length ? liked.map((item) => `- ${item.title}`).join("\n") : "- (none)";
  const dislikedBlock = disliked.length ? disliked.map((item) => `- ${item.title}`).join("\n") : "- (none)";
  const previousBlock = previous.length ? previous.join("\n") : "- (none)";

  return `${base}Songs the listener loved:\n${likedBlock}\n\nSongs the listener disliked:\n${dislikedBlock}\n\nPrevious playlist:\n${previousBlock}\n\nGenerate a refreshed JSON array. Keep loved songs exactly as provided. Avoid disliked songs. Fill the remaining slots with complementary picks that match the brief.`;
}

/**
 * @param {string[]} songs
 */
function applyPlaylist(songs) {
  const seen = new Set();
  const normalize = (title) => title.toLowerCase();
  const next = [];

  for (const item of state.playlist) {
    if (item.rating && !seen.has(normalize(item.title))) {
      seen.add(normalize(item.title));
      next.push({ title: item.title, rating: item.rating });
    }
  }

  for (const title of songs) {
    const trimmed = title.trim();
    if (!trimmed) continue;
    const key = normalize(trimmed);
    if (seen.has(key)) continue;
    const previous = state.playlist.find((item) => normalize(item.title) === key);
    next.push({ title: trimmed, rating: previous?.rating ?? null });
    seen.add(key);
  }

  state.playlist = next;
  renderPlaylist();
}

function renderPlaylist() {
  ui.copyBtn.innerHTML = defaultCopyLabel;

  if (!state.playlist.length) {
    render(html`<div class="list-group-item text-center text-secondary py-4">No playlist yet.</div>`, ui.playlist);
    ui.copyBtn.disabled = true;
    ui.refineBtn.disabled = true;
    return;
  }

  render(
    html`${state.playlist.map(
      (item, index) =>
        html`<div class="list-group-item d-flex align-items-center gap-2 playlist-item">
          <button
            type="button"
            class="btn btn-link flex-grow-1 text-start playlist-title"
            data-action="open"
            data-index="${index}"
          >
            ${item.title}
          </button>
          <div class="btn-group btn-group-sm" role="group">
            <button
              type="button"
              class="btn btn-outline-success rating-btn ${item.rating === "up" ? "active" : ""}"
              data-action="up"
              data-index="${index}"
            >
              <i class="bi ${item.rating === "up" ? "bi-hand-thumbs-up-fill" : "bi-hand-thumbs-up"}"></i>
            </button>
            <button
              type="button"
              class="btn btn-outline-danger rating-btn ${item.rating === "down" ? "active" : ""}"
              data-action="down"
              data-index="${index}"
            >
              <i class="bi ${item.rating === "down" ? "bi-hand-thumbs-down-fill" : "bi-hand-thumbs-down"}"></i>
            </button>
          </div>
        </div>`,
    )}`,
    ui.playlist,
  );

  ui.copyBtn.disabled = false;
  ui.refineBtn.disabled = false;
}

/**
 * @param {number} index
 * @param {Rating} rating
 */
function toggleRating(index, rating) {
  const item = state.playlist[index];
  if (!item) return;
  const nextRating = item.rating === rating ? null : rating;
  state.playlist = state.playlist.map((entry, idx) =>
    idx === index ? { title: entry.title, rating: nextRating } : entry,
  );
  renderPlaylist();
}

/**
 * @param {PlaylistItem} item
 */
function openOnYouTube(item) {
  const query = encodeURIComponent(item.title.replace(/["']/g, ""));
  window.open(`https://www.youtube.com/results?search_query=${query}`, "_blank", "noopener");
}

/**
 * @returns {AsyncGenerator<{ content?: string; error?: Error }>}
 */
async function* callLLM(url, init) {
  if (typeof window.__testAsyncLLM === "function") {
    for await (const chunk of window.__testAsyncLLM(url, init)) yield chunk;
    return;
  }
  const { asyncLLM } = await import("https://cdn.jsdelivr.net/npm/asyncllm@2");
  for await (const chunk of asyncLLM(url, init)) yield chunk;
}

/**
 * @param {boolean} withFeedback
 */
async function generatePlaylist(withFeedback) {
  const preferences = ui.preferences.value.trim();
  if (!preferences) return;
  state.preferences = preferences;

  const loadingMessage = withFeedback ? "Refreshing playlist…" : "Generating playlist…";
  setLoading(true, loadingMessage);

  const credentials = await requestCredentials();
  if (!credentials) {
    setLoading(false, "");
    return;
  }

  const { apiKey, baseUrl } = credentials;
  const endpoint = `${baseUrl.replace(/\/$/, "")}/chat/completions`;
  const body = {
    model: MODEL,
    stream: true,
    temperature: withFeedback ? 0.4 : 0.6,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserPrompt(withFeedback) },
    ],
  };

  let raw = "";
  try {
    for await (const { content, error } of callLLM(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    })) {
      if (error) throw error;
      if (content) raw = content;
    }
    const songs = parsePlaylist(raw);
    if (!songs.length) throw new Error("The model did not return any songs. Try adjusting your prompt or model.");
    applyPlaylist(songs);
  } catch (error) {
    bootstrapAlert({
      container: ui.alertContainer ?? undefined,
      title: "Playlist error",
      body: error instanceof Error ? error.message : String(error),
      color: "danger",
      replace: true,
    });
    if (!state.playlist.length) render(loadingTemplate("No playlist yet."), ui.playlist);
  } finally {
    setLoading(false, "");
  }
}

ui.form.addEventListener("submit", (event) => {
  event.preventDefault();
  generatePlaylist(false);
});

ui.refineBtn.addEventListener("click", () => generatePlaylist(true));

ui.preferences.addEventListener("input", () => {
  ui.generateBtn.disabled = !ui.preferences.value.trim();
});

ui.copyBtn.addEventListener("click", async () => {
  if (!state.playlist.length) return;
  const joined = state.playlist.map((item) => item.title).join("\n");
  const copied = await copyText(joined);
  if (!copied) {
    bootstrapAlert({
      container: ui.alertContainer ?? undefined,
      title: "Copy failed",
      body: "Unable to copy the playlist. Please try again.",
      color: "danger",
      replace: true,
    });
    return;
  }
  ui.copyBtn.innerHTML = '<i class="bi bi-check-circle me-1"></i>Copied!';
});

ui.configBtn.addEventListener("click", async () => {
  const openaiConfig = await loadOpenAIConfig();
  await openaiConfig({ defaultBaseUrls: DEFAULT_BASE_URLS, show: true, help: openrouterHelp });
});

ui.playlist.addEventListener("click", (event) => {
  const target = event.target.closest("[data-action]");
  if (!(target instanceof HTMLElement)) return;
  const index = Number.parseInt(target.dataset.index ?? "", 10);
  if (Number.isNaN(index)) return;
  const item = state.playlist[index];
  if (!item) return;

  const action = target.dataset.action;
  if (action === "open") openOnYouTube(item);
  else if (action === "up") toggleRating(index, "up");
  else if (action === "down") toggleRating(index, "down");
});

render(loadingTemplate("No playlist yet."), ui.playlist);
