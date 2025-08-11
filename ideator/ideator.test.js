import { describe, it, expect, vi } from "vitest";
import { Window } from "happy-dom";

const window = new Window();
const { document } = window;
global.window = window;
global.document = document;

vi.mock("https://cdn.jsdelivr.net/npm/marked/+esm", () => ({ marked: { parse: (s) => s } }));
vi.mock("https://cdn.jsdelivr.net/npm/bootstrap-alert@1", () => ({ bootstrapAlert: vi.fn() }));
vi.mock("../recall/notes.js", () => ({
  files: [
    { url: "a", name: "A" },
    { url: "b", name: "B" },
  ],
  fetchNotes: async () => ["- A", "- B"],
  randomItem: (arr, exclude = []) => arr.find((i) => !exclude.includes(i)),
}));

describe("ideator", () => {
  it("loads notes and opens chatgpt", async () => {
    document.body.innerHTML =
      '<input id="goal-input"><button id="add-btn"></button><button id="ideate-btn"></button><div id="notes"></div>';
    window.open = vi.fn();
    await import("./script.js");
    expect(document.querySelectorAll(".note-card").length).toBe(2);
    document.getElementById("ideate-btn").click();
    expect(window.open).toHaveBeenCalled();
  });
});
