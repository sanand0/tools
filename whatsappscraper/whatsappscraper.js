const MESSAGE_TEXT_SELECTOR =
  '[data-testid="selectable-text"], .selectable-text';
const QUOTE_SELECTOR = '[aria-label="Quoted message" i]';

const defaultState = createScraperState();

// Extract human-visible text from an element, including emoji rendered through wrappers.
function getTextWithEmojis(element) {
  if (!element) return undefined;
  const clone = element.cloneNode(true);
  for (const el of clone.querySelectorAll("[data-plain-text]"))
    el.replaceWith(el.dataset.plainText);
  for (const img of clone.querySelectorAll("img.emoji[alt]"))
    img.replaceWith(img.alt);
  return clone.textContent;
}

export function createScraperState(seed) {
  const messagesById = Object.create(null);
  if (seed)
    for (const [key, value] of Object.entries(seed)) messagesById[key] = value;
  return { messagesById, captureTimer: null };
}

export function whatsappMessages(rootDocument = document) {
  const messages = [];
  const chatId = resolveCurrentChatId(rootDocument);
  const context = {
    lastAuthor: null,
    lastAuthorPhone: null,
    lastSenderLabel: null,
    lastTime: null,
  };

  for (const row of rootDocument.querySelectorAll('#main [role="row"]')) {
    const id = parseRowIdentity(row, chatId);
    if (!id) continue;

    const message = compactMessage(id);

    const prePlainText = row.querySelector("[data-pre-plain-text]")?.dataset
      .prePlainText;
    const meta = parsePrePlainText(prePlainText);
    if (meta.time) message.time = meta.time;
    if (meta.authorPhone) message.authorPhone = meta.authorPhone;
    if (meta.author) message.author = meta.author;

    const author = extractAuthor(row);
    if (author.name) message.author = author.name;
    if (!message.authorPhone && author.phone)
      message.authorPhone = author.phone;

    if (!message.time) {
      const visibleTime = extractVisibleTime(row);
      if (visibleTime) message.time = updateTime(context.lastTime, visibleTime);
    }

    applyAuthorFallback(message, context, meta.senderLabel);

    const quote = extractQuote(row, messages);
    Object.assign(message, quote);

    const reactions = extractReactions(row);
    if (reactions) message.reactions = reactions;

    const media = extractMedia(row);
    if (media) Object.assign(message, media);

    if (row.querySelector('[data-icon="recalled"]')) {
      message.isRecalled = true;
      messages.push(finishMessage(message, context, meta.senderLabel));
      continue;
    }

    const text = extractBodyText(row, message, {
      fallback: !message.mediaType,
    });
    if (text) {
      if (message.mediaType && !message.mediaCaption)
        message.mediaCaption = text;
      if (!message.text) message.text = text;
    }
    if (!message.text && message.mediaCaption)
      message.text = message.mediaCaption;

    const link = extractLinkDetails(row, message);
    if (link) {
      message.linkUrl = link.url;
      message.linkSite = link.site;
      if (link.title) message.linkTitle = link.title;
      if (link.description) message.linkDescription = link.description;
      if (link.title && normalizeUrl(message.text) === normalizeUrl(link.url)) {
        const previewParts = [link.title, link.description].filter(Boolean);
        if (previewParts.length)
          message.text = [message.text, ...previewParts].join("\n");
      }
    }

    messages.push(finishMessage(message, context, meta.senderLabel));
  }

  return messages;
}

function parseRowIdentity(row, chatId) {
  const messageNode = row.querySelector("[data-id]");
  const parsed = parseDataId(messageNode?.dataset.id);
  if (!parsed?.messageId) return null;
  return compactMessage({
    messageId: parsed.messageId,
    userId: parsed.userId || chatId,
    ...(parsed.isOutgoing || isOutgoingRow(row) ? { isOutgoing: true } : {}),
  });
}

