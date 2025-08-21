import { describe, it, beforeAll, afterAll, expect, vi } from "vitest";
import "fake-indexeddb/auto";
import { loadFrom } from "../common/testutils.js";

describe("threadchat", () => {
  beforeAll(() => vi.useFakeTimers());
  afterAll(() => vi.useRealTimers());

  async function mount() {
    const { page, window, document } = await loadFrom("threadchat");
    window.setTimeout = setTimeout;
    Object.assign(window, {
      indexedDB,
      IDBKeyRange,
      IDBDatabase,
      IDBObjectStore,
      IDBTransaction,
      IDBRequest,
      IDBCursor,
      IDBOpenDBRequest,
      IDBIndex,
    });
    await vi.runAllTimersAsync();
    return { page, window, document };
  }

  async function navigate(window, hash) {
    window.location.hash = hash;
    window.dispatchEvent(new window.HashChangeEvent("hashchange"));
    await vi.runAllTimersAsync();
    await Promise.resolve();
  }

  it(
    "full flow",
    async () => {
      const { window, document } = await mount();

      // sign up
      document.getElementById("signup-user").value = "bob";
      document.getElementById("signup-pass").value = "pw";
      document
        .getElementById("signup-form")
        .dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));

      // submit post
      await navigate(window, "#submit");
      document.getElementById("submit-title").value = "My Post";
      document.getElementById("submit-text").value = "Hello world";
      document
        .getElementById("submit-form")
        .dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
      await navigate(window, "#new");
      expect(document.body.textContent).toContain("My Post");

      // vote dedupe
      const voteBtn = document.querySelector("[data-vote]");
      voteBtn.click();
      await navigate(window, window.location.hash);
      voteBtn.click();
      await navigate(window, window.location.hash);
      expect(document.body.textContent).toContain("1 points");

      // comment and reply
      document.querySelector('a[href^="#thread-"]').click();
      await navigate(window, window.location.hash);
      for (let i = 0; i < 5 && !document.getElementById("new-comment"); i++)
        await navigate(window, window.location.hash);
      document.getElementById("new-comment").value = "first";
      document.getElementById("comment-btn").click();
      await navigate(window, window.location.hash);
      const promptSpy = vi.spyOn(window, "prompt").mockReturnValue("second");
      document.querySelector("[data-reply]").click();
      promptSpy.mockRestore();
      await navigate(window, window.location.hash);

      // back to list
      await navigate(window, "#new");
      expect(document.body.textContent).toMatch(/2 comments/);

      // profile karma
      document.querySelector("span.navbar-text").click();
      await navigate(window, "#user-bob");
      expect(document.body.textContent).toContain("Karma 1");

      // reset
      document.getElementById("reset-btn").click();
      await navigate(window, window.location.hash);
      expect(document.body.textContent).toContain("Welcome");
    },
    { timeout: 10000 },
  );
});
