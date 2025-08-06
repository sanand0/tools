import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest";
import { loadFrom } from "../common/testutils.js";

describe("githubusers", () => {
  let window, document, form, urls, results, copyBtn;

  const user = {
    html_url: "https://github.com/octocat",
    avatar_url: "https://avatars.githubusercontent.com/u/1?v=4",
    name: "The Octocat",
    company: "GitHub",
    blog: "https://github.blog",
    location: "Earth",
    email: null,
    hireable: null,
    bio: "Hi",
    twitter_username: "octotwitter",
    public_repos: 2,
    public_gists: 1,
    followers: 3,
    following: 4,
    created_at: "2020-01-01T00:00:00Z",
    updated_at: "2020-01-02T00:00:00Z",
  };

  beforeAll(() => vi.useFakeTimers());
  afterAll(() => vi.useRealTimers());

  beforeEach(async () => {
    const realFetch = fetch;
    vi.stubGlobal("fetch", (url) => {
      if (url.includes("api.github.com/users/octocat")) return Promise.resolve(new Response(JSON.stringify(user)));
      return realFetch(url);
    });
    ({ window, document } = await loadFrom(import.meta.dirname));
    window.setTimeout = setTimeout;
    form = document.getElementById("urlForm");
    urls = document.getElementById("urls");
    results = document.getElementById("results");
    copyBtn = document.getElementById("copyToExcelBtn");
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("fetches user data and copies", async () => {
    urls.value = "https://github.com/octocat";
    form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
    await Promise.resolve();
    expect(results.querySelector("tbody tr")).not.toBeNull();
    copyBtn.click();
    expect(await window.navigator.clipboard.readText()).toContain("The Octocat");
  });
});
