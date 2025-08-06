import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import { loadFrom } from "../common/testutils.js";

const originalFetch = globalThis.fetch;
const data =
  '{"timestamp":"2024-01-01","goal":"Goal A","idea":"Idea A","concepts":["A"],"novel":1,"coherent":1,"feasible":1,"impactful":1,"novel_why":"a","coherent_why":"b","feasible_why":"c","impactful_why":"d"}\n' +
  '{"timestamp":"2024-01-02","goal":"Goal B","idea":"Idea B","concepts":["B"],"novel":2,"coherent":2,"feasible":2,"impactful":2,"novel_why":"a","coherent_why":"b","feasible_why":"c","impactful_why":"d"}\n';

let window, document, view;
let consoleErrorSpy;

async function loadPage(fail = false) {
  globalThis.fetch = (url) => {
    if (typeof url === "string" && url.includes("daydream.jsonl")) {
      if (fail) return Promise.resolve(new Response("", { status: 500 }));
      return Promise.resolve(new Response(data));
    }
    return originalFetch(url);
  };
  ({ window, document } = await loadFrom(import.meta.dirname));
  window.setTimeout = setTimeout;
  window.clearTimeout = clearTimeout;
  window.setInterval = setInterval;
  window.clearInterval = clearInterval;
  view = document.getElementById("view");
  consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
}

describe("Daydream tests", () => {
  beforeAll(() => vi.useFakeTimers());
  afterAll(() => vi.useRealTimers());

  afterEach(() => {
    globalThis.fetch = originalFetch;
    consoleErrorSpy.mockRestore();
  });

  it("renders table with entries", async () => {
    await loadPage();
    const rows = view.querySelectorAll("tbody tr");
    expect(rows.length).toBe(2);
  });

  it("filters by search", async () => {
    await loadPage();
    const search = document.getElementById("search");
    search.value = "Goal B";
    search.dispatchEvent(new window.Event("input", { bubbles: true }));
    const rows = view.querySelectorAll("tbody tr");
    expect(rows.length).toBe(1);
    expect(rows[0].querySelector("td:nth-child(2)").textContent).toBe("Goal B");
  });

  it("sorts by goal", async () => {
    await loadPage();
    const header = view.querySelector('th[data-k="goal"]');
    header.click();
    const firstGoal = view.querySelector("tbody tr td:nth-child(2)").textContent;
    expect(firstGoal).toBe("Goal A");
  });

  it("shows error on load failure", async () => {
    await loadPage(true);
    const toast = document.querySelector(".toast-body");
    expect(toast.textContent).toContain("Load error");
  });
});
