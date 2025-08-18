import { bootstrapAlert } from "https://cdn.jsdelivr.net/npm/bootstrap-alert@1";
import { createCard } from "../recall/card.js";

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
const notesDiv = document.getElementById("notes");
const promptEl = document.getElementById("prompt-template");
promptEl.value = promptTemplate;

[
  ["add-btn", addNote],
  ["ideate-btn", ideate],
  ["copy-btn", copyPrompt],
].forEach(([id, fn]) => (document.getElementById(id).onclick = fn));

await Promise.all([addNote(), addNote()]);

/** @returns {Promise<void>} */
async function addNote() {
  let card;
  const exclude = () =>
    [...notesDiv.querySelectorAll(".note-card")]
      .filter((c) => c !== card)
      .map((c) => c.note)
      .filter(Boolean);
  card = await createCard(notesDiv, { deletable: true, exclude });
  const del = card.querySelector(".note-delete");
  del.onclick = () => {
    card.remove();
    if (notesDiv.children.length === 1)
      notesDiv.firstElementChild.querySelector(".note-delete").classList.add("d-none");
  };
  if (notesDiv.children.length === 1) del.classList.add("d-none");
}

/** @returns {string|undefined} */
function getPrompt() {
  const notes = [...notesDiv.querySelectorAll(".note-card")].map((c) => c.note.trim()).filter(Boolean);
  if (!notes.length) {
    bootstrapAlert({ title: "Error", body: "No notes", color: "danger", replace: true });
    return;
  }
  const goal = goalInput.value.trim() || "Innovative web app";
  return promptEl.value
    .replace("__GOAL__", goal)
    .replace("__NOTES__", notes.map((n) => `<CONCEPT>\n${n}\n</CONCEPT>`).join("\n\n"));
}

/** @returns {void} */
const withPrompt = (fn) => {
  const p = getPrompt();
  if (p) fn(p);
};
function ideate() {
  withPrompt((p) => window.open(`https://chatgpt.com/?model=gpt-5-thinking&q=${encodeURIComponent(p)}`, "_blank"));
}

/** @returns {Promise<void>} */
async function copyPrompt() {
  withPrompt(async (p) => {
    await navigator.clipboard.writeText(p);
    bootstrapAlert({ body: "Copied", color: "success", replace: true });
  });
}
