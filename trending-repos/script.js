// @ts-check
import { html, render } from "https://cdn.jsdelivr.net/npm/lit-html@3/+esm";
import { tsvParseRows } from "https://cdn.jsdelivr.net/npm/d3-dsv@3/+esm";
import { bootstrapAlert } from "https://cdn.jsdelivr.net/npm/bootstrap-alert@1";

const $ = (s, el = document) => el.querySelector(s);

const DATA_URL = "https://raw.githubusercontent.com/sanand0/til/refs/heads/live/trending-repos.tsv";
const STATUS_ORDER = ["🟣", "🟢", "⏺️", "🔴", "🔵"];
const STATUS_LABELS = {
  "🟣": "Evaluate",
  "🟢": "Used",
  "⏺️": "Interesting",
  "🔴": "Unused",
  "🔵": "Deferred",
};

const state = {
  rows: /** @type {TrendingRepo[]} */ ([]),
  loading: true,
  error: "",
  sort: /** @type {{ key: SortKey; direction: SortDirection }} */ ({ key: "stars", direction: "desc" }),
  filters: {
    status: new Set(/** @type {string[]} */ ([])),
    language: new Set(/** @type {string[]} */ ([])),
  },
};

/**
 * @typedef {"status" | "language" | "repo" | "currentStars" | "stars" | "date"} SortKey
 * @typedef {"asc" | "desc"} SortDirection
 * @typedef {{
 *   status: string;
 *   language: string;
 *   stars: number;
 *   currentStars: number;
 *   date: Date;
 *   repo: string;
 *   description: string;
 *   notes: string;
 *   url: string;
 * }} TrendingRepo
 */

const app = $("#app");
if (!app) throw new Error("App container missing");

initFiltersFromQuery();
renderApp();
loadData();

function initFiltersFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const statuses = params.getAll("status");
  const languages = params.getAll("lang");
  if (statuses.length) state.filters.status = new Set(statuses);
  if (languages.length) state.filters.language = new Set(languages);
}

async function loadData() {
  try {
    const response = await fetch(DATA_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    const rows = parseTsv(text);
    state.rows = rows;
    state.loading = false;
    renderApp();
  } catch (error) {
    state.loading = false;
    state.error = error instanceof Error ? error.message : "Unknown error";
    bootstrapAlert({
      title: "Failed to fetch",
      body: `${state.error}. Try again in a bit.`,
      color: "danger",
    });
    renderApp();
  }
}

/**
 * @param {string} text
 */
function parseTsv(text) {
  const rows = tsvParseRows(text, (cells) => {
    if (!cells?.length) return null;
    const [
      status = "",
      language = "",
      stars = "0",
      currentStars = "0",
      date = "",
      repo = "",
      description = "",
      notes = "",
    ] = cells;
    if (!repo) return null;
    const cleanStatus = status.trim();
    const cleanLanguage = language.trim();
    const totalStars = Number.parseInt(stars.replace(/\s+/g, ""), 10) || 0;
    const weeklyStars = Number.parseInt(currentStars.replace(/\s+/g, ""), 10) || 0;
    const dateString = date.trim();
    return {
      status: cleanStatus,
      language: cleanLanguage,
      stars: totalStars,
      currentStars: weeklyStars,
      date: dateString ? new Date(`${dateString}T00:00:00Z`) : new Date(0),
      repo: repo.trim(),
      description: description.trim(),
      notes: notes.trim(),
      url: `https://github.com/${repo.trim()}`,
    };
  });
  return rows.filter(Boolean);
}

/**
 * @param {TrendingRepo[]} items
 */
function applyFilters(items) {
  const { status, language } = state.filters;
  if (!status.size && !language.size) return items;
  return items.filter((item) => {
    if (status.size && !status.has(item.status)) return false;
    if (language.size && !language.has(item.language)) return false;
    return true;
  });
}

/**
 * @template {keyof TrendingRepo} Key
 * @param {TrendingRepo[]} items
 * @param {Key} key
 * @param {Set<TrendingRepo[Key]>} selected
 */
function filterByKey(items, key, selected) {
  if (!selected.size) return items;
  return items.filter((item) => selected.has(item[key]));
}

/**
 * @param {TrendingRepo[]} items
 */
function sortRows(items) {
  const { key, direction } = state.sort;
  const modifier = direction === "asc" ? 1 : -1;
  return [...items].sort((a, b) => {
    if (key === "status") {
      return (STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status)) * modifier;
    }
    if (key === "currentStars" || key === "stars") {
      return (a[key] - b[key]) * modifier;
    }
    if (key === "date") {
      return (a.date.getTime() - b.date.getTime()) * modifier;
    }
    const valueA = (a[key] ?? "").toString().toLowerCase();
    const valueB = (b[key] ?? "").toString().toLowerCase();
    return valueA.localeCompare(valueB) * modifier;
  });
}

