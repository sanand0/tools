import { dsvFormat } from "https://cdn.jsdelivr.net/npm/d3-dsv@3/+esm";
import { bootstrapAlert } from "https://cdn.jsdelivr.net/npm/bootstrap-alert@1";
import TurndownService from "https://cdn.jsdelivr.net/npm/turndown@7/+esm";
import { openaiConfig } from "https://cdn.jsdelivr.net/npm/bootstrap-llm-provider@1";

const DEFAULT_BASE_URLS = ["https://openrouter.ai/api/v1", "https://llmfoundry.straive.com/openai/v1"];

const inputArea = document.getElementById("input-data");
const outputArea = document.getElementById("output-data");
const compareBtn = document.getElementById("compare-btn");
const progressSection = document.getElementById("progress-section");
const progressBar = document.getElementById("progress-bar");
const spinner = document.getElementById("spinner");
const resultsDiv = document.getElementById("results");
const openaiConfigBtn = document.getElementById("openai-config-btn");
const modalBody = document.getElementById("modal-body");
const modal = new bootstrap.Modal(document.getElementById("detail-modal"));

openaiConfigBtn.addEventListener("click", async () => {
  await openaiConfig({ defaultBaseUrls: DEFAULT_BASE_URLS, show: true });
});

const PROMPT = `# GOAL\n\nFor every original key in EXTRACT_JSON:\n- If both sources (Markdown and JSON) have the same semantic value \u2192 "correct".\n- If both sources (Markdown and JSON) have no value (null, empty, None or not mentioned) \u2192 "correct".\n- If both sources (Markdown and JSON) have different semantic values \u2192 "incorrect".\n- If one source has a value and the other does not (null, empty, None or not mentioned) \u2192 "incorrect".\n\n# DEFINITIONS\n"No value" = null, empty string, empty array/object, or None or NOT MENTIONED in WEBSITE_MD.\n"Same semantic value" = equal after normalizing case, whitespace, punctuation, trivial formatting; numbers equal within rounding; dates same after normalization (ISO-8601). Otherwise, treat as different.\n\n# THINK (silently)\n1. Parse EXTRACT_JSON. Flatten nested keys with dot-paths (e.g., "address.city").\n2. Search WEBSITE_MD for each key’s concept/value.\n3. Decide status per rules above.\n4. Build output exactly matching SCHEMA.\n\n# OUTPUT\nReturn **valid JSON** that conforms to SCHEMA. No extra text.\n\n<SCHEMA>\n"results": {\n"<dot_key>": {\n"status": "correct" | "incorrect",\n"json_value": any,\n"markdown_value": string | null\n}\n// ...one object per key from EXTRACT_JSON\n}\n</SCHEMA>\n\n# INPUTS\n<WEBSITE_MD>\n{{MARKDOWN}}\n</WEBSITE_MD>\n\n<EXTRACT_JSON>\n{{JSON}}\n</EXTRACT_JSON>`;

const parseTSV = (txt) => dsvFormat("\t").parse(txt.trim());

function baseline(row1, row2, keys) {
  const res = {};
  keys.forEach((k) => {
    res[k] = row1[k] === row2?.[k] ? "correct" : "incorrect";
  });
  return res;
}

function buildTable(rows, keys) {
  resultsDiv.innerHTML = "";
  const table = d3.select(resultsDiv).append("table").attr("class", "table table-bordered table-sm mt-4");
  const thead = table.append("thead").append("tr");
  thead.append("th").text("Row");
  keys.forEach((k) => thead.append("th").text(k));
  thead.append("th").text("% incorrect");
  const tbody = table.append("tbody");
  const totals = Array(keys.length).fill(0);
  rows.forEach((r, i) => {
    const tr = tbody.append("tr");
    tr.append("th").text(i + 1);
    let wrong = 0;
    keys.forEach((k, idx) => {
      const match = r.baseline[k] === r.llm[k]?.status;
      wrong += Number(!match);
      totals[idx] += Number(!match);
      tr.append("td")
        .attr("class", match ? "bg-success" : "bg-danger")
        .style("cursor", "pointer")
        .text(match ? "" : "")
        .on("click", () => {
          modalBody.textContent = JSON.stringify({ llm: r.llm[k], input: r.input[k], output: r.output[k] }, null, 2);
          modal.show();
        });
    });
    tr.append("td").text(((wrong / keys.length) * 100).toFixed(0) + "%");
  });
  const tfoot = table.append("tfoot").append("tr");
  tfoot.append("th").text("% incorrect");
  let totalWrong = 0;
  totals.forEach((v) => (totalWrong += v));
  keys.forEach((k, i) => {
    tfoot.append("td").text(((totals[i] / rows.length) * 100).toFixed(0) + "%");
  });
  tfoot.append("td").text(((totalWrong / (rows.length * keys.length)) * 100).toFixed(0) + "%");
}

compareBtn.addEventListener("click", async () => {
  const inputText = inputArea.value.trim();
  const outputText = outputArea.value.trim();
  if (!inputText || !outputText) return bootstrapAlert("Paste input and output", "warning");
  let inputRows, outputRows;
  try {
    inputRows = parseTSV(inputText);
    outputRows = parseTSV(outputText);
  } catch (err) {
    bootstrapAlert(err.message, "danger");
    return;
  }
  const headers = inputRows.columns;
  const from = headers.indexOf("Name");
  const to = headers.indexOf("Notes");
  if (from === -1) return bootstrapAlert("Name column missing", "danger");
  const keys = headers.slice(from, to === -1 ? headers.length : to);
  const { apiKey, baseUrl } = await openaiConfig({ defaultBaseUrls: DEFAULT_BASE_URLS, help: "" });
  if (!apiKey) return;
  const service = new TurndownService();
  progressSection.classList.remove("d-none");
  const results = [];
  for (let i = 0; i < inputRows.length; i++) {
    progressBar.style.width = `${(i / inputRows.length) * 100}%`;
    spinner.classList.remove("d-none");
    const row = inputRows[i];
    const out = outputRows[i] || {};
    const base = baseline(row, out, keys);
    const extract = {};
    keys.forEach((k) => (extract[k] = row[k]));
    try {
      const html = await fetch(`https://llmfoundry.straive.com/-/proxy/${row.FacultySource}`).then((r) => r.text());
      const markdown = service.turndown(html);
      const body = PROMPT.replace("{{MARKDOWN}}", markdown).replace("{{JSON}}", JSON.stringify(extract));
      const resp = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model: "gpt-4o", messages: [{ role: "user", content: body }] }),
      });
      const json = await resp.json();
      const content = json.choices?.[0]?.message?.content;
      const llm = content ? JSON.parse(content).results : {};
      results.push({ baseline: base, llm, input: row, output: out });
    } catch (err) {
      bootstrapAlert(err.message, "danger");
      spinner.classList.add("d-none");
      return;
    }
  }
  spinner.classList.add("d-none");
  progressBar.style.width = "100%";
  buildTable(results, keys);
});
