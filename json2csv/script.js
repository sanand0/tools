import { objectsToCsv, objectsToTsv, csvToTable, downloadCsv, copyText } from "../common/csv.js";
import { updateLatestToast } from "../common/toast.js";

const $jsonInput = document.getElementById("jsonInput");
const $convertBtn = document.getElementById("convertBtn");
const $output = document.getElementById("output");
const $downloadBtn = document.getElementById("downloadBtn");
const $copyBtn = document.getElementById("copyBtn");

// Initialize with sample data
$jsonInput.value = JSON.stringify([
  { name: "Bond, James", age: 30, place: { city: "New York\nUSA" } },
  { name: "Alice", age: 25, place: { country: "Canada", city: "Ottawa" } },
]);

const parseJsonInput = (input) => {
  try {
    const parsed = JSON.parse(input);
    if (Array.isArray(parsed)) {
      return parsed;
    } else if (typeof parsed === "object" && parsed !== null) {
      // It's a single object, wrap it in an array
      return [parsed];
    }
  } catch (e) {
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
  } catch (e) {
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

function showToast(message, color = "bg-primary") {
  updateLatestToast({ body: message, color });
}

$convertBtn.addEventListener("click", () => {
  try {
    const jsonStringInput = $jsonInput.value.trim();
    if (!jsonStringInput) throw new Error("Please enter some JSON data.");

    const csv = jsonToCsv(jsonStringInput);
    displayCsvTable(csv);
    $downloadBtn.classList.remove("d-none");
    $copyBtn.classList.remove("d-none");
  } catch (error) {
    $output.innerHTML = `<div class="alert alert-danger"><i class="bi bi-exclamation-triangle"></i> Error: ${error.message}</div>`;
    $downloadBtn.classList.add("d-none");
    $copyBtn.classList.add("d-none");
  }
});

$downloadBtn.addEventListener("click", () => downloadCsv(jsonToCsv($jsonInput.value.trim())));
$copyBtn.addEventListener("click", async () => {
  await copyText(jsonToCsv($jsonInput.value.trim(), true));
  showToast("Copied to clipboard!");
});
