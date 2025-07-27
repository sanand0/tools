import { marked } from "https://cdn.jsdelivr.net/npm/marked/+esm";
import { updateLatestToast } from "../common/toast.js";

const files = [
  {
    url: "https://raw.githubusercontent.com/sanand0/til/refs/heads/live/llms.md",
    name: "LLMs",
  },
  {
    url: "https://raw.githubusercontent.com/sanand0/til/refs/heads/live/til.md",
    name: "Things I learned",
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

const content = document.getElementById("content");
const fileSelect = document.getElementById("file-select");
const randomBtn = document.getElementById("random-btn");
const copyBtn = document.getElementById("copy-btn");
const starBtn = document.getElementById("star-btn");
const decayInput = document.getElementById("decay-input");
const indexInput = document.getElementById("index-input");
const prevBtn = document.getElementById("prev-btn");
const nextBtn = document.getElementById("next-btn");
const title = document.getElementById("title");
let items = [];
let view = [];
let index = 0;
let starOnly = false;

files.forEach((f) => fileSelect.insertAdjacentHTML("beforeend", `<option value="${f.url}">${f.name}</option>`));

async function load(url) {
  content.innerHTML = '<div class="text-center"><div class="spinner-border" role="status"></div></div>';
  try {
    const text = await fetch(url).then((r) => {
      if (r.ok) return r.text();
      throw new Error(`Load failed: ${r.status}`);
    });
    items = marked
      .lexer(text)
      .filter((t) => t.type === "list")
      .flatMap((l) => l.items.map((i) => i.raw.trim()));
    applyFilter();
  } catch (e) {
    content.innerHTML = "";
    updateLatestToast({ title: "Error", body: e.message, color: "bg-danger" });
  }
}

function weight(i) {
  const d = +decayInput.value;
  return (1 - d) ** i;
}

function applyFilter() {
  view = starOnly ? items.filter((t) => t.includes("⭐")) : items.slice();
  if (!view.length) {
    content.innerHTML = "";
    indexInput.value = "";
    updateLatestToast({ body: "No ⭐ items", color: "bg-danger" });
    return;
  }
  randomPick();
}

function show(i) {
  if (i < 0 || i >= view.length) {
    updateLatestToast({ body: "Index out of range", color: "bg-danger" });
    return;
  }
  index = i;
  content.innerHTML = marked.parse(view[i]);
  indexInput.value = i + 1;
}

function randomPick() {
  const weights = view.map((_, i) => weight(i));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  let i = 0;
  while (r >= weights[i]) r -= weights[i++];
  show(i);
}

fileSelect.onchange = () => load(fileSelect.value);
decayInput.oninput = randomPick;
randomBtn.onclick = randomPick;
title.onclick = randomPick;
prevBtn.onclick = () => show(index - 1);
nextBtn.onclick = () => show(index + 1);
indexInput.oninput = () => show(+indexInput.value - 1);
copyBtn.onclick = async () => {
  await navigator.clipboard.writeText(view[index] || "");
  updateLatestToast({ body: "Copied", color: "bg-success" });
};

starBtn.onclick = () => {
  starOnly = !starOnly;
  starBtn.className = `btn btn-${starOnly ? "warning" : "outline-warning"} btn-sm`;
  starBtn.innerHTML = `<i class="bi bi-${starOnly ? "star-fill" : "star"}"></i>`;
  applyFilter();
};

load(files[0].url);
