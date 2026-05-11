// @ts-check

const defaultInviteState = createInviteScraperState();

export function createInviteScraperState(seed) {
  const invitesByKey = Object.create(null);
  if (seed) for (const [key, value] of Object.entries(seed)) invitesByKey[key] = value;
  return {
    invitesByKey,
    nextOrder: Object.keys(invitesByKey).length,
    captureTimer: null,
    autoScrollTimer: null,
    scrollPhase: "toTop",
    stableTicks: 0,
    lastScrollTop: -1,
    lastCount: 0,
  };
}

export function linkedinInvites(rootDocument = document) {
  return [...rootDocument.querySelectorAll('[role="listitem"][componentkey^="urn:li:invitation:"]')].map((card) =>
    compactInvite(extractInvite(card, rootDocument)),
  );
}

function extractInvite(card, rootDocument) {
  const name = extractName(card);
  const rawLines = textLines(card.innerText);
  const profileUrl = cleanUrl(card.querySelector('a[href*="/in/"]')?.href, rootDocument);
  const followsYou = rawLines.some((line) => /follows you/i.test(line));
  const invitationAge = rawLines.find(isAgeLine);
  const ageIndex = rawLines.findIndex((line) => line === invitationAge);
  const linesBeforeAge = (ageIndex >= 0 ? rawLines.slice(0, ageIndex) : rawLines).filter((line) =>
    isProfileDetailLine(line, name),
  );
  const description = linesBeforeAge.find((line) => !isMutualConnectionLine(line));
  const contextLines = linesBeforeAge.filter((line) => line !== description);
  const mutualLine = contextLines.find(isMutualConnectionLine);
  const { connections, connectionsCount } = parseMutualConnections(mutualLine);
  const commonOrgs = contextLines.filter((line) => !isMutualConnectionLine(line));
  const message = extractMessage(rawLines, ageIndex);

  return {
    name,
    description,
    profileUrl,
    followsYou,
    invitationAge,
    connections,
    connectionsCount,
    commonOrgs,
    badges: extractBadges(card),
    message,
  };
}

