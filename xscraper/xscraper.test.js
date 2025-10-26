import { beforeAll, afterAll, beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import path from "node:path";
import { fileURLToPath } from "url";
import { loadFrom } from "../common/testutils.js";
import { addBuzzKeep, createScraperState, parseCount, scrape, xTweets } from "./xscraper.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe("xscraper", () => {
  let page;
  let document;
  let window;

  beforeAll(() => {
    vi.useFakeTimers();
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  beforeEach(async () => {
    ({ page, document, window } = await loadFrom(__dirname, "__fixtures__/thread.html"));
    window.setInterval = setInterval;
    window.setTimeout = setTimeout;
    window.clearInterval = clearInterval;
    window.scrollBy = () => {};
  });

  afterEach(() => {
    if (typeof page?.close === "function") page.close();
  });

  it("parses counts and excludes ads", () => {
    expect(parseCount("2.3K")).toBe(2300);
    expect(parseCount("101.5K")).toBe(101500);
    expect(parseCount("1,200")).toBe(1200);

    const tweets = xTweets(document);
    expect(tweets).toHaveLength(3); // promoted + no-time dropped
    expect(tweets[0]).toMatchObject({
      link: "https://test/emollick/status/123",
      name: "Ethan Mollick",
      handle: "emollick",
      // likes come from visible 2.3K (max of sources)
      likes: 2300,
      // replies from visible 12 vs aria 8 -> max 12
      replies: 12,
      views: 101500,
    });
    // Additional metrics parsed from aria-label
    expect(tweets[0].reposts).toBe(1);
    expect(tweets[0].bookmarks).toBe(14);

    // Replies parent mapping
    for (let i = 1; i < tweets.length; i++) expect(tweets[i].parent_link).toBe(tweets[0].link);
  });

  it("scrape keeps state in sync and copies JSON", async () => {
    const state = createScraperState();
    let resolveClipboard;
    const writeText = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveClipboard = resolve;
        }),
    );

    scrape({
      document,
      navigator: { clipboard: { writeText } },
      state,
      setIntervalFn: setInterval,
      clearIntervalFn: clearInterval,
    });

    const button = document.getElementById("xscraper-copy-btn");
    expect(button).not.toBeNull();
    expect(button.textContent).toBe("Copy 3 tweets");

    // Add another reply dynamically
    const main = document.querySelector("main");
    const newReply = document.createElement("article");
    newReply.setAttribute("role", "article");
    newReply.innerHTML = `
      <div data-testid="User-Name"><a role="link" href="/carol"><span>Carol</span></a><span>@carol</span></div>
      <a role="link" href="/carol/status/126"><time datetime="2025-10-20T13:30:00.000Z"></time></a>
      <div data-testid="tweetText">Another thought.</div>
      <div><div data-testid="reply"><span>1</span></div><div data-testid="like"><span>2</span></div><div data-testid="views"><span>10</span></div></div>
    `;
    main.appendChild(newReply);

    await vi.advanceTimersByTimeAsync(1200);

    const refreshed = document.getElementById("xscraper-copy-btn");
    expect(refreshed.textContent).toBe("Copy 4 tweets");

    refreshed.click();
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(resolveClipboard).toBeTypeOf("function");
    resolveClipboard();
    await Promise.resolve();

    const payload = writeText.mock.calls[0][0];
    const parsed = JSON.parse(payload);
    expect(parsed).toHaveLength(4);
    const carol = parsed.find((t) => t.handle === "carol");
    expect(carol).toMatchObject({ message: "Another thought.", likes: 2, replies: 1, views: 10 });
    // buzz/keep are added before copying
    expect(typeof carol.buzz).toBe("number");
    expect(typeof carol.keep).toBe("number");
    expect(carol.buzz).toBeGreaterThanOrEqual(0);
    expect(carol.keep).toBeGreaterThanOrEqual(0);
  });

  it("adds buzz/keep scores with decay and weights", () => {
    const now = new Date("2025-10-26T12:00:00.000Z");
    const items = [
      // High repost and likes, recent -> should have high buzz
      {
        link: "a",
        date: "2025-10-26T11:00:00.000Z",
        likes: 500,
        reposts: 200,
        replies: 20,
        bookmarks: 10,
        views: 10000,
      },
      // High bookmarks and replies, recent -> should have high keep
      {
        link: "b",
        date: "2025-10-26T11:00:00.000Z",
        likes: 50,
        reposts: 5,
        replies: 200,
        bookmarks: 150,
        views: 10000,
      },
      // Older item with similar rates -> significantly decayed
      {
        link: "c",
        date: "2025-10-20T11:00:00.000Z",
        likes: 500,
        reposts: 200,
        replies: 20,
        bookmarks: 10,
        views: 10000,
      },
    ];

    const scored = addBuzzKeep(items, { now, debug: true });

    // All have scores in 0-100
    for (const s of scored) {
      expect(s.buzz).toBeGreaterThanOrEqual(0);
      expect(s.buzz).toBeLessThanOrEqual(100);
      expect(s.keep).toBeGreaterThanOrEqual(0);
      expect(s.keep).toBeLessThanOrEqual(100);
    }

    // Buzz prioritizes reposts+likes; keep prioritizes bookmarks+replies
    const a = scored.find((x) => x.link === "a");
    const b = scored.find((x) => x.link === "b");
    expect(a.buzz).toBeGreaterThan(b.buzz);
    expect(b.keep).toBeGreaterThan(a.keep);

    // Old item should decay strongly relative to recent one
    const c = scored.find((x) => x.link === "c");
    expect(c.buzz).toBeLessThan(a.buzz);
    expect(c.keep).toBeLessThan(b.keep);

    // Debug fields present when debug=true
    expect(a).toHaveProperty("buzz_z");
    expect(a).toHaveProperty("keep_orth_z");
  });
});
