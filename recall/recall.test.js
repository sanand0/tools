import { describe, it, expect, vi, beforeEach } from "vitest";
import { Window } from "happy-dom";

const window = new Window();
const { document } = window;
global.window = window;
global.document = document;

vi.mock("https://cdn.jsdelivr.net/npm/bootstrap-alert@1", () => ({ bootstrapAlert: vi.fn() }));
vi.mock("https://cdn.jsdelivr.net/npm/marked/+esm", () => ({ marked: { parse: (s) => s, lexer: () => [] } }));
vi.mock("./notes.js", () => ({
  files: [
    { url: "a", name: "A" },
    { url: "b", name: "B", decay: 0 },
  ],
  fetchAll: async () => ["- A", "- B"],
  filterNotes: (items) => items,
  renderStar: (btn, on) => {
    if (!btn) return on;
    btn.className = `btn btn-${on ? "warning" : "outline-warning"} btn-sm note-star`;
    btn.innerHTML = `<i class="bi bi-${on ? "star-fill" : "star"}"></i>`;
    return on;
  },
}));

beforeEach(() => {
  vi.resetModules();
  document.body.innerHTML = '<div id="notes"></div>';
  window.open = vi.fn();
  Object.defineProperty(global, "navigator", {
    value: { clipboard: { writeText: vi.fn(() => Promise.resolve()) } },
    configurable: true,
  });
});

describe("recall card", () => {
  it("loads a note card with Random default", async () => {
    await import("./script.js");
    expect(document.querySelectorAll(".note-card").length).toBe(1);
    const sel = document.querySelector(".note-file");
    expect(sel.value).toBe("");
    const title = document.querySelector(".card-title");
    expect(title.textContent).toBe("All");
  });

  it("keeps star after random reload", async () => {
    await import("./script.js");
    const card = document.querySelector(".note-card");
    card.querySelector(".note-star").click();
    card.querySelector(".note-random").click();
    const btn = card.querySelector(".note-star");
    expect(card.star).toBe(true);
    expect(btn.className).toContain("btn-warning");
    expect(btn.innerHTML).toContain("bi-star-fill");
  });

  it("applies file-specific decay", async () => {
    await import("./script.js");
    const card = document.querySelector(".note-card");
    const decay = card.querySelector(".note-decay");
    expect(decay.value).toBe("0.02");
    const sel = card.querySelector(".note-file");
    sel.value = "b";
    sel.dispatchEvent(new window.Event("change"));
    await Promise.resolve();
    await Promise.resolve();
    expect(decay.value).toBe("0");
  });
});
