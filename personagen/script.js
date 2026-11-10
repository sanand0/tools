import { openaiHelp } from "../common/aiconfig.js";
import { objectsToCsv, downloadCsv } from "../common/csv.js";
import { html, render } from "https://cdn.jsdelivr.net/npm/lit-html/+esm";
import { unsafeHTML } from "https://cdn.jsdelivr.net/npm/lit-html/directives/unsafe-html.js";
import { bootstrapAlert } from "https://cdn.jsdelivr.net/npm/bootstrap-alert@1";
import saveform from "https://cdn.jsdelivr.net/npm/saveform@1.2";

const DEFAULT_BASE_URLS = [
  "https://api.openai.com/v1",
  "https://aipipe.org/openai/v1",
  "https://llmfoundry.straivedemo.com/openai/v1",
  "https://llmfoundry.straive.com/openai/v1",
];

const defaultPrompt = `You create marketing personas. Given a scenario, respond in Markdown with:

# Objective
Explain the marketing purpose behind the scenario.

# Persona fields
List bullet fields describing personas (demographic, behavioural, etc.).

# Code
\u0060\u0060\u0060js
import { faker } from "https://cdn.jsdelivr.net/npm/@faker-js/faker/+esm"
import { randomNormal } from "https://cdn.jsdelivr.net/npm/d3-random@3/+esm"
export default function generate(n){ /* ... */ }
\u0060\u0060\u0060

# Survey questions
\u0060\u0060\u0060json
[{"question":"...","choices":["..."]}]
\u0060\u0060\u0060`;

let personas = [];
let survey = [];
let origSurvey = [];
let results = [];

const ui = {
  scenario: document.getElementById("scenario"),
  systemPrompt: document.getElementById("system-prompt"),
  model: document.getElementById("model"),
  countRange: document.getElementById("persona-count"),
  countDisplay: document.getElementById("persona-count-display"),
  generateBtn: document.getElementById("generate-btn"),
  configBtn: document.getElementById("openai-config-btn"),
  alert: document.getElementById("alert"),
  output: document.getElementById("llm-output"),
  table: document.getElementById("table-container"),
  downloadBtn: document.getElementById("download-btn"),
  surveyEditor: document.getElementById("survey-editor"),
  surveyActions: document.getElementById("survey-actions"),
  runSurveyBtn: document.getElementById("run-survey-btn"),
  resetSurveyBtn: document.getElementById("reset-survey-btn"),
  results: document.getElementById("results-container"),
  downloadJsonBtn: document.getElementById("download-json-btn"),
};

saveform("#personagen-form");

ui.systemPrompt.value = defaultPrompt;
ui.countRange.addEventListener("input", () => (ui.countDisplay.textContent = ui.countRange.value));

ui.configBtn.addEventListener("click", async () => {
  const { openaiConfig } = await import("https://cdn.jsdelivr.net/npm/bootstrap-llm-provider@1");
  await openaiConfig({ defaultBaseUrls: DEFAULT_BASE_URLS, show: true, openaiHelp });
});

const showError = (msg) => bootstrapAlert({ title: "Error", body: msg, color: "danger", replace: true });

ui.generateBtn.addEventListener("click", async () => {
  const scenario = ui.scenario.value.trim();
  if (!scenario) return showError("Enter a scenario.");
  const { openaiConfig } = await import("https://cdn.jsdelivr.net/npm/bootstrap-llm-provider@1");
  const { apiKey, baseUrl } = await openaiConfig({ defaultBaseUrls: DEFAULT_BASE_URLS, help: openaiHelp });
  if (!apiKey) return showError("Configure your API key.");

  ui.alert.innerHTML = "";
  ui.output.innerHTML = "";
  ui.table.innerHTML = "";
  ui.results.innerHTML = "";
  ui.downloadBtn.classList.add("d-none");
  ui.downloadJsonBtn.classList.add("d-none");
  ui.surveyEditor.innerHTML = "";
  ui.surveyActions.classList.add("d-none");

  ui.generateBtn.disabled = true;
  ui.generateBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Generating';

  const { asyncLLM } = await import("https://cdn.jsdelivr.net/npm/asyncllm@2");
  const { marked } = await import("https://cdn.jsdelivr.net/npm/marked@12/+esm");
  let full = "";
  for await (const { content } of asyncLLM(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: ui.model.value.trim(),
      stream: true,
      messages: [
        { role: "system", content: ui.systemPrompt.value },
        { role: "user", content: scenario },
      ],
    }),
  })) {
    full = content ?? "";
    render(unsafeHTML(marked.parse(full)), ui.output);
  }
  ui.generateBtn.disabled = false;
  ui.generateBtn.innerHTML = "Generate personas";

  const codeMatch = full.match(/```js\n([\s\S]*?)```/);
  const surveyMatch = full.match(/```json\n([\s\S]*?)```/);
  if (!codeMatch || !surveyMatch) return showError("Missing code or survey.");
  const blob = new Blob([codeMatch[1]], { type: "text/javascript" });
  personas = await (await import(URL.createObjectURL(blob))).default(parseInt(ui.countRange.value, 10));
  survey = JSON.parse(surveyMatch[1]);
  origSurvey = JSON.parse(JSON.stringify(survey));
  await renderTable();
  renderSurveyEditor();
  ui.surveyActions.classList.remove("d-none");
  ui.downloadBtn.classList.remove("d-none");
});

