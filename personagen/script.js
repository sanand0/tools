import { openaiHelp } from "../common/aiconfig.js";
import { objectsToCsv, downloadCsv } from "../common/csv.js";

const DEFAULT_BASE_URLS = [
  "https://api.openai.com/v1",
  "https://aipipe.org/openai/v1",
  "https://llmfoundry.straivedemo.com/openai/v1",
  "https://llmfoundry.straive.com/openai/v1",
];

const defaultPrompt = `You create marketing personas. Given a scenario, respond in Markdown with:\n\n# Objective\nExplain the marketing purpose behind the scenario.\n\n# Persona fields\nList bullet fields describing personas (demographic, behavioural, etc.).\n\n# Code\n\u0060\u0060\u0060js\nimport { faker } from "https://cdn.jsdelivr.net/npm/@faker-js/faker/+esm"\nimport { randomNormal } from "https://cdn.jsdelivr.net/npm/d3-random@3/+esm"\nexport default function generate(n){ /* ... */ }\n\u0060\u0060\u0060\n\n# Survey questions\n[ {"question":"...","choices":["..."]} ]`;

let personas = [];

document.addEventListener("DOMContentLoaded", () => {
  const scenario = document.getElementById("scenario");
  const systemPrompt = document.getElementById("system-prompt");
  const model = document.getElementById("model");
  const countRange = document.getElementById("persona-count");
  const countDisplay = document.getElementById("persona-count-display");
  const generateBtn = document.getElementById("generate-btn");
  const configBtn = document.getElementById("openai-config-btn");
  const alert = document.getElementById("alert");
  const output = document.getElementById("llm-output");
  const tableContainer = document.getElementById("table-container");
  const downloadBtn = document.getElementById("download-btn");
  systemPrompt.value = defaultPrompt;
  import("https://cdn.jsdelivr.net/npm/bootstrap-dark-theme@1").catch(() => {});

  countRange.addEventListener("input", () => (countDisplay.textContent = countRange.value));
  configBtn.addEventListener("click", async () => {
    const { openaiConfig } = await import("https://cdn.jsdelivr.net/npm/bootstrap-llm-provider@1");
    await openaiConfig({ defaultBaseUrls: DEFAULT_BASE_URLS, show: true, openaiHelp });
  });

  const showAlert = (msg) => (alert.innerHTML = `<div class="alert alert-danger" role="alert">${msg}</div>`);

  generateBtn.addEventListener("click", async () => {
    const scenarioText = scenario.value.trim();
    const { openaiConfig } = await import("https://cdn.jsdelivr.net/npm/bootstrap-llm-provider@1");
    const { apiKey, baseUrl } = await openaiConfig({
      defaultBaseUrls: DEFAULT_BASE_URLS,
      help: openaiHelp,
    });
    if (!scenarioText) return showAlert("Enter a scenario.");
    if (!apiKey) return showAlert("Configure your API key.");

    alert.innerHTML = "";
    output.innerHTML = "";
    tableContainer.innerHTML = "";
    downloadBtn.classList.add("d-none");
    generateBtn.disabled = true;
    generateBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Generating';

    const { asyncLLM } = await import("https://cdn.jsdelivr.net/npm/asyncllm@2");
    const { marked } = await import("https://cdn.jsdelivr.net/npm/marked@12/+esm");
    let full = "";
    for await (const { content } of asyncLLM(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model.value.trim(),
        stream: true,
        messages: [
          { role: "system", content: systemPrompt.value },
          { role: "user", content: scenarioText },
        ],
      }),
    })) {
      full = content ?? "";
      output.innerHTML = marked.parse(full);
      output.scrollTop = output.scrollHeight;
    }
    generateBtn.disabled = false;
    generateBtn.innerHTML = "Generate personas";

    const codeMatch = full.match(/```js\n([\s\S]*?)```/);
    if (!codeMatch) return showAlert("No code block found.");
    const code = codeMatch[1];
    const blob = new Blob([code], { type: "text/javascript" });
    const mod = await import(URL.createObjectURL(blob));
    personas = await mod.default(parseInt(countRange.value, 10));
    renderTable();
  });

  async function renderTable() {
    if (!personas.length) return;
    const headers = Object.keys(personas[0]);
    const { select } = await import("https://cdn.jsdelivr.net/npm/d3@7/+esm");
    await import("https://cdn.jsdelivr.net/npm/sortable-tablesort@4").catch(() => {});
    const table = select(tableContainer)
      .html("")
      .append("table")
      .attr("class", "table table-striped table-bordered sortable");
    table
      .append("thead")
      .append("tr")
      .selectAll("th")
      .data(headers)
      .join("th")
      .text((d) => d);
    table
      .append("tbody")
      .selectAll("tr")
      .data(personas)
      .join("tr")
      .selectAll("td")
      .data((d) => headers.map((h) => d[h]))
      .join("td")
      .text((d) => d);
    downloadBtn.classList.remove("d-none");
    if (window.Tablesort) new window.Tablesort(table.node());
  }

  downloadBtn.addEventListener("click", () => {
    if (!personas.length) return;
    const csv = objectsToCsv(personas);
    downloadCsv(csv, "personas.csv");
  });
});
