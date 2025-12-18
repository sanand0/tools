import { dsvFormat } from "https://cdn.jsdelivr.net/npm/d3-dsv@3/+esm";
import { bootstrapAlert } from "https://cdn.jsdelivr.net/npm/bootstrap-alert@1";
import saveform from "https://cdn.jsdelivr.net/npm/saveform@1.2";
import { copyText } from "../common/clipboard-utils.js";
import { downloadBlob } from "../common/download.js";
import { loadConfigJson, readParam } from "../common/demo.js";

const input = document.getElementById("input");
const output = document.getElementById("output");
const copyBtn = document.getElementById("copy-btn");
const downloadBtn = document.getElementById("download-btn");
const formatSelect = document.getElementById("format-select");
const sampleContainer = document.getElementById("sampleContainer");
saveform("#excelconvert-form");
let config;

const converters = {
  jsonl: (rows) => rows.map((r) => JSON.stringify(r)).join("\n"),
  yaml: (rows) =>
    rows
      .map(
        (r) =>
          "- " +
          Object.entries(r)
            .map(([k, v], i) => (i ? `\n  ${k}: ${v}` : `${k}: ${v}`))
            .join(""),
      )
      .join("\n"),
  xml: (rows) =>
    `<rows>\n${rows
      .map(
        (r) =>
          `  <row>\n${Object.entries(r)
            .map(([k, v]) => `    <${k}>${v}</${k}>`)
            .join("\n")}\n  </row>`,
      )
      .join("\n")}\n</rows>`,
  toml: (rows) =>
    rows
      .map(
        (r) =>
          `[[rows]]\n${Object.entries(r)
            .map(([k, v]) => `${k} = "${v}"`)
            .join("\n")}`,
      )
      .join("\n\n"),
};

function updateDownloadButton() {
  downloadBtn.disabled = output.value.trim() === "";
}

function convert() {
  const text = input.value.trim();
  if (!text) {
    output.value = "";
    updateDownloadButton();
    return;
  }
  try {
    const rows = dsvFormat("\t").parse(text);
    output.value = converters[formatSelect.value](rows);
  } catch (error) {
    output.value = "";
    bootstrapAlert(error.message, "danger");
  }
  updateDownloadButton();
}

input.addEventListener("input", convert);
formatSelect.addEventListener("change", convert);

copyBtn.addEventListener("click", async () => {
  await copyText(output.value);
  bootstrapAlert("Copied to clipboard!");
});

downloadBtn.addEventListener("click", () => {
  const ext = { jsonl: "jsonl", yaml: "yaml", xml: "xml", toml: "toml" }[formatSelect.value];
  downloadBlob(new Blob([output.value], { type: "text/plain" }), `data.${ext}`);
});

updateDownloadButton();

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
  input.value = await response.text();
  if (preset.format && converters[preset.format]) formatSelect.value = preset.format;
  convert();
}

async function init() {
  try {
    config = await loadConfigJson("config.json");
    renderSamples(config.presets);
    const requestedFormat = readParam("format", { fallback: "" });
    if (requestedFormat && converters[requestedFormat]) formatSelect.value = requestedFormat;
    const presetId = readParam("tsv", { fallback: "" });
    if (presetId) {
      await loadPreset(presetId);
      return;
    }
  } catch (error) {
    bootstrapAlert(`Config error: ${error.message}`, "danger");
  } finally {
    updateDownloadButton();
  }
}

void init();
