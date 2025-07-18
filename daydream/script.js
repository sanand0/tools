import { marked } from "https://cdn.jsdelivr.net/npm/marked/+esm";
import { updateLatestToast } from "../common/toast.js";
import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";

const view = document.getElementById("view");
let entries = [];
let index = 0;
let sortKey = "";
let sortAsc = true;

const md = (s) => marked.parse(s || "");
const snippet = (s) => s.replace(/\n/g, " ").slice(0, 60);

load();

async function load() {
  try {
    const txt = await fetch("daydream.jsonl").then((r) => r.text());
    entries = txt
      .trim()
      .split(/\n+/)
      .map((l) => JSON.parse(l));
    const n = parseInt(location.hash.slice(1)) - 1;
    if (entries[n]) return showEntry(n);
    showTable();
  } catch (e) {
    updateLatestToast({ title: "Load error", body: e.message, color: "bg-danger" });
  }
}

function showTable() {
  history.replaceState(null, "", location.pathname);
  const rows = entries
    .map(
      (e, i) => /* html */ `
      <tr data-i="${i}">
        <td>${i + 1}</td>
        <td class="w-25 text-truncate">${snippet(e.concept1)} | ${snippet(e.concept2)}</td>
        <td class="w-50 text-truncate">${snippet(e.idea)}</td>
        <td>${e.novel}</td>
        <td>${e.coherent}</td>
        <td>${e.feasible}</td>
        <td>${e.impactful}</td>
      </tr>`,
    )
    .join("");
  view.innerHTML = /* html */ `
    <table class="table table-hover table-striped text-nowrap">
      <thead>
        <tr>
          ${["#", "Concepts", "Idea", "Novel", "Coherent", "Feasible", "Impactful"]
            .map((h) => `<th data-k="${h.toLowerCase()}">${h}</th>`)
            .join("")}
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
  view.querySelectorAll("tbody tr").forEach((r) => r.addEventListener("click", () => showEntry(r.dataset.i)));
  view.querySelectorAll("th").forEach((h) => h.addEventListener("click", () => sort(h.dataset.k)));
}

function sort(k) {
  if (!k) return;
  sortAsc = sortKey === k ? !sortAsc : true;
  sortKey = k;
  entries.sort((a, b) => {
    const v1 = a[k];
    const v2 = b[k];
    return (v1 > v2 ? 1 : -1) * (sortAsc ? 1 : -1);
  });
  showTable();
}

function chart(e) {
  const data = ["novel", "coherent", "feasible", "impactful"].map((k) => ({ name: k, value: e[k] }));
  const w = 220,
    h = 120,
    y = d3
      .scaleLinear()
      .domain([0, 4])
      .range([h - 20, 0]);
  const svg = d3
    .create("svg")
    .attr("width", w)
    .attr("height", h)
    .selectAll("g")
    .data(data)
    .join("g")
    .attr("transform", (_, i) => `translate(${i * 55 + 10},0)`);
  svg
    .append("rect")
    .attr("x", 0)
    .attr("y", (d) => y(d.value))
    .attr("width", 40)
    .attr("height", (d) => h - 20 - y(d.value))
    .attr("fill", "#0d6efd");
  svg
    .append("text")
    .attr("x", 20)
    .attr("y", h - 5)
    .attr("text-anchor", "middle")
    .text((d) => d.name);
  svg
    .append("text")
    .attr("x", 20)
    .attr("y", (d) => y(d.value) - 5)
    .attr("text-anchor", "middle")
    .text((d) => d.value);
  return svg.node();
}

function showEntry(i) {
  index = +i;
  const e = entries[index];
  location.hash = `#${index + 1}`;
  view.innerHTML = /* html */ `
    <div class="mb-3">${md(e.concept1)}${md(e.concept2)}</div>
    <div class="card mb-3"><div class="card-body">${md(e.idea)}</div></div>
    <div id="chart" class="mb-3"></div>
    <ul>
      <li><b>Novel:</b> ${e.novel} – ${e.novel_why}</li>
      <li><b>Coherent:</b> ${e.coherent} – ${e.coherent_why}</li>
      <li><b>Feasible:</b> ${e.feasible} – ${e.feasible_why}</li>
      <li><b>Impactful:</b> ${e.impactful} – ${e.impactful_why}</li>
    </ul>
    <div class="d-flex justify-content-between">
      <button class="btn btn-outline-primary" id="prev">Previous</button>
      <button class="btn btn-outline-primary" id="next">Next</button>
      <button class="btn btn-secondary" id="back">Back</button>
    </div>`;
  document.getElementById("chart").appendChild(chart(e));
  document.getElementById("prev").onclick = () => showEntry((index - 1 + entries.length) % entries.length);
  document.getElementById("next").onclick = () => showEntry((index + 1) % entries.length);
  document.getElementById("back").onclick = showTable;
}
