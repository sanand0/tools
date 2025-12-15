# WhatsApp Chat Scraper Bookmarklet

This tool is a browser bookmarklet that allows users to scrape messages from an active WhatsApp Web chat session. The extracted messages are compiled into a JSON format and copied to the user's clipboard.

![Screenshot](screenshot.webp)

## What it does

The WhatsApp Scraper extracts message data from the currently open chat in WhatsApp Web. To use it, a user navigates to WhatsApp Web, opens the desired chat, scrolls to load the message history they wish to capture, and then clicks the bookmarklet.

The scraper attempts to collect the following information for each message:

- Message ID
- Author's phone number identifier
- Author's display name
- Message text
- Link details (URL, site, preview title/description when available)
- Timestamp (derived from message metadata or display)
- Whether it's a system message (e.g., "User joined")
- Whether it's a recalled (deleted) message
- Details of any quoted message (author, text, and an attempt to link to the original quoted message ID)
- Reactions to the message

The collected data is structured as a JSON array of message objects, which is then copied to the clipboard.

Link previews (when WhatsApp renders them) are captured in:

- `linkUrl`
- `linkSite`
- `linkTitle` (optional)
- `linkDescription` (optional)

## Output format

The bookmarklet copies a JSON array of message objects to the clipboard.

- Output is **best-effort**: fields are included only when they can be extracted from the currently-rendered DOM.
- Output is **de-duplicated** by `messageId` while you scroll. If the same message is observed multiple times, the scraper keeps the “richer” version (for string fields, it prefers the longer value).
- Output is **sorted by time** (ascending) when copied. Messages with missing/unknown `time` are sorted first.

### Message object schema

Each entry in the JSON array is a “message-like row” from WhatsApp Web’s `#main` history view.

```ts
type WhatsAppScrapedMessage = {
  messageId: string;
  userId: string;
  isSystemMessage: boolean;
  isRecalled: boolean;

  time?: string; // ISO 8601 string in clipboard JSON
  author?: string;
  authorPhone?: string;
  text?: string;

  quoteAuthor?: string;
  quoteAuthorPhone?: string;
  quoteText?: string;
  quoteMessageId?: string;

  linkUrl?: string;
  linkSite?: string;
  linkTitle?: string;
  linkDescription?: string;

  reactions?: string;
};
```

### Field semantics

