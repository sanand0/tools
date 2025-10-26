const defaultState = createScraperState();

export function createScraperState(seed) {
  const tweetsByLink = Object.create(null);
  if (seed) for (const [k, v] of Object.entries(seed)) tweetsByLink[k] = v;
  return {
    tweetsByLink,
    captureTimer: null,
    autoScrollTimer: null,
    seenCount: 0,
    scrollPhase: "toTop",
    topStableTicks: 0,
  };
}

export function parseCount(text) {
  if (!text) return 0;
  const t = String(text).trim().replace(/,/g, "");
  const m = t.match(/^([0-9]*\.?[0-9]+)\s*([KkMm])?$/);
  if (!m) return Number.parseInt(t, 10) || 0;
  const n = Number.parseFloat(m[1]);
  const scale = !m[2] ? 1 : /k/i.test(m[2]) ? 1_000 : 1_000_000;
  return Math.round(n * scale);
}

function countFrom(container) {
  if (!container) return 0;
  // Prefer explicit aria labels like "12 likes" if available
  const btn = container.closest?.("button");
  const aria = btn?.getAttribute?.("aria-label") || container.getAttribute?.("aria-label") || "";
  const numberInAria = (aria.match(/([0-9][0-9,.]*)(?:\s+(?:likes?|repl(?:y|ies)|views?))/i) || [])[1];
  if (numberInAria) return parseCount(numberInAria);
  // Fallback: visible count span
  const span = container.querySelector('[data-testid="app-text-transition-container"] span, span');
  return parseCount(span?.textContent || "0");
}

function isAdArticle(article) {
  // X marks promoted tweets with a socialContext like "Promoted"
  const sc = article.querySelector('[data-testid="socialContext"]');
  if (sc && /promoted|sponsored|ad/i.test(sc.textContent || "")) return true;
  // Additional heuristic: very top line sometimes shows "Promoted"
  const top = (article.textContent || "").split("\n").slice(0, 3).join(" ");
  if (/\bPromoted\b/i.test(top)) return true;
  return false;
}

export function xTweets(rootDocument = document) {
  const out = [];
  const articles = rootDocument.querySelectorAll('article[role="article"]');
  for (const a of articles) {
    if (isAdArticle(a)) continue; // Exclude ads / promoted

    const time = a.querySelector('a[role="link"][href*="/status/"] time, time');
    const linkEl =
      time?.closest?.('a[role="link"][href*="/status/"]') || a.querySelector('a[role="link"][href*="/status/"]');
    const href = linkEl?.getAttribute?.("href");
    if (!href) continue; // Not a canonical tweet cell
    const link = new URL(href, rootDocument.location?.origin || "https://x.com").href;

    const user = a.querySelector('div[data-testid="User-Name"]');
    let name = null;
    let handle = null;
    if (user) {
      const spans = [...user.querySelectorAll("span")].map((s) => s.textContent?.trim()).filter(Boolean);
      handle = spans.find((t) => t.startsWith("@"))?.replace(/^@/, "") || null;
      name = spans.find((t) => t && !t.startsWith("@")) || null;
    }

    const timeEl = a.querySelector("time");
    const date = timeEl?.getAttribute?.("datetime") || null;
    if (!date) continue; // Drop entries with missing dates (likely ads)

    // Message text (fallback to alt text extraction if necessary)
    const textEl = a.querySelector('div[data-testid="tweetText"]');
    const message = textEl?.innerText?.trim?.() || null;

    // Metrics
    const likes = countFrom(a.querySelector('div[data-testid="like"]'));
    const replies = countFrom(a.querySelector('div[data-testid="reply"]'));
    // Views container has varied testids; try a few common ones
    const views = countFrom(
      a.querySelector(
        'div[data-testid="views"], div[data-testid="view"] , a[href*="/analytics"] div[data-testid], a[href*="/status/"] div[aria-label*="Views"]',
      ),
    );

    // Parse any aria-label summaries to capture additional fields (reposts/retweets, bookmarks, quotes)
    const extras = metricsFromAria(a);
    const mergedLikes = Math.max(likes || 0, extras.likes || 0);
    const mergedReplies = Math.max(replies || 0, extras.replies || 0);
    const mergedViews = Math.max(views || 0, extras.views || 0);
    delete extras.likes;
    delete extras.replies;
    delete extras.views;

    out.push({
      link,
      name,
      handle,
      date,
      message,
      likes: mergedLikes,
      replies: mergedReplies,
      views: mergedViews,
      ...extras,
    });
  }
  // Thread parent mapping: assume first is root; set others' parent_link to root link
  const root = out[0]?.link;
  if (root) for (let i = 1; i < out.length; i++) out[i].parent_link = root;
  return out;
}

