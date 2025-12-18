// @ts-check
import { html, render } from "https://cdn.jsdelivr.net/npm/lit-html@3/+esm";
import { bootstrapAlert } from "https://cdn.jsdelivr.net/npm/bootstrap-alert@1";
import { openrouterHelp } from "../common/aiconfig.js";
import { copyText } from "../common/clipboard-utils.js";
import saveform from "https://cdn.jsdelivr.net/npm/saveform@1.2";
import { loadConfigJson, readParam } from "../common/demo.js";

const DEFAULT_BASE_URLS = ["https://openrouter.ai/api/v1", "https://aipipe.org/openrouter/v1"];
const DEFAULT_MODEL = "gpt-5-nano";
const MODEL_OPTIONS = [
  { value: "gpt-5-nano", label: "gpt-5-nano (fast)" },
  { value: "gpt-5-mini", label: "gpt-5-mini" },
  { value: "gpt-5", label: "gpt-5" },
  { value: "gpt-4.1-nano", label: "gpt-4.1-nano" },
  { value: "gpt-4.1-mini", label: "gpt-4.1-mini" },
  { value: "gpt-4.1", label: "gpt-4.1" },
];
const RESPONSE_FORMAT = {
  type: "json_schema",
  json_schema: {
    name: "playlist_songs",
    strict: true,
    schema: {
      type: "object",
      properties: {
        songs: {
          type: "array",
          items: { type: "string" },
          minItems: 20,
          maxItems: 20,
        },
      },
      required: ["songs"],
      additionalProperties: false,
    },
  },
};
const SYSTEM_PROMPT = `You are a music curator who replies with structured JSON playlists.
Every song must follow the exact format "Title - Album - Artist (Year)".
Only suggest songs that have not been mentioned by the listener.
Always respond with a JSON object {"songs": ["Title - Album - Artist (Year)", ...]} containing twenty entries.`;

/** @typedef {"up" | "down" | null} Rating */
/** @typedef {{ title: string, rating: Rating }} PlaylistItem */

const ui = {
  form: /** @type {HTMLFormElement} */ (document.getElementById("preferences-form")),
  preferences: /** @type {HTMLTextAreaElement} */ (document.getElementById("song-preferences")),
  generateBtn: /** @type {HTMLButtonElement} */ (document.getElementById("generate-btn")),
  refineBtn: /** @type {HTMLButtonElement} */ (document.getElementById("refine-btn")),
  copyBtn: /** @type {HTMLButtonElement} */ (document.getElementById("copy-btn")),
  configBtn: /** @type {HTMLButtonElement} */ (document.getElementById("openai-config-btn")),
  modelSelect: /** @type {HTMLSelectElement} */ (document.getElementById("model-select")),
  statusText: document.getElementById("status-text"),
  spinner: document.getElementById("loading-indicator"),
  playlist: document.getElementById("playlist"),
  alertContainer: document.getElementById("alert-container"),
  sampleContainer: document.getElementById("sampleContainer"),
};

const defaultCopyLabel = ui.copyBtn.innerHTML;
saveform("#preferences-form", { exclude: '[type="file"]' });

const state = {
  playlist: /** @type {PlaylistItem[]} */ ([]),
  preferences: "",
};

const loadingTemplate = (message) =>
  html`<div class="list-group-item text-center text-secondary py-4">${message}</div>`;

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
const parseSongs = (raw) =>
  JSON.parse(raw)
    .songs.map((item) => String(item).trim())
    .filter(Boolean);

/**
 * @param {boolean} withFeedback
 */
function buildUserPrompt() {
  const liked = state.playlist.filter((item) => item.rating === "up");
  const disliked = state.playlist.filter((item) => item.rating === "down");
  const unrated = state.playlist.filter((item) => item.rating === null);

  const formatBlock = (items) => (items.length ? items.map((item) => `- ${item.title}`).join("\n") : "- (none)");

  return `Preferences:\n${state.preferences || "- (none)"}\n\nSongs the listener liked:\n${formatBlock(liked)}\n\nSongs the listener disliked:\n${formatBlock(disliked)}\n\nSongs the listener did not rate:\n${formatBlock(unrated)}\n\nRecommend 20 additional songs that fit the preferences, lean toward the liked selections, and avoid the disliked ones. Only include new songs that are not listed above. Respond with the required JSON object.`;
}

/**
 * @param {string[]} songs
 */