- `messageId`: Message identifier parsed from the row’s `data-id`. Used as the primary key for de-duplication and merging. Format is not documented by WhatsApp; it may change.
- `userId`: Chat identifier parsed from the row’s `data-id` (the chat JID “user” part, without the domain). Despite the name, this is **not** the message author; it’s the currently-open chat/thread id (often constant across all rows you scrape).
- `isSystemMessage`: Best-effort system-event flag derived from the row’s `data-id` prefix (historically `true_`/`false_`). In CDP checks on a group chat, all observed `data-id` values started with `false_`, so this flag may currently never be `true`.
- `isRecalled`: `true` when the row is a recalled/deleted message. Detected via `[data-icon="recalled"]`. Recalled rows usually have no `text`/`author`/`time`.
- `time`: Message timestamp. When present, the clipboard JSON contains an ISO 8601 string. Internally, `whatsappMessages()` returns a `Date` when parsed from `data-pre-plain-text`, and returns an ISO string when derived from the visible time-of-day fallback; it may be missing when neither source is available.
- `author`: Display name shown by WhatsApp for the sender. In group chats, WhatsApp sometimes omits author UI for consecutive messages; the scraper inherits the previous non-empty author only when the row has **no** author section. If the row has an author section but no name (`[dir]`), `author` can be missing even when `authorPhone` exists.
- `authorPhone`: Sender phone extracted from `data-pre-plain-text` (when present). This is a raw string like `+00 10000 00000` (not normalized). May be missing when WhatsApp doesn’t render `data-pre-plain-text`.
- `text`: Cleaned “human-visible” message content. Present for non-system, non-recalled rows when textual content can be extracted. Whitespace is collapsed for normal messages; link-only messages may contain newlines because preview title/description are appended. Some content (see caveats) is intentionally stripped. GIF rows are represented as `(media-gif)`.
- `quoteAuthor`: The quoted/replied-to author label. May be a display name (preferred) or a phone number string, depending on what WhatsApp renders in the quote header.
- `quoteAuthorPhone`: Digits-only phone number for the quoted author (when WhatsApp shows both phone + labeled name). Only set when the quote header contains both an unlabeled phone span and a labeled name span. Not guaranteed even when `quoteAuthor` is present.
- `quoteText`: Extracted quoted/replied-to snippet from `.quoted-mention` within the quote block. Depending on WhatsApp layout, this can include extra/repeated text (e.g., parts of the reply message) and should be treated as best-effort.
- `quoteMessageId`: Best-effort link to the earlier scraped message that the quote refers to. Only set when a previous scraped message has the same `author` as `quoteAuthor` **and** its `text` starts with `quoteText` (whitespace-normalized). This will be missing when the referenced message isn’t currently loaded/visible, has non-text content, or was edited.
- `linkUrl`: First external `http(s)` URL found in the row. Only the first link is captured even if the message contains multiple links.
- `linkSite`: Hostname of `linkUrl` (minus a leading `www.`). Present whenever `linkUrl` is present.
- `linkTitle`: Best-effort preview “title” extracted from the preview card text. Derived from the text immediately above the URL line in `row.innerText`, filtered to exclude author/quote/timestamp/reaction-count lines; may be absent or noisy.
- `linkDescription`: Best-effort preview “description” extracted from the preview card text. Same extraction approach as `linkTitle`; may be multi-line (joined with `\\n`).
- `reactions`: Human-readable reaction summary parsed from an `aria-label`. A normalized string like `👍, ❤ 4`. It is not a structured map of emoji → count.

### Link preview behavior

WhatsApp sometimes shows a “preview card” even when the message text is just the URL.

- If the message is **link-only** (the cleaned `text` matches the URL), the scraper appends `linkTitle` / `linkDescription` into `text` (joined with newlines) so downstream consumers see the same content as the WhatsApp bubble.
- If the message includes a **caption + link**, the preview fields are still extracted, but `text` remains the caption + URL (preview text is not appended).

## Rules and constraints (for refactors)

These are the observable invariants from the current implementation:

- Always emit `messageId`, `userId`, `isSystemMessage`, `isRecalled` for every row that is captured.
- If `linkUrl` is present, `linkSite` should also be present and should correspond to `new URL(linkUrl).hostname` (minus `www.`).
- If `quoteText` is present, `quoteAuthor` should usually be present, but `quoteAuthorPhone` and `quoteMessageId` are **optional** and best-effort.
- `reactions` is a freeform string; consumers must not assume a stable format beyond “human-readable summary”.
- `text` is normalized and may be missing for media-only or unhandled message types; consumers should handle message objects that lack `text`.

## Caveats / exceptions to handle

- **Only rendered history is scraped:** WhatsApp Web virtualizes the timeline; you must scroll to load older messages. Quotes may refer to messages that are not loaded, so `quoteMessageId` can be missing.
- **Quote blocks can be noisy:** WhatsApp can nest additional text inside the quote UI; `quoteText` can accidentally include parts of the reply message depending on DOM structure.
- **Many message types are currently “metadata-only”:** rows that don’t expose readable text in `.selectable-text` (common for media and some UI variants) may produce message objects with no `text` and often no `time`.
- **Locale-dependent date parsing:** `data-pre-plain-text` is parsed assuming a `dd/mm/yyyy` date order. In locales where WhatsApp renders `mm/dd/yyyy`, the derived `time` may be wrong.
- **Fallback timestamps are approximate:** when `data-pre-plain-text` is missing, the scraper uses the visible time-of-day and combines it with the previous message’s date; this can be wrong across day boundaries.
- **Text is aggressively normalized:** whitespace is collapsed for normal messages; curly quotes are normalized. Additionally, any `hh:mm am/pm` substring is stripped, which can remove legitimate time mentions from message text. Link-only messages re-introduce newlines when appending preview title/description.
- **Media coverage is limited:** GIFs are detected and represented as `(media-gif)`. Other media types (images/videos/docs/audio), forwarded flags, captions on non-link media, etc. are not first-class and may produce missing or noisy `text`.
- **System message detection is unverified:** in CDP checks, no `data-id` nodes used the historical `true_` prefix, so `isSystemMessage` may not currently be set even when system events are visible.
- **System/recalled rows are sparse:** when a row is treated as a system message, the scraper uses the raw `outerText`; recalled messages generally contain only identifiers/flags (and may sort to the beginning due to missing `time`).
- **Link preview extraction is heuristic:** it uses `row.innerText` line filtering, so preview title/description may be missing, mis-identified, or include stray UI text depending on WhatsApp layout.