async function renderTable() {
  if (!personas.length) return;
  const headers = Object.keys(personas[0]);
  render(
    html`<table class="table table-striped table-bordered sortable">
      <thead>
        <tr>
          ${headers.map((h) => html`<th class="text-no-wrap">${h}</th>`)}
        </tr>
      </thead>
      <tbody>
        ${personas.map(
          (p) =>
            html`<tr>
              ${headers.map((h) => html`<td>${p[h]}</td>`)}
            </tr>`,
        )}
      </tbody>
    </table>`,
    ui.table,
  );
  await import("https://cdn.jsdelivr.net/npm/sortable-tablesort@4").catch(() => {});
  if (window.Tablesort) new window.Tablesort(ui.table.querySelector("table"));
}

ui.downloadBtn.addEventListener("click", () => {
  if (!personas.length) return;
  downloadCsv(objectsToCsv(personas), "personas.csv");
});

function renderSurveyEditor() {
  render(
    html`
      ${survey.map(
        (q, qi) =>
          html`<div class="mb-3">
            <div class="d-flex mb-2">
              <input class="form-control me-2" .value=${q.question} @input=${(e) => (q.question = e.target.value)} />
              <button
                class="btn btn-outline-danger"
                @click=${() => {
                  survey.splice(qi, 1);
                  renderSurveyEditor();
                }}
              >
                Delete
              </button>
            </div>
            ${q.choices.map(
              (c, ci) =>
                html`<div class="input-group mb-2">
                  <span class="input-group-text">${String.fromCharCode(65 + ci)}</span>
                  <input class="form-control" .value=${c} @input=${(e) => (q.choices[ci] = e.target.value)} />
                  <button
                    class="btn btn-outline-danger"
                    @click=${() => {
                      q.choices.splice(ci, 1);
                      renderSurveyEditor();
                    }}
                  >
                    Del
                  </button>
                </div>`,
            )}
            <button
              class="btn btn-sm btn-outline-secondary"
              ?disabled=${q.choices.length >= 6}
              @click=${() => {
                q.choices.push("");
                renderSurveyEditor();
              }}
            >
              Add option
            </button>
          </div>`,
      )}
      <button
        class="btn btn-outline-primary"
        @click=${() => {
          survey.push({ question: "", choices: [""] });
          renderSurveyEditor();
        }}
      >
        Add question
      </button>
    `,
    ui.surveyEditor,
  );
}

ui.resetSurveyBtn.addEventListener("click", () => {
  survey = JSON.parse(JSON.stringify(origSurvey));
  renderSurveyEditor();
});

ui.runSurveyBtn.addEventListener("click", runSurvey);

