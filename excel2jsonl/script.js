import { dsvFormat } from "https://cdn.jsdelivr.net/npm/d3-dsv@3/+esm";
import { bootstrapAlert } from "https://cdn.jsdelivr.net/npm/bootstrap-alert@1";
import saveform from "https://cdn.jsdelivr.net/npm/saveform@1.2";
import { copyText } from "../common/clipboard-utils.js";
import { download } from "../common/download-helper.js";

const inputTextarea = document.getElementById("input");
const outputTextarea = document.getElementById("output");
const copyBtn = document.getElementById("copyBtn");
const downloadBtn = document.getElementById("downloadBtn");
saveform("#excel2jsonl-form");
function convertToJSONL(input) {
  const parsed = dsvFormat("\t").parse(input);
  return parsed.map((row) => JSON.stringify(row)).join("\n");
}

function updateDownloadButton() {
  downloadBtn.disabled = outputTextarea.value.trim() === "";
}

inputTextarea.addEventListener("input", () => {
  try {
    const jsonl = convertToJSONL(inputTextarea.value);
    outputTextarea.value = jsonl;
    bootstrapAlert("Conversion successful!", "success");
    updateDownloadButton();
  } catch (error) {
    outputTextarea.value = "";
    bootstrapAlert(error.message, "danger");
    updateDownloadButton();
  }
});

copyBtn.addEventListener("click", async () => {
  await copyText(outputTextarea.value);
  bootstrapAlert("Copied to clipboard!");
});

downloadBtn.addEventListener("click", () => {
  download(new Blob([outputTextarea.value], { type: "application/x-jsonlines" }), "data.jsonl");
  bootstrapAlert("File downloaded!", "success");
});

// Initial button state
updateDownloadButton();
