import { marked } from "https://cdn.jsdelivr.net/npm/marked/+esm";
import { default as fuzzysort } from "https://cdn.jsdelivr.net/npm/fuzzysort@3.1.0/+esm";
import { updateLatestToast } from "../common/toast.js";
import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";

const view = document.getElementById("view");
const wrap = document.getElementById("wrap");
let entries = [];
let index = 0;
let sortKey = "";
let sortAsc = true;
let searchTerm = "";

const fmt = (ts) =>
  new Date(ts).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

const md = (s) => marked.parse(s || "");
const filterEntries = () => {
  if (!searchTerm) return entries;
  return fuzzysort.go(searchTerm, entries, { keys: ["goal", "idea", "concepts"] }).map((r) => r.obj);
};

load();
document.getElementById("home").onclick = showTable;
window.addEventListener("popstate", () => {
  const ts = decodeURIComponent(location.hash.slice(1));
  const n = entries.findIndex((e) => e.timestamp === ts);
  if (n > -1) showEntry(n, false);
  else showTable(false);
});

async function load() {
  try {
    const txt = await fetch("https://raw.githubusercontent.com/sanand0/til/refs/heads/live/daydream.jsonl").then((r) =>
      r.text()
    );
    entries = txt
      .trim()
      .split(/\n+/)
      .map((l, i) => {
        const e = JSON.parse(l);
        return { id: i + 1, overall: e.novel + e.coherent + e.feasible + e.impactful, ...e };
      });
    const hash = decodeURIComponent(location.hash.slice(1));
    const n = entries.findIndex((e) => e.timestamp === hash);
    if (n > -1) return showEntry(n);
    showTable();
  } catch (e) {
    updateLatestToast({ title: "Load error", body: e.message, color: "bg-danger" });
  }
}

function sortIcon(k) {
  if (sortKey !== k) return "";
  return `<i class="bi bi-caret-${sortAsc ? "up" : "down"}-fill ms-1"></i>`;
}

function showTable(push = true) {
  if (push && location.hash) history.pushState(null, "", location.pathname);
  wrap.className = "container-fluid py-4";
  const list = filterEntries().slice();
  if (sortKey) list.sort((a, b) => (a[sortKey] > b[sortKey] ? 1 : -1) * (sortAsc ? 1 : -1));
  const rows = list
    .map(
      (e) => /* html */ `
      <tr data-i="${e.id - 1}" class="align-top">
        <td class="text-end">${fmt(e.timestamp)}</td>
        <td class="fw-bold">${e.goal}</td>
        <td>${e.concepts
          .map((c) => `<div style="max-width:40rem;max-height:7.5rem;overflow:hidden">${md(c)}</div>`)
          .join("")}</td>
        <td><div style="max-height:12rem;overflow:hidden">${md(e.idea)}</div></td>
        ${["novel", "coherent", "feasible", "impactful", "overall"]
          .map(
            (k) => `<td class="text-end" data-bs-toggle="tooltip" data-bs-title="${e[k + "_why"] || "OK"}">${e[k]}</td>`
          )
          .join("")}
      </tr>`
    )
    .join("");
  view.innerHTML = /* html */ `
    <div class="mb-3"><input id="search" class="form-control" placeholder="Search" value="${searchTerm}"/></div>
    <div class="table-responsive">
      <table class="table table-hover table-striped">
        <thead>
          <tr>
            <th>#</th>
            <th data-k="goal" style="cursor:pointer">Goal${sortIcon("goal")}</th>
            <th>Concepts</th>
            <th data-k="idea" style="cursor:pointer">Idea${sortIcon("idea")}</th>
            ${["novel", "coherent", "feasible", "impactful", "overall"]
              .map(
                (k) =>
                  `<th data-k="${k}" class="text-end" style="cursor:pointer">${
                    k.charAt(0).toUpperCase() + k.slice(1)
                  }${sortIcon(k)}</th>`
              )
              .join("")}
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
  const q = document.getElementById("search");
  q.oninput = () => {
    searchTerm = q.value.trim();
    showTable();
  };
  view.querySelectorAll("tbody tr").forEach((r) => r.addEventListener("click", () => showEntry(r.dataset.i)));
  view.querySelectorAll("th[data-k]").forEach((h) => h.addEventListener("click", () => sort(h.dataset.k)));
  initTooltips();
}

function sort(k) {
  if (!k) return;
  sortAsc = sortKey === k ? !sortAsc : true;
  sortKey = k;
  showTable();
}

function initTooltips() {
  view.querySelectorAll('[data-bs-toggle="tooltip"]').forEach((el) => new bootstrap.Tooltip(el));
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

function showEntry(i, push = true) {
  index = +i;
  const e = entries[index];
  if (push) location.hash = `#${encodeURIComponent(e.timestamp)}`;
  wrap.className = "container py-4";
  view.innerHTML = /* html */ `
    <h2 class="mb-3">${e.goal}</h2>
    <h3>Concepts</h3>
    <div class="mb-3">${e.concepts.map((c) => md(c)).join("")}</div>
    <h3>Idea</h3>
    <div class="card mb-3"><div class="card-body">${md(e.idea)}</div></div>
    <div id="chart" class="mb-3"></div>
    <ul>
      <li><b>Novel:</b> ${e.novel} – ${e.novel_why}</li>
      <li><b>Coherent:</b> ${e.coherent} – ${e.coherent_why}</li>
      <li><b>Feasible:</b> ${e.feasible} – ${e.feasible_why}</li>
      <li><b>Impactful:</b> ${e.impactful} – ${e.impactful_why}</li>
    </ul>
    <div class="d-flex justify-content-between">
      <button class="btn btn-outline-primary" id="prev"><i class="bi bi-arrow-left"></i> Previous</button>
      <button class="btn btn-secondary" id="list"><i class="bi bi-list"></i> List</button>
      <button class="btn btn-outline-primary" id="next">Next <i class="bi bi-arrow-right"></i></button>
    </div>`;
  document.getElementById("chart").appendChild(chart(e));
  document.getElementById("prev").onclick = () => showEntry((index - 1 + entries.length) % entries.length);
  document.getElementById("next").onclick = () => showEntry((index + 1) % entries.length);
  document.getElementById("list").onclick = showTable;
}