async function runSurvey() {
  if (!personas.length || !survey.length) return;
  ui.runSurveyBtn.disabled = true;
  ui.resetSurveyBtn.disabled = true;
  ui.results.innerHTML = "";
  ui.downloadJsonBtn.classList.add("d-none");

  const { openaiConfig } = await import("https://cdn.jsdelivr.net/npm/bootstrap-llm-provider@1");
  const { apiKey, baseUrl } = await openaiConfig({ defaultBaseUrls: DEFAULT_BASE_URLS, help: openaiHelp });
  if (!apiKey) {
    ui.runSurveyBtn.disabled = false;
    ui.resetSurveyBtn.disabled = false;
    return showError("Configure your API key.");
  }

  const { asyncLLM } = await import("https://cdn.jsdelivr.net/npm/asyncllm@2");
  const total = personas.length;
  let done = 0;
  renderProgress(done, total);

  results = Array(total);

  async function callLLM(p, i) {
    const personaText = Object.entries(p)
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n");
    const surveyText = JSON.stringify(survey);
    let full = "";
    try {
      for await (const { content } of asyncLLM(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: ui.model.value.trim(),
          stream: true,
          messages: [
            { role: "system", content: "Answer the survey as the persona. Return only JSON." },
            { role: "user", content: `${personaText}\n\nSurvey:\n${surveyText}` },
          ],
        }),
      })) {
        full = content ?? "";
      }
      return JSON.parse(full);
    } catch (e) {
      bootstrapAlert({ title: `Persona ${i + 1}`, body: String(e), color: "danger", append: true });
      return { error: String(e) };
    } finally {
      done++;
      renderProgress(done, total);
    }
  }

  let index = 0;
  async function worker() {
    while (index < personas.length) {
      const i = index++;
      results[i] = await callLLM(personas[i], i);
    }
  }
  await Promise.all(Array(4).fill(0).map(worker));

  ui.runSurveyBtn.disabled = false;
  ui.resetSurveyBtn.disabled = false;
  renderResults();
  ui.downloadJsonBtn.classList.remove("d-none");
}

function renderProgress(done, total) {
  const pct = Math.round((done / total) * 100);
  render(
    html`<div class="d-flex align-items-center mb-2">
        <div class="spinner-border me-2" role="status"></div>
        Persona ${done}/${total}
      </div>
      <div class="progress">
        <div class="progress-bar" style="width:${pct}%"></div>
      </div>`,
    ui.results,
  );
}

function personaHtml(p) {
  return Object.entries(p)
    .map(([k, v]) => `${k}: ${v}`)
    .join("<br>");
}

function questionHtml(q, choice) {
  return `${q.question}<br>${q.choices
    .map(
      (c, i) =>
        `<div${choice === String.fromCharCode(65 + i) ? ' class="fw-bold"' : ""}>${String.fromCharCode(65 + i)}. ${c}</div>`,
    )
    .join("")}`;
}

function renderResults() {
  const colors = {
    A: "var(--bs-primary)",
    B: "var(--bs-warning)",
    C: "var(--bs-success)",
    D: "var(--bs-danger)",
    E: "var(--bs-secondary)",
    F: "var(--bs-dark)",
  };
  render(
    html`<table class="table table-bordered text-center">
      <thead>
        <tr>
          <th class="text-no-wrap"></th>
          ${survey.map(
            (q, i) =>
              html`<th class="text-no-wrap" data-bs-toggle="tooltip" data-bs-html="true" title="${questionHtml(q)}">
                Q${i + 1}
              </th>`,
          )}
        </tr>
      </thead>
      <tbody>
        ${personas.map(
          (p, i) =>
            html`<tr>
              <th
                scope="row"
                class="text-no-wrap"
                data-bs-toggle="tooltip"
                data-bs-html="true"
                title="${personaHtml(p)}"
              >
                ${i + 1}
              </th>
              ${survey.map((q, qi) => {
                const ans = results[i]?.answers?.find((a) => a.q === qi + 1);
                const choice = ans?.choice;
                const col = colors[choice] || "var(--bs-light)";
                const tip = questionHtml(q, choice) + "<br><br>" + personaHtml(p);
                return html`<td data-bs-toggle="tooltip" data-bs-html="true" title="${tip}">
                  <span class="d-inline-block rounded-circle" style="width:1rem;height:1rem;background:${col}"></span>
                </td>`;
              })}
            </tr>`,
        )}
      </tbody>
    </table>`,
    ui.results,
  );
  const tooltipTriggerList = ui.results.querySelectorAll('[data-bs-toggle="tooltip"]');
  tooltipTriggerList.forEach((el) => new bootstrap.Tooltip(el));
}

ui.downloadJsonBtn.addEventListener("click", () => {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify({ personas, survey, results }, null, 2)], { type: "application/json" }),
  );
  ui.downloadJsonBtn.href = url;
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
