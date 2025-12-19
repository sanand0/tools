import { dsvFormat } from "https://cdn.jsdelivr.net/npm/d3-dsv@3/+esm";
import TurndownService from "https://cdn.jsdelivr.net/npm/turndown@7/+esm";
import { gfm } from "https://cdn.jsdelivr.net/npm/@joplin/turndown-plugin-gfm@1/+esm";
import { bootstrapAlert } from "https://cdn.jsdelivr.net/npm/bootstrap-alert@1";
import { openaiConfig } from "https://cdn.jsdelivr.net/npm/bootstrap-llm-provider@1";
import { openaiHelp } from "../common/aiconfig.js";
import saveform from "https://cdn.jsdelivr.net/npm/saveform@1.2";

const DEFAULT_BASE_URLS = [
  "https://api.openai.com/v1",
  "https://aipipe.org/openai/v1",
  "https://llmfoundry.straive.com/openai/v1",
];

const ui = {
  input: document.getElementById("input-box"),
  output: document.getElementById("output-box"),
  run: document.getElementById("run-btn"),
  progress: document.getElementById("progress"),
  bar: document.getElementById("progress-bar"),
  results: document.getElementById("results"),
  config: document.getElementById("openai-config-btn"),
  modal: new bootstrap.Modal(document.getElementById("detail-modal")),
  modalBody: document.querySelector("#detail-modal .modal-body"),
};

saveform("#comparator-form", { exclude: '[type="file"]' });

let promptTemplate = "";
fetch("../prompts/comparator.md")
  .then((r) => r.text())
  .then((t) => (promptTemplate = t));

const dsv = dsvFormat("\t");
const turndown = new TurndownService();
turndown.use(gfm);

function parseTSV(text) {
  const clean = text
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .trim();
  if (!clean) return { headers: [], rows: [] };
  const data = dsv.parse(clean);
  const headers = data.columns;
  const rows = data.map((r) => {
    const obj = {};
    headers.forEach((h) => {
      const v = (r[h] || "").trim();
      obj[h] = v ? v : null;
    });
    return obj;
  });
  return { headers, rows };
}

const evalKeys = (headers) => {
  const start = headers.indexOf("Name");
  const end = headers.indexOf("Notes");
  return headers.slice(start, end === -1 ? headers.length : end);
};

function baseline(a, b, keys) {
  const res = {};
  keys.forEach((k) => {
    const x = (a[k] || "").trim().toLowerCase();
    const y = (b[k] || "").trim().toLowerCase();
    res[k] = x === y ? "match" : "mismatch";
  });
  return res;
}

async function fetchMarkdown(url) {
  const r = await fetch(`https://llmfoundry.straive.com/-/proxy/${url}`);
  return turndown.turndown(await r.text());
}

async function llm(markdown, extract, apiKey, baseUrl) {
  const body = (m) =>
    JSON.stringify({
      model: "gpt-4o",
      messages: [{ role: "system", content: m }],
      temperature: 0,
    });
  let attempt = 0;
  while (attempt < 2) {
    const msg = promptTemplate.replace("{{MARKDOWN}}", markdown).replace("{{JSON}}", JSON.stringify(extract));
    const resp = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: body(msg),
    });
    const data = await resp.json();
    try {
      return JSON.parse(data.choices[0].message.content);
    } catch {
      attempt += 1;
    }
  }
  throw new Error("Invalid LLM response");
}

function updateProgress(i, total, start, latSum) {
  const pct = Math.round((i / total) * 100);
  ui.bar.style.width = `${pct}%`;
  ui.bar.textContent = `${pct}%`;
  const rowsPerSec = (i / ((Date.now() - start) / 1000)).toFixed(2);
  const latency = i ? (latSum / i).toFixed(0) : 0;
  ui.bar.title = `${rowsPerSec} rows/s, ${latency}ms`;
}

