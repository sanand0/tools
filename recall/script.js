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
const anotherBtn = document.getElementById("another-btn");
const copyBtn = document.getElementById("copy-btn");
const decayInput = document.getElementById("decay-input");
const title = document.getElementById("title");
let items = [];
let current = "";

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
    pick();
  } catch (e) {
    content.innerHTML = "";
    updateLatestToast({ title: "Error", body: e.message, color: "bg-danger" });
  }
}

function weight(i) {
  const d = +decayInput.value;
  return (1 - d) ** i;
}

function pick() {
  const weights = items.map((_, i) => weight(i));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  let i = 0;
  while (r >= weights[i]) r -= weights[i++];
  current = items[i];
  content.innerHTML = marked.parse(current);
}

fileSelect.onchange = () => load(fileSelect.value);
decayInput.oninput = pick;
anotherBtn.onclick = pick;
title.onclick = pick;
copyBtn.onclick = async () => {
  await navigator.clipboard.writeText(current);
  updateLatestToast({ body: "Copied", color: "bg-success" });
};

load(files[0].url);