function parseDataId(value) {
  if (!value) return null;
  const match = value.match(/^(true|false)_([^@]+)@[^_]+_([^_]+)/i);
  if (match) {
    return {
      isOutgoing: match[1] === "true",
      userId: match[2],
      messageId: match[3],
    };
  }

  const bareMessageId = parseBareMessageId(value);
  if (!bareMessageId) return null;
  return { messageId: bareMessageId };
}

function parseBareMessageId(value) {
  const trimmed = normalizeInlineText(value);
  if (!trimmed || /\s/.test(trimmed)) return null;
  if (!/^[a-z0-9._:-]{8,}$/i.test(trimmed)) return null;
  return trimmed;
}

function isOutgoingRow(row) {
  return !!row.querySelector(".message-out");
}

function resolveCurrentChatId(rootDocument) {
  const candidates = [
    ['#main header [data-chat-id]', "data-chat-id"],
    ['#main header [data-contact-id]', "data-contact-id"],
    ['#main header [data-jid]', "data-jid"],
    ['#pane-side [aria-selected="true"] [data-chat-id]', "data-chat-id"],
    ['#pane-side [aria-selected="true"] [data-contact-id]', "data-contact-id"],
    ['#pane-side [aria-selected="true"] [data-jid]', "data-jid"],
  ];

  for (const [selector, attribute] of candidates) {
    const value = rootDocument.querySelector(selector)?.getAttribute(attribute);
    const chatId = normalizeChatId(value);
    if (chatId) return chatId;
  }

  return undefined;
}

function normalizeChatId(value) {
  const trimmed = normalizeInlineText(value).replace(/\u200b/g, "");
  if (!trimmed) return undefined;

  const jidMatch = trimmed.match(/^([^@\s]+)@[^@\s]+$/);
  if (jidMatch) return jidMatch[1];

  if (/^[a-z0-9._:-]{6,}$/i.test(trimmed)) return trimmed;
  return undefined;
}

function parsePrePlainText(value) {
  if (!value) return {};
  const match = value.match(
    /^\[(\d{1,2}:\d{2}(?:\s?[ap]m)?),\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\]\s*(.+?):\s*$/i,
  );
  if (!match) return {};

  const [, clock, day, month, year, senderLabel] = match;
  const time = buildTimestamp({
    year: Number(year),
    month: Number(month),
    day: Number(day),
    clock,
  });
  const cleanedSenderLabel = normalizeInlineText(senderLabel);

  return {
    time,
    senderLabel: cleanedSenderLabel,
    author: isPhoneLike(cleanedSenderLabel)
      ? undefined
      : cleanName(cleanedSenderLabel),
    authorPhone: isPhoneLike(cleanedSenderLabel)
      ? cleanedSenderLabel
      : undefined,
  };
}

function buildTimestamp({ year, month, day, clock }) {
  const parsed = parseClock(clock);
  if (!parsed) return undefined;
  return new Date(
    year,
    month - 1,
    day,
    parsed.hours,
    parsed.minutes,
    0,
    0,
  ).toISOString();
}

function parseClock(value) {
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^(\d{1,2}):(\d{2})(?:\s*([ap]m))?$/i);
  if (!match) return null;

  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const meridiem = match[3]?.toLowerCase();

  if (meridiem) {
    hours %= 12;
    if (meridiem === "pm") hours += 12;
  }

  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
  return { hours, minutes };
}

function updateTime(lastTime, clock) {
  if (!lastTime) return undefined;
  const parsed = parseClock(clock);
  if (!parsed) return undefined;

  const date = new Date(lastTime);
  date.setHours(parsed.hours, parsed.minutes, 0, 0);
  return date.toISOString();
}

function parseDurationToSeconds(value) {
  const parts = (value || "")
    .split(":")
    .map((part) => Number.parseInt(part, 10));
  if (!parts.length || parts.some((part) => !Number.isFinite(part))) {
    return undefined;
  }
  if (parts.length === 2) {
    const [minutes, seconds] = parts;
    return minutes * 60 + seconds;
  }
  if (parts.length === 3) {
    const [hours, minutes, seconds] = parts;
    return hours * 3600 + minutes * 60 + seconds;
  }
  return undefined;
}

