const defaultState = createScraperState();

export function createScraperState(seed) {
  const messagesById = Object.create(null);
  if (seed) for (const [key, value] of Object.entries(seed)) messagesById[key] = value;
  return { messagesById, captureTimer: null };
}

export function whatsappMessages(rootDocument = document) {
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
    isSystemMessage = isSystemMessage === "true";
    let isRecalled = !!el.querySelector('[data-icon="recalled"]');
    const message = { messageId, isSystemMessage, isRecalled, userId };
    // Non-recalled system messages are typically:
    //  - user (joined via an invite link | joined from the community | was added | changed to new mobile)
    //  - admin (added | removed) user
    if (isSystemMessage && !isRecalled) message.text = el.outerText;
    if (!isSystemMessage && !isRecalled) {
      // TODO: Image links
      // TODO: Forwarded flag
      const selectable = el.querySelector(".selectable-text");
      rawText = selectable?.outerText;
      hasGif = !!el.querySelector('[aria-label="Play GIF" i]');
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
      message.time = date;
      if (phone) message.authorPhone = phone;
      // If not, the hh:mm am/pm is available in the last dir="auto"
      if (!message.time) {
        const auto = [...el.querySelectorAll('[dir="auto"]')].at(-1);
        if (auto) message.time = updateTime(lastTime, auto.textContent);
        // Else it's a pinned message. Ignore it.
      }
    }
    lastTime = message.time;
    lastAuthor = message.author;

    // Get quote information if it exists
    const quote = el.querySelector('[aria-label="Quoted message" i]');
    if (quote) {
      const quoteAuthorNoLabel = quote.querySelector('[role=""] :not([aria-label])')?.textContent;
      const quoteAuthorLabel = quote.querySelector('[role=""] [aria-label]')?.textContent;
      if (quoteAuthorLabel) {
        // Ensure quoteAuthorPhone matches authorPhone format
        message.quoteAuthorPhone = quoteAuthorNoLabel.replace(/[^0-9]+/g, "");
        message.quoteAuthor = quoteAuthorLabel;
      } else message.quoteAuthor = quoteAuthorNoLabel;
      message.quoteText = quote.querySelector(".quoted-mention")?.outerText;
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
    const reactions = el.querySelector('[aria-label^="Reactions "],[aria-label^="reaction "]');
    if (reactions)
      message.reactions = reactions
        .getAttribute("aria-label")
        .replace(/view reactions/i, "")
        .replace(/^reactions? */i, "")
        .replace(/ *in total/i, "")
        .replace(/[, .]+$/, "");
    if (!isSystemMessage && !isRecalled) {
      const cleaned = cleanMessageText(rawText, {
        author: message.author,
        quoteAuthor: message.quoteAuthor,
        quoteText: message.quoteText,
        usedFallback,
        hasGif,
      });
      if (cleaned) message.text = cleaned;
      else delete message.text;
    }
    messages.push(message);
  }
  return messages;
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
    cleaned = cleaned.replace(/\bMaybe\b/gi, "");
    cleaned = cleaned.replace(/\+?\d[\d\s-]{5,}/g, "");
  }

  cleaned = cleaned
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
