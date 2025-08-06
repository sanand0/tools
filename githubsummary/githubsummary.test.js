import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest";
import { loadFrom } from "../common/testutils.js";

const event = {
  type: "PushEvent",
  repo: { name: "octocat/Hello-World" },
  payload: { ref: "refs/heads/main", commits: [{ message: "Test" }] },
  created_at: "2024-06-01T00:00:00Z",
};
const repo = {
  full_name: "octocat/Hello-World",
  description: "Repo",
  stargazers_count: 1,
  forks_count: 0,
  open_issues_count: 0,
};

const encoder = new TextEncoder();
function openaiStream() {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"Summary"}}]}\n\n'));
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
}

describe("githubsummary", () => {
  let window, document, form, generateBtn;

  beforeAll(() => vi.useFakeTimers());
  afterAll(() => vi.useRealTimers());

  beforeEach(async () => {
    const realFetch = fetch;
    vi.stubGlobal("fetch", (url) => {
      if (typeof url === "string") {
        if (url.startsWith("https://cdn.jsdelivr.net/npm/bootstrap-llm-provider@1"))
          return Promise.resolve(
            new Response(
              "export async function openaiConfig(){return {apiKey:'k', baseUrl:'https://api.openai.com/v1'};}",
            ),
          );
        if (url.includes("api.github.com/users/testuser/events")) {
          const page = new URL(url).searchParams.get("page");
          const data = page === "1" ? [event] : [];
          return Promise.resolve(new Response(JSON.stringify(data)));
        }
        if (url.includes("api.github.com/repos/octocat/Hello-World"))
          return Promise.resolve(new Response(JSON.stringify(repo)));
        if (url.includes("api.openai.com/v1/chat/completions"))
          return Promise.resolve(new Response(openaiStream(), { headers: { "Content-Type": "text/event-stream" } }));
      }
      return realFetch(url);
    });
    ({ window, document } = await loadFrom(import.meta.dirname));
    window.setTimeout = setTimeout;
    form = document.getElementById("github-form");
    generateBtn = document.getElementById("generate-summary-btn");
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("summarizes GitHub activity", async () => {
    document.getElementById("username").value = "testuser";
    document.getElementById("since").value = "2024-01-01";
    document.getElementById("until").value = "2024-12-31";
    document.querySelector("#system-prompt-tab-content textarea").value = "Summarize";
    form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
    await Promise.resolve();
    generateBtn.click();
    await Promise.resolve();
    expect(document.getElementById("results-content").textContent).toContain("Summary");
  });
});
