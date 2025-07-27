import { objectsToCsv, objectsToTsv, csvToTable, downloadCsv } from "../common/csv.js";
import { bootstrapAlert } from "https://cdn.jsdelivr.net/npm/bootstrap-alert@1";
import { marked } from "https://cdn.jsdelivr.net/npm/marked/+esm";
import saveform from "https://cdn.jsdelivr.net/npm/saveform@1.2";

const input = document.getElementById("markdownInput");
const extractBtn = document.getElementById("extractBtn");
const output = document.getElementById("output");
const downloadBtn = document.getElementById("downloadBtn");
const copyBtn = document.getElementById("copyBtn");
saveform("#md2csv-form");

let data = [];
let csv = "";

const plain = (tokens = []) => {
  return tokens
    .map((t) => {
      if (t.type === "link") return plain(t.tokens);
      if (t.type === "image") return "";
      if (t.type === "html" && t.text === "<br>") return "";
      return t.tokens ? plain(t.tokens) : t.text || "";
    })
    .join("");
};

function parseTable(md) {
  const table = marked.lexer(md).find((t) => t.type === "table");
  if (!table) throw new Error("No table found");
  const headers = table.header.map((c) => plain(c.tokens));
  return table.rows.map((row) => Object.fromEntries(headers.map((h, i) => [h, plain(row[i].tokens)])));
}

function showError(msg) {
  output.textContent = "";
  bootstrapAlert(msg, "danger");
  downloadBtn.classList.add("d-none");
  copyBtn.classList.add("d-none");
}

extractBtn.addEventListener("click", () => {
  try {
    let md = input.value.trim();
    // Remove SVGs before lexing
    md = md.replace(/<svg\b[\s\S]*?<\/svg>/g, "");
    data = parseTable(md);
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
  await navigator.clipboard.writeText(objectsToTsv(data));
  bootstrapAlert("Copied to clipboard");
});
