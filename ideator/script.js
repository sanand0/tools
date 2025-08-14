import { marked } from "https://cdn.jsdelivr.net/npm/marked/+esm";
import { bootstrapAlert } from "https://cdn.jsdelivr.net/npm/bootstrap-alert@1";
import { files, fetchNotes, randomItem, filterNotes } from "../recall/notes.js";

const promptTemplate = `You are a radical concept synthesizer hired to astound even experts.

Generate a big, useful, non-obvious idea aligned with "__GOAL__" fusing provided <CONCEPT>s with concrete next steps.

__NOTES__

THINK:

1. Generate 5+ candidate ideas (searching online for context if useful) using these lenses:
   - Inversion
   - Mechanism-transplant
   - Constraint-violation
   - Scale-jump
   - Oblique strategies
   - Any other radical angle
2. Score each for
   - Novelty: 1=common; 3=unusual; 5=not seen in field
   - Utility: 1=nice-to-have; 3=team-level impact; 5=moves a key metric in ≤90 days
3. Pick top score. Tie → lower complexity.

OUTPUT:

- INSIGHT: 1-2 sentences.
- HOW TO BUILD: Explain how it works.
- HOW TO TEST: 3 bullets, doable in ≤30 days.
- WHAT'S SUPRISING: What convention does this challenge?
- CRITIQUE: 2 sentences: biggest risk & mitigation

STYLE:

- Plain English; no hype; easy to understand. Define new terms in parentheses.
`;
const goalInput = document.getElementById("goal-input");
const addBtn = document.getElementById("add-btn");
const ideateBtn = document.getElementById("ideate-btn");
const notesDiv = document.getElementById("notes");
const promptEl = document.getElementById("prompt-template");
promptEl.value = promptTemplate;

addBtn.onclick = addNote;
ideateBtn.onclick = ideate;

await Promise.all([addNote(), addNote()]);

async function addNote() {
  notesDiv.insertAdjacentHTML(
    "beforeend",
    /* html */ `<div class="card mb-3 note-card">
      <div class="card-header d-flex gap-2 flex-wrap">
        <select class="form-select form-select-sm w-auto note-file">
          <option value="">Random</option>
          ${files.map((f) => `<option value="${f.url}">${f.name}</option>`).join("")}
        </select>
        <input type="search" class="form-control form-control-sm w-auto note-search" placeholder="Search" style="max-width: 10rem" />
        <button class="btn btn-outline-warning btn-sm note-star" title="Star"><i class="bi bi-star"></i></button>
        <button class="btn btn-outline-secondary btn-sm note-reload" title="Reload"><i class="bi bi-shuffle"></i></button>
        <button class="btn btn-outline-danger btn-sm note-delete" title="Delete"><i class="bi bi-x"></i></button>
      </div>
      <div class="card-body">
        <h5 class="card-title"></h5>
        <div class="note-content"></div>
      </div>
    </div>`,
  );
  const card = notesDiv.lastElementChild;
  const search = card.querySelector(".note-search");
  const starBtn = card.querySelector(".note-star");
  const select = card.querySelector(".note-file");
  card.querySelector(".note-reload").onclick = () => reload(card);
  select.onchange = () => {
    search.value = "";
    card.starOnly = false;
    starBtn.className = "btn btn-outline-warning btn-sm note-star";
    starBtn.innerHTML = '<i class="bi bi-star"></i>';
    reload(card);
  };
  search.oninput = () => pick(card);
  starBtn.onclick = () => {
    card.starOnly = !card.starOnly;
    starBtn.className = `btn btn-${card.starOnly ? "warning" : "outline-warning"} btn-sm note-star`;
    starBtn.innerHTML = `<i class="bi bi-${card.starOnly ? "star-fill" : "star"}"></i>`;
    pick(card);
  };
  card.querySelector(".note-delete").onclick = () => card.remove();
  if (notesDiv.children.length === 1) card.querySelector(".note-delete").classList.add("d-none");
  await reload(card);
}

async function reload(card) {
  const select = card.querySelector(".note-file");
  const content = card.querySelector(".note-content");
  content.innerHTML = /* html */ `<div class="text-center"><div class="spinner-border" role="status"></div></div>`;
  const url = select.value;
  try {
    const lists = url
      ? [[url, await fetchNotes(url)]]
      : await Promise.all(files.map(async (f) => [f.url, await fetchNotes(f.url)]));
    card.items = lists.flatMap(([u, arr]) => arr.map((note) => ({ note, url: u })));
    card.fileUrl = url || "";
    pick(card);
  } catch (e) {
    content.innerHTML = "";
    bootstrapAlert({ title: "Error", body: e.message, color: "danger", replace: true });
  }
}

function pick(card) {
  const title = card.querySelector(".card-title");
  const content = card.querySelector(".note-content");
  const term = card.querySelector(".note-search").value;
  let list = filterNotes(card.items, term, card.starOnly, "note");
  if (!list.length) {
    content.innerHTML = "";
    const msg = term.trim() ? "No match" : "No ⭐ items";
    bootstrapAlert({ body: msg, color: "danger", replace: true });
    return;
  }
  const used = [...notesDiv.querySelectorAll(".note-card")]
    .filter((c) => c !== card)
    .map((c) => c.note)
    .filter(Boolean);
  list = list.filter((o) => !used.includes(o.note));
  const note = randomItem(list.map((o) => o.note));
  if (!note) {
    content.innerHTML = "";
    bootstrapAlert({ body: "No match", color: "danger", replace: true });
    return;
  }
  const obj = list.find((o) => o.note === note);
  card.note = obj.note;
  card.fileUrl = obj.url;
  title.textContent = files.find((f) => f.url === card.fileUrl)?.name || "Unknown";
  content.innerHTML = /* html */ `<div class="form-control note-text" contenteditable>${marked.parse(card.note)}</div>`;
  content.firstElementChild.oninput = (e) => (card.note = e.target.textContent);
}

function ideate() {
  const notes = [...notesDiv.querySelectorAll(".note-card")].map((c) => c.note.trim()).filter(Boolean);
  if (!notes.length) return bootstrapAlert({ title: "Error", body: "No notes", color: "danger", replace: true });
  const goal = goalInput.value.trim() || "Innovative web app";
  const prompt = promptEl.value
    .replace("__GOAL__", goal)
    .replace("__NOTES__", notes.map((n) => `<CONCEPT>\n${n}\n</CONCEPT>`).join("\n\n"));
  window.open(`https://chatgpt.com/?model=gpt-5-thinking&q=${encodeURIComponent(prompt)}`, "_blank");
}