function applyPlaylist(songs) {
  const normalize = (title) => title.trim().toLowerCase();
  const seen = new Set(state.playlist.map((item) => normalize(item.title)));
  const additions = [];

  for (const title of songs) {
    const trimmed = title.trim();
    if (!trimmed) continue;
    const key = normalize(trimmed);
    if (seen.has(key)) continue;
    additions.push({ title: trimmed, rating: null });
    seen.add(key);
  }

  if (!additions.length && state.playlist.length) {
    renderPlaylist();
    return;
  }

  state.playlist = [...additions, ...state.playlist];
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
  const query = encodeURIComponent(item.title);
  window.open(`https://www.youtube.com/results?search_query=${query}`, "_blank", "noopener");
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

  const openaiConfig =
    typeof window.__testOpenAIConfig === "function"
      ? window.__testOpenAIConfig
      : (await import("https://cdn.jsdelivr.net/npm/bootstrap-llm-provider@1")).openaiConfig;
  const credentials = await openaiConfig({ defaultBaseUrls: DEFAULT_BASE_URLS, help: openrouterHelp });
  if (!credentials?.apiKey) {
    setLoading(false, "");
    return;
  }

  const { apiKey, baseUrl } = credentials;
  const endpoint = `${baseUrl.replace(/\/$/, "")}/chat/completions`;
  const selectedModel = MODEL_OPTIONS.some((option) => option.value === ui.modelSelect?.value)
    ? ui.modelSelect.value
    : DEFAULT_MODEL;
  const body = {
    model: selectedModel,
    response_format: RESPONSE_FORMAT,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserPrompt() },
    ],
  };

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error("The playlist request failed. Please try again.");
    const payload = await response.json();
    const raw = payload?.choices?.[0]?.message?.content;
    if (!raw) throw new Error("The model did not return any songs. Try adjusting your prompt or model.");
    const songs = parseSongs(raw);
    applyPlaylist(songs);
  } catch (error) {
    const friendlyMessage =
      error instanceof SyntaxError
        ? "We couldn't parse the playlist response. Please try again."
        : error instanceof Error
          ? error.message
          : String(error);
    bootstrapAlert({
      container: ui.alertContainer ?? undefined,
      title: "Playlist error",
      body: friendlyMessage,
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

if (ui.modelSelect)
  render(
    html`${MODEL_OPTIONS.map((option) => html`<option value="${option.value}">${option.label}</option>`)}`,
    ui.modelSelect,
  );
if (ui.modelSelect) ui.modelSelect.value = DEFAULT_MODEL;

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
  const openaiConfig =
    typeof window.__testOpenAIConfig === "function"
      ? window.__testOpenAIConfig
      : (await import("https://cdn.jsdelivr.net/npm/bootstrap-llm-provider@1")).openaiConfig;
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

function renderSamples(presets) {
  if (!ui.sampleContainer) return;
  if (!Array.isArray(presets) || !presets.length) {
    ui.sampleContainer.replaceChildren();
    return;
  }
  const label = document.createElement("span");
  label.className = "text-secondary small fw-semibold me-1";
  label.textContent = "Examples";
  ui.sampleContainer.replaceChildren(
    label,
    ...presets.map((preset) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "btn btn-sm btn-outline-secondary";
      button.textContent = preset.name || preset.id;
      button.addEventListener("click", () => {
        ui.preferences.value = preset.vibe || "";
        if (preset.model && MODEL_OPTIONS.some((option) => option.value === preset.model))
          ui.modelSelect.value = preset.model;
        ui.preferences.dispatchEvent(new Event("input", { bubbles: true }));
      });
      return button;
    }),
  );
}

async function init() {
  try {
    const config = await loadConfigJson("config.json");
    renderSamples(config.presets);
    if (!ui.preferences.value.trim() && Array.isArray(config.presets) && config.presets.length) {
      ui.preferences.value = config.presets[0].vibe || "";
      ui.preferences.dispatchEvent(new Event("input", { bubbles: true }));
    }
  } catch {
    renderSamples([]);
  }

  const vibe = readParam("vibe", { fallback: "", trim: false });
  if (vibe) {
    ui.preferences.value = vibe;
    ui.preferences.dispatchEvent(new Event("input", { bubbles: true }));
  }
  const model = readParam("model", { fallback: "" });
  if (model && MODEL_OPTIONS.some((option) => option.value === model)) ui.modelSelect.value = model;
}

void init();