## Use Cases

- **Personal Chat Backup:** Create a personal, offline backup of important WhatsApp conversations.
- **Data Analysis:** Analyze personal chat patterns, common phrases, or message frequency (for personal use only).
- **Information Retrieval:** Easily search through a large volume of messages once extracted, using tools that can process JSON.

**Important Considerations:**

- **Privacy & Ethics:** This tool scrapes data that is visible to you in your WhatsApp Web session. Be mindful of privacy and obtain consent if you are scraping shared conversations. Respect WhatsApp's terms of service. The scraped data is for personal use.
- **WhatsApp Web Updates:** WhatsApp Web's HTML structure can change. If it does, this scraper might stop working correctly or require updates to its selectors and parsing logic.
- **Performance:** Scraping very long chats by scrolling extensively might be resource-intensive for the browser.

## How It Works

1. **Installation (Setting up the Bookmarklet):**
   - Open the `index.html` file from this tool's directory in your browser.
   - Drag the "💬 WhatsApp Scraper" button displayed on that page to your browser's bookmarks bar. This creates the bookmarklet.
2. **Scraping Process:**
   - Go to [web.whatsapp.com](https://web.whatsapp.com/) and open the specific chat conversation you want to scrape.
   - Click the "💬 WhatsApp Scraper" bookmarklet from your browser's bookmarks bar. This displays a "Copy ... messages" button on the top right of WhatsApp.
   - **Crucially, scroll within the chat panel to load all the messages you intend to capture.** The scraper can only access messages that are currently rendered in the WhatsApp Web interface.
   - Click on the "Copy ... messages" button to copy the captured messages as JSON.
3. **Data Extraction:**
   - The bookmarklet executes JavaScript code in the context of the WhatsApp Web page.
   - This script queries the Document Object Model (DOM) to find HTML elements corresponding to messages.
   - It parses attributes and text content from these elements to extract message details (author, text, time, quotes, reactions).
   - Helper functions are used to process timestamps and other specific data points.
4. **Output:**
   - The extracted messages are formatted into a JSON string.
   - This JSON string is automatically copied to your clipboard.
   - Click the injected "Copy … messages" button to copy the JSON.

## CDP Verification

If you have a Chromium/Chrome instance running with the DevTools Protocol exposed (e.g. `--remote-debugging-port=9222`)
and an existing WhatsApp Web tab open, you can sanity-check the scraper output without using the bookmarklet:

- Build the bundled script: `npm --prefix whatsappscraper run build`
- Run the verifier: `node whatsappscraper/verify.mjs`

`verify.mjs` connects to `http://localhost:9222`, injects `whatsappscraper.min.js` into the WhatsApp Web tab, runs
`whatsappscraper.whatsappMessages(document)`, and prints a representative message (prefering one with link preview data).

## Technical Details

- The core scraping logic is in `whatsappscraper.js`.
- The `package.json` defines a build script using `esbuild` to bundle and minify `whatsappscraper.js` into `whatsappscraper.min.js`.
- The `index.html` page fetches this minified script to construct the `javascript:` URL for the bookmarklet.
- The tool is entirely client-side and runs within the user's browser. It does not involve any external server for the scraping process itself.
