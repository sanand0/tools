import { describe, it, expect, vi, beforeEach } from "vitest";
import { Window } from "happy-dom";

const window = new Window();
const { document } = window;
global.window = window;
global.document = document;

vi.mock("https://cdn.jsdelivr.net/npm/bootstrap-alert@1", () => ({ bootstrapAlert: vi.fn() }));
vi.mock("https://cdn.jsdelivr.net/npm/marked/+esm", () => ({ marked: { parse: (s) => s } }));
vi.mock("../recall/notes.js", () => ({
  files: [
    { url: "a", name: "A" },
    { url: "b", name: "B" },
  ],
  fetchAll: async () => ["- A", "- B"],
  filterNotes: (items) => items,
  randomItem: (arr, exclude = []) => arr.find((i) => !exclude.includes(i)),
  renderStar: (btn, on) => {
    if (!btn) return on;
    btn.className = `btn btn-${on ? "warning" : "outline-warning"} btn-sm note-star`;
    btn.innerHTML = `<i class="bi bi-${on ? "star-fill" : "star"}"></i>`;
    return on;
  },
}));

beforeEach(() => {
  vi.resetModules();
  document.body.innerHTML =
    '<input id="goal-input"><button id="add-btn"></button><button id="ideate-btn"></button><div id="notes"></div><div id="prompt-template"></div>';
  window.open = vi.fn();
});

describe("ideator", () => {
  it("loads notes and opens chatgpt", async () => {
    await import("./script.js");
    expect(document.querySelectorAll(".note-card").length).toBe(2);
    document.getElementById("ideate-btn").click();
    expect(window.open).toHaveBeenCalled();
  });

  it("deletes extra cards", async () => {
    await import("./script.js");
    document.querySelectorAll(".note-delete")[1].click();
    expect(document.querySelectorAll(".note-card").length).toBe(1);
  });

  it("uses edited notes", async () => {
    await import("./script.js");
    const card = document.querySelector(".note-card");
    const text = card.querySelector(".note-text");
    text.textContent = "Edited";
    text.dispatchEvent(new window.Event("input"));
    document.getElementById("ideate-btn").click();
    const url = new URL(window.open.mock.calls[0][0]);
    expect(url.searchParams.get("q")).toContain("Edited");
  });

  it("keeps star after reload", async () => {
    await import("./script.js");
    const card = document.querySelector(".note-card");
    card.querySelector(".note-star").click();
    await card.querySelector(".note-reload").onclick();
    const btn = card.querySelector(".note-star");
    expect(card.star).toBe(true);
    expect(btn.className).toContain("btn-warning");
    expect(btn.innerHTML).toContain("bi-star-fill");
  });
});
