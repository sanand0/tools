import { describe, it, expect, beforeEach, vi } from "vitest";
import { Window } from "happy-dom";

const window = new Window();
const { document } = window;
global.window = window;
global.document = document;

vi.mock("https://cdn.jsdelivr.net/npm/saveform@1.2", () => ({ default: vi.fn() }));
vi.mock("https://cdn.jsdelivr.net/npm/bootstrap-alert@1", () => ({ bootstrapAlert: vi.fn() }));
vi.mock("https://cdn.jsdelivr.net/npm/bootstrap-llm-provider@1", () => ({
  openaiConfig: vi.fn().mockResolvedValue({ apiKey: "k", baseUrl: "https://api" }),
}));
vi.mock("https://cdn.jsdelivr.net/npm/asyncllm@2", () => ({
  asyncLLM: vi.fn(() =>
    (async function* () {
      yield { content: '{"text":"Edited"}' };
    })(),
  ),
}));
vi.mock("https://cdn.jsdelivr.net/npm/diff-match-patch@1/+esm", () => ({
  default: class {
    patch_fromText(t) {
      return JSON.parse(t).text;
    }
    patch_apply(p, text) {
      return [p, [true]];
    }
  },
}));

beforeEach(() => {
  vi.resetModules();
  document.body.innerHTML =
    '<form id="llmedit-form"><textarea id="prompt-input"></textarea><button></button></form><textarea id="doc-area"></textarea><div id="loading" class="d-none"></div><button id="openai-config-btn"></button>';
});

describe("llmedit", () => {
  it("applies diff to document", async () => {
    await import("./script.js");
    const doc = document.getElementById("doc-area");
    doc.value = "Original";
    document.getElementById("prompt-input").value = "Edit";
    document.getElementById("llmedit-form").dispatchEvent(new window.Event("submit"));
    await new Promise((r) => setTimeout(r, 0));
    expect(doc.value).toBe("Edited");
  });
});
