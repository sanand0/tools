import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { loadFrom } from "../common/testutils.js";

describe("Viva", () => {
  let window, document;
  beforeAll(async () => {
    vi.useFakeTimers();
    ({ window, document } = await loadFrom(import.meta.dirname));
  });

  afterAll(() => vi.useRealTimers());

  it("evaluates and hides audio", async () => {
    document.querySelector(".exam-btn").click();
    const cont = document.getElementById("mic-continue");
    cont.disabled = false;
    cont.click();
    window.vivaState.recordings[0].transcript = "answer";
    const transcript = document.getElementById("transcript");
    expect(transcript.classList.contains("d-none")).toBe(true);
    document.getElementById("toggle-transcript").click();
    expect(transcript.classList.contains("d-none")).toBe(false);
    window.openaiConfig = vi.fn(async () => ({ apiKey: "k", baseUrl: "https://test" }));
    window.asyncLLM = async function* () {
      yield { content: JSON.stringify({ totalScore: 0.7 }) };
    };
    document.getElementById("submit-btn").click();
    await vi.runAllTimersAsync();
    const text = document.getElementById("results").textContent;
    expect(text).toMatch(/Practice/);
    expect(text).toMatch(/0.7/);
    expect(window.vivaState.recordings[0].audio).toBe(null);
  });
});
