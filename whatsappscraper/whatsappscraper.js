const defaultState = createScraperState();

// Extract human-visible text from an element.
//
// WhatsApp renders emojis in multiple ways:
// - Real emoji characters, e.g. "😀"
// - Spans/images with `data-plain-text="😀"` (common in selectable/copyable regions)
// - Emoji images with `img.emoji[alt="😀"]`
//
// We clone the node and replace those wrappers with their plain-text equivalents so the
// resulting `.textContent` matches what a human would copy/paste.
function getTextWithEmojis(element) {
  if (!element) return undefined;
  const clone = element.cloneNode(true);
  for (const el of clone.querySelectorAll("[data-plain-text]")) el.replaceWith(el.dataset.plainText);
  for (const img of clone.querySelectorAll("img.emoji[alt]")) img.replaceWith(img.alt);
  return clone.textContent;
}

export function createScraperState(seed) {
  const messagesById = Object.create(null);
  if (seed) for (const [key, value] of Object.entries(seed)) messagesById[key] = value;
  return { messagesById, captureTimer: null };
}

export function whatsappMessages(rootDocument = document) {
  // WhatsApp Web renders each visible message row within `#main` with `role="row"`.
  //
  // Example (simplified):
  // <div id="main">
  //   <div role="row">
  //     <div data-id="false_<chat>@g.us_<MESSAGE_ID>_<internal>@lid">
  //       <div data-pre-plain-text="[9:12 am, 10/12/2025] +00 10000 00000: ">
  //         <div class="selectable-text">Hello</div>
  //         <div role=""><span dir="ltr">Member Alpha</span></div>
  //       </div>
  //     </div>
  //   </div>
  // </div>
  //
  // We prefer role/data-* attributes over classes because WhatsApp classes are frequently
  // obfuscated and change between builds.
  const messages = [];
  let lastAuthor;
  let lastTime;
  for (const el of rootDocument.querySelectorAll('#main [role="row"]')) {
    let rawText;
    let usedFallback = false;
    let hasGif = false;
    let [isSystemMessage, userId, _userDomain, messageId, _internalId, _authorDomain] = el
      .querySelector("[data-id]")
      .dataset.id.split(/[_@]/);
    // `data-id` is the most stable per-message identifier we have.
    // Format is not documented and can evolve, but in practice the message id sits in the 3rd segment:
    //   "false_<userId>@g.us_<messageId>_<internalId>@lid"
    // We split on "_" and "@" to avoid depending on domain suffixes.
    isSystemMessage = isSystemMessage === "true";
    // Recalled/deleted messages show a small "recalled" icon.
    let isRecalled = !!el.querySelector('[data-icon="recalled"]');
    const message = { messageId, isSystemMessage, isRecalled, userId };
    // Non-recalled system messages are typically:
    //  - user (joined via an invite link | joined from the community | was added | changed to new mobile)
    //  - admin (added | removed) user
    if (isSystemMessage && !isRecalled) message.text = el.outerText;
    if (!isSystemMessage && !isRecalled) {
      // TODO: Image links
      // TODO: Forwarded flag
      // Actual message content (typed text or link URL) is usually in `.selectable-text`.
      // This class has been comparatively stable and yields cleaner text than `el.innerText`
      // (which includes author, phone, preview text, timestamps, reactions, etc.).
      const selectable = el.querySelector(".selectable-text");
      rawText = getTextWithEmojis(selectable);
      // GIF messages have no meaningful text; detect via the play button label.
      hasGif = !!el.querySelector('[aria-label="Play GIF" i]');

      // Author line is rendered in a container with `role=""` and a child with a `[dir]` attribute.
      // (WhatsApp uses `[dir]` a lot to handle RTL/LTR names; it’s more stable than class names.)
      const authorSection = el.querySelector('[role=""]');
      message.author = authorSection?.querySelector("[dir]")?.textContent;

      // If it's a system message, e.g. adding/deleting a user, deleting a message, etc. use raw text
      if (!rawText) {
        if (hasGif) rawText = "(media-gif)";
        else {
          rawText = el.textContent;
          usedFallback = true;
        }
      }
      // If it's not a system message and there's no author section, it must be a continuation from last author
      if (!authorSection && !message.author && rawText) message.author = lastAuthor;

      // Time and authorPhone are available in data-pre-plain-text="[10:33 am, 8/5/2025] +91 99999 99999: "
      const prePlainText = el.querySelector("[data-pre-plain-text]")?.dataset.prePlainText;
      const { date, phone } = extractDateAndPhone(prePlainText);
      // Prefer `data-pre-plain-text` because it includes both date and author phone in a machine-readable
      // format. This is more robust than parsing a visual timestamp.
      message.time = date;
      if (phone) message.authorPhone = phone;
      // If not, the hh:mm am/pm is available in the last dir="auto"
      if (!message.time) {
        // WhatsApp often renders the visible time as the last `[dir="auto"]` in the row.
        // It's only a time-of-day, so we combine it with `lastTime`'s date to preserve chronology.
        const auto = [...el.querySelectorAll('[dir="auto"]')].at(-1);
        if (auto) message.time = updateTime(lastTime, auto.textContent);
        // Else it's a pinned message. Ignore it.
      }
    }
    lastTime = message.time;
    lastAuthor = message.author;

    // Quoted/replied messages:
    // - The quote container uses an aria-label "Quoted message"
    // - Inside is the quoted author (sometimes as an aria-label) and quoted text in `.quoted-mention`
    const quote = el.querySelector('[aria-label="Quoted message" i]');
    if (quote) {
      const quoteAuthorNoLabel = quote.querySelector('[role=""] :not([aria-label])')?.textContent;
      const quoteAuthorLabel = quote.querySelector('[role=""] [aria-label]')?.textContent;
      if (quoteAuthorLabel) {
        // Ensure quoteAuthorPhone matches authorPhone format
        message.quoteAuthorPhone = quoteAuthorNoLabel.replace(/[^0-9]+/g, "");
        message.quoteAuthor = quoteAuthorLabel;
      } else message.quoteAuthor = quoteAuthorNoLabel;
      message.quoteText = getTextWithEmojis(quote.querySelector(".quoted-mention"));
      // Find previous message
      if (message.quoteText)
        for (let j = messages.length - 1; j >= 0; j--) {
          const quoteText = message.quoteText.replace(/\s+/gs, " ").trim();
          if (message.quoteAuthor == messages[j].author && messages[j].text)
            if (messages[j].text.replace(/\s+/gs, " ").trim().startsWith(quoteText)) {
              // NOTE: If the previous message was edited, we won't find it.
              message.quoteMessageId = messages[j].messageId;
              break;
            }
        }
    }
    // Reactions are exposed via aria-label. We use two selectors because WhatsApp varies the casing.
    const reactions = el.querySelector('[aria-label^="Reactions "],[aria-label^="reaction "]');
    if (reactions)
      message.reactions = reactions
        .getAttribute("aria-label")
        .replace(/view reactions/i, "")
        .replace(/^reactions? */i, "")
        .replace(/ *in total/i, "")
        .replace(/[, .]+$/, "");
    if (!isSystemMessage && !isRecalled) {
      // Link previews:
      //
      // When a message is "link-only" (the message text is just the URL), WhatsApp renders an
      // expanded preview card inside the same row (title/description/site), in addition to the URL.
      // The preview card’s class structure is volatile, so we don't target it directly.
      //
      // Instead:
      // - Find the first external anchor `a[href^="http"]` (covers both the URL and preview links)
      // - Always capture `linkUrl/linkSite`
      // - If a preview card is present, anchor off the site line (e.g. "x.com") and read the smallest
      //   surrounding block to extract `linkTitle/linkDescription` without depending on volatile classes.
      const link = extractLinkDetails(el, { author: message.author, authorPhone: message.authorPhone, rawText });
      if (link) {
        message.linkUrl = link.url;
        message.linkSite = link.site;
        if (link.title) message.linkTitle = link.title;
        if (link.description) message.linkDescription = link.description;
      }
      const cleaned = cleanMessageText(rawText, {
        author: message.author,
        quoteAuthor: message.quoteAuthor,
        quoteText: message.quoteText,
        usedFallback,
        hasGif,
      });
      if (cleaned) {
        message.text = cleaned;
        // For link-only messages, include preview title/description in `.text` so downstream consumers
        // get the same "human-visible" content WhatsApp shows in the bubble.
        if (link?.title && normalizeUrl(cleaned) === normalizeUrl(link.url)) {
          const previewParts = [link.title, link.description].filter(Boolean);
          if (previewParts.length) message.text = [cleaned, ...previewParts].join("\n");
        }
      } else delete message.text;
    }
    messages.push(message);
  }
  return messages;
}

