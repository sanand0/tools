// @ts-check
const defaultState = createScraperState();

const REACTION_EMOJI = {
  heart: "♥️",
  heart_on_fire: "❤️‍🔥",
  "+1": "👍",
  "-1": "👎",
  laugh: "😆",
  laughing: "😆",
  joy: "😂",
  grin: "😁",
  smile: "😄",
  open_mouth: "😮",
  scream: "😱",
  cry: "😭",
  sob: "😭",
  clap: "👏",
  raised_hands: "🙌",
  tada: "🎉",
  confetti_ball: "🎊",
  rocket: "🚀",
  thinking: "🤔",
  eyes: "👀",
  star_struck: "🤩",
  fire: "🔥",
  100: "💯",
};

export function createScraperState(seed) {
  const postsById = Object.create(null);
  if (seed) for (const [key, value] of Object.entries(seed)) postsById[key] = value;
  return {
    postsById,
    captureTimer: null,
    autoScrollTimer: null,
    seenCount: 0,
    scrollPhase: "toTop",
    topStableTicks: 0,
  };
}

export function parseCount(text) {
  if (!text) return 0;
  const cleaned = String(text).trim().replace(/,/g, "");
  const shorthand = cleaned.match(/^([0-9]*\.?[0-9]+)\s*([KkMm])$/);
  if (!shorthand) return Number.parseInt(cleaned, 10) || 0;
  const value = Number.parseFloat(shorthand[1]);
  const multiplier = shorthand[2].toLowerCase() === "k" ? 1_000 : 1_000_000;
  return Math.round(value * multiplier);
}

function controllerFromDocument(rootDocument) {
  const w = rootDocument.defaultView;
  const container = w?.Discourse?.__container__;
  if (!container?.lookup) return null;
  try {
    return container.lookup("controller:topic") || null;
  } catch {
    return null;
  }
}

function getTopicBase(rootDocument, controller) {
  const { location } = rootDocument.defaultView || {};
  const pathname = location?.pathname || "";
  const match = pathname.match(/^\/t\/([^/]+)\/(\d+)(?:\/\d+)?/);
  if (match) return `${location.origin}/t/${match[1]}/${match[2]}`;
  const model = controller?.model;
  if (model?.relative_url && location?.origin)
    return new URL(model.relative_url, location.origin).href.replace(/\/\d+$/, "");
  const canonical = rootDocument.querySelector('link[rel="canonical"]')?.getAttribute("href");
  if (canonical) {
    const url = new URL(canonical, location?.origin || "https://discourse.example.com");
    const parts = url.pathname.split("/").slice(0, 4).join("/");
    return `${url.origin}${parts}`;
  }
  return location?.href ? location.href.replace(/\/\d+(?:\?.*)?$/, "") : "";
}

function permalinkFor(baseUrl, postNumber) {
  if (!baseUrl) return null;
  if (postNumber === 1) return baseUrl;
  return `${baseUrl}/${postNumber}`;
}

function reactionIdToEmoji(id) {
  if (!id) return null;
  if (REACTION_EMOJI[id]) return REACTION_EMOJI[id];
  const normalized = id.replace(/:.+$/, "");
  if (REACTION_EMOJI[normalized]) return REACTION_EMOJI[normalized];
  if (REACTION_EMOJI[id.replace(/-/g, "_")]) return REACTION_EMOJI[id.replace(/-/g, "_")];
  return id;
}

function summarizeReactions(post) {
  const likes = Object.create(null);
  if (Number.isFinite(post?.like_count) && post.like_count > 0) likes["♥️"] = post.like_count;
  if (Array.isArray(post?.reactions))
    for (const reaction of post.reactions) {
      const count = Number(reaction?.count) || 0;
      if (!count) continue;
      const key = reactionIdToEmoji(reaction.id) || reaction.id;
      const prev = Number(likes[key]) || 0;
      likes[key] = Math.max(prev, count);
    }
  if (Array.isArray(post?.actions_summary))
    for (const summary of post.actions_summary) {
      const { id, count } = summary;
      if (!(Number(count) > 0)) continue;
      if (id === 2) {
        likes["♥️"] = Math.max(Number(likes["♥️"]) || 0, count);
      }
    }
  return likes;
}

function absoluteUrl(url, rootDocument) {
  if (!url) return null;
  try {
    return new URL(url, rootDocument.defaultView?.location?.href || "https://discourse.example.com").href;
  } catch {
    return url;
  }
}