function render(results, keys) {
  const colRed = Object.fromEntries(keys.map((k) => [k, 0]));
  let totalRed = 0;
  let html = '<table class="table table-bordered table-sm m-3">';
  html += '<thead><tr><th class="sticky-header sticky-col">#</th>';
  keys.forEach((k) => (html += `<th class="sticky-header">${k}</th>`));
  html += '<th class="sticky-header">Row Error %</th></tr></thead><tbody>';
  results.forEach((r, i) => {
    let rowRed = 0;
    html += `<tr><th class="sticky-col">${i + 1}</th>`;
    keys.forEach((k) => {
      const verdict = r.llm.results[k]?.status === "correct" ? "match" : "mismatch";
      const ok = verdict === r.base[k];
      if (!ok) {
        rowRed += 1;
        colRed[k] += 1;
        totalRed += 1;
      }
      const cls = ok ? "table-success" : "table-danger";
      html += `<td data-row="${i}" data-key="${k}" class="${cls}">${verdict}</td>`;
    });
    html += `<td>${Math.round((rowRed / keys.length) * 100)}</td></tr>`;
  });
  html += '</tbody><tfoot><tr><th class="sticky-col">Col Error %</th>';
  keys.forEach((k) => {
    html += `<th>${Math.round((colRed[k] / results.length) * 100)}</th>`;
  });
  html += `<th>${Math.round((totalRed / (results.length * keys.length)) * 100)}</th></tr></tfoot></table>`;
  ui.results.innerHTML = html;
}

ui.results.addEventListener("click", (e) => {
  const td = e.target.closest("td[data-row]");
  if (!td) return;
  const r = window.__rows[+td.dataset.row];
  const key = td.dataset.key;
  const j = JSON.stringify(r.llm.results[key], null, 2);
  const body = `<p><strong>Input:</strong> ${r.input[key] || ""}</p><p><strong>Output:</strong> ${
    r.output[key] || ""
  }</p><pre>${j}</pre>`;
  ui.modalBody.innerHTML = body;
  ui.modal.show();
});

ui.config.addEventListener("click", async () => {
  await openaiConfig({ defaultBaseUrls: DEFAULT_BASE_URLS, show: true, help: openaiHelp });
});

ui.run.addEventListener("click", async () => {
  const { apiKey, baseUrl } = await openaiConfig({ defaultBaseUrls: DEFAULT_BASE_URLS, help: openaiHelp });
  if (!apiKey) return;
  const inData = parseTSV(ui.input.value);
  const outData = parseTSV(ui.output.value);
  if (!inData.rows.length || !outData.rows.length) {
    bootstrapAlert({ title: "Input needed", body: "Both tables required", color: "danger" });
    return;
  }
  if (inData.headers.join() !== outData.headers.join()) {
    bootstrapAlert({ title: "Header mismatch", body: "Input and Output headers differ", color: "danger" });
    return;
  }
  const keys = evalKeys(inData.headers);
  const total = inData.rows.length;
  let latSum = 0;
  const start = Date.now();
  const results = [];
  ui.progress.classList.remove("d-none");
  for (let i = 0; i < total; i++) {
    updateProgress(i, total, start, latSum);
    const inputRow = inData.rows[i];
    const outputRow = outData.rows[i];
    const base = baseline(inputRow, outputRow, keys);
    const md = await fetchMarkdown(inputRow.FacultySource);
    const extract = Object.fromEntries(keys.map((k) => [k, inputRow[k]]));
    const t0 = performance.now();
    let llmRes;
    try {
      llmRes = await llm(md, extract, apiKey, baseUrl);
    } catch (err) {
      bootstrapAlert({ title: "LLM error", body: err.message, color: "danger" });
      return;
    }
    latSum += performance.now() - t0;
    results.push({ input: inputRow, output: outputRow, base, llm: llmRes });
  }
  updateProgress(total, total, start, latSum);
  window.__rows = results;
  render(results, keys);
});
