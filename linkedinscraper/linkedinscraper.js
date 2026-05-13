// @ts-check

const defaultInviteState = createInviteScraperState();
const defaultProfileState = createProfileScraperState();

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

export function createProfileScraperState() {
  return {
    captureTimer: null,
    autoScrollTimer: null,
    scrollPhase: "toTop",
    stableTicks: 0,
    lastScrollTop: -1,
    lastScrollHeight: 0,
    ticks: 0,
    done: false,
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
  const invitationMonth = invitationMonthFromAge(invitationAge);
  const firstActionIndex = rawLines.findIndex(isActionLine);
  const detailsEndIndex = ageIndex >= 0 ? ageIndex : firstActionIndex >= 0 ? firstActionIndex : rawLines.length;
  const detailLines = rawLines.slice(0, detailsEndIndex).filter((line) => isProfileDetailLine(line, name));
  const description = detailLines.find((line) => !isMutualConnectionLine(line));
  const contextLines = detailLines.filter((line) => line !== description);
  const mutualLine = contextLines.find(isMutualConnectionLine);
  const { connections, connectionsCount } = parseMutualConnections(mutualLine);
  const commonOrgs = contextLines.filter((line) => !isMutualConnectionLine(line));
  const message = extractMessage(rawLines, ageIndex >= 0 ? ageIndex : firstActionIndex);

  return {
    name,
    description,
    profileUrl,
    followsYou,
    invitationMonth,
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

export function invitationMonthFromAge(ageText, now = new Date()) {
  const age = normalizeInlineText(ageText).toLowerCase();
  if (!age) return `${formatMonth(new Date(now))}?`;

  const date = new Date(now);
  if (age === "today") return formatMonth(date);
  if (age === "yesterday") {
    date.setDate(date.getDate() - 1);
    return formatMonth(date);
  }
  const match = age.match(/^(\d+)\s+(second|minute|hour|day|week|month|year)s? ago$/i);
  if (!match) return `${formatMonth(date)}?`;
  const count = Number(match[1]);
  const unit = match[2].toLowerCase();
  if (unit === "day") date.setDate(date.getDate() - count);
  if (unit === "week") date.setDate(date.getDate() - count * 7);
  if (unit === "month") date.setMonth(date.getMonth() - count);
  if (unit === "year") date.setFullYear(date.getFullYear() - count);

  return formatMonth(date);
}

function formatMonth(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
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
    const label = `${button.innerText || ""} ${button.getAttribute("aria-label") || ""}`;
    if (/\bshow more\b/i.test(label) || /\bsee more\b/i.test(label)) button.click();
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

function startProfileAutoScroll({ rootDocument = document, state = defaultProfileState } = {}) {
  const view = rootDocument.defaultView;
  const step = () => {
    state.ticks += 1;
    clickHelpfulButtons(rootDocument);
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
        scrollByAmount(scroller, view, Math.max(500, (view?.innerHeight || 900) * 0.9));
      }
      return;
    }

    const beforeScrollHeight = Number(scroller.scrollHeight || 0);
    scrollByAmount(scroller, view, Math.max(500, (view?.innerHeight || 900) * 0.9));
    const afterScrollTop = Number(scroller.scrollTop || 0);
    const afterScrollHeight = Number(scroller.scrollHeight || 0);
    const maxScrollTop = Math.max(0, afterScrollHeight - Number(scroller.clientHeight || view?.innerHeight || 0));
    const atEnd = afterScrollTop >= maxScrollTop - 8;
    state.stableTicks =
      atEnd && afterScrollHeight === beforeScrollHeight && afterScrollHeight === state.lastScrollHeight
        ? state.stableTicks + 1
        : 0;
    state.lastScrollTop = afterScrollTop;
    state.lastScrollHeight = afterScrollHeight;
    if (state.stableTicks >= 5 && state.ticks >= 8) state.done = true;
  };

  step();
  state.autoScrollTimer = view?.setInterval?.(step, 900) || null;
}

export function linkedinProfileMarkdown(rootDocument = document) {
  const url = cleanUrl(rootDocument.location?.href, rootDocument);
  const main = rootDocument.querySelector("main") || rootDocument.body;
  const name = profileName(rootDocument, main);
  const sections = profileSections(main, name);
  const fallbackLines = profileTextLines(main);
  const parts = [`# ${escapeMarkdownHeading(name)}`, "", `Source: ${url}`];

  const profile = sections.find((section) => section.title === "Profile");
  const headline = profileHeadline(main, name) || profile?.lines.find((line) => line !== name && !isPronounLine(line));
  const summary = profileSummary(name, headline, profile?.lines || []);
  if (summary.length) parts.push("", "## Profile Summary", "", summary.join("\n"));

  const contentSections = sections
    .filter((section) => section.title !== "Profile" && !isDroppedProfileSection(section.title))
    .sort((a, b) => sectionSortKey(a.title) - sectionSortKey(b.title));
  if (contentSections.length) {
    for (const section of contentSections) {
      const markdown = sectionMarkdown(section);
      if (markdown) parts.push("", `## ${escapeMarkdownHeading(section.title)}`, "", markdown);
    }
  } else if (fallbackLines.length) {
    parts.push("", "## Visible Profile Text", "", fallbackLines.join("\n"));
  }

  return `${parts
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()}\n`;
}

function profileName(rootDocument, main) {
  const h1 = normalizeInlineText(main.querySelector("h1")?.textContent);
  if (h1 && h1 !== "LinkedIn Profile") return h1;
  const title = normalizeInlineText(rootDocument.title).replace(/\s+\|\s+LinkedIn$/i, "");
  return title || "LinkedIn Profile";
}

function profileHeadline(main, name) {
  const candidates = [
    main.querySelector(".text-body-medium.break-words"),
    main.querySelector("[data-generated-suggestion-target]"),
    ...main.querySelectorAll("h1 + div, h1 ~ div"),
  ];
  return candidates
    .map((element) => normalizeInlineText(element?.textContent))
    .find((line) => line && line !== name && !isPronounLine(line));
}

function profileSummary(name, headline, lines) {
  const cleaned = removeMutualConnectionFragments(lines).filter((line) => line !== name && line !== headline);
  const connections = connectionsLine(cleaned);
  const followers = cleaned.find((line) => /^\d[\d,]*\s+followers$/i.test(line));
  const location = cleaned.find(isLikelyLocationLine);
  const current = cleaned.find((line) => line.includes(" · "));
  const extras = cleaned.filter(
    (line) =>
      line !== connections &&
      line !== followers &&
      line !== location &&
      line !== current &&
      !isPronounLine(line) &&
      !/^connections$/i.test(line) &&
      !/^\d[\d,+]*$/.test(line),
  );
  const output = [];
  if (headline) output.push(`- **Headline:** ${headline}`);
  if (current) output.push(`- **Current / Education:** ${current}`);
  if (location) output.push(`- **Location:** ${location}`);
  if (followers) output.push(`- **Followers:** ${followers.replace(/\s+followers$/i, "")}`);
  if (connections) output.push(`- **Connections:** ${connections}`);
  for (const extra of extras.slice(0, 3)) output.push(`- **Profile detail:** ${extra}`);
  return output;
}

function connectionsLine(lines) {
  const joined = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (/^\d[\d,+]*$/i.test(lines[index]) && /^connections$/i.test(lines[index + 1] || "")) {
      joined.push(`${lines[index]} connections`);
      index += 1;
      continue;
    }
    if (/^\d[\d,+]*\s+connections$/i.test(lines[index])) joined.push(lines[index]);
  }
  return joined[0];
}

function isLikelyLocationLine(line) {
  if (/\d|followers|connections|mutual|newsletter/i.test(line)) return false;
  if (line.length > 80) return false;
  return /,/.test(line) || /^(Singapore|Berlin|Bengaluru|Mumbai|Delhi|London|New York|San Francisco)\b/i.test(line);
}

function isPronounLine(line) {
  return /^(He\/Him|She\/Her|They\/Them)$/i.test(line);
}

function profileSections(main, name) {
  const cards = [...main.querySelectorAll("section, .artdeco-card")]
    .map((section) => {
      const title = sectionTitle(section, name);
      const lines = profileTextLines(section).filter((line) => line !== title);
      const records = profileSectionRecords(section, title);
      return { title, lines: removeMutualConnectionFragments(lines), records };
    })
    .filter((section) => section.title && section.lines.length >= 1);

  const uniqueSections = [];
  const seen = new Set();
  for (const section of cards) {
    const key = `${section.title}\n${section.lines.join("\n")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueSections.push(section);
  }
  return uniqueSections;
}

function sectionMarkdown(section) {
  const lines = sectionLinesForOutput(section);
  if (!lines.length) return "";
  if (section.title === "About") return paragraph(lines);
  if (/^(Featured|Activity)$/i.test(section.title)) return activityMarkdown(section.records, lines, section.title);
  if (section.records?.length) return recordsMarkdown(section);
  return lines.map((line) => `- ${line}`).join("\n");
}

function sectionLinesForOutput(section) {
  let lines = section.lines.filter((line) => !isProfileNoiseLine(line));
  if (/^(Featured|Activity)$/i.test(section.title)) lines = lines.filter((line) => !isActivityChromeLine(line));
  return unique(lines);
}

function paragraph(lines) {
  const skillsIndex = lines.findIndex((line) => /^Top skills$/i.test(line));
  if (skillsIndex < 0) return lines.join("\n\n");
  const prose = lines.slice(0, skillsIndex).join("\n\n");
  const skills = lines.slice(skillsIndex + 1).filter((line) => !/^Show top skills$/i.test(line));
  return [prose, skills.length ? `**Top skills:** ${skills.join(" • ")}` : ""].filter(Boolean).join("\n\n");
}

function recordsMarkdown(section) {
  if (/^Skills$/i.test(section.title)) return section.lines.map((line) => `- ${line}`).join("\n");
  const rendered = section.records.map((record) => recordMarkdown(record, section.title));
  const covered = new Set(section.records.flat());
  const missing = sectionLinesForOutput(section).filter((line) => !covered.has(line));
  if (missing.length) {
    rendered.push(["- **Additional visible details**", ...missing.map((line) => `  - ${line}`)].join("\n"));
  }
  return rendered.join("\n\n");
}

function recordMarkdown(record, sectionTitle) {
  const lines = sectionLinesForOutput({ title: sectionTitle, lines: record });
  if (!lines.length) return "";
  const [title, ...details] = lines;
  return [`- **${title}**`, ...details.map((line) => `  - ${recordLineLabel(line, sectionTitle)}`)].join("\n");
}

function recordLineLabel(line, sectionTitle) {
  if (isDateLine(line)) return `Dates: ${line}`;
  if (isLikelyLocationLine(line)) return `Location: ${line}`;
  if (line.includes(" · ")) return `Organization: ${line}`;
  if (/^Issued\b|^Credential ID\b/i.test(line)) return `Credential: ${line}`;
  if (/^Received \(\d+\)|^Given \(\d+\)$/i.test(line)) return `Count: ${line}`;
  if (/^Recommendations$/i.test(sectionTitle) && /\b(?:reported to|managed|worked with|senior to)\b/i.test(line))
    return `Relationship: ${line}`;
  return `Details: ${line}`;
}

function activityMarkdown(records, lines, sectionTitle) {
  if (records?.length) {
    const items = records.map((record) => {
      const excerpt = sectionLinesForOutput({ title: "Activity", lines: record }).filter(
        (line) => !isEngagementLine(line) && !/^\d[\d,]*$/.test(line),
      );
      return excerpt.map((line, index) => (index === 0 ? `- **${line}**` : `  - ${line}`)).join("\n");
    });
    const covered = new Set(records.flat());
    const missing = lines.filter((line) => !covered.has(line) && !isEngagementLine(line) && !/^\d[\d,]*$/.test(line));
    if (missing.length) items.push(recordsMarkdown({ title: sectionTitle, lines: missing, records: [] }));
    return items.filter(Boolean).join("\n\n");
  }
  return lines
    .filter((line) => !isEngagementLine(line) && !/^\d[\d,]*$/.test(line))
    .map((line) => `- ${line}`)
    .join("\n");
}

function profileSectionRecords(section, title) {
  if (/^About$/i.test(title || "")) return [];
  const candidates = [...section.querySelectorAll('[role="listitem"], li')];
  const items = candidates
    .filter((item) => !candidates.some((parent) => parent !== item && parent.contains(item)))
    .map((item) => removeMutualConnectionFragments(profileTextLines(item)))
    .filter((lines) => lines.length >= 2);
  return uniqueRecords(items);
}

function uniqueRecords(records) {
  const seen = new Set();
  return records.filter((record) => {
    const key = record.join("\n");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isDateLine(line) {
  return (
    /\b(?:Present|Issued|Expires)\b/i.test(line) ||
    /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}\b/i.test(line) ||
    /\b\d{4}\s*[–-]\s*(?:\d{4}|Present)\b/i.test(line)
  );
}

function isEngagementLine(line) {
  return /^\d[\d,]*\s+(?:reaction|reactions|comment|comments|repost|reposts)(?:\s+·\s+\d[\d,]*\s+(?:comment|comments|repost|reposts))*$/i.test(
    line,
  );
}

function isActivityChromeLine(line) {
  return (
    /^(Posts|Comments|Videos|Images|Documents|Newsletters|Post|Comment|Repost|reactions?|comments?|reposts?)$/i.test(
      line,
    ) || /^\d[\d,]*\s+followers$/i.test(line)
  );
}

function isDroppedProfileSection(title) {
  return /^(Highlights|Interests|People also viewed|More profiles for you|Explore Premium profiles)$/i.test(title);
}

function sectionSortKey(title) {
  const order = [
    "About",
    "Experience",
    "Education",
    "Licenses & certifications",
    "Projects",
    "Volunteering",
    "Skills",
    "Recommendations",
    "Featured",
    "Activity",
  ];
  const index = order.findIndex((value) => value.toLowerCase() === title.toLowerCase());
  return index < 0 ? order.length : index;
}

function sectionTitle(section, name) {
  const heading = section.querySelector("h2, h3");
  let title = normalizeInlineText(heading?.textContent)
    .replace(/\s+(Show all|See all|Edit|Add|Open).*$/i, "")
    .trim();
  if (!title && normalizeInlineText(section.querySelector("h1")?.textContent) === name) title = "Profile";
  if (title === name) title = "Profile";
  if (!title || title.length > 80) return undefined;
  if (isProfileNoiseLine(title)) return undefined;
  if (
    /^(More profiles for you|People also viewed|People you may know|You might like|Similar profiles|Explore Premium profiles)$/i.test(
      title,
    )
  )
    return undefined;
  return title;
}

function profileTextLines(element) {
  const clone = element.cloneNode(true);
  for (const node of clone.querySelectorAll(
    [
      "script",
      "style",
      "svg",
      "img",
      "button",
      "nav",
      "aside",
      "iframe",
      "[aria-hidden='true']",
      ".visually-hidden",
      ".artdeco-dropdown",
      ".msg-overlay-list-bubble",
    ].join(","),
  )) {
    node.remove();
  }

  return unique(
    textPieces(clone)
      .flatMap(textLines)
      .map((line) => line.replace(/\s+(opens? in a new tab|link)$/i, "").trim())
      .filter((line) => line && !isProfileNoiseLine(line)),
  );
}

function textPieces(element) {
  const showText = element.ownerDocument.defaultView?.NodeFilter?.SHOW_TEXT || 4;
  const walker = element.ownerDocument.createTreeWalker(element, showText);
  const pieces = [];
  while (walker.nextNode()) {
    const line = normalizeInlineText(walker.currentNode.nodeValue);
    if (line) pieces.push(line);
  }
  return pieces;
}

function isProfileNoiseLine(line) {
  return (
    /^(Home|My Network|Jobs|Messaging|Notifications|Me|For Business|Try Premium|Search|Skip to main content)$/i.test(
      line,
    ) ||
    /^(Connect|Follow|Message|More|Save|Cancel|Done|Edit|Add profile section|Open to|Contact info|Link)$/i.test(line) ||
    /^Show (credential|project)$/i.test(line) ||
    /^Recommend\b/i.test(line) ||
    /^Manage notifications\b/i.test(line) ||
    /^View my newsletter$/i.test(line) ||
    /^follows you$/i.test(line) ||
    /\bfollowing you since\b/i.test(line) ||
    /^You both\b/i.test(line) ||
    /^·\s*(1st|2nd|3rd)$/i.test(line) ||
    /^•\s*(1st|2nd|3rd)$/i.test(line) ||
    /^,\s*$/.test(line) ||
    /^[·•]$/.test(line) ||
    /^Show (all|more)\b/i.test(line) ||
    /^See (all|more)\b/i.test(line) ||
    /^\d+\s*\/\s*\d+$/.test(line)
  );
}

function removeMutualConnectionFragments(lines) {
  const output = [];
  for (const line of lines) {
    if (/\bmutual connections?\b/i.test(line)) {
      while (output.length && isLikelyDetachedPersonName(output.at(-1))) output.pop();
      continue;
    }
    output.push(line);
  }
  return output;
}

function isLikelyDetachedPersonName(line) {
  if (!line || line.length > 40) return false;
  if (/^(and|or|the|a)\b/i.test(line)) return true;
  if (/[,.;:|@/\\]|\d/.test(line)) return false;
  return /^[A-Z][\p{L}'-]*(?:\s+[A-Z][\p{L}'-]*){0,2}$/u.test(line);
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

export function scrapeProfile({
  document: rootDocument = document,
  navigator: nav = typeof navigator === "undefined" ? undefined : navigator,
  state = defaultProfileState,
  setIntervalFn = setInterval,
  clearIntervalFn = clearInterval,
} = {}) {
  const buttonId = "linkedinscraper-profile-copy-btn";
  rootDocument.getElementById(buttonId)?.remove();
  rootDocument.body.insertAdjacentHTML(
    "beforeend",
    `<button id="${buttonId}" disabled style="position:fixed;top:10px;right:10px;padding:10px 12px;z-index:2147483647;background:#fff;color:#111;border:1px solid #bbb;border-radius:6px;box-shadow:0 2px 10px rgba(0,0,0,.18);font:14px system-ui,sans-serif;opacity:.82;">Scanning profile...</button>`,
  );
  const button = rootDocument.getElementById(buttonId);

  const update = () => {
    if (!state.done) return;
    button.disabled = false;
    button.style.opacity = "1";
    button.textContent = "Copy profile Markdown";
    if (state.autoScrollTimer && rootDocument.defaultView)
      rootDocument.defaultView.clearInterval(state.autoScrollTimer);
    state.autoScrollTimer = null;
  };

  if (!state.autoScrollTimer && !state.done) startProfileAutoScroll({ rootDocument, state });
  update();
  state.captureTimer = setIntervalFn(update, 600);

  button.addEventListener("click", async () => {
    clearIntervalFn(state.captureTimer);
    if (state.autoScrollTimer && rootDocument.defaultView)
      rootDocument.defaultView.clearInterval(state.autoScrollTimer);
    state.captureTimer = null;
    state.autoScrollTimer = null;
    button.remove();
    await nav?.clipboard?.writeText?.(linkedinProfileMarkdown(rootDocument));
  });

  try {
    rootDocument.defaultView.__linkedinscraperProfileState = state;
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

function escapeMarkdownHeading(value) {
  return normalizeInlineText(value).replace(/^#+\s*/, "");
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
