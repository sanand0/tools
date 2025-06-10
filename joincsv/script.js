import { csvFormat, tsvFormat, dsvFormat } from "https://cdn.jsdelivr.net/npm/d3-dsv@3/+esm";
import { downloadCsv, copyText } from "../common/csv.js";

const separatorInput = document.getElementById("separator");
const tablesInput = document.getElementById("tables");
const joinBtn = document.getElementById("joinBtn");
const downloadBtn = document.getElementById("downloadBtn");
const copyBtn = document.getElementById("copyBtn");
const outputArea = document.getElementById("output");

let joined = null;

const getSep = () => (separatorInput.value === "tab" ? "\t" : separatorInput.value || ",");

function parseTables(text, sep) {
  const chunks = text.trim().split(/\n\s*\n\s*/);
  const parser = dsvFormat(sep);
  return chunks.map((t) => parser.parseRows(t).map((r) => r.map((c) => c.trim())));
}

function joinTables(tables) {
  const headers = new Set();
  const data = new Map();
  const keyHeader = tables[0][0][0];

  tables.forEach((rows, idx) => {
    const header = rows[0];
    for (let c = 1; c < header.length; c++) {
      let col = header[c];
      if (headers.has(col)) col = `${col}_${idx + 1}`;
      headers.add(col);
      header[c] = col;
    }
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      const key = row[0];
      if (!data.has(key)) data.set(key, { [keyHeader]: key });
      const obj = data.get(key);
      for (let c = 1; c < header.length; c++) obj[header[c]] = row[c] || "";
    }
  });

  const cols = [keyHeader, ...headers];
  return { rows: Array.from(data.values()), headers: cols };
}

joinBtn.addEventListener("click", () => {
  const text = tablesInput.value.trim();
  if (!text) return;
  const sep = getSep();
  const tables = parseTables(text, sep);
  joined = joinTables(tables);
  outputArea.value = csvFormat(joined.rows, joined.headers);
  downloadBtn.classList.remove("d-none");
  copyBtn.classList.remove("d-none");
});

downloadBtn.addEventListener("click", () => {
  if (joined) downloadCsv(csvFormat(joined.rows, joined.headers), "joined.csv");
});

copyBtn.addEventListener("click", async () => {
  if (joined) await copyText(tsvFormat(joined.rows, joined.headers));
});

// Default example
tablesInput.value = `Name,Age\nAlice,30\nBob,25\n\n\nName,Score\nAlice,85\nCharlie,92`;
