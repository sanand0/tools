import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { loadFrom } from "../common/testutils.js";

const flush = async () => {
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
};

const expectEventually = async (assertion) => {
  let lastError;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      assertion();
      return;
    } catch (error) {
      lastError = error;
      await flush();
    }
  }
  throw lastError;
};

describe("findsongs playlist", () => {
  let window, document, preferencesInput, generateBtn, refineBtn, playlistContainer, copyBtn, modelSelect;

  beforeEach(async () => {
    ({ window, document } = await loadFrom(import.meta.dirname));
    window.__testOpenAIConfig = () => Promise.resolve({ apiKey: "test-key", baseUrl: "https://example.com/v1" });
    preferencesInput = document.getElementById("song-preferences");
    generateBtn = document.getElementById("generate-btn");
    refineBtn = document.getElementById("refine-btn");
    playlistContainer = document.getElementById("playlist");
    copyBtn = document.getElementById("copy-btn");
    modelSelect = document.getElementById("model-select");
    window.__testRequests = [];
    window.__setLLM = (fn) => {
      window.__testAsyncLLM = fn;
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
    if (window?.__setLLM) delete window.__setLLM;
    if (window?.__testAsyncLLM) delete window.__testAsyncLLM;
    if (window?.__testOpenAIConfig) delete window.__testOpenAIConfig;
  });

  it("generates playlist items from LLM output", async () => {
    const calls = [];
    window.__setLLM(async function* (url, init) {
      calls.push({ url, init });
      await Promise.resolve();
      yield { content: '{"songs":["Song Alpha — Artist","Song Beta — Artist"]}' };
    });

    preferencesInput.value = "Upbeat pop songs for running.";
    preferencesInput.dispatchEvent(new window.Event("input", { bubbles: true }));
    generateBtn.click();

    expect(generateBtn.disabled).toBe(true);
    expect(refineBtn.disabled).toBe(true);
    expect(playlistContainer.textContent.trim()).toBe("Generating playlist…");

    await flush();
    await flush();

    expect(calls).toHaveLength(1);
    const body = JSON.parse(calls[0].init.body);
    expect(body.model).toBe("gpt-5-nano");
    expect(body.response_format).toMatchObject({ type: "json_schema" });
    expect(body.response_format.json_schema.schema.required).toContain("songs");
    await expectEventually(() => {
      expect(playlistContainer.querySelectorAll(".playlist-item").length).toBe(2);
    });
    const items = playlistContainer.querySelectorAll(".playlist-item");
    expect(items[0].querySelector(".playlist-title").textContent).toContain("Song Alpha — Artist");
    expect(generateBtn.disabled).toBe(false);
    expect(refineBtn.disabled).toBe(false);
  });

  it("retains rated songs after refining the playlist", async () => {
    const sequence = [
      '{"songs":["Song A — Artist","Song B — Artist","Song C — Artist"]}',
      '{"songs":["Song D — Artist","Song E — Artist","Song F — Artist"]}',
    ];
    let callIndex = 0;
    const bodies = [];
    window.__setLLM(async function* (_url, init) {
      bodies.push(JSON.parse(init.body));
      yield { content: sequence[callIndex++] };
    });

    preferencesInput.value = "Indie folk with storytelling lyrics.";
    preferencesInput.dispatchEvent(new window.Event("input", { bubbles: true }));
    modelSelect.value = "gpt-5";
    modelSelect.dispatchEvent(new window.Event("change", { bubbles: true }));
    generateBtn.click();
    await expectEventually(() => {
      expect(playlistContainer.querySelectorAll(".playlist-item").length).toBe(3);
    });
    const firstLikeBtn = playlistContainer.querySelector('.rating-btn[data-action="up"]');
    const secondDislikeBtn = playlistContainer.querySelectorAll('.rating-btn[data-action="down"]')[1];
    firstLikeBtn.click();
    secondDislikeBtn.click();

    refineBtn.click();
    await expectEventually(() => {
      expect(bodies).toHaveLength(2);
      expect(bodies[0].model).toBe("gpt-5");
      expect(bodies[1].model).toBe("gpt-5");
      expect(bodies[0].response_format.json_schema.schema.required).toContain("songs");
      expect(JSON.stringify(bodies[1].messages)).toContain("Song A — Artist");
      expect(JSON.stringify(bodies[1].messages)).toContain("Song B — Artist");
      const titleButtons = Array.from(playlistContainer.querySelectorAll(".playlist-title"));
      expect(titleButtons.length).toBeGreaterThan(0);
      expect(titleButtons[0].textContent.trim()).toBe("Song A — Artist");
    });
    expect(playlistContainer.querySelector('.rating-btn[data-action="up"]').classList).toContain("active");
  });

  it("copies the playlist to clipboard", async () => {
    window.__setLLM(async function* () {
      yield { content: '{"songs":["Song One","Song Two"]}' };
    });
    preferencesInput.value = "Acoustic covers.";
    preferencesInput.dispatchEvent(new window.Event("input", { bubbles: true }));
    generateBtn.click();
    await expectEventually(() => {
      expect(playlistContainer.querySelectorAll(".playlist-item").length).toBe(2);
    });

    const writeText = vi.spyOn(window.navigator.clipboard, "writeText").mockResolvedValue();
    copyBtn.click();
    await expectEventually(() => {
      expect(writeText).toHaveBeenCalledWith("Song One\nSong Two");
    });
    await expectEventually(() => {
      expect(copyBtn.textContent.trim()).toBe("Copied!");
    });
  });
});