function htmlToMarkdown(html, rootDocument) {
  if (!html) return "";
  const temp = rootDocument.createElement("div");
  temp.innerHTML = html;
  temp.querySelectorAll("script, style, noscript").forEach((el) => el.remove());
  temp.querySelectorAll("span.mention, a.mention").forEach((el) => {
    el.replaceWith(`@${el.textContent?.replace(/^@/, "") || ""}`.trim());
  });
  temp.querySelectorAll("img.emoji").forEach((img) => {
    const replacement = img.getAttribute("alt") || img.getAttribute("title") || "";
    img.replaceWith(replacement);
  });
  return cleanupMarkdown(nodesToMarkdown(temp.childNodes, { listStack: [], rootDocument })).trim();
}

function nodesToMarkdown(nodeList, context) {
  let out = "";
  nodeList.forEach((node) => {
    out += nodeToMarkdown(node, context);
  });
  return out;
}

function nodeToMarkdown(node, context) {
  if (!node) return "";
  if (node.nodeType === node.TEXT_NODE) return escapeMarkdown(node.textContent || "", context);
  if (node.nodeType !== node.ELEMENT_NODE) return "";
  const tag = node.tagName.toLowerCase();
  switch (tag) {
    case "br":
      return "  \n";
    case "p":
    case "div":
      return blockWrap(nodesToMarkdown(node.childNodes, context));
    case "strong":
    case "b": {
      const content = nodesToMarkdown(node.childNodes, context).trim();
      return content ? `**${content}**` : "";
    }
    case "em":
    case "i": {
      const content = nodesToMarkdown(node.childNodes, context).trim();
      return content ? `*${content}*` : "";
    }
    case "code": {
      const parent = node.parentElement?.tagName.toLowerCase();
      const content = (node.textContent || "").replace(/\s+/g, " ").trim();
      if (!content) return "";
      return parent === "pre" ? content : `\`${content}\``;
    }
    case "pre": {
      const text = node.textContent || "";
      if (!text.trim()) return "";
      const trimmed = text.replace(/\s+$/, "");
      return `\n\n\`\`\`\n${trimmed}\n\`\`\`\n\n`;
    }
    case "blockquote": {
      const content = cleanupMarkdown(nodesToMarkdown(node.childNodes, context).trim());
      if (!content) return "";
      return `\n\n${content
        .split("\n")
        .map((line) => `> ${line.trim()}`)
        .join("\n")}\n\n`;
    }
    case "ul":
    case "ol": {
      const isOrdered = tag === "ol";
      context.listStack.push(isOrdered ? "ol" : "ul");
      const children = [...node.children].filter((el) => el.tagName.toLowerCase() === "li");
      const lines = children
        .map((child, index) => listItemMarkdown(child, context, isOrdered ? index + 1 : null))
        .filter(Boolean)
        .join("\n");
      context.listStack.pop();
      return `\n${lines}\n`;
    }
    case "li":
      return listItemMarkdown(node, context, null);
    case "hr":
      return "\n\n---\n\n";
    case "a": {
      const href = node.getAttribute("href");
      const content = nodesToMarkdown(node.childNodes, context).trim() || href;
      if (!href) return content;
      const absolute = absoluteUrl(href, context.rootDocument || document);
      return `[${content}](${absolute || href})`;
    }
    case "img": {
      const alt = node.getAttribute("alt") || "";
      const src = node.getAttribute("src");
      if (!src) return alt;
      return `![${alt}](${src})`;
    }
    case "table": {
      const rows = [...node.querySelectorAll("tr")];
      if (!rows.length) return "";
      const table = rows.map((row) => [...row.children].map((cell) => cleanupMarkdown(cell.textContent || "").trim()));
      const header = table[0];
      const alignRow = header.map(() => "---");
      const body = table.slice(1);
      const allRows = [header, alignRow, ...body].map((cols) => `| ${cols.join(" | ")} |`);
      return `\n${allRows.join("\n")}\n\n`;
    }
    default:
      return nodesToMarkdown(node.childNodes, context);
  }
}

function listItemMarkdown(node, context, orderIndex) {
  const depth = context.listStack.length - 1;
  const indent = depth > 0 ? "  ".repeat(depth) : "";
  const marker = context.listStack.at(-1) === "ol" ? `${orderIndex ?? 1}. ` : "- ";
  const content = cleanupMarkdown(nodesToMarkdown(node.childNodes, context).trim());
  if (!content) return "";
  const lines = content.split("\n");
  const [first, ...rest] = lines;
  const subsequent = rest.map((line) => `${indent}  ${line}`).join("\n");
  return `${indent}${marker}${first}${subsequent ? `\n${subsequent}` : ""}`;
}

