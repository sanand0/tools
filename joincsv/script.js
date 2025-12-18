import { csvFormat, tsvFormat, dsvFormat } from "https://cdn.jsdelivr.net/npm/d3-dsv@3/+esm";
import { downloadCsv } from "../common/csv.js";
import saveform from "https://cdn.jsdelivr.net/npm/saveform@1.2";
import { copyText } from "../common/clipboard-utils.js";
import { bootstrapAlert } from "https://cdn.jsdelivr.net/npm/bootstrap-alert@1";
import { loadConfigJson, readParam } from "../common/demo.js";

const sepInput = document.getElementById("separator");
const tablesInput = document.getElementById("tables");
const joinBtn = document.getElementById("joinBtn");
const downloadBtn = document.getElementById("downloadBtn");
const copyBtn = document.getElementById("copyBtn");
const outputArea = document.getElementById("output");
const alertContainer = document.getElementById("alertContainer");
const sampleContainer = document.getElementById("sampleContainer");
saveform("#joincsv-form");
let joined;
let config;

const alert = (options) =>
  bootstrapAlert({
    container: alertContainer ?? undefined,
    replace: true,
    ...options,
  });

const getSep = () => (sepInput.value === "tab" ? "\t" : sepInput.value || ",");

const parseTables = (text, sep) => {
  const parser = dsvFormat(sep);
  const chunks = text
    .trim()
    .split(/\n\s*\n\s*/)
    .filter(Boolean);
  if (chunks.length < 2) throw new Error("Paste at least two tables separated by two blank lines.");
  return chunks.map((chunk) => parser.parseRows(chunk).map((row) => row.map((cell) => cell.trim())));
};

function joinTables(tables) {
  if (!tables.length || !tables[0]?.length) throw new Error("No tables found.");
  const key = tables[0][0][0];
  if (!key) throw new Error("First column header is missing.");
  const headers = new Set([key]);
  const data = new Map();

  for (const rows of tables) {
    const [head, ...body] = rows;
    if (!head?.length) continue;
    head.slice(1).forEach((h) => headers.add(h));
    for (const row of body) {
      const keyVal = row[0];
      if (!keyVal) continue;
      if (!data.has(keyVal)) data.set(keyVal, { [key]: keyVal });
      const obj = data.get(keyVal);
      head.slice(1).forEach((h, i) => {
        obj[h] = row[i + 1] || "";
      });
    }
  }
  if (!data.size) throw new Error("No joined rows found. Check that the first column has matching keys.");
  return { headers: [...headers], rows: [...data.values()] };
}

function runJoin() {
  try {
    const text = tablesInput.value.trim();
    if (!text) throw new Error("Paste tables to join.");
    joined = joinTables(parseTables(text, getSep()));
    outputArea.value = csvFormat(joined.rows, joined.headers);
    downloadBtn.classList.remove("d-none");
    copyBtn.classList.remove("d-none");
    alertContainer?.replaceChildren();
  } catch (error) {
    outputArea.value = "";
    downloadBtn.classList.add("d-none");
    copyBtn.classList.add("d-none");
    alert({ title: "Join failed", body: error.message, color: "danger" });
  }
}

joinBtn.addEventListener("click", runJoin);

downloadBtn.addEventListener("click", () => {
  if (joined) downloadCsv(csvFormat(joined.rows, joined.headers), "joined.csv");
});

copyBtn.addEventListener("click", async () => {
  if (joined) await copyText(tsvFormat(joined.rows, joined.headers));
});

function renderSamples(presets) {
  if (!sampleContainer) return;
  if (!Array.isArray(presets) || !presets.length) {
    sampleContainer.replaceChildren();
    return;
  }
  const label = document.createElement("span");
  label.className = "text-secondary small fw-semibold me-1";
  label.textContent = "Examples";
  sampleContainer.replaceChildren(
    label,
    ...presets.map((preset) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "btn btn-sm btn-outline-secondary";
      button.textContent = preset.name || preset.id;
      button.addEventListener("click", () => void loadPreset(preset.id));
      return button;
    }),
  );
}

async function loadPreset(id) {
  const preset = config?.presets?.find((item) => item.id === id);
  if (!preset?.path) return;
  const response = await fetch(preset.path);
  if (!response.ok) throw new Error(`Failed to load ${preset.path}: HTTP ${response.status}`);
  tablesInput.value = await response.text();
  sepInput.value = preset.separator || sepInput.value || ",";
  outputArea.value = "";
  downloadBtn.classList.add("d-none");
  copyBtn.classList.add("d-none");
  alertContainer?.replaceChildren();
}

async function init() {
  try {
    config = await loadConfigJson("config.json");
    renderSamples(config.presets);
    const presetId = readParam("tables", { fallback: "" });
    if (presetId) await loadPreset(presetId);
    const sep = readParam("sep", { fallback: "" });
    if (sep) sepInput.value = sep;
  } catch (error) {
    alert({ title: "Config error", body: error.message, color: "danger" });
  }
}

void init();