function extractAuthor(row) {
  const blocks = [...row.querySelectorAll('[role=""]')].filter(
    (el) => !el.closest(QUOTE_SELECTOR),
  );
  return extractParticipant(blocks[0]);
}

function extractParticipant(container) {
  if (!container) return {};

  const parts = [];
  for (const node of container.childNodes) {
    const raw =
      node.nodeType === 3 ? node.textContent : getTextWithEmojis(node);
    const text = normalizeInlineText(raw);
    if (!text || parts.at(-1) === text) continue;
    parts.push(text);
  }

  const phone = parts.find(isPhoneLike);
  const name = parts.map(cleanName).find(Boolean);
  return { name, phone };
}

function cleanName(value) {
  const cleaned = normalizeInlineText(value).replace(/^Maybe\s+/i, "");
  if (!cleaned || isPhoneLike(cleaned) || !/[A-Za-z0-9]/.test(cleaned))
    return undefined;
  return cleaned;
}

function applyAuthorFallback(message, context, senderLabel) {
  if (message.author) return;

  if (senderLabel && !isPhoneLike(senderLabel)) {
    message.author = cleanName(senderLabel);
    return;
  }

  if (!senderLabel && !message.authorPhone && context.lastAuthor) {
    message.author = context.lastAuthor;
    return;
  }

  if (
    message.authorPhone &&
    context.lastAuthorPhone === message.authorPhone &&
    context.lastAuthor
  ) {
    message.author = context.lastAuthor;
    return;
  }

  if (
    senderLabel &&
    context.lastSenderLabel === senderLabel &&
    context.lastAuthor
  ) {
    message.author = context.lastAuthor;
  }
}

function extractVisibleTime(row) {
  const values = [...row.querySelectorAll('[dir="auto"]')]
    .map((el) => normalizeInlineText(el.textContent))
    .filter((text) => isTimeLine(text));
  return values.at(-1);
}

function extractQuote(row, messages) {
  const quote = row.querySelector(QUOTE_SELECTOR);
  if (!quote) return {};

  const result = {};
  const participant = extractParticipant(quote.querySelector('[role=""]'));
  if (participant.name) result.quoteAuthor = participant.name;
  if (participant.phone)
    result.quoteAuthorPhone = normalizePhone(participant.phone);
  if (!result.quoteAuthor && participant.phone)
    result.quoteAuthor = participant.phone;

  const quoteNode = getTopLevelMatches(
    quote,
    `${MESSAGE_TEXT_SELECTOR}, .quoted-mention`,
  ).at(-1);
  const quoteText = normalizeMessageText(getTextWithEmojis(quoteNode));
  if (quoteText) result.quoteText = quoteText;

  if (result.quoteText) {
    const quotedMessageId = findQuotedMessageId(result, messages);
    if (quotedMessageId) result.quoteMessageId = quotedMessageId;
  }

  return result;
}

function findQuotedMessageId(quote, messages) {
  const targetText = normalizeComparableText(quote.quoteText);
  const targetAuthor = normalizeComparableName(quote.quoteAuthor);
  const targetPhone = normalizePhone(
    quote.quoteAuthorPhone || quote.quoteAuthor,
  );

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const candidate = messages[index];
    if (!candidate.text) continue;

    const authorMatches =
      (targetAuthor &&
        normalizeComparableName(candidate.author) === targetAuthor) ||
      (targetPhone && normalizePhone(candidate.authorPhone) === targetPhone);
    if (!authorMatches) continue;

    if (normalizeComparableText(candidate.text).startsWith(targetText))
      return candidate.messageId;
  }

  return undefined;
}

