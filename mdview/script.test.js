import { beforeEach, describe, expect, it, vi } from "vitest";
import { Browser } from "happy-dom";

vi.mock("https://cdn.jsdelivr.net/npm/bootstrap-alert@1", () => ({
  bootstrapAlert: vi.fn(),
}));

describe("mdview landing page loader", () => {
  const browser = new Browser({ console });
  let loadBookmarklet;
  let bootstrapAlert;
  let bookmarkletButton;
  let statusText;
  let spinner;
  let errorText;
  let window;
  let document;

  beforeEach(async () => {
    vi.resetModules();
    const page = browser.newPage();
    window = page.mainFrame.window;
    document = page.mainFrame.document;
    document.body.innerHTML = `
      <a id="bookmarklet"></a>
      <span id="bookmarklet-status-text"></span>
      <span id="bookmarklet-spinner" class="d-none"></span>
      <p id="bookmarklet-error"></p>
    `;
    globalThis.window = window;
    globalThis.document = document;
    globalThis.__mdviewDisableAutoload = true;
    window.fetch = vi.fn();
    globalThis.fetch = window.fetch;
    ({ bootstrapAlert } = await import("https://cdn.jsdelivr.net/npm/bootstrap-alert@1"));
    ({ loadBookmarklet } = await import("./script.js"));
    bookmarkletButton = document.getElementById("bookmarklet");
    statusText = document.getElementById("bookmarklet-status-text");
    spinner = document.getElementById("bookmarklet-spinner");
    errorText = document.getElementById("bookmarklet-error");
    bootstrapAlert.mockClear();
  });

  it("loads bookmarklet code and updates the drag link", async () => {
    window.fetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve("window.mdview={showPopup(){}}"),
    });

    await loadBookmarklet();

    expect(window.fetch).toHaveBeenCalledWith("bookmarklet.js", { cache: "no-store" });
    expect(bookmarkletButton.href).toContain("javascript:");
    expect(decodeURIComponent(bookmarkletButton.href.replace("javascript:", ""))).toContain("mdview.showPopup()");
    expect(statusText.textContent).toContain("Drag the button");
    expect(spinner.classList.contains("d-none")).toBe(true);
    expect(errorText.textContent).toBe("");
  });

  it("renders an error state when loading fails", async () => {
    window.fetch.mockResolvedValue({
      ok: false,
      status: 503,
    });

    await loadBookmarklet();

    expect(statusText.textContent).toBe("Unable to load bookmarklet.");
    expect(errorText.textContent).toContain("Unable to load bookmarklet (503)");
    expect(bootstrapAlert).toHaveBeenCalledWith({
      title: "Load error",
      body: "Unable to load bookmarklet (503)",
      color: "danger",
    });
    expect(spinner.classList.contains("d-none")).toBe(true);
  });
});
