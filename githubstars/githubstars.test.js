import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest";
import { loadFrom } from "../common/testutils.js";

describe("githubstars", () => {
  let window, document, form, input, results;

  const repo = {
    full_name: "octocat/Hello-World",
    name: "Hello-World",
    stargazers_count: 80,
    forks_count: 20,
    pushed_at: "2024-01-01T00:00:00Z",
  };

  beforeAll(() => vi.useFakeTimers());
  afterAll(() => vi.useRealTimers());

  beforeEach(async () => {
    const realFetch = fetch;
    vi.stubGlobal("fetch", (url) => {
      if (url.includes("api.github.com/repos/octocat/Hello-World"))
        return Promise.resolve(new Response(JSON.stringify(repo)));
      return realFetch(url);
    });
    ({ window, document } = await loadFrom(import.meta.dirname));
    window.setTimeout = setTimeout;
    form = document.getElementById("repoForm");
    input = document.getElementById("inputText");
    results = document.getElementById("resultsTable");
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("fetches repo stars and rewrites text", () => {
    input.value = "[hw](https://github.com/octocat/Hello-World)";
    form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
    const row = results.querySelector("tbody tr");
    expect(row.textContent).toContain("octocat/Hello-World");
    expect(input.value).toContain("80 ⭐ Jan 2024");
  });
});
