import { marked } from "https://cdn.jsdelivr.net/npm/marked/+esm";
import { bootstrapAlert } from "https://cdn.jsdelivr.net/npm/bootstrap-alert@1";
import { files, fetchNotes, randomItem } from "../recall/notes.js";

const goalInput = document.getElementById("goal-input");
const addBtn = document.getElementById("add-btn");
const ideateBtn = document.getElementById("ideate-btn");
const notesDiv = document.getElementById("notes");

addBtn.onclick = addNote;
ideateBtn.onclick = ideate;

await Promise.all([addNote(), addNote()]);

function name(url) {
  return files.find((f) => f.url === url)?.name || "Unknown";
}

async function addNote() {
  const card = document.createElement("div");
  card.className = "card mb-3 note-card";
  card.innerHTML = `
    <div class="card-body">
      <div class="d-flex gap-2 mb-2">
        <select class="form-select form-select-sm w-auto note-file">
          <option value="">Random</option>
          ${files.map((f) => `<option value="${f.url}">${f.name}</option>`).join("")}
        </select>
        <button class="btn btn-outline-secondary btn-sm note-reload"><i class="bi bi-shuffle"></i></button>
      </div>
      <h5 class="card-title"></h5>
      <div class="note-content"></div>
    </div>`;
  notesDiv.append(card);
  card.querySelector(".note-reload").onclick = () => reload(card);
  await reload(card);
}

async function reload(card) {
  const select = card.querySelector(".note-file");
  const title = card.querySelector(".card-title");
  const content = card.querySelector(".note-content");
  content.innerHTML = '<div class="text-center"><div class="spinner-border" role="status"></div></div>';
  const url = select.value || randomItem(files).url;
  try {
    const items = await fetchNotes(url);
    const used = [...notesDiv.querySelectorAll(".note-card")]
      .filter((c) => c !== card)
      .map((c) => c.note)
      .filter(Boolean);
    card.note = randomItem(items, used);
    title.textContent = name(url);
    content.innerHTML = marked.parse(card.note);
    card.fileUrl = url;
  } catch (e) {
    content.innerHTML = "";
    bootstrapAlert({ title: "Error", body: e.message, color: "danger", replace: true });
  }
}

function ideate() {
  const notes = [...notesDiv.querySelectorAll(".note-card")].map((c) => c.note).filter(Boolean);
  if (!notes.length) return bootstrapAlert({ title: "Error", body: "No notes", color: "danger", replace: true });
  const goal = goalInput.value.trim() || "Idea";
  const user = [`<GOAL>${goal}</GOAL>`, ...notes.map((n) => `<CONCEPT>${n}</CONCEPT>`)].join("\n");
  const url = `https://chatgpt.com/?model=gpt-5&q=${encodeURIComponent(`${SYSTEM_PROMPT}\n\n${user}`)}`;
  window.open(url, "_blank");
}

const SYSTEM_PROMPT = `You are a radical concept synthesiser hired to astound even experts.

GOAL: Generate one radically non-obvious <GOAL>-aligned idea fusing provided <CONCEPT>s with concrete next steps.

THINK:
1. Generate 5+ candidate links using these lenses: Inversion, Mechanism-transplant, Constraint-violation, Scale-jump, Oblique strategies, Any other radical angle
2. Score for Novelty x Utility (1-5 each); select the highest-scoring fusion
3. Converge: stress-test for edge-cases; refine language.

OUTPUT FORMAT
INSIGHT: 1-2 sentences ≤ 30 words.
MECHANISM: Explain the HOW ≤ 40 words.
HOW TO TEST: 3 bullets, each ≤ 15 words, doable within 1 month.
WHAT'S SUPRISING: What convention does this challenge?
CRITIQUE: 2 sentences: biggest risk & mitigation`;