function extractStructuredBodyText(row) {
  const textNode = getTopLevelMatches(row, MESSAGE_TEXT_SELECTOR).findLast(
    (el) => !el.closest(QUOTE_SELECTOR),
  );
  return normalizeMessageText(getTextWithEmojis(textNode));
}

function extractBodyText(row, message, { fallback = true } = {}) {
  const structuredText = extractStructuredBodyText(row);
  if (structuredText) return structuredText;
  if (!fallback) return undefined;
  return extractFallbackText(row, message);
}

function getTopLevelMatches(root, selector) {
  return [...root.querySelectorAll(selector)].filter(
    (el) => !el.parentElement?.closest(selector),
  );
}

function extractFallbackText(
  row,
  { author, authorPhone, quoteAuthor, quoteAuthorPhone, quoteText } = {},
) {
  const quoteLineSet = new Set(textLines(quoteText));
  const normalizedQuote = normalizeComparableText(quoteText);
  const skipLines = new Set([
    ...participantLineVariants(author, authorPhone),
    ...participantLineVariants(quoteAuthor, quoteAuthorPhone),
  ]);
  const filtered = textLines(row.innerText).filter((line) => {
    if (skipLines.has(line)) return false;
    if (quoteLineSet.has(line)) return false;
    if (
      normalizedQuote &&
      normalizeComparableText(line).includes(normalizedQuote)
    )
      return false;
    if (isTimeLine(line)) return false;
    return true;
  });
  return normalizeMessageText(filtered.join("\n"));
}

function extractReactions(row) {
  const reactions = row.querySelector(
    '[aria-label^="Reactions "],[aria-label^="reaction "]',
  );
  if (!reactions) return undefined;

  return reactions
    .getAttribute("aria-label")
    .replace(/view reactions/i, "")
    .replace(/^reactions? */i, "")
    .replace(/ *in total/i, "")
    .replace(/[, .]+$/, "");
}

function extractMedia(row) {
  if (row.querySelector('[aria-label="Play GIF" i]'))
    return { mediaType: "gif", text: "(media-gif)" };

  const voice = extractVoiceMedia(row);
  if (voice) return voice;

  const image = extractImageMedia(row);
  if (image) return image;

  return undefined;
}

function extractVoiceMedia(row) {
  if (
    !row.querySelector(
      '[aria-label="Play voice message" i],[aria-label="Pause voice message" i],[aria-label="Voice message" i]',
    )
  ) {
    return undefined;
  }

  const duration = extractVoiceDuration(row);
  return compactMessage({
    mediaType: "voice",
    mediaDuration: duration,
    mediaDurationSeconds: duration
      ? parseDurationToSeconds(duration)
      : undefined,
  });
}

function extractVoiceDuration(row) {
  const slider = row.querySelector('[role="slider"][aria-valuetext*="/"]');
  const ariaValueText = slider?.getAttribute("aria-valuetext") || "";
  const duration = normalizeInlineText(ariaValueText.split("/").at(-1));
  if (parseDurationToSeconds(duration) !== undefined) return duration;
  return undefined;
}

function extractImageMedia(row) {
  const picture = row.querySelector('[aria-label="Open picture" i]');
  if (!picture) return undefined;

  const image = pickLargestMediaAsset(
    [...picture.querySelectorAll("img")].filter(
      (img) => !img.classList.contains("emoji"),
    ),
  );
  const { width, height } = extractMediaDimensions(picture, image);
  const caption = extractMediaCaption(image?.getAttribute("alt"));

  return compactMessage({
    mediaType: "image",
    mediaCaption: caption,
    mediaWidth: width,
    mediaHeight: height,
  });
}

function pickLargestMediaAsset(elements) {
  return [...elements].sort((a, b) => mediaArea(b) - mediaArea(a))[0];
}

function mediaArea(element) {
  if (!element) return 0;
  const width = Number(
    element.naturalWidth || element.width || element.clientWidth || 0,
  );
  const height = Number(
    element.naturalHeight || element.height || element.clientHeight || 0,
  );
  return width * height;
}

