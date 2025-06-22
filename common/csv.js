import { csvFormat, csvParse, tsvFormat } from "https://cdn.jsdelivr.net/npm/d3-dsv@3/+esm";

function flattenObject(obj, prefix = "") {
  return Object.entries(obj).reduce((acc, [key, value]) => {
    const newKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) Object.assign(acc, flattenObject(value, newKey));
    else acc[newKey] = value;
    return acc;
  }, {});
}

function objectsToCsv(data, format = csvFormat) {
  const headers = [];
  const rows = data.map((item) => {
    const flat = flattenObject(item);
    Object.keys(flat).forEach((k) => {
      if (!headers.includes(k)) headers.push(k);
    });
    return flat;
  });
  return format(rows, headers);
}

const objectsToTsv = (data) => objectsToCsv(data, tsvFormat);

function csvToTable(element, csv, columns, rowClassFn) {
  const parsed = csvParse(csv);
  const headers = columns && columns.length ? columns : parsed.columns;
  element.innerHTML = /* html */ `
    <table class="table table-striped table-bordered">
      <thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead>
      <tbody>${parsed
        .map((row) => {
          const cls = rowClassFn ? rowClassFn(row) : "";
          return `<tr${cls ? ` class="${cls}"` : ""}>${headers.map((h) => `<td>${row[h] || ""}</td>`).join("")}</tr>`;
        })
        .join("")}</tbody>
    </table>`;
}

function downloadCsv(csv, filename = "data.csv") {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  if (navigator.msSaveBlob) return navigator.msSaveBlob(blob, filename);
  const url = URL.createObjectURL(blob);
  Object.assign(document.createElement("a"), { href: url, download: filename }).click();
  URL.revokeObjectURL(url);
}

export { flattenObject, objectsToCsv, objectsToTsv, csvToTable, downloadCsv };
