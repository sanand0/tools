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
    expect(messages).toHaveLength(5);

    expect(messages[0]).toMatchObject({
      messageId: "AC186CE91CBE1B7EA49A2127E5DDE29D",
      authorPhone: "+00 10000 00000",
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
      author: "Member Alpha",
      reactions: "👍, ❤ 4",
    });
    expect(messages[1].authorPhone).toBeUndefined(); // No data-pre-plain-text
    expect(messages[1].time).toBe(secondExpected.toISOString());

    expect(messages[2]).toMatchObject({
      messageId: "AC808B3EE3AB05D57A37A08250124655",
      isSystemMessage: true,
      isRecalled: false,
      userId: "120363403498637789",
    });
    expect(messages[2].authorPhone).toBeUndefined();
    expect(messages[2].text).toContain("changed to a new mobile number");

    expect(messages[3]).toMatchObject({
      messageId: "3EB0E63CFC6AC65FD9BF6E",
      authorPhone: "+00 10000 00001",
      quoteAuthor: "Member Alpha",
      quoteAuthorPhone: "001000000000",
      quoteMessageId: "AC186CE91CBE1B7EA49A2127E5DDE29D",
    });
    expect(messages[3].quoteText.trim()).toMatch(/^As far as US dairy argument/i);

    expect(messages[4]).toMatchObject({
      messageId: "GIFMSG1",
      quoteAuthor: "Member Gamma",
      quoteAuthorPhone: "001000000003",
      text: "(media-gif)",
    });
    expect(messages[4].authorPhone).toBeUndefined(); // No data-pre-plain-text
    expect(messages[4].text).toBe("(media-gif)");
    expect(messages[4].quoteText.trim()).toMatch(/^"Corn fields look impressive on camera/);
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

  it("inherits lastAuthor when message has NO author section (continuation)", async () => {
    const { Window } = await import("happy-dom");
    const win = new Window();
    win.document.body.innerHTML = `
        <div id="main">
          <div role="row">
            <div data-id="false_120363403498637789@g.us_MSG1_1234567890@lid">
              <div data-pre-plain-text="[9:12 am, 10/12/2025] +91 12345 67890: ">
                <div class="selectable-text">First message</div>
                <div role=""><span dir="ltr">Known Author</span></div>
              </div>
            </div>
          </div>
          <div role="row">
            <div data-id="false_120363403498637789@g.us_MSG2_1234567890@lid">
              <div data-pre-plain-text="[9:13 am, 10/12/2025] +91 12345 67890: ">
                <div class="selectable-text">Continuation message</div>
              </div>
            </div>
          </div>
        </div>
    `;
    const messages = whatsappMessages(win.document);
    expect(messages).toHaveLength(2);
    expect(messages[0].author).toBe("Known Author");
    expect(messages[0].authorPhone).toBe("+91 12345 67890");
    expect(messages[1].author).toBe("Known Author"); // Should inherit
    expect(messages[1].authorPhone).toBe("+91 12345 67890");
  });

  it("extracts emojis from img tags in message text and quote text", async () => {
    const { Window } = await import("happy-dom");
    const win = new Window();
    win.document.body.innerHTML = `
        <div id="main">
          <div role="row">
            <div data-id="false_120363049558306142@g.us_3A1F09F1FDDD0934B858_149275984019540@lid">
              <div data-pre-plain-text="[1:14 pm, 12/11/2025] +1 (937) 708-1307: ">
                <div class="selectable-text">
                  <span>I would fund that startup <img crossorigin="anonymous" alt="😂" draggable="false" class="b82 emoji wa _ao3e selectable-text copyable-text" data-plain-text="😂" tabindex="-1" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" style="background-position: -40px -60px;"></span>
                </div>
                <div role=""><span dir="ltr">Pratik Desai</span></div>
                <div aria-label="Quoted message">
                  <div role="">
                    <span class="_ahx_">+91 96202 12419</span>
                    <span aria-label="Contact Name">Test Contact</span>
                  </div>
                  <div class="quoted-mention">AI Insurance? <img crossorigin="anonymous" alt="🤔" draggable="false" class="b96 emoji wa _ao3e" tabindex="-1" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" style="background-position: -40px -60px;"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
    `;
    const messages = whatsappMessages(win.document);
    expect(messages).toHaveLength(1);
    expect(messages[0].text).toBe("I would fund that startup 😂");
    expect(messages[0].quoteText).toBe("AI Insurance? 🤔");
    expect(messages[0].author).toBe("Pratik Desai");
    expect(messages[0].authorPhone).toBe("+1 (937) 708-1307");
  });

  it("does NOT inherit lastAuthor when message has author section but no dir element (phone number only)", async () => {
    const { Window } = await import("happy-dom");
    const win = new Window();
    win.document.body.innerHTML = `
        <div id="main">
          <div role="row">
            <div data-id="false_120363403498637789@g.us_MSG1_1234567890@lid">
              <div data-pre-plain-text="[9:12 am, 10/12/2025] +91 12345 67890: ">
                <div class="selectable-text">First message</div>
                <div role=""><span dir="ltr">Known Author</span></div>
              </div>
            </div>
          </div>
          <div role="row">
            <div data-id="false_120363403498637789@g.us_MSG2_9999999999@lid">
              <div data-pre-plain-text="[9:14 am, 10/12/2025] +91 99100 35571: ">
                <div class="selectable-text">Message from unknown contact</div>
                <div role="">
                  <span class="_ahx_">+91 99100 35571</span>
                </div>
              </div>
            </div>
          </div>
        </div>
    `;
    const messages = whatsappMessages(win.document);
    expect(messages).toHaveLength(2);
    expect(messages[0].author).toBe("Known Author");
    expect(messages[0].authorPhone).toBe("+91 12345 67890");
    expect(messages[1].author).toBeUndefined(); // Should NOT inherit
    expect(messages[1].authorPhone).toBe("+91 99100 35571"); // But phone is extracted from data-pre-plain-text
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
    expect(button.textContent).toBe("Copy 5 messages");

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
      authorPhone: "+91 12345 67890",
    });

    const refreshedButton = document.getElementById("copy-btn");
    expect(refreshedButton.textContent).toBe("Copy 6 messages");

    refreshedButton.click();
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(resolveClipboard).toBeTypeOf("function");
    resolveClipboard();
    await Promise.resolve();

    const payload = writeText.mock.calls[0][0];
    const parsed = JSON.parse(payload);
    expect(parsed).toHaveLength(6);
    const newEntry = parsed.find((msg) => msg.messageId === "NEWMSGID");
    expect(newEntry).toMatchObject({
      messageId: "NEWMSGID",
      author: "Sayali",
      authorPhone: "+91 12345 67890",
    });

    expect(document.getElementById("copy-btn")).toBeNull();
    expect(state.captureTimer).toBeNull();
  });
});