export function mergeTweets(arr, state = defaultState) {
  for (const t of arr) {
    if (!t?.link) continue;
    const existing = state.tweetsByLink[t.link] || {};
    for (const [k, v] of Object.entries(t)) {
      const old = existing[k];
      if (typeof v === "string") {
        if ((v?.length || 0) > (old?.length || 0)) existing[k] = v;
      } else if (typeof v === "number") {
        // Keep max metric seen during capture window
        if ((v || 0) > (old || 0)) existing[k] = v;
      } else if (!old) existing[k] = v;
    }
    state.tweetsByLink[t.link] = existing;
  }
}

function clickHelpfulButtons(rootDocument = document) {
  // Expand nested replies: look for buttons with text mentioning replies
  const btns = [...rootDocument.querySelectorAll('div[role="button"], button')];
  for (const b of btns) {
    const t = (b.innerText || "").toLowerCase();
    if (!t) continue;
    if (/show/.test(t) && /repl/.test(t))
      b.click(); // "Show more replies", "Show replies"
    else if (/view/.test(t) && /repl/.test(t))
      b.click(); // "View replies"
    else if (/show more/.test(t) && !/reply|repl/.test(t)) b.click(); // expand long tweet text
  }
}

function startAutoScroll({ rootDocument = document, state = defaultState } = {}) {
  const w = rootDocument.defaultView;
  const step = () => {
    clickHelpfulButtons(rootDocument);
    const before = state.seenCount;
    const list = xTweets(rootDocument);
    mergeTweets(list, state);
    const after = Object.keys(state.tweetsByLink).length;
    if (after > before) state.seenCount = after;

    const scroller = rootDocument.scrollingElement || rootDocument.documentElement || rootDocument.body;
    if (!scroller) return;

    if (state.scrollPhase === "toTop") {
      const prevTop = scroller.scrollTop;
      w?.scrollBy?.(0, -Math.max(200, w.innerHeight * 0.9));
      // If we are at the very top already, count stability to ensure DOM had time to load earlier items
      if (scroller.scrollTop <= 0 || scroller.scrollTop === prevTop) state.topStableTicks += 1;
      else state.topStableTicks = 0;
      if (state.topStableTicks >= 3) state.scrollPhase = "down";
      return;
    }

    // Downward scan to load all replies
    w?.scrollBy?.(0, Math.max(200, w.innerHeight * 0.9));
  };
  // Jump to top immediately so we truly start at the beginning
  rootDocument.defaultView?.scrollTo?.(0, 0);
  step();
  state.autoScrollTimer = rootDocument.defaultView?.setInterval?.(step, 900) || null;
}