function extractMediaDimensions(container, asset) {
  const naturalWidth = Number(asset?.naturalWidth || asset?.width || 0);
  const naturalHeight = Number(asset?.naturalHeight || asset?.height || 0);
  if (naturalWidth > 1 && naturalHeight > 1) {
    return { width: naturalWidth, height: naturalHeight };
  }

  const clientWidth = Number(asset?.clientWidth || container?.clientWidth || 0);
  const clientHeight = Number(
    asset?.clientHeight || container?.clientHeight || 0,
  );
  if (clientWidth > 1 && clientHeight > 1) {
    return { width: clientWidth, height: clientHeight };
  }

  return {
    width:
      extractPixelDimension(asset, "width") ||
      extractPixelDimension(container, "width"),
    height:
      extractPixelDimension(asset, "height") ||
      extractPixelDimension(container, "height"),
  };
}

function extractPixelDimension(element, property) {
  const value = element?.style?.[property];
  if (!value) return undefined;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : undefined;
}

function extractMediaCaption(value) {
  const caption = normalizeMessageText(value);
  if (!caption) return undefined;
  if (/^(photo|picture|image|media)$/i.test(caption)) return undefined;
  return caption;
}

function extractLinkDetails(
  messageRow,
  { author, authorPhone, quoteAuthor, quoteAuthorPhone, quoteText, text } = {},
) {
  const link = messageRow.querySelector(
    '[data-testid="selectable-text"] a[href^="http"], .selectable-text a[href^="http"], a[href^="http"]',
  );
  if (!link?.href) return null;

  let site;
  try {
    site = new URL(link.href).hostname.replace(/^www\./i, "");
  } catch {
    return null;
  }

  const selectableLineSet = new Set(textLines(text));
  const quoteLineSet = new Set(textLines(quoteText));
  const normalizedQuote = normalizeComparableText(quoteText);
  const skipLines = new Set([
    ...participantLineVariants(author, authorPhone),
    ...participantLineVariants(quoteAuthor, quoteAuthorPhone),
  ]);
  const urlNorm = normalizeLine(link.href);
  const allLines = textLines(messageRow.innerText);
  const urlIndex = allLines.findIndex((line) => {
    const normalized = normalizeLine(line);
    if (!looksLikeUrl(line)) return false;
    return (
      normalized === urlNorm ||
      normalized.includes(urlNorm) ||
      urlNorm.includes(normalized)
    );
  });
  if (urlIndex < 0) return { url: link.href, site };

  let candidates = allLines.slice(0, urlIndex).filter((line) => {
    if (skipLines.has(line)) return false;
    if (selectableLineSet.has(line)) return false;
    if (quoteLineSet.has(line)) return false;
    if (
      normalizedQuote &&
      normalizeComparableText(line).includes(normalizedQuote)
    )
      return false;
    if (isTimeLine(line)) return false;
    if (isTinyCountLine(line)) return false;
    return true;
  });

  if (looksLikeDomain(candidates.at(-1))) candidates = candidates.slice(0, -1);

  const [title, ...rest] = candidates;
  const description = rest.join("\n").trim() || undefined;
  return title
    ? { url: link.href, site, title, description }
    : { url: link.href, site };
}

function normalizeInlineText(value) {
  return (value || "").replace(/\s+/g, " ").trim();
}

function normalizeMessageText(value) {
  if (typeof value !== "string") return undefined;

  const lines = value
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim());

  while (lines[0] === "") lines.shift();
  while (lines.at(-1) === "") lines.pop();

  const normalized = [];
  let previousBlank = false;
  for (const line of lines) {
    if (!line) {
      if (!previousBlank) normalized.push("");
      previousBlank = true;
      continue;
    }
    normalized.push(line.replace(/[“”]/g, '"'));
    previousBlank = false;
  }

  return normalized.join("\n").trim() || undefined;
}