function escapeMarkdown(text, context) {
  if (!text) return "";
  const replaced = text.replace(/\s+/g, " ");
  if (context.listStack?.length) return replaced;
  return replaced;
}

function blockWrap(text) {
  const trimmed = cleanupMarkdown(text).trim();
  return trimmed ? `\n\n${trimmed}\n\n` : "";
}

function cleanupMarkdown(text) {
  return text.replace(/\u00a0/g, " ").replace(/\n{3,}/g, "\n\n");
}

function postsFromController(controller, rootDocument) {
  const model = controller?.model;
  const posts = Array.isArray(model?.postStream?.posts) ? model.postStream.posts : [];
  const baseUrl = getTopicBase(rootDocument, controller);
  const topicTitle = model?.title || rootDocument.title || null;
  const topicId = model?.id || null;
  const topicSlug = model?.slug || null;
  const topicUrl = baseUrl || rootDocument.defaultView?.location?.href || null;
  const output = [];
  for (const post of posts) {
    if (!post) continue;
    if (post.post_type && post.post_type !== 1) continue;
    const cooked = post.cooked || "";
    if (!cooked.trim()) continue;
    const postNumber = Number(post.post_number) || 1;
    const record = {
      topic_id: topicId,
      topic_slug: topicSlug,
      topic_title: topicTitle,
      topic_url: topicUrl,
      post_id: post.id,
      post_number: postNumber,
      reply_to_post_number: post.reply_to_post_number ?? null,
      date: post.created_at || post.updated_at || null,
      link: permalinkFor(baseUrl, postNumber),
      parent_link: post.reply_to_post_number ? permalinkFor(baseUrl, post.reply_to_post_number) : null,
      user_id: post.user_id ?? null,
      user_name: post.name || post.username || null,
      user_username: post.username || null,
      user_link: post.username ? `/u/${post.username}` : null,
      user_role: post.user_title || null,
      message: htmlToMarkdown(cooked, rootDocument),
      likes: summarizeReactions(post),
    };
    if (Number.isFinite(post.reads)) record.reads = post.reads;
    if (Number.isFinite(post.reply_count)) record.reply_count = post.reply_count;
    if (Array.isArray(post.link_counts) && post.link_counts.length)
      record.links = post.link_counts.map((link) => ({
        url: absoluteUrl(link.url, rootDocument),
        title: link.title || null,
        clicks: link.clicks ?? null,
        internal: link.internal ?? null,
      }));
    if (Array.isArray(post.replies_to_post_number)) record.replies_to_post_number = post.replies_to_post_number;
    output.push(record);
  }
  if (output.length && Number.isFinite(model?.views)) output[0].views = model.views;
  return output;
}

function postsFromDom(rootDocument) {
  const baseUrl = getTopicBase(rootDocument, null);
  const topicTitle = rootDocument.title || null;
  const topicUrl = rootDocument.defaultView?.location?.href || null;
  const articles = rootDocument.querySelectorAll("article[data-post-id]");
  const output = [];
  for (const article of articles) {
    const cooked = article.querySelector(".cooked");
    if (!cooked) continue;
    const idAttr = article.getAttribute("data-post-id");
    const postNumberMatch = article.id?.match?.(/post_(\d+)/);
    const postNumber = postNumberMatch ? Number(postNumberMatch[1]) : null;
    const time = article.querySelector("time")?.getAttribute("datetime");
    const userEl = article.querySelector(".names span.username, .poster span.username");
    const username = userEl?.textContent?.trim() || null;
    const userLink = article.querySelector(".names span.username a, .poster span.username a")?.getAttribute("href");
    output.push({
      topic_title: topicTitle,
      topic_url: topicUrl,
      post_id: idAttr ? Number(idAttr) : null,
      post_number: postNumber,
      reply_to_post_number: null,
      date: time || null,
      link: postNumber ? permalinkFor(baseUrl, postNumber) : baseUrl,
      parent_link: null,
      user_name: username,
      user_username: username,
      user_link: userLink || null,
      user_role: article.querySelector(".names .title")?.textContent?.trim() || null,
      message: htmlToMarkdown(cooked.innerHTML, rootDocument),
      likes: {},
    });
  }
  const viewsButton = rootDocument.querySelector(".topic-map__views-trigger .number");
  const first = output[0];
  if (first && viewsButton) first.views = parseCount(viewsButton.textContent || "");
  return output;
}

