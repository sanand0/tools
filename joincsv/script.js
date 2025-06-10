import { csvFormat, tsvFormat, dsvFormat } from "https://cdn.jsdelivr.net/npm/d3-dsv@3/+esm";
import { downloadCsv, copyText } from "../common/csv.js";

const sepInput = document.getElementById("separator");
const tablesInput = document.getElementById("tables");
const joinBtn = document.getElementById("joinBtn");
const downloadBtn = document.getElementById("downloadBtn");
const copyBtn = document.getElementById("copyBtn");
const outputArea = document.getElementById("output");

let joined;

const getSep = () => (sepInput.value === "tab" ? "\t" : sepInput.value || ",");

const parseTables = (text, sep) => {
  const parser = dsvFormat(sep);
  return text
    .trim()
    .split(/\n\s*\n\s*/)
    .map((t) => parser.parseRows(t).map((r) => r.map((c) => c.trim())));
};

function joinTables(tables) {
  const key = tables[0][0][0];
  const headers = new Set([key]);
  const data = new Map();

  for (const rows of tables) {
    const [head, ...body] = rows;
    head.slice(1).forEach((h) => headers.add(h));
    for (const row of body) {
      const keyVal = row[0];
      if (!data.has(keyVal)) data.set(keyVal, { [key]: keyVal });
      const obj = data.get(keyVal);
      head.slice(1).forEach((h, i) => {
        obj[h] = row[i + 1] || "";
      });
    }
  }
  return { headers: [...headers], rows: [...data.values()] };
}

joinBtn.addEventListener("click", () => {
  const text = tablesInput.value.trim();
  if (!text) return;
  joined = joinTables(parseTables(text, getSep()));
  outputArea.value = csvFormat(joined.rows, joined.headers);
  downloadBtn.classList.remove("d-none");
  copyBtn.classList.remove("d-none");
});

downloadBtn.addEventListener("click", () => {
  if (joined) downloadCsv(csvFormat(joined.rows, joined.headers), "joined.csv");
});

copyBtn.addEventListener("click", () => {
  if (joined) copyText(tsvFormat(joined.rows, joined.headers));
});

// Default example
tablesInput.value = `Name,Age\nAlice,30\nBob,25\n\n\nName,Score\nAlice,85\nCharlie,92`;
