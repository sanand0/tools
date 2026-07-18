import { describe, it, beforeEach, expect, vi, afterAll, beforeAll } from "vitest";
import { Window } from "happy-dom";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

vi.mock("https://cdn.jsdelivr.net/npm/lit-html/+esm", () => ({
  html: (s, ...v) => s.reduce((acc, cur, i) => acc + cur + (v[i] ?? ""), ""),
  render: (c, el) => {
    el.innerHTML = Array.isArray(c) ? c.join("") : c;
  },
}));
vi.mock("https://cdn.jsdelivr.net/npm/bootstrap-alert@1", () => ({ bootstrapAlert: vi.fn() }));
vi.mock("https://cdn.jsdelivr.net/npm/bootstrap-llm-provider@1", () => ({
  openaiConfig: vi.fn(async () => ({ apiKey: "k", baseUrl: "https://g" })),
}));
vi.mock("https://cdn.jsdelivr.net/npm/asyncllm@2", () => ({ asyncLLM: vi.fn() }));

let html;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scriptURL = pathToFileURL(path.join(__dirname, "script.js")).href;
const htmlPath = path.join(__dirname, "index.html");

beforeAll(async () => {
  vi.useFakeTimers();
  html = await fs.readFile(htmlPath, "utf8");
});

afterAll(() => vi.useRealTimers());

describe("voicenotes", () => {
  let window, document, addNote, copyNotes;
  beforeEach(async () => {
    window = new Window({ url: "https://test/voicenotes/" });
    document = window.document;
    const body = html
      .match(/<body[^>]*>([\s\S]*)<\/body>/i)[1]
      .replace(/<script[^>]*src="script.js"[^>]*><\/script>/, "");
    document.body.innerHTML = body;
    globalThis.window = window;
    globalThis.document = document;
    globalThis.Blob = window.Blob;
    globalThis.btoa = window.btoa;
    Object.defineProperty(globalThis, "navigator", { value: window.navigator, configurable: true });
    Object.defineProperty(globalThis, "localStorage", { value: window.localStorage, configurable: true });
    localStorage.clear();
    Object.defineProperty(navigator, "clipboard", { value: { writeText: vi.fn() }, configurable: true });
    vi.resetModules();
    ({ addNote, copyNotes } = await import(scriptURL));
  });

  it("adds transcribed note", () => {
    addNote("hi");
    const items = document.querySelectorAll("#notes-list li");
    expect(items.length).toBe(1);
    expect(items[0].textContent).toContain("hi");
  });

  it("copies markdown list", async () => {
    addNote("hi");
    await copyNotes();
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("- hi");
  });
});
