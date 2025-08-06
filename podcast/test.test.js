import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest";
import { loadFrom } from "../common/testutils.js";

const originalFetch = globalThis.fetch;

let window, document, contentInput, generateScriptBtn, alertContainer, generateAudioBtn, openaiConfigBtn, podcastScript;
let consoleErrorSpy;

describe("Podcast tests", () => {
  beforeAll(() => vi.useFakeTimers());
  afterAll(() => vi.useRealTimers());

  beforeEach(async () => {
    globalThis.openaiReturn = { apiKey: "", baseUrl: "https://base" };
    globalThis.openaiCalls = [];
    globalThis.fetch = (url) => {
      if (typeof url === "string" && url.includes("bootstrap-llm-provider@1"))
        return Promise.resolve(
          new Response(
            "export async function openaiConfig(opts){globalThis.openaiCalls.push(opts);return globalThis.openaiReturn}",
            { headers: { "Content-Type": "application/javascript" } },
          ),
        );
      return originalFetch(url);
    };
    ({ window, document } = await loadFrom(import.meta.dirname));
    window.setTimeout = setTimeout;
    window.clearTimeout = clearTimeout;
    window.setInterval = setInterval;
    window.clearInterval = clearInterval;
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    contentInput = document.getElementById("contentInput");
    generateScriptBtn = document.getElementById("generateScriptBtn");
    alertContainer = document.getElementById("alertContainer");
    generateAudioBtn = document.getElementById("generateAudioBtn");
    openaiConfigBtn = document.getElementById("openai-config-btn");
    podcastScript = document.getElementById("podcastScript");
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    consoleErrorSpy.mockRestore();
  });

  it("shows error when content missing", async () => {
    globalThis.openaiReturn = { apiKey: "key", baseUrl: "url" };
    generateScriptBtn.click();
    expect(alertContainer.textContent).toContain("Please enter some content");
  });

  it("shows error when API key missing", async () => {
    contentInput.value = "Topic";
    globalThis.openaiReturn = { apiKey: "", baseUrl: "url" };
    generateScriptBtn.click();
    expect(alertContainer.textContent).toContain("Configure your OpenAI API key first");
  });

  it("shows error when generating audio without script", () => {
    generateAudioBtn.click();
    expect(alertContainer.textContent).toContain("Please generate a podcast script first");
  });

  it("invokes openaiConfig from config button", () => {
    openaiConfigBtn.click();
    expect(globalThis.openaiCalls.length).toBe(1);
    expect(globalThis.openaiCalls[0].show).toBe(true);
  });
});
