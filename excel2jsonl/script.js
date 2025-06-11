import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
import { updateLatestToast } from "../common/toast.js";
import saveform from "https://cdn.jsdelivr.net/npm/saveform@1.2";

const inputTextarea = document.getElementById("input");
const outputTextarea = document.getElementById("output");
const copyBtn = document.getElementById("copyBtn");
const downloadBtn = document.getElementById("downloadBtn");
saveform("#excel2jsonl-form");

function showToast(message, color = "bg-primary") {
  updateLatestToast({ body: message, color });
}

function convertToJSONL(input) {
  try {
    const parsed = d3.dsvFormat("\t").parse(input);
    const jsonl = parsed.map((row) => JSON.stringify(row)).join("\n");
    return jsonl;
  } catch (error) {
    throw new Error("Failed to parse input. Please ensure it's valid tab-delimited data.");
  }
}

function updateDownloadButton() {
  downloadBtn.disabled = outputTextarea.value.trim() === "";
}

inputTextarea.addEventListener("input", () => {
  try {
    const jsonl = convertToJSONL(inputTextarea.value);
    outputTextarea.value = jsonl;
    showToast("Conversion successful!", "bg-success");
    updateDownloadButton();
  } catch (error) {
    outputTextarea.value = "";
    showToast(error.message, "bg-danger");
    updateDownloadButton();
  }
});

copyBtn.addEventListener("click", () => {
  outputTextarea.select();
  document.execCommand("copy");
  showToast("Copied to clipboard!");
});

downloadBtn.addEventListener("click", () => {
  const blob = new Blob([outputTextarea.value], {
    type: "application/x-jsonlines",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "data.jsonl";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast("File downloaded!", "bg-success");
});

// Initial button state
updateDownloadButton();
