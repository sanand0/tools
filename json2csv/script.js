import { objectsToCsv, objectsToTsv, csvToTable, downloadCsv } from "../common/csv.js";
import { bootstrapAlert } from "https://cdn.jsdelivr.net/npm/bootstrap-alert@1";
import saveform from "https://cdn.jsdelivr.net/npm/saveform@1.2";
import { loadConfigJson, readParam } from "../common/demo.js";

const $jsonInput = document.getElementById("jsonInput");
const $convertBtn = document.getElementById("convertBtn");
const $output = document.getElementById("output");
const $downloadBtn = document.getElementById("downloadBtn");
const $copyBtn = document.getElementById("copyBtn");
const sampleContainer = document.getElementById("sampleContainer");
saveform("#json2csv-form");
let config;

const parseJsonInput = (input) => {
  try {
    const parsed = JSON.parse(input);
    if (Array.isArray(parsed)) {
      return parsed;
    } else if (typeof parsed === "object" && parsed !== null) {
      // It's a single object, wrap it in an array
      return [parsed];
    }
  } catch {
    // Initial parse failed, or it was a primitive/null which we don't want as a single object.
    // We'll fall through to the error if it's not a valid single object either.
  }
  // If the first try didn't return an array, try parsing as a single object again (or for the first time if initial parse failed)
  // This path is mostly for the case where JSON.parse(input) results in a non-array (e.g. a single object)
  try {
    const parsedObject = JSON.parse(input);
    if (typeof parsedObject === "object" && parsedObject !== null && !Array.isArray(parsedObject)) {
      return [parsedObject];
    }
  } catch {
    // This catch is for when the input is truly not JSON or not the object/array structure we expect
    throw new Error("Invalid JSON input. Expected an array or an object.");
  }
  // If it parsed but wasn't an array or a standalone object that we could wrap
  throw new Error("Invalid JSON input. Expected an array or an object.");
};

const jsonToCsv = (jsonStringInput, toTsv = false) => {
  const dataArray = parseJsonInput(jsonStringInput);
  return toTsv ? objectsToTsv(dataArray) : objectsToCsv(dataArray);
};

const displayCsvTable = (csv) => csvToTable($output, csv);

function runConvert() {
  try {
    const jsonStringInput = $jsonInput.value.trim();
    if (!jsonStringInput) throw new Error("Please enter some JSON data.");

    const csv = jsonToCsv(jsonStringInput);
    displayCsvTable(csv);
    $downloadBtn.classList.remove("d-none");
    $copyBtn.classList.remove("d-none");
  } catch (error) {
    $output.textContent = "";
    bootstrapAlert(`Error: ${error.message}`, "danger");
    $downloadBtn.classList.add("d-none");
    $copyBtn.classList.add("d-none");
  }
}

$convertBtn.addEventListener("click", runConvert);

$downloadBtn.addEventListener("click", () => downloadCsv(jsonToCsv($jsonInput.value.trim())));
$copyBtn.addEventListener("click", async () => {
  await navigator.clipboard.writeText(jsonToCsv($jsonInput.value.trim(), true));
  bootstrapAlert("Copied to clipboard!");
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
      button.addEventListener("click", () => applyPreset(preset.id, { convert: true }));
      return button;
    }),
  );
}

function applyPreset(id, { convert = false } = {}) {
  const preset = config?.presets?.find((item) => item.id === id);
  if (!preset) return;
  $jsonInput.value = JSON.stringify(preset.value, null, 2);
  $downloadBtn.classList.add("d-none");
  $copyBtn.classList.add("d-none");
  $output.replaceChildren();
  if (convert) runConvert();
}

async function init() {
  try {
    config = await loadConfigJson("config.json");
    renderSamples(config.presets);
    const presetId = readParam("json", { fallback: "" });
    if (presetId) {
      applyPreset(presetId, { convert: true });
      return;
    }
    if (!$jsonInput.value.trim() && config?.presets?.length) applyPreset(config.presets[0].id);
  } catch (error) {
    bootstrapAlert(`Config error: ${error.message}`, "danger");
  }
}

void init();
