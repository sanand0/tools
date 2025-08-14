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
  fetchNotes: async () => ["⭐ A", "B"],
  randomItem: (arr) => arr[0],
  filterNotes: (list, term = "", starOnly = false, key = "note") => {
    const base = starOnly ? list.filter((o) => (key ? o[key] : o).includes("⭐")) : list;
    if (!term.trim()) return base.slice();
    return base.filter((o) => (key ? o[key] : o).includes(term));
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

  it("searches notes", async () => {
    await import("./script.js");
    const card = document.querySelector(".note-card");
    const search = card.querySelector(".note-search");
    search.value = "B";
    search.dispatchEvent(new window.Event("input"));
    await Promise.resolve();
    expect(typeof card.note).toBe("string");
  });

  it("filters starred notes", async () => {
    await import("./script.js");
    const card = document.querySelector(".note-card");
    card.querySelector(".note-star").click();
    expect(card.note).toContain("⭐");
  });
});
