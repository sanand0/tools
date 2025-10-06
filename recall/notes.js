import { marked } from "https://cdn.jsdelivr.net/npm/marked/+esm";
import Fuse from "https://cdn.jsdelivr.net/npm/fuse.js@7/+esm";
import { bootstrapAlert } from "https://cdn.jsdelivr.net/npm/bootstrap-alert@1";

export const files = [
  {
    url: "https://raw.githubusercontent.com/sanand0/til/refs/heads/live/llms.md",
    name: "LLMs",
    preload: true,
  },
  {
    url: "https://raw.githubusercontent.com/sanand0/til/refs/heads/live/til.md",
    name: "Things I learned",
    preload: true,
  },
  {
    url: "https://raw.githubusercontent.com/sanand0/til/refs/heads/live/core-concepts.md",
    name: "Core concepts",
    preload: true,
  },
  {
    url: "https://raw.githubusercontent.com/sanand0/til/refs/heads/live/creative-ideas.md",
    name: "Creative ideas",
  },
  {
    url: "https://raw.githubusercontent.com/sanand0/til/refs/heads/live/apps.md",
    name: "Apps to build",
  },
  {
    url: "https://raw.githubusercontent.com/sanand0/til/refs/heads/live/ai-capabilities.md",
    name: "AI Capabilities",
  },
  {
    url: "https://raw.githubusercontent.com/sanand0/til/refs/heads/live/questions.md",
    name: "Questions to ask",
  },
  {
    url: "https://notes.s-anand.net/transcripts.md",
    name: "🔒 Transcript notes",
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
];

const cache = new Map();
const error = new Map();

export async function fetchNotes(url) {
  if (error.has(url)) return [];
  if (cache.has(url)) return cache.get(url);
  const opts = url.includes("notes.s-anand.net") ? { credentials: "include" } : undefined;
  const text = await fetch(url, opts).then((r) =>
    r.ok ? r.text() : Promise.reject(new Error(`Load failed: ${r.status}`)),
  );
  const items = [];
  let header = "";
  for (const tok of marked.lexer(text)) {
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
      const url = urls[i];
      error.set(url, true);
      const file = files.find((f) => f.url === url);
      const name = file?.name || url;
      if (!name.startsWith("🔒"))
        bootstrapAlert({ title: "Error", body: `${name}: ${r.reason.message}`, color: "danger" });
    }
  });
  return out;
}

export function filterNotes(items, term, starOnly) {
  const base = starOnly ? items.filter((t) => t.includes("⭐")) : items;
  if (!base.length) return [];
  const q = term.trim();
  return q ? new Fuse(base, { ignoreLocation: true }).search(q, { limit: 5 }).map((r) => r.item) : base;
}

export const randomItem = (arr, exclude = []) => {
  let tries = 5;
  let item;
  do item = arr[Math.floor(Math.random() * arr.length)];
  while (exclude.includes(item) && tries--);
  return item;
};

export const renderStar = (btn, on) => {
  "use strict";
  if (!btn) return on; // idempotent
  btn.classList.toggle("btn-warning", on);
  btn.classList.toggle("btn-outline-warning", !on);
  btn.innerHTML = /* html */ `<i class="bi bi-${on ? "star-fill" : "star"}"></i>`;
  return on;
};