export function scrape({
  document: rootDocument = document,
  navigator: nav = typeof navigator === "undefined" ? undefined : navigator,
  state = defaultState,
  setIntervalFn = setInterval,
  clearIntervalFn = clearInterval,
} = {}) {
  const btnId = "xscraper-copy-btn";
  const existing = rootDocument.getElementById(btnId);
  if (existing) existing.remove();
  rootDocument.body.insertAdjacentHTML(
    "beforeend",
    `<button id="${btnId}" style="position:fixed;top:10px;right:10px;padding:10px;z-index:2147483647;background-color:#fff;color:#000;border:1px solid #ccc;border-radius:6px;box-shadow:0 2px 6px rgba(0,0,0,0.15);">Copy 0 tweets</button>`,
  );
  const btn = rootDocument.getElementById(btnId);

  const update = () => {
    mergeTweets(xTweets(rootDocument), state);
    const n = Object.values(state.tweetsByLink).length;
    btn.textContent = `Copy ${n} tweets`;
  };

  // Kick off auto-scroll capture
  if (!state.autoScrollTimer) startAutoScroll({ rootDocument, state });

  update();
  state.captureTimer = setIntervalFn(update, 600);

  btn.addEventListener("click", async () => {
    clearIntervalFn(state.captureTimer);
    if (state.autoScrollTimer && rootDocument.defaultView)
      rootDocument.defaultView.clearInterval(state.autoScrollTimer);
    state.captureTimer = null;
    state.autoScrollTimer = null;
    btn.remove();
    const list = Object.values(state.tweetsByLink);
    const enriched = addBuzzKeep(list);
    await nav?.clipboard?.writeText?.(JSON.stringify(enriched, null, 2));
  });

  // Expose state for DevTools verification without polluting output
  try {
    rootDocument.defaultView.__xscraperState = state;
  } catch {}
}

function normalizeMetricKey(label) {
  const t = label.toLowerCase();
  if (t.startsWith("repl")) return "replies";
  if (t.startsWith("retw") || t.startsWith("repo")) return "reposts";
  if (t.startsWith("like")) return "likes";
  if (t.startsWith("book")) return "bookmarks";
  if (t.startsWith("view")) return "views";
  if (t.startsWith("quot")) return "quotes";
  return t.replace(/s$/, "");
}

function metricsFromAria(article) {
  const totals = {};
  const nodes = article.querySelectorAll("[aria-label]");
  for (const el of nodes) {
    const aria = el.getAttribute("aria-label") || "";
    const re =
      /(\d[\d,.\s]*)\s*(repl(?:y|ies)|repost(?:s)?|retweet(?:s)?|like(?:s)?|bookmark(?:s)?|view(?:s)?|quote(?:s)?)/gi;
    let m;
    while ((m = re.exec(aria))) {
      const num = parseCount(m[1]);
      const key = normalizeMetricKey(m[2]);
      totals[key] = Math.max(totals[key] || 0, num);
    }
  }
  return totals;
}

// ---------------------------------------------------------------------------
// Buzz/Keep scoring
// ---------------------------------------------------------------------------

