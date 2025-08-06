import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest";
import { loadFrom } from "../common/testutils.js";

const originalFetch = globalThis.fetch;

let window, document, form, promptInput, urlInput, uploadInput, preview, samples, openaiConfigBtn;
let consoleErrorSpy;

describe("Image Generator tests", () => {
  beforeAll(() => vi.useFakeTimers());
  afterAll(() => vi.useRealTimers());

  beforeEach(async () => {
    globalThis.openaiReturn = { apiKey: "", baseUrl: "url" };
    globalThis.openaiCalls = [];
    globalThis.fetch = (url, opts) => {
      if (typeof url === "string" && url.includes("bootstrap-llm-provider@1"))
        return Promise.resolve(
          new Response(
            "export async function openaiConfig(opts){globalThis.openaiCalls.push(opts);return globalThis.openaiReturn}",
            { headers: { "Content-Type": "application/javascript" } },
          ),
        );
      return originalFetch(url, opts);
    };
    ({ window, document } = await loadFrom(import.meta.dirname));
    window.setTimeout = setTimeout;
    window.clearTimeout = clearTimeout;
    window.setInterval = setInterval;
    window.clearInterval = clearInterval;
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    form = document.getElementById("chat-form");
    promptInput = document.getElementById("prompt-input");
    urlInput = document.getElementById("image-url");
    uploadInput = document.getElementById("upload-input");
    preview = document.getElementById("preview-image");
    samples = document.getElementById("samples");
    openaiConfigBtn = document.getElementById("openai-config-btn");
    await vi.runAllTimers();
    await Promise.resolve();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    consoleErrorSpy.mockRestore();
  });

  it("shows warning when prompt missing", () => {
    form.dispatchEvent(new window.Event("submit", { bubbles: true }));
    expect(document.querySelector(".toast-body").textContent).toContain("Describe the image");
  });

  it("updates preview when URL is entered", () => {
    urlInput.value = "https://example.com/a.png";
    urlInput.dispatchEvent(new window.Event("input", { bubbles: true }));
    expect(preview.src).toBe("https://example.com/a.png");
    expect(preview.classList.contains("d-none")).toBe(false);
    expect(uploadInput.value).toBe("");
  });

  it("updates preview when file uploaded", () => {
    const file = new window.File(["hi"], "a.png", { type: "image/png" });
    Object.defineProperty(uploadInput, "files", { value: [file] });
    uploadInput.dispatchEvent(new window.Event("change", { bubbles: true }));
    expect(preview.classList.contains("d-none")).toBe(false);
    expect(urlInput.value).toBe("");
    expect(preview.src.startsWith("blob:")).toBe(true);
  });

  it("selects sample and updates prompt", () => {
    const sample = samples.querySelector(".sample");
    sample.click();
    expect(promptInput.value).toBe(sample.dataset.prompt);
    expect(urlInput.value).toBe(sample.dataset.url);
    expect(preview.src).toBe(sample.dataset.url);
    expect(preview.classList.contains("d-none")).toBe(false);
    expect(sample.querySelector(".card").classList.contains("border-primary")).toBe(true);
  });
});
