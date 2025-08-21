import { describe, it, expect, beforeAll } from "vitest";
import { loadFrom } from "../common/testutils.js";

describe("personagen", () => {
  let window, document, slider, display;
  beforeAll(async () => {
    ({ window, document } = await loadFrom(import.meta.dirname));
  });
  it("updates slider display", () => {
    slider = document.getElementById("persona-count");
    display = document.getElementById("persona-count-display");
    slider.value = "5";
    slider.dispatchEvent(new window.Event("input", { bubbles: true }));
    expect(display.textContent).toBe("5");
  });
});