export function addBuzzKeep(items, opts = {}) {
  const {
    halfLifeBuzzHours = 72,
    halfLifeKeepHours = 36,
    buzzWeights = { likes: 2, reposts: 5 },
    keepWeights = { bookmarks: 5, replies: 4 },
    now = new Date(),
    z = 1.96,
    debug = false,
  } = opts;

  const clamp = (x, lo, hi) => Math.min(Math.max(x, lo), hi);

  function hoursBetween(d1, d2) {
    const ms = d1.getTime() - d2.getTime();
    return ms / (1000 * 60 * 60);
  }

  function expDecay(ageHours, halfLifeHours) {
    if (!isFinite(ageHours) || halfLifeHours <= 0) return 1;
    return Math.exp((-Math.log(2) * ageHours) / halfLifeHours);
  }

  function wilsonLowerBound(k, n, zScore = z) {
    if (!(n > 0)) return 0;
    const phat = Math.min(k / n, 1);
    const denom = 1 + (zScore * zScore) / n;
    const inner = (phat * (1 - phat) + (zScore * zScore) / (4 * n)) / n;
    const num = phat + (zScore * zScore) / (2 * n) - zScore * Math.sqrt(Math.max(inner, 0));
    return Math.max(num / denom, 0);
  }

  function zscore(arr) {
    const filtered = arr.filter(Number.isFinite);
    const mean = filtered.reduce((s, x) => s + x, 0) / (filtered.length || 1);
    const sd = Math.sqrt(filtered.reduce((s, x) => s + (x - mean) * (x - mean), 0) / (filtered.length || 1)) || 1;
    return arr.map((x) => (Number.isFinite(x) ? (x - mean) / sd : 0));
  }

  function correlation(x, y) {
    const n = Math.min(x.length, y.length);
    let sx = 0,
      sy = 0,
      sxx = 0,
      syy = 0,
      sxy = 0,
      count = 0;
    for (let i = 0; i < n; i++) {
      const xi = x[i],
        yi = y[i];
      if (!Number.isFinite(xi) || !Number.isFinite(yi)) continue;
      sx += xi;
      sy += yi;
      sxx += xi * xi;
      syy += yi * yi;
      sxy += xi * yi;
      count++;
    }
    if (count === 0) return 0;
    const mx = sx / count,
      my = sy / count;
    const vx = sxx / count - mx * mx;
    const vy = syy / count - my * my;
    const cov = sxy / count - mx * my;
    const denom = Math.sqrt(vx * vy);
    return denom > 0 ? clamp(cov / denom, -1, 1) : 0;
  }

  function minMaxScale(arr, lo = 0, hi = 100) {
    const valid = arr.filter(Number.isFinite);
    const min = Math.min(...valid, 0);
    const max = Math.max(...valid, 1);
    const span = max - min || 1;
    return arr.map((x) => lo + ((x - min) / span) * (hi - lo));
  }

  const nowDate = now instanceof Date ? now : new Date(now);

  const derived = items.map((raw) => {
    const o = { ...raw };
    const views = Number(o.views) || 0;
    const likes = Number(o.likes) || 0;
    const reposts = Number(o.reposts) || 0;
    const replies = Number(o.replies) || 0;
    const bookmarks = Number(o.bookmarks) || 0;

    const date = o.date ? new Date(o.date) : null;
    const ageHours = date instanceof Date && !isNaN(date) ? Math.max(0, hoursBetween(nowDate, date)) : 0;

    const wlb_likes = wilsonLowerBound(likes, views);
    const wlb_reposts = wilsonLowerBound(reposts, views);
    const wlb_replies = wilsonLowerBound(replies, views);
    const wlb_bookmarks = wilsonLowerBound(bookmarks, views);

    const buzzBase = (buzzWeights.reposts || 0) * wlb_reposts + (buzzWeights.likes || 0) * wlb_likes;
    const buzzRaw = buzzBase * expDecay(ageHours, halfLifeBuzzHours);

    const keepBase = (keepWeights.bookmarks || 0) * wlb_bookmarks + (keepWeights.replies || 0) * wlb_replies;
    const keepRaw = keepBase * expDecay(ageHours, halfLifeKeepHours);

    return {
      ...o,
      views,
      likes,
      reposts,
      replies,
      bookmarks,
      age_hours: ageHours,
      wlb_likes,
      wlb_reposts,
      wlb_replies,
      wlb_bookmarks,
      buzz_raw: buzzRaw,
      keep_raw: keepRaw,
    };
  });

  const buzzZ = zscore(derived.map((d) => d.buzz_raw));
  const keepZ = zscore(derived.map((d) => d.keep_raw));

  const corr = correlation(keepZ, buzzZ);
  const keepOrthZ = keepZ.map((kz, i) => kz - corr * buzzZ[i]);

  const buzz = minMaxScale(buzzZ, 0, 100);
  const keep = minMaxScale(keepOrthZ, 0, 100);

  return derived.map((d, i) => {
    const out = {
      ...d,
      buzz: Number.isFinite(buzz[i]) ? +buzz[i].toFixed(2) : 0,
      keep: Number.isFinite(keep[i]) ? +keep[i].toFixed(2) : 0,
    };
    if (debug) {
      out.buzz_z = +buzzZ[i].toFixed(4);
      out.keep_z = +keepZ[i].toFixed(4);
      out.keep_orth_z = +keepOrthZ[i].toFixed(4);
      out.keep_buzz_corr = +corr.toFixed(4);
    } else {
      delete out.wlb_likes;
      delete out.wlb_reposts;
      delete out.wlb_replies;
      delete out.wlb_bookmarks;
      delete out.buzz_raw;
      delete out.keep_raw;
    }
    return out;
  });
}
