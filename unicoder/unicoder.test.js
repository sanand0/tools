import { describe, it, expect } from "vitest";
import { loadFrom } from "../common/testutils.js";

describe("Unicoder tests", async () => {
  const { window, document } = await loadFrom(__dirname);

  // Encode Test
  it("should encode markdown to unicode correctly", () => {
    const inputElement = document.getElementById("markdown-input");
    inputElement.value = "**bold** _italic_ `code`";
    inputElement.dispatchEvent(new window.Event("input", { bubbles: true }));
    expect(document.getElementById("output").textContent.trim()).toBe("𝗯𝗼𝗹𝗱 𝘪𝘵𝘢𝘭𝘪𝘤 𝚌𝚘𝚍𝚎");
  });
});