function extractName(card) {
  const acceptLabel = card.querySelector('button[aria-label^="Accept "]')?.getAttribute("aria-label") || "";
  const acceptMatch = acceptLabel.match(/^Accept (.+?)(?:'|’|\u2019)s invitation$/i);
  if (acceptMatch) return normalizeInlineText(acceptMatch[1]);
  return normalizeInlineText(card.querySelector('a[href*="/in/"] strong, a[href*="/in/"]')?.textContent);
}

function isProfileDetailLine(line, name) {
  if (!line || line === name) return false;
  if (isInviteLine(line)) return false;
  if (isActionLine(line)) return false;
  return true;
}

function isInviteLine(line) {
  return (
    /(?:follows you and is )?inviting you to connect/i.test(line) ||
    /^follows you and is inviting you to connect$/i.test(line)
  );
}

function isActionLine(line) {
  return (
    /^(Ignore|Accept|Message|Show more actions|…)$/i.test(line) ||
    /^Reply to\b/i.test(line) ||
    /^…?\s*show more$/i.test(line)
  );
}

function isAgeLine(line) {
  return /^(Today|Yesterday)$/i.test(line) || /^\d+\s+(?:second|minute|hour|day|week|month|year)s? ago$/i.test(line);
}

function isMutualConnectionLine(line) {
  return /\bmutual connections?\b/i.test(line);
}

function parseMutualConnections(line) {
  if (!line) return { connections: undefined, connectionsCount: 0 };

  let match = line.match(/^(.+?)\s+and\s+(\d+)\s+other mutual connections?$/i);
  if (match) {
    return {
      connections: [normalizeInlineText(match[1])],
      connectionsCount: Number(match[2]) + 1,
    };
  }

  match = line.match(/^(.+?)\s+is a mutual connection$/i);
  if (match) {
    return {
      connections: [normalizeInlineText(match[1])],
      connectionsCount: 1,
    };
  }

  match = line.match(/^(\d+)\s+mutual connections?$/i);
  if (match) return { connections: undefined, connectionsCount: Number(match[1]) };

  return { connections: [line], connectionsCount: undefined };
}

function extractBadges(card) {
  const labels = [...card.querySelectorAll("[aria-label]")]
    .map((element) => normalizeInlineText(element.getAttribute("aria-label")))
    .filter(Boolean);
  const badges = [];
  for (const label of labels) {
    if (/\bPremium\b/i.test(label)) badges.push("premium");
    if (/\bVerified\b/i.test(label)) badges.push("verified");
    if (/open to work/i.test(label)) badges.push("openToWork");
    if (/\bhiring\b/i.test(label)) badges.push("hiring");
    if (/top voice/i.test(label)) badges.push("topVoice");
  }
  return unique(badges);
}

function extractMessage(rawLines, ageIndex) {
  if (ageIndex < 0) return undefined;
  const message = rawLines
    .slice(ageIndex + 1)
    .map((line) => line.replace(/\s+…?\s*show more\b.*$/i, "").replace(/\s+Reply to\b.*$/i, ""))
    .filter((line) => line && !isActionLine(line) && !isAgeLine(line))
    .join("\n")
    .trim();
  return message || undefined;
}

export function mergeInvites(invites, state = defaultInviteState) {
  for (const invite of invites) {
    const key = invite.profileUrl || invite.name;
    if (!key) continue;
    const existing = state.invitesByKey[key] || { _order: state.nextOrder++ };
    for (const [field, value] of Object.entries(invite)) existing[field] = mergeValue(existing[field], value);
    state.invitesByKey[key] = existing;
  }
}

function mergeValue(previous, next) {
  if (next === undefined || next === null || next === false || next === "") return previous;
  if (Array.isArray(next) && !next.length) return previous;
  if (previous === undefined || previous === null || previous === false || previous === "") return next;
  if (typeof previous === "number" && typeof next === "number") return Math.max(previous, next);
  if (typeof previous === "boolean" && typeof next === "boolean") return previous || next;
  if (Array.isArray(previous) && Array.isArray(next)) return unique([...previous, ...next]);
  if (typeof previous === "string" && typeof next === "string") return next.length > previous.length ? next : previous;
  return previous;
}

function clickHelpfulButtons(rootDocument) {
  for (const button of rootDocument.querySelectorAll("button")) {
    const label = button.innerText || "";
    if (/show more/i.test(label)) button.click();
  }
}

function startInviteAutoScroll({ rootDocument = document, state = defaultInviteState } = {}) {
  const view = rootDocument.defaultView;
  const step = () => {
    clickHelpfulButtons(rootDocument);
    mergeInvites(linkedinInvites(rootDocument), state);

    const scroller = findScrollContainer(rootDocument);
    if (!scroller) return;

    if (state.scrollPhase === "toTop") {
      scrollToTop(scroller, view);
      const scrollTop = Number(scroller.scrollTop || 0);
      state.stableTicks = scrollTop <= 0 || scrollTop === state.lastScrollTop ? state.stableTicks + 1 : 0;
      state.lastScrollTop = scrollTop;
      if (state.stableTicks >= 2) {
        state.scrollPhase = "down";
        state.stableTicks = 0;
        scrollByAmount(scroller, view, Math.max(300, (view?.innerHeight || 800) * 0.85));
      }
      return;
    }

    const beforeCount = Object.keys(state.invitesByKey).length;
    const beforeScrollTop = Number(scroller.scrollTop || 0);
    scrollByAmount(scroller, view, Math.max(300, (view?.innerHeight || 800) * 0.85));
    const afterScrollTop = Number(scroller.scrollTop || 0);
    state.stableTicks =
      beforeCount === state.lastCount && afterScrollTop === beforeScrollTop ? state.stableTicks + 1 : 0;
    state.lastCount = beforeCount;
    state.lastScrollTop = afterScrollTop;
  };

  step();
  state.autoScrollTimer = view?.setInterval?.(step, 900) || null;
}

function findScrollContainer(rootDocument) {
  const fallback = rootDocument.scrollingElement || rootDocument.documentElement || rootDocument.body;
  const candidates = [...rootDocument.querySelectorAll("main, [role='main'], body, body *")]
    .filter((element) => {
      const overflowY = rootDocument.defaultView?.getComputedStyle?.(element).overflowY || "";
      if (!/auto|scroll/i.test(overflowY)) return false;
      if (element.clientHeight < 100) return false;
      return element.scrollHeight > element.clientHeight + 20;
    })
    .sort((a, b) => b.scrollHeight - b.clientHeight - (a.scrollHeight - a.clientHeight));
  return candidates[0] || fallback;
}

function scrollToTop(scroller, view) {
  if (
    scroller === scroller.ownerDocument.scrollingElement ||
    scroller === scroller.ownerDocument.documentElement ||
    scroller === scroller.ownerDocument.body
  ) {
    view?.scrollTo?.(0, 0);
  }
  scroller.scrollTop = 0;
}

function scrollByAmount(scroller, view, amount) {
  if (
    scroller === scroller.ownerDocument.scrollingElement ||
    scroller === scroller.ownerDocument.documentElement ||
    scroller === scroller.ownerDocument.body
  ) {
    view?.scrollBy?.(0, amount);
    scroller.scrollTop += amount;
    return;
  }
  scroller.scrollTop = Math.min(scroller.scrollHeight - scroller.clientHeight, scroller.scrollTop + amount);
}

export function scrapeInvites({
  document: rootDocument = document,
  navigator: nav = typeof navigator === "undefined" ? undefined : navigator,
  state = defaultInviteState,
  setIntervalFn = setInterval,
  clearIntervalFn = clearInterval,
} = {}) {
  const buttonId = "linkedinscraper-invites-copy-btn";
  rootDocument.getElementById(buttonId)?.remove();
  rootDocument.body.insertAdjacentHTML(
    "beforeend",
    `<button id="${buttonId}" style="position:fixed;top:10px;right:10px;padding:10px 12px;z-index:2147483647;background:#fff;color:#111;border:1px solid #bbb;border-radius:6px;box-shadow:0 2px 10px rgba(0,0,0,.18);font:14px system-ui,sans-serif;">Copy 0 invites</button>`,
  );
  const button = rootDocument.getElementById(buttonId);

  const update = () => {
    mergeInvites(linkedinInvites(rootDocument), state);
    button.textContent = `Copy ${Object.keys(state.invitesByKey).length} invites`;
  };

  if (!state.autoScrollTimer) startInviteAutoScroll({ rootDocument, state });
  update();
  state.captureTimer = setIntervalFn(update, 600);

  button.addEventListener("click", async () => {
    clearIntervalFn(state.captureTimer);
    if (state.autoScrollTimer && rootDocument.defaultView)
      rootDocument.defaultView.clearInterval(state.autoScrollTimer);
    state.captureTimer = null;
    state.autoScrollTimer = null;
    button.remove();
    await nav?.clipboard?.writeText?.(JSON.stringify(orderedInvites(state), null, 2));
  });

  try {
    rootDocument.defaultView.__linkedinscraperInviteState = state;
  } catch {}
}

function orderedInvites(state) {
  return Object.values(state.invitesByKey)
    .sort((a, b) => a._order - b._order)
    .map(({ _order, ...invite }) => invite);
}

function cleanUrl(value, rootDocument) {
  if (!value) return undefined;
  try {
    const url = new URL(value, rootDocument.location?.origin || "https://www.linkedin.com");
    url.search = "";
    url.hash = "";
    return url.href;
  } catch {
    return value;
  }
}

function textLines(value) {
  return (value || "")
    .replace(/\r/g, "")
    .replace(/\b(Today|Yesterday|\d+\s+(?:second|minute|hour|day|week|month|year)s? ago)\b/gi, "\n$1\n")
    .replace(/\b(Ignore|Accept|Message|Show more actions)\b/g, "\n$1\n")
    .replace(/\s+(Reply to\b[^.\n]*)/g, "\n$1")
    .replace(/\s+(…?\s*show more)\b/gi, "\n$1")
    .split("\n")
    .map(normalizeInlineText)
    .filter(Boolean);
}

function normalizeInlineText(value) {
  return (value || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function compactInvite(invite) {
  return Object.fromEntries(
    Object.entries(invite).filter(([, value]) => {
      if (value === undefined || value === null || value === false || value === "") return false;
      if (Array.isArray(value) && !value.length) return false;
      return true;
    }),
  );
}

export function scrape() {
  return scrapeInvites();
}
