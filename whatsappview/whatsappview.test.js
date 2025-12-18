import { describe, it, expect } from "vitest";
import { loadFrom, sleep } from "../common/testutils.js";

describe("whatsappview", async () => {
  it("autoloads a sample chat from the URL and renders threads", async () => {
    const { document } = await loadFrom(import.meta.dirname, "index.html?chat=sample");
    await sleep(100);

    const threads = document.getElementById("threadContainer");
    const copyBtn = document.getElementById("copyMarkdown");
    expect(threads.textContent).toContain("Asha");
    expect(threads.textContent).toContain("Ben");
    expect(copyBtn.disabled).toBe(false);
  });
});