function normalizeUrl(value) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\/+$/, "");
}

function textLines(value) {
  return (value || "")
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function normalizeLine(value) {
  return normalizeUrl((value || "").trim()).toLowerCase();
}

function isTimeLine(value) {
  return /^\d{1,2}:\d{2}\s*(?:am|pm)\b/i.test(value || "");
}

function isTinyCountLine(value) {
  return /^\d{1,3}$/.test((value || "").trim());
}

function looksLikeDomain(value) {
  return /^[a-z0-9.-]+\.[a-z]{2,}$/i.test((value || "").trim());
}

function looksLikeUrl(value) {
  const t = (value || "").trim();
  if (!t) return false;
  if (/^https?:\/\//i.test(t)) return true;
  if (/\s/.test(t)) return false;
  // Reject punctuation-only lines like "." that can appear as author names.
  return /[a-z0-9]/i.test(t) && /[/.]/.test(t);
}

function extractLinkDetails(messageRow, { author, authorPhone, rawText } = {}) {
  // Links in WhatsApp messages are typically rendered as <a href="https://…">…</a>.
  // We only consider http(s) links; internal blob: and data: URLs are ignored by this selector.
  // Prefer links inside `.selectable-text` because preview cards may contain extra links (e.g. in description).
  const a = messageRow.querySelector('.selectable-text a[href^="http"],a[href^="http"]');
  if (!a?.href) return null;
  let site;
  try {
    site = new URL(a.href).hostname.replace(/^www\./i, "");
  } catch {
    return null;
  }

  const selectableText =
    typeof rawText === "string" ? rawText : getTextWithEmojis(messageRow.querySelector(".selectable-text"));
  const selectableLineSet = new Set(textLines(selectableText));
  const quoteLineSet = new Set(textLines(messageRow.querySelector('[aria-label="Quoted message" i]')?.innerText));

  // Preview text appears above the URL line inside the same message row. Instead of using brittle preview-card
  // selectors, anchor off the URL's position in `row.innerText` and extract the text immediately preceding it.
  const urlNorm = normalizeLine(a.href);
  const allLines = textLines(messageRow.innerText);
  const urlIndex = allLines.findIndex((line) => {
    const n = normalizeLine(line);
    if (!looksLikeUrl(line)) return false;
    return n === urlNorm || n.includes(urlNorm) || urlNorm.includes(n);
  });
  if (urlIndex < 0) return { url: a.href, site };

  let candidates = allLines.slice(0, urlIndex).filter((line) => {
    if (author && line === author) return false;
    if (authorPhone && line === authorPhone) return false;
    if (selectableLineSet.has(line)) return false;
    if (quoteLineSet.has(line)) return false;
    if (isTimeLine(line)) return false;
    if (isTinyCountLine(line)) return false;
    return true;
  });

  // Preview cards commonly end with a site line like "youtube.com" (not necessarily the same as the URL host).
  if (looksLikeDomain(candidates.at(-1))) candidates = candidates.slice(0, -1);

  const [title, ...rest] = candidates;
  const description = rest.join("\n").trim() || undefined;
  return title ? { url: a.href, site, title, description } : { url: a.href, site };
}

function extractDateAndPhone(prePlainText) {
  const result = { date: null, phone: null };
  if (!prePlainText) return result;
  // Format: "[10:33 am, 8/5/2025] +91 99999 99999: "
  const match = prePlainText.match(/\[(\d{1,2}:\d{2}\s?[ap]m),\s?(\d{1,2})\/(\d{1,2})\/(\d{4})\]\s*(.+?):\s*$/);
  if (match) {
    result.date = new Date(`${match[4]}-${match[3]}-${match[2]} ${match[1]}`);
    result.phone = match[5].trim();
  }
  return result;
}

// If lastTime an ISO string and time is like "10:18 pm", return lastTime updated with time as ISO
function updateTime(lastTime, time) {
  const match = time.match(/(\d+):(\d+)\s+(am|pm)/i);
  if (!match) return null;
  const [h, m] = match.slice(1, 3).map(Number);
  const isPM = /pm/i.test(time);
  const date = lastTime ? new Date(lastTime) : new Date();
  date.setHours((h % 12) + (isPM ? 12 : 0), m, 0, 0);
  return date.toISOString();
}

export function mergeMessages(arr, state = defaultState) {
  for (const msg of arr) {
    const existing = state.messagesById[msg.messageId] || {};
    for (const [k, v] of Object.entries(msg)) {
      const old = existing[k];
      if (typeof v === "string") {
        if ((v?.length || 0) > (old?.length || 0)) existing[k] = v;
      } else if (!old) existing[k] = v;
    }
    state.messagesById[msg.messageId] = existing;
  }
}

export function scrape({
  document: rootDocument = document,
  navigator: nav = typeof navigator === "undefined" ? undefined : navigator,
  state = defaultState,
  setIntervalFn = setInterval,
  clearIntervalFn = clearInterval,
} = {}) {
  rootDocument.body.insertAdjacentHTML(
    "beforeend",
    '<button id="copy-btn" style="position:fixed;top:10px;right:10px;padding:10px;z-index:999;background-color:#fff;color:#000;">Copy 0 messages</button>',
  );
  const btn = rootDocument.getElementById("copy-btn");

  const update = () => {
    mergeMessages(whatsappMessages(rootDocument), state);
    btn.textContent = `Copy ${Object.values(state.messagesById).filter((m) => m.text).length} messages`;
  };

  update();
  state.captureTimer = setIntervalFn(update, 500);

  btn.addEventListener("click", async () => {
    clearIntervalFn(state.captureTimer);
    state.captureTimer = null;
    btn.remove();
    const list = Object.values(state.messagesById).sort((a, b) => {
      const ta = a.time ? new Date(a.time).getTime() : 0;
      const tb = b.time ? new Date(b.time).getTime() : 0;
      return ta - tb;
    });
    await nav?.clipboard?.writeText?.(JSON.stringify(list, null, 2));
  });
}

function cleanMessageText(text, { author, quoteAuthor, quoteText, usedFallback, hasGif } = {}) {
  // Post-processing rationale:
  // - When we fall back to `el.textContent`, it may include author names/phones/timestamps; strip those.
  // - When a quote is present, WhatsApp repeats quoted text inside the row; remove it from the main text.
  // - Normalize whitespace and curly quotes so downstream matching and diffing is easier.
  if (typeof text !== "string") return text;
  let cleaned = text;

  if (quoteText) {
    const normalizedQuote = quoteText.replace(/\s+/g, " ").trim();
    const variants = [quoteText, normalizedQuote, normalizedQuote.replace(/^"|"$/g, "")];
    for (const variant of variants) {
      if (!variant) continue;
      const escaped = escapeRegExp(variant);
      if (escaped) cleaned = cleaned.replace(new RegExp(escaped, "gi"), "");
    }
  }

  if (usedFallback && author) {
    const escapedAuthor = escapeRegExp(author);
    cleaned = cleaned.replace(new RegExp(`^${escapedAuthor}\\s*`, "i"), "");
  }
  if (usedFallback && quoteAuthor) {
    const escapedQuoteAuthor = escapeRegExp(quoteAuthor);
    cleaned = cleaned.replace(new RegExp(escapedQuoteAuthor, "gi"), "");
  }
  if (usedFallback) {
    // "Maybe <name>" and phone numbers show up in fallback text in group chats; remove to avoid duplication.
    cleaned = cleaned.replace(/\bMaybe\b/gi, "");
    cleaned = cleaned.replace(/\+?\d[\d\s-]{5,}/g, "");
  }

  cleaned = cleaned
    // GIF rows include playback fallback strings and "tenor"/forward markers; hide those and keep "(media-gif)".
    .replace(/Your browser doesn't support video playback\.?/gi, "")
    .replace(/\btenor\b/gi, "")
    .replace(/\bforward-[\w-]+\b/gi, "")
    .replace(/\b\d{1,2}:\d{2}\s*(?:am|pm)\b/gi, "");

  if (hasGif || /media-gif/i.test(cleaned)) cleaned = "(media-gif)";

  cleaned = cleaned.replace(/[“”]/g, '"');
  cleaned = cleaned.replace(/\s+/g, " ").trim();
  cleaned = cleaned.replace(/^["']+|["']+$/g, "").trim();

  if (!cleaned) return hasGif ? "(media-gif)" : null;
  return cleaned;
}

function escapeRegExp(string) {
  return string ? string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") : "";
}
