import { beforeAll, afterAll, beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import path from "node:path";
import { fileURLToPath } from "url";
import { loadFrom } from "../common/testutils.js";
import { createScraperState, mergeMessages, scrape, whatsappMessages } from "./whatsappscraper.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe("whatsappscraper", () => {
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
    ({ page, document, window } = await loadFrom(__dirname, "__fixtures__/conversation.html"));
    window.setInterval = setInterval;
    window.setTimeout = setTimeout;
    window.clearInterval = clearInterval;
  });

  afterEach(() => {
    if (typeof page?.close === "function") page.close();
  });

  it("extracts rich message data from DOM conversation", () => {
    const messages = whatsappMessages(document);
    expect(messages).toHaveLength(6);

    expect(messages[0]).toMatchObject({
      messageId: "AC186CE91CBE1B7EA49A2127E5DDE29D",
      authorPhone: "100000000000",
      isSystemMessage: false,
      isRecalled: false,
      userId: "120363403498637789",
      author: "Member Alpha",
    });
    expect(messages[0].text.trim()).toMatch(/^As far as US dairy argument/i);
    expect(messages[0].time).toBeInstanceOf(Date);
    expect(messages[0].time.getHours()).toBe(9);
    expect(messages[0].time.getMinutes()).toBe(12);
    expect(messages[0].time.getMonth()).toBe(11);
    expect(messages[0].time.getDate()).toBe(10);

    const secondExpected = new Date(messages[0].time);
    secondExpected.setHours(21, 34, 0, 0);
    expect(messages[1]).toMatchObject({
      messageId: "3EB036C7035BE6F5227333",
      authorPhone: "100000000001",
      author: "Member Alpha",
      reactions: "👍, ❤ 4",
    });
    expect(messages[1].time).toBe(secondExpected.toISOString());

    expect(messages[2]).toMatchObject({
      messageId: "AC808B3EE3AB05D57A37A08250124655",
      isSystemMessage: true,
      isRecalled: false,
      userId: "120363403498637789",
    });
    expect(messages[2].authorPhone).toBeUndefined();
    expect(messages[2].text).toContain("changed to a new mobile number");

    // This message has no explicit author and follows a system message
    // It should inherit the author from the last non-system message (Member Alpha)
    const noAuthorExpected = new Date(messages[1].time);
    noAuthorExpected.setHours(21, 45, 0, 0);
    expect(messages[3]).toMatchObject({
      messageId: "NOAUTHORMSG",
      authorPhone: "100000000001",
      isSystemMessage: false,
      isRecalled: false,
      author: "Member Alpha",
    });
    expect(messages[3].text.trim()).toMatch(/^This message has no explicit author/i);
    expect(messages[3].time).toBe(noAuthorExpected.toISOString());

    expect(messages[4]).toMatchObject({
      messageId: "3EB0E63CFC6AC65FD9BF6E",
      authorPhone: "100000000001",
      quoteAuthor: "Member Alpha",
      quoteAuthorPhone: "001000000000",
      quoteMessageId: "AC186CE91CBE1B7EA49A2127E5DDE29D",
    });
    expect(messages[4].quoteText.trim()).toMatch(/^As far as US dairy argument/i);

    expect(messages[5]).toMatchObject({
      messageId: "GIFMSG1",
      authorPhone: "100000000002",
      quoteAuthor: "Member Gamma",
      quoteAuthorPhone: "001000000003",
      text: "(media-gif)",
    });
    expect(messages[5].text).toBe("(media-gif)");
    expect(messages[5].quoteText.trim()).toMatch(/^"Corn fields look impressive on camera/);
  });

  it("prefers richer fields when merging message updates", () => {
    const state = createScraperState();
    mergeMessages(
      [
        {
          messageId: "abc",
          text: "short",
          authorPhone: "123",
        },
      ],
      state,
    );
    mergeMessages(
      [
        {
          messageId: "abc",
          text: "a much longer message body with more context",
          reactions: "🔥",
        },
      ],
      state,
    );

    expect(state.messagesById.abc).toMatchObject({
      text: "a much longer message body with more context",
      authorPhone: "123",
      reactions: "🔥",
    });
  });

  it("scrape keeps the live state in sync and copies the transcript", { timeout: 10_000 }, async () => {
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

    const main = document.getElementById("main");
    const button = document.getElementById("copy-btn");
    expect(button).not.toBeNull();
    expect(button.textContent).toBe("Copy 6 messages");

    const newRow = document.createElement("div");
    newRow.setAttribute("role", "row");
    newRow.innerHTML = `
        <div data-id="false_120363403498637789@g.us_NEWMSGID_1234567890@lid">
          <div data-pre-plain-text="[5:05 am, 12/10/2025] +91 12345 67890: ">
            <div class="selectable-text">New insight on dairy trade.</div>
            <div role=""><span dir="ltr">Sayali</span></div>
          </div>
        </div>
      `;
    main.appendChild(newRow);

    await vi.advanceTimersByTimeAsync(500);

    expect(state.messagesById.NEWMSGID).toMatchObject({
      text: "New insight on dairy trade.",
      author: "Sayali",
    });

    const refreshedButton = document.getElementById("copy-btn");
    expect(refreshedButton.textContent).toBe("Copy 7 messages");

    refreshedButton.click();
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(resolveClipboard).toBeTypeOf("function");
    resolveClipboard();
    await Promise.resolve();

    const payload = writeText.mock.calls[0][0];
    const parsed = JSON.parse(payload);
    expect(parsed).toHaveLength(7);
    const newEntry = parsed.find((msg) => msg.messageId === "NEWMSGID");
    expect(newEntry).toMatchObject({
      messageId: "NEWMSGID",
      author: "Sayali",
    });

    expect(document.getElementById("copy-btn")).toBeNull();
    expect(state.captureTimer).toBeNull();
  });
});
