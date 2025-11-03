import { beforeAll, afterAll, beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadFrom } from "../common/testutils.js";
import { createScraperState, discoursePosts, mergePosts, scrape } from "./discoursescraper.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe("discoursescraper", () => {
  let page;
  let document;
  let window;
  let postsData;
  let controller;

  beforeAll(() => {
    vi.useFakeTimers();
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  beforeEach(async () => {
    ({ page, document, window } = await loadFrom(__dirname, "__fixtures__/topic.html"));
    window.location.href = "https://test/t/sample-topic/123/45";
    window.innerHeight = 800;
    window.scrollBy = vi.fn();
    window.scrollTo = vi.fn();
    window.setInterval = setInterval;
    window.clearInterval = clearInterval;

    postsData = [
      {
        id: 101,
        post_number: 1,
        post_type: 1,
        created_at: "2025-10-01T00:00:00.000Z",
        cooked: `
          <p>Welcome to the <strong>Project</strong> thread.</p>
          <ul>
            <li>Read spec</li>
            <li>Submit pull request</li>
          </ul>
        `,
        like_count: 5,
        reactions: [
          { id: "heart", count: 5 },
          { id: "+1", count: 2 },
        ],
        reply_to_post_number: null,
        username: "alice",
        name: "Alice",
        user_title: "Course TA",
        reads: 150,
        reply_count: 2,
        link_counts: [
          {
            url: "/uploads/default/original/1X/spec.pdf",
            internal: true,
            clicks: 4,
            title: "Spec PDF",
          },
          {
            url: "https://example.com/ref",
            internal: false,
            clicks: 3,
            title: "Reference",
          },
        ],
      },
      {
        id: 102,
        post_number: 2,
        post_type: 1,
        created_at: "2025-10-01T02:00:00.000Z",
        cooked: `<p>Reply with <a href="/resource">link</a> and <code>code</code>.</p>`,
        like_count: 0,
        reactions: [{ id: "confetti_ball", count: 1 }],
        reply_to_post_number: 1,
        username: "bob",
        name: "Bob",
        reads: 80,
      },
      {
        id: 103,
        post_number: 3,
        post_type: 3,
        created_at: "2025-10-01T03:00:00.000Z",
        cooked: "",
      },
    ];

    controller = {
      model: {
        id: 123,
        slug: "sample-topic",
        title: "Sample Topic",
        relative_url: "/t/sample-topic/123/45",
        views: 4321,
        postStream: {
          posts: postsData,
        },
      },
    };

    window.Discourse = {
      __container__: {
        lookup(name) {
          if (name === "controller:topic") return controller;
          return null;
        },
      },
    };
  });

  afterEach(() => {
    if (typeof page?.close === "function") page.close();
  });

  it("extracts posts with markdown, links, and metadata", () => {
    const posts = discoursePosts(document);
    expect(posts).toHaveLength(2);

    const root = posts[0];
    expect(root.post_number).toBe(1);
    expect(root.topic_title).toBe("Sample Topic");
    expect(root.link).toBe("https://test/t/sample-topic/123");
    expect(root.views).toBe(4321);
    expect(root.likes).toEqual({ "♥️": 5, "👍": 2 });
    expect(root.message).toContain("**Project**");
    expect(root.message).toContain("- Read spec");
    expect(root.links?.[0].url).toBe("https://test/uploads/default/original/1X/spec.pdf");

    const reply = posts[1];
    expect(reply.post_number).toBe(2);
    expect(reply.parent_link).toBe(root.link);
    expect(reply.likes["🎊"]).toBe(1);
    expect(reply.message).toContain("[link](https://test/resource)");
  });

  it("merges posts preferring richer fields", () => {
    const state = createScraperState();
    const posts = discoursePosts(document);
    mergePosts(posts, state);

    const rootId = posts[0].post_id;
    mergePosts([{ post_id: rootId, message: "Short" }], state);
    expect(state.postsById[rootId].message).toBe(posts[0].message);

    mergePosts([{ post_id: rootId, likes: { "♥️": 8 } }], state);
    expect(state.postsById[rootId].likes["♥️"]).toBe(8);
  });

  it("scrapes continuously and copies JSON payload", async () => {
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

    const btn = document.getElementById("discoursescraper-copy-btn");
    expect(btn).not.toBeNull();
    expect(btn.textContent).toBe("Copy 2 posts");

    postsData.push({
      id: 104,
      post_number: 3,
      post_type: 1,
      created_at: "2025-10-01T04:00:00.000Z",
      cooked: "<p>Later update.</p>",
      like_count: 1,
      reactions: [{ id: "heart", count: 1 }],
      reply_to_post_number: 1,
      username: "cara",
      name: "Cara",
    });

    await vi.advanceTimersByTimeAsync(1800);
    expect(btn.textContent).toBe("Copy 3 posts");

    btn.click();
    expect(writeText).toHaveBeenCalledTimes(1);
    resolveClipboard();
    await Promise.resolve();

    const payload = JSON.parse(writeText.mock.calls[0][0]);
    expect(payload).toHaveLength(3);
    const latest = payload.at(-1);
    expect(latest.message).toContain("Later update");
    expect(latest.parent_link).toBe(payload[0].link);
  });
});
