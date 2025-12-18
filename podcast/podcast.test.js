import { describe, it, expect } from "vitest";
import { loadFrom, sleep } from "../common/testutils.js";

describe("podcast presets", async () => {
  it("prefills content from config by default", async () => {
    const { document } = await loadFrom(import.meta.dirname);
    await sleep(50);
    const content = document.getElementById("contentInput");
    expect(content.value.trim().length).toBeGreaterThan(0);
  });

  it("supports ?source= and ?model=", async () => {
    const { document } = await loadFrom(import.meta.dirname, "index.html?source=meeting-notes&model=gpt-4.1-nano");
    await sleep(50);
    const content = document.getElementById("contentInput");
    const model = document.getElementById("model");
    expect(content.value).toContain("Agenda: demo readiness");
    expect(model.value).toBe("gpt-4.1-nano");
  });
});
