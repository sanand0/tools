import { marked } from "https://cdn.jsdelivr.net/npm/marked/+esm";

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

export async function fetchNotes(url) {
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

export const randomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];
