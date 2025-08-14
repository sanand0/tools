import { marked } from "https://cdn.jsdelivr.net/npm/marked/+esm";
import Fuse from "https://cdn.jsdelivr.net/npm/fuse.js@7/+esm";
import { bootstrapAlert } from "https://cdn.jsdelivr.net/npm/bootstrap-alert@1";

export const files = [
  {
    url: "https://raw.githubusercontent.com/sanand0/til/refs/heads/live/llms.md",
    name: "LLMs",
  },
  {
    url: "https://raw.githubusercontent.com/sanand0/til/refs/heads/live/til.md",
    name: "Things I learned",
  },
  {
    url: "https://raw.githubusercontent.com/sanand0/til/refs/heads/live/questions.md",
    name: "Questions to ask",
  },
  {
    url: "https://notes.s-anand.net/explore.md",
    name: "🔒 Explore",
  },
  {
    url: "https://notes.s-anand.net/jobs-people.md",
    name: "🔒 Jobs - People",
  },
  {
    url: "https://raw.githubusercontent.com/sanand0/til/refs/heads/live/claude-code-uses.md",
    name: "Claude Code Uses",
  },
  {
    url: "https://raw.githubusercontent.com/sanand0/til/refs/heads/live/core-concepts.md",
    name: "Core concepts",
  },
  {
    url: "https://raw.githubusercontent.com/sanand0/til/refs/heads/live/oblique-strategies.md",
    name: "Oblique strategies",
  },
];

const cache = new Map();
const error = new Map();

export async function fetchNotes(url) {
  if (error.has(url)) return [];
  if (cache.has(url)) return cache.get(url);
  const options = url.match(/notes\.s-anand\.net/) ? { credentials: "include" } : {};
  const text = await fetch(url, options).then((r) => {
    if (r.ok) return r.text();
    throw new Error(`Load failed: ${r.status}`);
  });
  const toks = marked.lexer(text);
  const items = [];
  let header = "";
  for (const tok of toks) {
    if (tok.type === "heading") header = tok.text.trim();
    else if (tok.type === "list") for (const li of tok.items) items.push(`${li.raw.trim()}\n\n\n  🏷️ *${header}*`);
  }
  cache.set(url, items);
  return items;
}

export async function fetchAll(urls) {
  const res = await Promise.allSettled(urls.map(fetchNotes));
  const out = [];
  res.forEach((r, i) => {
    if (r.status === "fulfilled") out.push(...r.value);
    else {
      error.set(urls[i], true);
      bootstrapAlert({ title: "Error", body: `${files[i].name}: ${r.reason.message}`, color: "danger" });
    }
  });
  return out;
}

export function filterNotes(items, term, starOnly) {
  const base = starOnly ? items.filter((t) => t.includes("⭐")) : items;
  if (!base.length) return [];
  const fuse = new Fuse(base, { ignoreLocation: true });
  const q = term.trim();
  return q ? fuse.search(q, { limit: 5 }).map((r) => r.item) : base;
}

export const randomItem = (arr, exclude = []) => {
  let tries = 5;
  let item;
  do item = arr[Math.floor(Math.random() * arr.length)];
  while (exclude.includes(item) && tries--);
  return item;
};
