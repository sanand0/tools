import { describe, it, expect, vi } from "vitest";
import { Window } from "happy-dom";

const window = new Window();
const { document } = window;
global.window = window;
global.document = document;

vi.mock("https://cdn.jsdelivr.net/npm/marked/+esm", () => ({
  marked: { lexer: () => [], parse: (s) => s },
}));
vi.mock("https://cdn.jsdelivr.net/npm/bootstrap-alert@1", () => ({ bootstrapAlert: vi.fn() }));
vi.mock("https://cdn.jsdelivr.net/npm/asyncllm@2", () => ({ asyncLLM: async function* () {} }));
vi.mock("https://cdn.jsdelivr.net/npm/bootstrap-llm-provider@1", () => ({ openaiConfig: vi.fn() }));
vi.mock("https://cdn.jsdelivr.net/npm/d3@7/+esm", () => ({
  create: () => ({
    attr() {
      return this;
    },
    append() {
      return this;
    },
    selectAll() {
      return this;
    },
    data() {
      return this;
    },
    join() {
      return this;
    },
    text() {
      return this;
    },
    node() {
      return document.createElement("table");
    },
  }),
}));
vi.mock("../recall/notes.js", () => ({
  files: [
    { url: "a", name: "A" },
    { url: "b", name: "B" },
  ],
  fetchNotes: async () => ["- A", "- B"],
  randomItem: (arr) => arr[0],
}));

describe("ideator", () => {
  it("shows two notes", async () => {
    document.body.innerHTML = `<select id="file1-select"></select><select id="file2-select"></select><input id="goal-input"><button id="reload-btn"></button><button id="ideate-btn"></button><div id="notes"></div><div id="idea"></div><div id="eval"></div>`;
    await import("./script.js");
    await window.reloadNotes();
    expect(document.querySelectorAll("#notes h5").length).toBe(2);
  });
});
