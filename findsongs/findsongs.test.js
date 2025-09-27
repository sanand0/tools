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
    window.fetch = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
    if (window?.__testOpenAIConfig) delete window.__testOpenAIConfig;
    if (window?.fetch) delete window.fetch;
  });

  it("generates playlist items from LLM output", async () => {
    const requests = [];
    window.fetch.mockImplementation(async (url, init) => {
      requests.push({ url, init });
      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{"songs":["Song Alpha — Artist","Song Beta — Artist"]}' } }],
        }),
      };
    });

    preferencesInput.value = "Upbeat pop songs for running.";
    preferencesInput.dispatchEvent(new window.Event("input", { bubbles: true }));
    generateBtn.click();

    expect(generateBtn.disabled).toBe(true);
    expect(refineBtn.disabled).toBe(true);
    expect(playlistContainer.textContent.trim()).toBe("Generating playlist…");

    await expectEventually(() => {
      expect(window.fetch).toHaveBeenCalledTimes(1);
    });
    const body = JSON.parse(requests[0].init.body);
    expect(body.model).toBe("gpt-5-nano");
    expect("temperature" in body).toBe(false);
    expect(body.response_format).toMatchObject({ type: "json_schema" });
    expect(body.response_format.json_schema.schema.required).toContain("songs");
    expect(body.messages[0].content).toContain("Title - Album - Artist (Year)");
    expect(body.messages[1].content).toContain("Preferences:\nUpbeat pop songs for running.");
    expect(body.messages[1].content).toContain("Songs the listener liked:\n- (none)");
    expect(body.messages[1].content).toContain("Songs the listener did not rate:\n- (none)");
    expect(body.messages[1].content).toContain("20 additional songs");
    await expectEventually(() => {
      expect(playlistContainer.querySelectorAll(".playlist-item").length).toBe(2);
    });
    const items = playlistContainer.querySelectorAll(".playlist-item");
    expect(items[0].querySelector(".playlist-title").textContent).toContain("Song Alpha — Artist");
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => {});
    items[0].querySelector(".playlist-title").click();
    expect(openSpy).toHaveBeenCalledWith(
      "https://www.google.com/search?btnI=1&pws=0&q=site%3Ayoutube.com%2Fwatch%20Song%20Alpha%20%E2%80%94%20Artist",
      "_blank",
      "noopener",
    );
    openSpy.mockRestore();
    expect(generateBtn.disabled).toBe(false);
    expect(refineBtn.disabled).toBe(false);
  });

  it("retains rated songs after refining the playlist", async () => {
    const mockReplies = [
      {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{"songs":["Song A — Artist","Song B — Artist","Song C — Artist"]}' } }],
        }),
      },
      {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{"songs":["Song D — Artist","Song E — Artist","Song F — Artist"]}' } }],
        }),
      },
    ];
    const bodies = [];
    window.fetch.mockImplementation(async (_url, init) => {
      bodies.push(JSON.parse(init.body));
      return mockReplies[bodies.length - 1];
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
      expect(window.fetch).toHaveBeenCalledTimes(2);
      expect(bodies[0].model).toBe("gpt-5");
      expect(bodies[1].model).toBe("gpt-5");
      expect(bodies[0].response_format.json_schema.schema.required).toContain("songs");
      const [, userMessage] = bodies[1].messages;
      expect(userMessage.content).toContain("Songs the listener liked:\n- Song A — Artist");
      expect(userMessage.content).toContain("Songs the listener disliked:\n- Song B — Artist");
      expect(userMessage.content).toContain("Songs the listener did not rate:\n- Song C — Artist");
      const titleButtons = Array.from(playlistContainer.querySelectorAll(".playlist-title"));
      expect(titleButtons.length).toBe(6);
      expect(titleButtons[0].textContent.trim()).toBe("Song D — Artist");
      expect(titleButtons[1].textContent.trim()).toBe("Song E — Artist");
      expect(titleButtons[2].textContent.trim()).toBe("Song F — Artist");
      expect(titleButtons[3].textContent.trim()).toBe("Song A — Artist");
    });
    const likedRow = Array.from(playlistContainer.querySelectorAll(".playlist-item")).find(
      (item) => item.querySelector(".playlist-title")?.textContent.trim() === "Song A — Artist",
    );
    expect(likedRow).toBeDefined();
    expect(likedRow.querySelector('.rating-btn[data-action="up"]').classList).toContain("active");
  });

  it("copies the playlist to clipboard", async () => {
    window.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"songs":["Song One","Song Two"]}' } }],
      }),
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
