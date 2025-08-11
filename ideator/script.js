import { marked } from "https://cdn.jsdelivr.net/npm/marked/+esm";
import { bootstrapAlert } from "https://cdn.jsdelivr.net/npm/bootstrap-alert@1";
import { asyncLLM } from "https://cdn.jsdelivr.net/npm/asyncllm@2";
import { openaiConfig } from "https://cdn.jsdelivr.net/npm/bootstrap-llm-provider@1";
import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
import { files, fetchNotes, randomItem } from "../recall/notes.js";

const file1Select = document.getElementById("file1-select");
const file2Select = document.getElementById("file2-select");
const goalInput = document.getElementById("goal-input");
const reloadBtn = document.getElementById("reload-btn");
const ideateBtn = document.getElementById("ideate-btn");
const notesDiv = document.getElementById("notes");
const ideaDiv = document.getElementById("idea");
const evalDiv = document.getElementById("eval");
let note1, note2;

files.forEach((f) => {
  file1Select.insertAdjacentHTML("beforeend", `<option value="${f.url}">${f.name}</option>`);
  file2Select.insertAdjacentHTML("beforeend", `<option value="${f.url}">${f.name}</option>`);
});

function name(url) {
  return files.find((f) => f.url === url)?.name || "Unknown";
}

async function reload() {
  notesDiv.innerHTML = '<div class="text-center"><div class="spinner-border" role="status"></div></div>';
  const urls = [file1Select.value, file2Select.value].map((v) => v || randomItem(files).url);
  try {
    const [items1, items2] = await Promise.all(urls.map(fetchNotes));
    note1 = randomItem(items1);
    note2 = randomItem(items2);
    let tries = 5;
    while (note1 === note2 && tries--) note2 = randomItem(items2);
    notesDiv.innerHTML = `${urls
      .map((u, i) => `<div class="mb-3"><h5>${name(u)}</h5>${marked.parse(i ? note2 : note1)}</div>`)
      .join("")}`;
  } catch (e) {
    notesDiv.innerHTML = "";
    bootstrapAlert({ title: "Error", body: e.message, color: "danger", replace: true });
  }
}

reloadBtn.onclick = reload;
window.reloadNotes = reload;
reload();

ideateBtn.onclick = async () => {
  if (!note1 || !note2) return;
  ideaDiv.innerHTML = '<div class="text-center"><div class="spinner-border" role="status"></div></div>';
  evalDiv.innerHTML = "";
  const goal = goalInput.value.trim() || "Idea";
  const { apiKey, baseUrl } = await openaiConfig();
  const userPrompt = `<GOAL>${goal}</GOAL>\n<CONCEPT>${note1}</CONCEPT>\n<CONCEPT>${note2}</CONCEPT>`;
  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userPrompt },
  ];
  let idea = "";
  for await (const { content, error } of asyncLLM(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: "o4-mini", stream: true, messages }),
  })) {
    if (error) return bootstrapAlert({ title: "Error", body: error, color: "danger", replace: true });
    idea = content ?? "";
    ideaDiv.innerHTML = marked.parse(idea);
  }
  await evaluate(idea, { apiKey, baseUrl });
};

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

async function evaluate(idea, { apiKey, baseUrl }) {
  evalDiv.innerHTML = '<div class="text-center"><div class="spinner-border" role="status"></div></div>';
  const schema = {
    type: "object",
    properties: {
      novel: { type: "integer" },
      novel_why: { type: "string" },
      coherent: { type: "integer" },
      coherent_why: { type: "string" },
      feasible: { type: "integer" },
      feasible_why: { type: "string" },
      impactful: { type: "integer" },
      impactful_why: { type: "string" },
    },
    required: [
      "novel",
      "novel_why",
      "coherent",
      "coherent_why",
      "feasible",
      "feasible_why",
      "impactful",
      "impactful_why",
    ],
    additionalProperties: false,
  };
  const messages = [
    { role: "system", content: EVAL_PROMPT },
    { role: "user", content: idea },
  ];
  let text = "";
  for await (const { content, error } of asyncLLM(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "o4-mini",
      stream: true,
      messages,
      response_format: { type: "json_schema", json_schema: { name: "ideator_eval", schema } },
    }),
  })) {
    if (error) return bootstrapAlert({ title: "Error", body: error, color: "danger", replace: true });
    text = content ?? "";
    try {
      drawTable(JSON.parse(text));
    } catch {}
  }
}

const EVAL_PROMPT = `You are a skeptical, unsentimental reviewer.
Return a JSON object with keys novel, coherent, feasible, impactful **and** keys novel_why, ….

NOVEL (2-5):
- 5: Challenges core assumptions, would shock experts, no existing precedent (e.g. peer-reviewed paper, blog, conference talk)
- 4: Significant departure from current practice, would surprise most experts
- 3: Interesting twist on known approaches, some experts would find it noteworthy
- 2: Minor variation on existing ideas, predictable to experts

COHERENT (2-5):
- 5: Rigorous logic (every sentence follows from the previous), addresses obvious objections, internally consistent
- 4: Generally sound reasoning with minor gaps
- 3: Basic logic holds but some hand-waving
- 2: Significant logical flaws or missing steps

FEASIBLE (2-5):
- 5: Clear implementation path, reasonable resource requirements, existing tech. 1 can prototype in a month.
- 4: Challenging but achievable with current technology. 2 can prototype in 3 months
- 3: Possible but requires significant breakthroughs or resources
- 2: Major technical/economic barriers

IMPACTFUL (2-5):
- 5: Transformative potential, affects millions, enables new industries
- 4: Significant competitive advantage or efficiency gain
- 3: Useful improvement, clear value proposition
- 2: Modest benefit, limited scope

For each rating, provide a _why:
- Score justification (≤30 words)
- Specific weakness (≤20 words)
- Existing alternatives (≤20 words, what already solves this?)

CRITICAL: If you can't identify significant weaknesses or alternatives, you're being too generous. Most ideas score 2-3 on most dimensions.`;

function drawTable(data) {
  const rows = [
    ["novel", data.novel, data.novel_why],
    ["coherent", data.coherent, data.coherent_why],
    ["feasible", data.feasible, data.feasible_why],
    ["impactful", data.impactful, data.impactful_why],
  ];
  const table = d3.create("table").attr("class", "table table-sm");
  const tbody = table.append("tbody");
  rows.forEach((r) =>
    tbody
      .append("tr")
      .selectAll("td")
      .data(r)
      .join("td")
      .text((d) => d),
  );
  evalDiv.replaceChildren(table.node());
}
