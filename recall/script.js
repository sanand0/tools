import { marked } from "https://cdn.jsdelivr.net/npm/marked/+esm";
import { bootstrapAlert } from "https://cdn.jsdelivr.net/npm/bootstrap-alert@1";
import { files, fetchAll, filterNotes } from "./notes.js";

const content = document.getElementById("content");
const fileSelect = document.getElementById("file-select");
const randomBtn = document.getElementById("random-btn");
const copyBtn = document.getElementById("copy-btn");
const quizBtn = document.getElementById("quiz-btn");
const starBtn = document.getElementById("star-btn");
const decayInput = document.getElementById("decay-input");
const indexInput = document.getElementById("index-input");
const searchInput = document.getElementById("search-input");
const prevBtn = document.getElementById("prev-btn");
const nextBtn = document.getElementById("next-btn");
const title = document.getElementById("title");
let items = [];
let view = [];
let index = 0;
let starOnly = false;

fileSelect.insertAdjacentHTML("beforeend", /* html */ `<option value="">All</option>`);
files.forEach((f) =>
  fileSelect.insertAdjacentHTML("beforeend", /* html */ `<option value="${f.url}">${f.name}</option>`),
);
fileSelect.value = "";

async function load(url) {
  content.innerHTML = '<div class="text-center"><div class="spinner-border" role="status"></div></div>';
  const urls = url ? [url] : files.map((f) => f.url);
  const list = await fetchAll(urls);
  items.length = 0;
  items.push(...list);
  applyFilter();
}

function weight(i) {
  const d = +decayInput.value;
  return (1 - d) ** i;
}

function applyFilter() {
  if (!items.length) {
    content.innerHTML = "";
    indexInput.value = "";
    bootstrapAlert({ body: "No notes", color: "danger", replace: true });
    return;
  }
  view = filterNotes(items, searchInput.value, starOnly);
  if (!view.length) {
    content.innerHTML = "";
    indexInput.value = "";
    bootstrapAlert({ body: starOnly ? "No ⭐ items" : "No match", color: "danger", replace: true });
    return;
  }
  if (searchInput.value.trim()) {
    index = 0;
    content.innerHTML = marked.parse(view.join("\n"));
    indexInput.value = "";
    return;
  }
  randomPick();
}

function show(i) {
  if (i < 0 || i >= view.length) {
    bootstrapAlert({ body: "Index out of range", color: "danger", replace: true });
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

fileSelect.onchange = () => {
  searchInput.value = "";
  load(fileSelect.value);
};
decayInput.oninput = randomPick;
randomBtn.onclick = randomPick;
title.onclick = randomPick;
prevBtn.onclick = () => show(index - 1);
nextBtn.onclick = () => show(index + 1);
indexInput.oninput = () => show(+indexInput.value - 1);
searchInput.oninput = applyFilter;
copyBtn.onclick = async () => {
  await navigator.clipboard.writeText(view[index] || "");
  bootstrapAlert({ body: "Copied", color: "success", replace: true });
};

quizBtn.onclick = () => {
  const note = view[index];
  if (!note) return bootstrapAlert({ body: "No note", color: "danger", replace: true });
  const q = `${note}\n\nQuiz me so I can learn this better. Search online for more information if required.`;
  window.open(`https://chatgpt.com/?model=gpt-5-thinking&q=${encodeURIComponent(q)}`, "_blank");
};

starBtn.onclick = () => {
  starOnly = !starOnly;
  starBtn.className = `btn btn-${starOnly ? "warning" : "outline-warning"} btn-sm`;
  starBtn.innerHTML = /* html */ `<i class="bi bi-${starOnly ? "star-fill" : "star"}"></i>`;
  applyFilter();
};

load();
