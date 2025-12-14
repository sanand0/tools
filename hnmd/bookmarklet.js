const $ = (selector, el) => (el || document).querySelector(selector);
const normalize = (text = "") => text.replace(/\s+/g, " ").trim();
const pad = (value) => String(value).padStart(2, "0");

const renderMessage = (node) => {
  if (!node) return "";
  const clone = node.cloneNode(true);
  clone.querySelectorAll("a[href]").forEach((a) => (a.textContent = a.href));
  clone.querySelectorAll("p, br, div").forEach((el) => el.insertAdjacentText("beforebegin", " "));
  return normalize(clone.textContent ?? "");
};

const formatTimestamp = (root) => {
  const title = $(".age", root)?.getAttribute("title")?.trim();
  if (!title) return "unknown";
  const iso = title.split(/\s+/)[0];
  const date = new Date(iso.endsWith("Z") ? iso : `${iso}Z`);
  if (Number.isNaN(date.getTime())) return "unknown";
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}Z`;
};

const buildStory = (doc) => {
  const story = $(".fatitem", doc);
  if (!story) return null;

  const title = normalize($(".titleline a", story)?.textContent ?? "");
  const text = renderMessage($(".commtext", story));
  const url = $(".titleline a", story)?.href ?? "";
  const user = $(".hnuser", story)?.textContent?.trim() ?? "unknown";
  const message = normalize([title, text, url && !url.includes("item?id=") ? url : ""].filter(Boolean).join(" — "));

  return message ? { user, message, timestamp: formatTimestamp(story), indent: 0 } : null;
};

const buildComments = (doc) =>
  [...doc.querySelectorAll("tr.athing.comtr")].map((row) => {
    const width = parseInt($("td.ind img", row)?.getAttribute("width") ?? "0", 10);
    const indent = Number.isNaN(width) ? 0 : Math.max(Math.round(width / 40), 0);
    const user = $(".hnuser", row)?.textContent?.trim() ?? "unknown";
    const message = renderMessage($(".commtext", row)) || "[no text]";
    return { user, message, timestamp: formatTimestamp(row), indent };
  });

const createIdFormatter = () => {
  const counters = [];
  return (indent) => {
    const level = indent + 1;
    if (!counters.length) {
      counters.push(1);
    } else if (level > counters.length) {
      while (counters.length < level) counters.push(1);
    } else {
      counters.splice(level);
      counters[counters.length - 1] += 1;
    }
    return counters.join(".");
  };
};

export const extractThread = (doc = document) => {
  const story = buildStory(doc);
  const baseIndent = story ? 1 : 0;
  const comments = buildComments(doc).map((comment) => ({ ...comment, indent: comment.indent + baseIndent }));
  const items = [story, ...comments].filter(Boolean);
  const formatId = createIdFormatter();

  return items
    .map(
      ({ indent, user, message, timestamp }) =>
        `${"  ".repeat(indent)}- [${formatId(indent)}] ${user}: ${message} [${timestamp}]`,
    )
    .join("\n");
};

const copyText = async (text, doc = document, win = window) => {
  if (win?.navigator?.clipboard?.writeText) {
    await win.navigator.clipboard.writeText(text);
    return true;
  }
  const textarea = doc.createElement("textarea");
  textarea.value = text;
  doc.body.append(textarea);
  textarea.select();
  const copied = doc.execCommand?.("copy");
  textarea.remove();
  return Boolean(copied);
};

export const copyThread = async (doc = document, win = window) => {
  const markdown = extractThread(doc);
  const ok = await copyText(markdown, doc, win);
  const notify = win?.alert ?? console.warn;
  notify(ok ? "Hacker News thread copied to clipboard" : "Failed to copy Hacker News thread");
  return markdown;
};

if (typeof window !== "undefined") window.hnMd = { extractThread, copyThread };
