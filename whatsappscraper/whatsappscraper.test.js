import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import path from "node:path";
import { fileURLToPath } from "url";
import { Window } from "happy-dom";
import { loadFrom } from "../common/testutils.js";
import { createScraperState, mergeMessages, scrape, whatsappMessages } from "./whatsappscraper.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe("whatsappscraper", () => {
  let page;
  let document;
  let window;

  function messagesFrom(html) {
    const win = new Window();
    win.document.body.innerHTML = html;
    return whatsappMessages(win.document);
  }

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

  it("inherits lastAuthor when message has NO author section (continuation)", () => {
    const messages = messagesFrom(`
      <div id="main">
        <div role="row">
          <div data-id="false_120363403498637789@g.us_MSG1_123@lid">
            <div data-pre-plain-text="[9:12 am, 10/12/2025] +00 00000 00000: ">
              <div class="selectable-text">First message</div>
              <div role=""><span dir="ltr">User A</span></div>
            </div>
          </div>
        </div>
        <div role="row">
          <div data-id="false_120363403498637789@g.us_MSG2_123@lid">
            <div data-pre-plain-text="[9:13 am, 10/12/2025] +00 00000 00000: ">
              <div class="selectable-text">Continuation message</div>
            </div>
          </div>
        </div>
      </div>
    `);
    expect(messages).toHaveLength(2);
    expect(messages[0].author).toBe("User A");
    expect(messages[0].authorPhone).toBe("+00 00000 00000");
    expect(messages[1].author).toBe("User A"); // Should inherit
    expect(messages[1].authorPhone).toBe("+00 00000 00000");
  });

  it("extracts data-plain-text from any element", () => {
    const messages = messagesFrom(`
      <div id="main">
        <div role="row">
          <div data-id="false_123@g.us_MSG1_456@lid">
            <div data-pre-plain-text="[1:14 pm, 12/11/2025] +00 000: ">
              <div class="selectable-text">
                <span>Hello <span data-plain-text="🌍">globe</span> world <img data-plain-text="😂" src="x"></span>
              </div>
              <div role=""><span dir="ltr">User</span></div>
            </div>
          </div>
        </div>
      </div>
    `);
    expect(messages[0].text).toBe("Hello 🌍 world 😂");
  });

  it("falls back to img.emoji alt when data-plain-text is missing", () => {
    const messages = messagesFrom(`
      <div id="main">
        <div role="row">
          <div data-id="false_123@g.us_MSG2_456@lid">
            <div data-pre-plain-text="[1:15 pm, 12/11/2025] +00 000: ">
              <div class="selectable-text">
                <span>Thinking <img class="emoji" alt="🤔" src="x"></span>
              </div>
              <div role=""><span dir="ltr">User</span></div>
            </div>
          </div>
        </div>
      </div>
    `);
    expect(messages[0].text).toBe("Thinking 🤔");
  });

  it("does NOT inherit lastAuthor when message has author section but no dir element (phone number only)", () => {
    const messages = messagesFrom(`
      <div id="main">
        <div role="row">
          <div data-id="false_120363403498637789@g.us_MSG1_123@lid">
            <div data-pre-plain-text="[9:12 am, 10/12/2025] +00 00000 00000: ">
              <div class="selectable-text">First message</div>
              <div role=""><span dir="ltr">User A</span></div>
            </div>
          </div>
        </div>
        <div role="row">
          <div data-id="false_120363403498637789@g.us_MSG2_999@lid">
            <div data-pre-plain-text="[9:14 am, 10/12/2025] +00 00000 00001: ">
              <div class="selectable-text">Message from unknown contact</div>
              <div role="">
                <span class="_ahx_">+00 00000 00001</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `);
    expect(messages).toHaveLength(2);
    expect(messages[0].author).toBe("User A");
    expect(messages[0].authorPhone).toBe("+00 00000 00000");
    expect(messages[1].author).toBeUndefined(); // Should NOT inherit
    expect(messages[1].authorPhone).toBe("+00 00000 00001"); // But phone is extracted from data-pre-plain-text
  });

  it("extracts link title + description (and appends when message is link-only)", () => {
    const messages = messagesFrom(`
      <div id="main">
        <div role="row">
          <div data-id="false_123@g.us_LINKMSG_456@lid">
            <div data-pre-plain-text="[1:15 pm, 12/11/2025] +00 000: ">
              <div class="preview-card">
                <div>
                  <span>Example Title</span>
                </div>
                <div>
                  <span>Example description.</span>
                </div>
                <div>
                  <span>thinkingmachines.ai</span>
                </div>
              </div>
              <div class="selectable-text">
                <a href="https://thinkingmachines.ai/blog/tinker-general-availability/">https://thinkingmachines.ai/blog/tinker-general-availability/</a>
              </div>
              <div role=""><span dir="ltr">User</span></div>
            </div>
          </div>
        </div>
      </div>
    `);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      messageId: "LINKMSG",
      linkUrl: "https://thinkingmachines.ai/blog/tinker-general-availability/",
      linkSite: "thinkingmachines.ai",
      linkTitle: "Example Title",
      linkDescription: "Example description.",
    });
    expect(messages[0].text).toContain("https://thinkingmachines.ai/blog/tinker-general-availability/");
    expect(messages[0].text).toContain("Example Title");
    expect(messages[0].text).toContain("Example description.");
  });

  it("accepts preview site text that includes www", () => {
    const messages = messagesFrom(`
      <div id="main">
        <div role="row">
          <div data-id="false_123@g.us_LINKMSG2_456@lid">
            <div data-pre-plain-text="[1:15 pm, 12/11/2025] +00 000: ">
              <div class="preview-card">
                <div><span>Now available in public beta</span></div>
                <div><span>Quickstart docs inside.</span></div>
                <div><span>www.linkedin.com</span></div>
              </div>
              <div class="selectable-text">
                <a href="https://www.linkedin.com/posts/introducing-the-interactions-api">https://www.linkedin.com/posts/introducing-the-interactions-api</a>
              </div>
              <div role=""><span dir="ltr">User</span></div>
            </div>
          </div>
        </div>
      </div>
    `);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      messageId: "LINKMSG2",
      linkUrl: "https://www.linkedin.com/posts/introducing-the-interactions-api",
      linkSite: "linkedin.com",
      linkTitle: "Now available in public beta",
      linkDescription: "Quickstart docs inside.",
    });
  });

  it("extracts link preview even when selectable text is a caption + url", () => {
    const messages = messagesFrom(`
      <div id="main">
        <div role="row">
          <div data-id="false_123@g.us_XMSG_456@lid">
            <div data-pre-plain-text="[1:15 pm, 12/11/2025] +00 000: ">
              <div class="preview-card">
                <div><span>Example preview title</span></div>
                <div><span>Example preview description.</span></div>
                <div><span>x.com</span></div>
              </div>
              <div class="selectable-text">
                Some caption text
                <a href="https://x.com/claudeai/status/1999209593247826419">https://x.com/claudeai/status/1999209593247826419</a>
              </div>
              <div role=""><span dir="ltr">User</span></div>
            </div>
          </div>
        </div>
      </div>
    `);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      messageId: "XMSG",
      linkUrl: "https://x.com/claudeai/status/1999209593247826419",
      linkSite: "x.com",
      linkTitle: "Example preview title",
      linkDescription: "Example preview description.",
    });
    expect(messages[0].text).toContain("Some caption text");
    expect(messages[0].text).toContain("https://x.com/claudeai/status/1999209593247826419");
    expect(messages[0].text).not.toContain("Example preview title");
  });

  it("extracts YouTube preview text even when URL host is youtu.be", () => {
    const messages = messagesFrom(`
      <div id="main">
        <div role="row">
          <div data-id="false_123@g.us_YTMSG_456@lid">
            <div data-pre-plain-text="[1:15 pm, 12/11/2025] +00 000: ">
              <div class="preview-card">
                <div><span>Example video title</span></div>
                <div><span>Example video description.</span></div>
                <div><span>youtube.com</span></div>
              </div>
              <div class="selectable-text">
                <a href="https://youtu.be/qMAg8_yf9zA?si=MZvj6D6821Rael45">https://youtu.be/qMAg8_yf9zA?si=MZvj6D6821Rael45</a>
              </div>
              <div role=""><span dir="ltr">User</span></div>
            </div>
          </div>
        </div>
      </div>
    `);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      messageId: "YTMSG",
      linkUrl: "https://youtu.be/qMAg8_yf9zA?si=MZvj6D6821Rael45",
      linkSite: "youtu.be",
      linkTitle: "Example video title",
      linkDescription: "Example video description.",
    });
  });

  it("does not confuse title text with the URL line (horses.html)", () => {
    const messages = messagesFrom(`
      <div id="main">
        <div role="row">
          <div data-id="false_123@g.us_HORSEMSG_456@lid">
            <div data-pre-plain-text="[1:15 pm, 12/11/2025] +00 000: ">
              <div class="preview-card">
                <div><span>Horses</span></div>
                <div><span>AI progress is steady. Human equivalence is sudden.</span></div>
                <div><span>andyljones.com</span></div>
              </div>
              <div class="selectable-text">
                <a href="https://andyljones.com/posts/horses.html">https://andyljones.com/posts/horses.html</a>
              </div>
              <div role=""><span dir="ltr">User</span></div>
            </div>
          </div>
        </div>
      </div>
    `);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      messageId: "HORSEMSG",
      linkUrl: "https://andyljones.com/posts/horses.html",
      linkSite: "andyljones.com",
      linkTitle: "Horses",
      linkDescription: "AI progress is steady. Human equivalence is sudden.",
    });
  });

  it("extracts preview when author is '.' and message is a caption + link (cookbook.openai.com)", () => {
    const messages = messagesFrom(`
      <div id="main">
        <div role="row">
          <div data-id="false_123@g.us_COOKMSG_456@lid">
            <div data-pre-plain-text="[8:58 pm, 12/09/2025] +00 000: ">
              <div aria-label="Quoted message">
                <div role="">
                  <span>+00 00000 00001</span>
                  <span aria-label="User Q">User Q</span>
                </div>
                <span class="quoted-mention">Quoted message content</span>
              </div>
              <div class="preview-card">
                <div><span>Example article title</span></div>
                <div><span>Example article description...</span></div>
                <div><span>cookbook.openai.com</span></div>
              </div>
              <div class="selectable-text">
                Caption text
                <a href="https://cookbook.openai.com/articles/openai-harmony#receiving-tool-calls">https://cookbook.openai.com/articles/openai-harmony#receiving-tool-calls</a>
              </div>
              <div role=""><span dir="ltr">.</span></div>
            </div>
          </div>
        </div>
      </div>
    `);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      messageId: "COOKMSG",
      linkUrl: "https://cookbook.openai.com/articles/openai-harmony#receiving-tool-calls",
      linkSite: "cookbook.openai.com",
      linkTitle: "Example article title",
      linkDescription: "Example article description...",
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
    expect(button.textContent).toBe("Copy 5 messages");

    const newRow = document.createElement("div");
    newRow.setAttribute("role", "row");
    newRow.innerHTML = `
        <div data-id="false_120363403498637789@g.us_NEWMSGID_123@lid">
          <div data-pre-plain-text="[5:05 am, 12/10/2025] +00 00000 00000: ">
            <div class="selectable-text">New insight on dairy trade.</div>
            <div role=""><span dir="ltr">User Z</span></div>
          </div>
        </div>
      `;
    main.appendChild(newRow);

    await vi.advanceTimersByTimeAsync(500);

    expect(state.messagesById.NEWMSGID).toMatchObject({
      text: "New insight on dairy trade.",
      author: "User Z",
      authorPhone: "+00 00000 00000",
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
      author: "User Z",
      authorPhone: "+00 00000 00000",
    });

    expect(document.getElementById("copy-btn")).toBeNull();
    expect(state.captureTimer).toBeNull();
  });
});
