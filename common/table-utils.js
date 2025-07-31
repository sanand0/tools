export const arrayToTable = (e, r, c) => {
  if (!r.length) return;
  const h = c || Object.keys(r[0]);
  e.innerHTML = `<table class="table table-striped table-bordered"><thead><tr>${h.map((x) => `<th>${x}</th>`).join("")}</tr></thead><tbody>${r.map((o) => `<tr>${h.map((x) => `<td>${o[x] ?? ""}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
};