function formatDateLabel(date) {
  if (!date || Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function updateQueryParams() {
  const params = new URLSearchParams();
  state.filters.status.forEach((status) => params.append("status", status));
  state.filters.language.forEach((lang) => params.append("lang", lang));
  const qs = params.toString();
  const nextUrl = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
  window.history.replaceState({}, "", nextUrl);
}

function toggleStatusFilter(statusKey) {
  if (state.filters.status.has(statusKey)) state.filters.status.delete(statusKey);
  else state.filters.status.add(statusKey);
  updateQueryParams();
  renderApp();
}

function toggleLanguageFilter(languageKey) {
  if (state.filters.language.has(languageKey)) state.filters.language.delete(languageKey);
  else state.filters.language.add(languageKey);
  updateQueryParams();
  renderApp();
}

/**
 * @param {SortKey} key
 */
function changeSort(key) {
  if (state.sort.key === key) {
    state.sort.direction = state.sort.direction === "asc" ? "desc" : "asc";
  } else {
    state.sort.key = key;
    state.sort.direction = key === "repo" || key === "language" ? "asc" : "desc";
  }
  renderApp();
}

function renderApp() {
  if (state.loading) {
    render(
      html`<section class="py-5 d-flex flex-column align-items-center justify-content-center text-secondary">
        <div class="spinner-border text-primary mb-3" role="status" aria-hidden="true"></div>
        <p class="mb-0">Fetching the latest weekly trending repositories…</p>
      </section>`,
      app,
    );
    return;
  }

  if (state.error) {
    render(
      html`<section class="py-5 text-center">
        <p class="text-danger fw-semibold">${state.error}</p>
        <button
          class="btn btn-outline-primary"
          @click=${() => {
            state.loading = true;
            state.error = "";
            renderApp();
            loadData();
          }}
        >
          Retry
        </button>
      </section>`,
      app,
    );
    return;
  }

  const filtered = applyFilters(state.rows);
  const sorted = sortRows(filtered);

  const statusScopedRows = filterByKey(state.rows, "language", state.filters.language);
  const statusCounts = new Map();
  statusScopedRows.forEach((row) => {
    statusCounts.set(row.status, (statusCounts.get(row.status) ?? 0) + 1);
  });
  const statusTallies = STATUS_ORDER.map((code) => ({
    code,
    label: STATUS_LABELS[code],
    count: statusCounts.get(code) ?? 0,
  }));

  const allLanguages = [...new Set(state.rows.map((row) => row.language))];
  allLanguages.sort((a, b) => a.localeCompare(b || "", undefined, { sensitivity: "base" }));
  const languageScopedRows = filterByKey(state.rows, "status", state.filters.status);
  const languageCounts = new Map();
  languageScopedRows.forEach((row) => {
    languageCounts.set(row.language, (languageCounts.get(row.language) ?? 0) + 1);
  });
  const languageTallies = allLanguages
    .map((language) => ({
      key: language,
      label: language || "—",
      count: languageCounts.get(language) ?? 0,
    }))
    .sort((a, b) => (b.count === a.count ? a.label.localeCompare(b.label) : b.count - a.count));

  const columns = [
    { key: "status", label: "Status", className: "text-center" },
    { key: "language", label: "Language", className: "text-nowrap" },
    { key: "repo", label: "Project" },
    { key: "currentStars", label: "New Stars", className: "text-end" },
    { key: "stars", label: "Total Stars", className: "text-end" },
    { key: "date", label: "Date", className: "text-nowrap text-end" },
  ];

  render(
    html`
      <section class="py-3">
        <div class="d-flex gap-3 justify-content-between align-items-center mb-2">
          ${statusTallies.map(({ code, label, count }) => {
            const active = state.filters.status.has(code);
            const classes = `btn btn-outline-primary ${
              active ? "active" : ""
            } w-100 h-100 text-start d-flex justify-content-between`;
            return html`<div class="col">
              <button type="button" class=${classes} aria-pressed=${active} @click=${() => toggleStatusFilter(code)}>
                <span>${code} <span class="d-none d-md-inline">${label}</span></span> ${count}
              </button>
            </div>`;
          })}
        </div>

        <div class="d-flex gap-3 justify-content-between align-items-center mb-2">
          ${languageTallies.map(({ key, label, count }) => {
            const active = state.filters.language.has(key);
            const classes = `btn btn-outline-secondary ${
              active ? "active" : ""
            } w-100 h-100 text-start d-flex justify-content-between`;
            return html`<div class="col">
              <button type="button" class=${classes} aria-pressed=${active} @click=${() => toggleLanguageFilter(key)}>
                ${label} ${count}
              </button>
            </div>`;
          })}
        </div>

        <div class="table-responsive">
          <table class="table table-hover table-sm align-middle mb-0">
            <thead class="table-light">
              <tr>
                ${columns.map(({ key, label, className }) => {
                  const isSorted = state.sort.key === key;
                  const icon = isSorted ? (state.sort.direction === "asc" ? "bi-arrow-up" : "bi-arrow-down") : "";
                  return html`<th
                    scope="col"
                    class=${className ?? ""}
                    style="cursor: pointer"
                    @click=${() => changeSort(key)}
                  >
                    <span class="d-inline-flex align-items-center gap-1">
                      <span>${label}</span>
                      ${icon ? html`<i class="bi ${icon}"></i>` : ""}
                    </span>
                  </th>`;
                })}
              </tr>
            </thead>
            <tbody>
              ${sorted.length
                ? sorted.map(
                    (row) =>
                      html`<tr
                        role="button"
                        class="position-relative"
                        style="cursor: pointer"
                        @click=${() => window.open(row.url, "_blank", "noopener")}
                      >
                        <td class="text-center">${row.status}</td>
                        <td class="text-nowrap">${row.language || "—"}</td>
                        <td>
                          <div class="fw-semibold text-break">${row.repo}</div>
                          ${row.description
                            ? html`<div class="text-secondary small text-break">${row.description}</div>`
                            : ""}
                          ${row.notes ? html`<div class="text-primary small text-break">${row.notes}</div>` : ""}
                        </td>
                        <td class="text-end">${row.currentStars.toLocaleString()}</td>
                        <td class="text-end">${row.stars.toLocaleString()}</td>
                        <td class="text-end text-nowrap">${formatDateLabel(row.date)}</td>
                      </tr>`,
                  )
                : html`<tr>
                    <td colspan=${columns.length} class="text-center py-5 text-secondary">
                      No repositories match these filters yet.
                    </td>
                  </tr>`}
            </tbody>
          </table>
        </div>
      </section>
    `,
    app,
  );
}