function textLines(value) {
  const normalized = normalizeMessageText(value);
  if (!normalized) return [];
  return normalized.split("\n").filter(Boolean);
}

function normalizeComparableText(value) {
  return (
    normalizeMessageText(value)?.replace(/\s+/g, " ").trim().toLowerCase() || ""
  );
}

function normalizeComparableName(value) {
  return normalizeInlineText(value).toLowerCase();
}

function participantLineVariants(name, phone) {
  return [
    ...new Set(
      [[name], [phone], [name, phone], [phone, name]]
        .map((parts) => normalizeInlineText(parts.filter(Boolean).join(" ")))
        .filter(Boolean),
    ),
  ];
}

function normalizeUrl(value) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\/+$/, "");
}

function normalizeLine(value) {
  return normalizeUrl(normalizeInlineText(value)).toLowerCase();
}

function normalizePhone(value) {
  return (value || "").replace(/\D/g, "");
}

function isPhoneLike(value) {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed.startsWith("+")) return false;
  if (/[a-z]/i.test(trimmed)) return false;
  return normalizePhone(trimmed).length >= 6;
}

function isTimeLine(value) {
  return !!parseClock(value);
}

function isTinyCountLine(value) {
  return /^\d{1,3}$/.test(normalizeInlineText(value));
}

function looksLikeDomain(value) {
  return /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(normalizeInlineText(value));
}

function looksLikeUrl(value) {
  const trimmed = normalizeInlineText(value);
  if (!trimmed) return false;
  if (/^https?:\/\//i.test(trimmed)) return true;
  if (/\s/.test(trimmed)) return false;
  return /[a-z0-9]/i.test(trimmed) && /[/.]/.test(trimmed);
}

function finishMessage(message, context, senderLabel) {
  const cleaned = compactMessage(message);
  context.lastTime = cleaned.time || context.lastTime;
  context.lastAuthor = cleaned.author || context.lastAuthor;
  context.lastAuthorPhone = cleaned.authorPhone || context.lastAuthorPhone;
  context.lastSenderLabel = senderLabel || context.lastSenderLabel;
  return cleaned;
}

function compactMessage(message) {
  return Object.fromEntries(
    Object.entries(message).filter(
      ([, value]) =>
        value !== undefined &&
        value !== null &&
        value !== false &&
        value !== "",
    ),
  );
}

function mergeValue(previous, next, key) {
  if (next === undefined || next === null || next === false || next === "")
    return previous;
  if (
    previous === undefined ||
    previous === null ||
    previous === false ||
    previous === ""
  ) {
    return next;
  }

  if (typeof previous === "number" && typeof next === "number")
    return next > previous ? next : previous;

  if (typeof previous === "boolean" && typeof next === "boolean")
    return previous || next;

  if (typeof previous === "string" && typeof next === "string") {
    if (key === "reactions" && next !== previous) return next;
    if (next.length > previous.length) return next;
    if (
      next.length === previous.length &&
      next !== previous &&
      (key === "time" || key === "mediaDuration")
    ) {
      return next;
    }
  }

  return previous;
}

export function mergeMessages(arr, state = defaultState) {
  for (const msg of arr) {
    const existing = state.messagesById[msg.messageId] || {};
    for (const [key, value] of Object.entries(msg))
      existing[key] = mergeValue(existing[key], value, key);
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
  rootDocument.getElementById("copy-btn")?.remove();
  rootDocument.body.insertAdjacentHTML(
    "beforeend",
    '<button id="copy-btn" style="position:fixed;top:10px;right:10px;padding:10px;z-index:999;background-color:#fff;color:#000;">Copy 0 messages</button>',
  );
  const btn = rootDocument.getElementById("copy-btn");

  const update = () => {
    mergeMessages(whatsappMessages(rootDocument), state);
    btn.textContent = `Copy ${Object.keys(state.messagesById).length} messages`;
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