export function discoursePosts(rootDocument = document) {
  const controller = controllerFromDocument(rootDocument);
  const posts = controller ? postsFromController(controller, rootDocument) : postsFromDom(rootDocument);
  const sorted = posts.slice().sort((a, b) => (a.post_number || 0) - (b.post_number || 0));
  return sorted.map((post, index) => {
    if (!post.parent_link && index > 0 && !post.reply_to_post_number)
      post.parent_link = sorted[0]?.link || post.parent_link;
    return post;
  });
}

export function mergePosts(list, state = defaultState) {
  for (const post of list) {
    const key = post.post_id || post.link;
    if (!key) continue;
    const existing = state.postsById[key] || {};
    for (const [field, value] of Object.entries(post)) {
      const prev = existing[field];
      if (typeof value === "string") {
        if ((value?.length || 0) > (prev?.length || 0)) existing[field] = value;
      } else if (Number.isFinite(value)) {
        if (Number.isFinite(prev)) existing[field] = Math.max(prev, value);
        else existing[field] = value;
      } else if (value && typeof value === "object") {
        existing[field] = { ...prev, ...value };
      } else if (value !== undefined && prev == null) existing[field] = value;
    }
    state.postsById[key] = existing;
  }
}

function clickHelpfulButtons(rootDocument) {
  const candidates = [...rootDocument.querySelectorAll('button, a[role="button"], .timeline-down .timeline-button')];
  for (const el of candidates) {
    const text = `${el.textContent || ""} ${el.getAttribute("aria-label") || ""}`.toLowerCase();
    if (!text) continue;
    if (/show more|load more|expand|continue|view replies|summary|top replies/.test(text)) el.click();
  }
}

function startAutoScroll({ rootDocument = document, state = defaultState } = {}) {
  const win = rootDocument.defaultView;
  if (!win) return;
  const step = () => {
    clickHelpfulButtons(rootDocument);
    const before = state.seenCount;
    mergePosts(discoursePosts(rootDocument), state);
    const after = Object.keys(state.postsById).length;
    if (after > before) state.seenCount = after;
    const scroller = rootDocument.scrollingElement || rootDocument.documentElement || rootDocument.body;
    if (!scroller) return;
    if (state.scrollPhase === "toTop") {
      const prevTop = scroller.scrollTop;
      win.scrollBy(0, -Math.max(200, win.innerHeight * 0.9));
      if (scroller.scrollTop <= 0 || scroller.scrollTop === prevTop) state.topStableTicks += 1;
      else state.topStableTicks = 0;
      if (state.topStableTicks >= 3) state.scrollPhase = "down";
      return;
    }
    win.scrollBy(0, Math.max(300, win.innerHeight * 0.9));
  };
  win.scrollTo(0, 0);
  step();
  state.autoScrollTimer = win.setInterval(step, 1000);
}

export function scrape({
  document: rootDocument = document,
  navigator: nav = typeof navigator === "undefined" ? undefined : navigator,
  state = defaultState,
  setIntervalFn = setInterval,
  clearIntervalFn = clearInterval,
} = {}) {
  const btnId = "discoursescraper-copy-btn";
  rootDocument.getElementById(btnId)?.remove();
  rootDocument.body.insertAdjacentHTML(
    "beforeend",
    `<button id="${btnId}" style="position:fixed;top:10px;right:10px;padding:10px;z-index:2147483647;background-color:#fff;color:#000;border:1px solid #ccc;border-radius:6px;box-shadow:0 2px 6px rgba(0,0,0,0.15);">Copy 0 posts</button>`,
  );
  const btn = rootDocument.getElementById(btnId);
  if (!state.autoScrollTimer) startAutoScroll({ rootDocument, state });

  const update = () => {
    mergePosts(discoursePosts(rootDocument), state);
    const count = Object.keys(state.postsById).length;
    btn.textContent = `Copy ${count} posts`;
  };

  update();
  state.captureTimer = setIntervalFn(update, 700);

  btn.addEventListener("click", async () => {
    clearIntervalFn(state.captureTimer);
    state.captureTimer = null;
    if (state.autoScrollTimer && rootDocument.defaultView)
      rootDocument.defaultView.clearInterval(state.autoScrollTimer);
    state.autoScrollTimer = null;
    btn.remove();

    const payload = Object.values(state.postsById).sort((a, b) => (a.post_number || 0) - (b.post_number || 0));
    await nav?.clipboard?.writeText?.(JSON.stringify(payload, null, 2));
  });

  try {
    rootDocument.defaultView.__discoursescraperState = state;
  } catch {
    // noop - best effort for debugging
  }
}

export { defaultState };
