import { objectsToCsv, objectsToTsv, csvToTable, downloadCsv, copyText } from "../common/csv.js";
import { marked } from "https://cdn.jsdelivr.net/npm/marked/+esm";

const input = document.getElementById("markdownInput");
const extractBtn = document.getElementById("extractBtn");
const output = document.getElementById("output");
const downloadBtn = document.getElementById("downloadBtn");
const copyBtn = document.getElementById("copyBtn");
const toast = new bootstrap.Toast(document.getElementById("toast"));

let data = [];
let csv = "";

const plain = (tokens = []) =>
  tokens
    .map((t) => {
      if (t.type === "link") return plain(t.tokens);
      if (t.type === "image") return "";
      return t.tokens ? plain(t.tokens) : t.text || "";
    })
    .join("");

function parseTable(md) {
  const table = marked.lexer(md).find((t) => t.type === "table");
  if (!table) throw new Error("No table found");
  const headers = table.header.map((c) => plain(c.tokens));
  return table.rows.map((row) => Object.fromEntries(headers.map((h, i) => [h, plain(row[i].tokens)])));
}

function showToast(msg) {
  document.querySelector("#toast .toast-body").textContent = msg;
  toast.show();
}

function showError(msg) {
  output.innerHTML = `<div class="alert alert-danger"><i class="bi bi-exclamation-triangle me-2"></i>${msg}</div>`;
  downloadBtn.classList.add("d-none");
  copyBtn.classList.add("d-none");
}

extractBtn.addEventListener("click", () => {
  try {
    data = parseTable(input.value.trim());
    csv = objectsToCsv(data);
    csvToTable(output, csv);
    downloadBtn.classList.remove("d-none");
    copyBtn.classList.remove("d-none");
  } catch (e) {
    showError(e.message);
  }
});

downloadBtn.addEventListener("click", () => downloadCsv(csv));
copyBtn.addEventListener("click", async () => {
  await copyText(objectsToTsv(data));
  showToast("Copied to clipboard");
});
