import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import path from "node:path";
import { fileURLToPath } from "url";
import { Window } from "happy-dom";
import { loadFrom } from "../common/testutils.js";
import {
  createScraperState,
  mergeMessages,
  scrape,
  whatsappMessages,
} from "./whatsappscraper.js";

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
    ({ page, document, window } = await loadFrom(
      __dirname,
      "__fixtures__/conversation.html",
    ));
    window.setInterval = setInterval;
    window.setTimeout = setTimeout;
    window.clearInterval = clearInterval;
  });

  afterEach(() => {
    if (typeof page?.close === "function") page.close();
  });

  it("extracts rich message data from the legacy conversation fixture", () => {
    const messages = whatsappMessages(document);
    expect(messages).toHaveLength(5);

    expect(messages[0]).toMatchObject({
      messageId: "AC186CE91CBE1B7EA49A2127E5DDE29D",
      authorPhone: "+00 10000 00000",
      userId: "120363403498637789",
      author: "Member Alpha",
      time: "2025-12-10T09:12:00.000Z",
    });
    expect(messages[0].text).toMatch(/^As far as US dairy argument/i);
    expect(messages[0]).not.toHaveProperty("isOutgoing");
    expect(messages[0]).not.toHaveProperty("isRecalled");
    expect(messages[0]).not.toHaveProperty("isSystemMessage");

    expect(messages[1]).toMatchObject({
      messageId: "3EB036C7035BE6F5227333",
      author: "Member Alpha",
      reactions: "👍, ❤ 4",
      time: "2025-12-10T21:34:00.000Z",
    });
    expect(messages[1].authorPhone).toBeUndefined();

    expect(messages[2]).toMatchObject({
      messageId: "RECALLEDMSG1",
      isRecalled: true,
      userId: "120363403498637789",
    });
    expect(messages[2].text).toBeUndefined();

    expect(messages[3]).toMatchObject({
      messageId: "3EB0E63CFC6AC65FD9BF6E",
      authorPhone: "+00 10000 00001",
      quoteAuthor: "Member Alpha",
      quoteAuthorPhone: "001000000000",
      quoteMessageId: "AC186CE91CBE1B7EA49A2127E5DDE29D",
      time: "2025-10-12T04:32:00.000Z",
    });
    expect(messages[3].quoteText).toMatch(
      /^As far as US dairy argument is concerned/i,
    );

    expect(messages[4]).toMatchObject({
      messageId: "GIFMSG1",
      authorPhone: "+00 10000 00002",
      mediaType: "gif",
      quoteAuthor: "Member Gamma",
      quoteAuthorPhone: "001000000003",
      text: "(media-gif)",
      time: "2025-10-12T21:34:00.000Z",
    });
    expect(messages[4].quoteText).toMatch(
      /^"Corn fields look impressive on camera/i,
    );
  });

  it("extracts clean current-style messages from the curated HTML fixture", async () => {
    const { page: fixturePage, document: fixtureDocument } = await loadFrom(
      __dirname,
      "test-messages.html",
    );
    const messages = whatsappMessages(fixtureDocument);
    fixturePage.close();

    expect(messages).toHaveLength(9);

    expect(messages[0]).toMatchObject({
      messageId: "MSG001",
      userId: "120363403498637789",
      author: "Ravi Menon",
      authorPhone: "+65 9000 0001",
      time: "2026-03-22T13:52:00.000Z",
      text: "Very sad to hear this. May he rest in peace 🙏",
    });
    expect(messages[0]).not.toHaveProperty("isOutgoing");
    expect(messages[0]).not.toHaveProperty("isRecalled");
    expect(messages[0]).not.toHaveProperty("isSystemMessage");

    expect(messages[1]).toMatchObject({
      messageId: "MSG002",
      author: "Ravi Menon",
      authorPhone: "+65 9000 0001",
      time: "2026-03-22T14:28:00.000Z",
      reactions: "👍",
      text: "Golden Village did not agree to a full hall screening for Dhurandhar 2 in the first weekend, so we could not organise it.",
    });

    expect(messages[2]).toMatchObject({
      messageId: "MSG003",
      author: "Aravind Rao",
      authorPhone: "+65 9000 0002",
      time: "2026-03-24T15:24:00.000Z",
      text: "Thanks Anand, and hello everyone. Great to be part of this community.",
    });

    expect(messages[3]).toMatchObject({
      messageId: "MSG004",
      author: "Pawan Sachdeva",
      authorPhone: "+65 9000 0003",
      time: "2026-03-24T15:28:00.000Z",
      quoteAuthor: "Aravind Rao",
      quoteAuthorPhone: "6590000002",
      quoteMessageId: "MSG003",
      quoteText:
        "Thanks Anand, and hello everyone. Great to be part of this community.",
      reactions: "👍",
      text: "Welcome!",
    });
    expect(messages[3].text).not.toContain("Pawan");
    expect(messages[3].text).not.toContain("15:28");
    expect(messages[3].text).not.toContain("Aravind");

    expect(messages[4]).toMatchObject({
      messageId: "MSG005",
      userId: "120363403498637789",
      isOutgoing: true,
      author: "Jordan Poe",
      time: "2025-12-14T20:05:00.000Z",
      quoteAuthor: "Richa Shah",
      quoteText:
        "Hi Jordan\nBack on the 22nd.\nLunch on the 22nd or 23rd would work.\n\nOthers?",
      text: "22 Dec lunch or evening works well for me. 23 Dec evening works too.",
    });
    expect(messages[4]).not.toHaveProperty("isSystemMessage");

    expect(messages[5]).toMatchObject({
      messageId: "MSG006",
      userId: "120363403498637789",
      isRecalled: true,
      authorPhone: "+65 9000 0004",
      time: "2025-12-14T20:07:00.000Z",
    });
    expect(messages[5].text).toBeUndefined();

    expect(messages[6]).toMatchObject({
      messageId: "MSG007",
      author: "Sana Iyer",
      authorPhone: "+65 9000 0005",
      time: "2025-12-14T21:12:00.000Z",
      linkUrl:
        "https://cookbook.openai.com/articles/openai-harmony#receiving-tool-calls",
      linkSite: "cookbook.openai.com",
      linkTitle: "Example article title",
      linkDescription: "Example article description.",
    });
    expect(messages[6].text).toContain("Worth a read");
    expect(messages[6].text).toContain(
      "https://cookbook.openai.com/articles/openai-harmony#receiving-tool-calls",
    );
    expect(messages[6].text).not.toContain("Example article title");

    expect(messages[7]).toMatchObject({
      messageId: "MSG008",
      author: "Asha Rao",
      authorPhone: "+65 9000 0099",
      time: "2026-03-24T14:20:00.000Z",
      mediaType: "image",
      mediaCaption: "Venue map for tonight's event",
      mediaWidth: 330,
      mediaHeight: 248,
      text: "Venue map for tonight's event",
    });

    expect(messages[8]).toMatchObject({
      messageId: "MSG009",
      author: "Vijay Gupta",
      authorPhone: "+65 9777 7777",
      time: "2026-03-25T11:20:00.000Z",
      mediaType: "voice",
      mediaDuration: "0:37",
      mediaDurationSeconds: 37,
    });
    expect(messages[8].text).toBeUndefined();
  });

  it("extracts Apr 19 2026 bare-data-id rows and makes userId optional", async () => {
    const { page: fixturePage, document: fixtureDocument } = await loadFrom(
      __dirname,
      "test-messages-2026-04.html",
    );
    const messages = whatsappMessages(fixtureDocument);
    fixturePage.close();

    expect(messages).toHaveLength(2);

    expect(messages[0]).toMatchObject({
      messageId: "3EB0041865291286CF6A5D",
      author: "Ashith",
      authorPhone: "+91 70928 62522",
      time: "2026-04-18T13:32:00.000Z",
      text: "need to try out\nhttps://specstory.com/",
      linkUrl: "https://specstory.com/",
      linkSite: "specstory.com",
    });
    expect(messages[0]).not.toHaveProperty("userId");
    expect(messages[0]).not.toHaveProperty("isOutgoing");

    expect(messages[1]).toMatchObject({
      messageId: "3AOUTGOINGAPR2026",
      author: "Jordan Poe",
      isOutgoing: true,
      time: "2026-04-19T20:05:00.000Z",
      text: "Will try this tonight.",
    });
    expect(messages[1]).not.toHaveProperty("userId");
  });

  it("extracts image captions and dimensions from media messages", () => {
    const messages = messagesFrom(`
      <div id="main">
        <div role="row">
          <div data-id="false_123@g.us_IMGMSG_456@lid">
            <div class="copyable-text" data-pre-plain-text="[2:20 pm, 24/03/2026] +65 9000 0099: ">
              <div role="">
                <span dir="auto">Asha Rao</span>
                <span class="_ahx_">+65 9000 0099</span>
              </div>
              <div role="button" aria-label="Open picture" style="width: 330px; height: 248px;">
                <img
                  alt="Venue map for tonight's event"
                  width="330"
                  height="248"
                  src="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/"
                />
              </div>
              <div class="message-meta"><span dir="auto">2:20 pm</span></div>
            </div>
          </div>
        </div>
      </div>
    `);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      messageId: "IMGMSG",
      author: "Asha Rao",
      authorPhone: "+65 9000 0099",
      time: "2026-03-24T14:20:00.000Z",
      mediaType: "image",
      mediaCaption: "Venue map for tonight's event",
      mediaWidth: 330,
      mediaHeight: 248,
      text: "Venue map for tonight's event",
    });
  });

  it("extracts voice message duration metadata", () => {
    const messages = messagesFrom(`
      <div id="main">
        <div role="row">
          <div data-id="false_123@g.us_VOICEMSG_456@lid">
            <div class="copyable-text" data-pre-plain-text="[11:20, 25/03/2026] +65 9777 7777: ">
              <div role="">
                <span dir="auto">Vijay Gupta</span>
                <span class="_ahx_">+65 9777 7777</span>
              </div>
              <button aria-label="Play voice message"></button>
              <span aria-label="Voice message"></span>
              <div role="slider" aria-valuenow="0" aria-valuetext="0:00/0:37" aria-valuemin="0" aria-valuemax="37"></div>
              <div aria-hidden="true">0:37</div>
              <div class="message-meta"><span dir="auto">11:20</span></div>
            </div>
          </div>
        </div>
      </div>
    `);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      messageId: "VOICEMSG",
      author: "Vijay Gupta",
      authorPhone: "+65 9777 7777",
      time: "2026-03-25T11:20:00.000Z",
      mediaType: "voice",
      mediaDuration: "0:37",
      mediaDurationSeconds: 37,
    });
    expect(messages[0].text).toBeUndefined();
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

  it("upgrades late-loading numeric and tie-break fields when merging", () => {
    const state = createScraperState();
    mergeMessages(
      [
        {
          messageId: "img1",
          mediaType: "image",
          mediaWidth: 330,
          mediaHeight: 248,
          mediaCaption: "Flyer",
          time: "2026-03-24T14:20:00.000Z",
          reactions: "👍",
        },
      ],
      state,
    );
    mergeMessages(
      [
        {
          messageId: "img1",
          mediaType: "image",
          mediaWidth: 1080,
          mediaHeight: 1190,
          mediaCaption:
            "Flyer with full event details and registration link included",
          time: "2026-03-24T14:20:30.000Z",
          reactions: "❤",
        },
      ],
      state,
    );

    expect(state.messagesById.img1).toMatchObject({
      mediaType: "image",
      mediaWidth: 1080,
      mediaHeight: 1190,
      mediaCaption:
        "Flyer with full event details and registration link included",
      time: "2026-03-24T14:20:30.000Z",
      reactions: "❤",
    });
  });

  it("inherits the previous author when the message row omits the author block", () => {
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
    expect(messages[1].author).toBe("User A");
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

  it("does not inherit the previous author when the sender identity changed", () => {
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
    expect(messages[1].author).toBeUndefined();
    expect(messages[1].authorPhone).toBe("+00 00000 00001");
  });

  it("extracts link title and description and appends them when the message is link-only", () => {
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
    expect(messages[0].text).toContain(
      "https://thinkingmachines.ai/blog/tinker-general-availability/",
    );
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
      linkUrl:
        "https://www.linkedin.com/posts/introducing-the-interactions-api",
      linkSite: "linkedin.com",
      linkTitle: "Now available in public beta",
      linkDescription: "Quickstart docs inside.",
    });
  });

  it("extracts link preview even when the selectable text is a caption plus a URL", () => {
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
    expect(messages[0].text).toContain(
      "https://x.com/claudeai/status/1999209593247826419",
    );
    expect(messages[0].text).not.toContain("Example preview title");
  });

  it("extracts YouTube preview text even when the URL host is youtu.be", () => {
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

  it("does not confuse title text with the URL line", () => {
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

  it("extracts previews when the author label is punctuation and the message is a caption plus link", () => {
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
      linkUrl:
        "https://cookbook.openai.com/articles/openai-harmony#receiving-tool-calls",
      linkSite: "cookbook.openai.com",
      linkTitle: "Example article title",
      linkDescription: "Example article description...",
    });
  });

  it(
    "keeps the live state in sync and copies the transcript",
    { timeout: 10_000 },
    async () => {
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
    },
  );
});
