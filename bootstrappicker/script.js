// @ts-check
import { html, render } from "https://cdn.jsdelivr.net/npm/lit-html@3/+esm";

const container = /** @type {HTMLElement} */ (document.getElementById("bookmarklet-root"));
const previewBtn = /** @type {HTMLButtonElement | null} */ (document.getElementById("launch-preview"));

/** @typedef {{ status: "loading" | "ready" | "error", href: string, message: string }} ViewState */

/** @type {ViewState} */
const state = { status: "loading", href: "", message: "" };

const renderView = () => {
  if (state.status === "loading")
    return html`<div class="text-center" data-status="loading"><div class="spinner-border" role="status"></div></div>`;
  if (state.status === "error") return html`<div class="alert alert-danger mb-0" role="alert">${state.message}</div>`;
  return html`
    <div class="d-flex flex-column flex-md-row align-items-md-center gap-3">
      <div>
        <a id="bookmarklet" class="btn btn-primary btn-lg shadow-sm" href=${state.href} draggable="true">
          🎨 Theme Picker
        </a>
      </div>
      <p class="mb-0 text-secondary">Drag the button to your bookmarks bar, then click it on any page.</p>
    </div>
  `;
};

const update = () => {
  render(renderView(), container);
};

update();

async function loadBookmarklet() {
  try {
    const response = await fetch("bootstrappicker.min.js");
    if (!response.ok) throw new Error("Failed to fetch bookmarklet script");
    const code = (await response.text()).trim();
    const href = "javascript:" + encodeURIComponent(`${code};bootstrapThemePicker.open();`);
    state.status = "ready";
    state.href = href;
    update();
  } catch (error) {
    console.error("bootstrap-theme-picker: bookmarklet load failed", error);
    state.status = "error";
    state.message = "Unable to load the bookmarklet. Refresh the page or try again later.";
    update();
  }
}

loadBookmarklet();

if (previewBtn)
  previewBtn.addEventListener("click", () => {
    window.bootstrapThemePicker?.open();
  });
