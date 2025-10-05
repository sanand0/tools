import { marked } from "https://cdn.jsdelivr.net/npm/marked/+esm";
import { bootstrapAlert } from "https://cdn.jsdelivr.net/npm/bootstrap-alert@1";
import { files, fetchAll, filterNotes, renderStar } from "./notes.js";

export async function createCard(parent, opts = {}) {
  const { deletable = false, exclude = () => [], showAllOnSearch = false } = opts;
  parent.insertAdjacentHTML(
    "beforeend",
    /* html */ `
    <div class="card mb-3 note-card">
      <div class="card-header">
        <div class="row">
          <div class="col-md-4">
            <select class="form-select form-select-sm note-file mb-2"></select>
          </div>
          <div class="col-md-8 d-flex">
            <input type="search" class="form-control form-control-sm note-search mb-2 me-auto" placeholder="Search" />
            <button class="btn btn-outline-warning btn-sm note-star text-nowrap ms-2 mb-2" title="Star"><i class="bi bi-star"></i></button>
            <button class="btn btn-secondary btn-sm note-copy text-nowrap ms-2 mb-2" title="Copy"><i class="bi bi-clipboard"></i> <span class="d-none d-sm-inline">Copy</span></button>
            <button class="btn btn-success btn-sm note-quiz text-nowrap ms-2 mb-2" title="Quiz"><i class="bi bi-question-circle"></i> <span class="d-none d-sm-inline">Quiz</span></button>
            <button class="btn btn-outline-danger btn-sm note-delete text-nowrap ms-2 mb-2" title="Delete"><i class="bi bi-x"></i></button>
          </div>
        </div>
        <div class="d-flex text-end">
          <button class="btn btn-outline-primary btn-sm note-prev me-2" title="Previous"><i class="bi bi-arrow-left"></i></button>
          <button class="btn btn-primary btn-sm note-random me-2" title="Random"><i class="bi bi-shuffle"></i> <span class="d-none d-sm-inline">Random</span></button>
          <button class="btn btn-outline-primary btn-sm note-next me-auto" title="Next"><i class="bi bi-arrow-right"></i></button>
          <label class="d-flex align-items-center">
            <span class="d-none d-md-block me-2">Decay</span>
            <input type="number" class="form-control form-control-sm w-auto note-decay d-none d-sm-block me-2" min="0" max="1" step="0.01" value="0.02" style="max-width:7rem" />
          </label>
          <label class="d-flex align-items-center">
            <span class="d-none d-md-block me-2">#</span>
            <input type="number" class="form-control form-control-sm w-auto note-index d-none d-sm-block" min="1" style="max-width:6rem" />
          </label>
        </div>
      </div>
      <div class="card-body">
        <h5 class="card-title"></h5>
        <div class="note-content"></div>
      </div>
    </div>
  `,
  );
  const card = parent.lastElementChild;
  // Map DOM → ui.* for readability
  const ui = Object.fromEntries(
    [
      ["fileSel", ".note-file"],
      ["searchInput", ".note-search"],
      ["starBtn", ".note-star"],
      ["copyBtn", ".note-copy"],
      ["quizBtn", ".note-quiz"],
      ["delBtn", ".note-delete"],
      ["prevBtn", ".note-prev"],
      ["randBtn", ".note-random"],
      ["nextBtn", ".note-next"],
      ["decayInput", ".note-decay"],
      ["indexInput", ".note-index"],
      ["title", ".card-title"],
      ["content", ".note-content"],
    ].map(([k, s]) => [k, card.querySelector(s)]),
  );
  files.forEach((f) => ui.fileSel.insertAdjacentHTML("beforeend", `<option value="${f.url}">${f.name}</option>`));
  ui.fileSel.insertAdjacentHTML("afterbegin", `<option value="">Random</option>`);
  ui.fileSel.value = ""; // default to Random
  if (!deletable) ui.delBtn.classList.add("d-none");
  ui.delBtn.onclick = () => card.remove();
  let items = [],
    view = [],
    index = 0;
  card.star = false;

  async function load() {
    ui.content.innerHTML = `<div class="text-center"><div class="spinner-border" role="status"></div></div>`;
    const url = ui.fileSel.value;
    items = await fetchAll(url ? [url] : files.filter((f) => f.preload).map((f) => f.url));
    ui.searchInput.value = "";
    index = 0;
    applyFilter();
    ui.title.textContent = url ? files.find((f) => f.url === url)?.name : "All";
  }

  const weight = (i) => (1 - +ui.decayInput.value) ** i;

  function applyFilter() {
    if (!items.length) return clearAndAlert("No notes");
    view = filterNotes(items, ui.searchInput.value, card.star);
    if (!view.length) return clearAndAlert(card.star ? "No ⭐ items" : "No match");
    const term = ui.searchInput.value.trim();
    if (showAllOnSearch && term) return showAll(view);
    if (term) return show(0);
    randomPick();
  }

  const clearAndAlert = (msg) => {
    ui.content.innerHTML = "";
    ui.indexInput.value = "";
    bootstrapAlert({ body: msg, color: "danger", replace: true });
  };
  const showAll = (arr) => {
    ui.content.innerHTML = marked.parse(arr.join("\n"));
    ui.indexInput.value = "";
  };

  function show(i) {
    if (i < 0 || i >= view.length)
      return bootstrapAlert({ body: "Index out of range", color: "danger", replace: true });
    index = i;
    const note = view[i];
    card.note = note;
    ui.content.innerHTML = `<div class="form-control note-text">${marked.parse(note)}</div>`;
    ui.indexInput.value = i + 1;
    ui.content.querySelector(".note-text").oninput = (e) => (card.note = e.target.innerText);
  }

  function randomPick() {
    const weights = view.map((_, i) => weight(i));
    const total = weights.reduce((a, b) => a + b, 0);
    let tries = 5;
    while (tries--) {
      let r = Math.random() * total;
      let i = 0;
      while (r >= weights[i]) r -= weights[i++];
      if (!exclude().includes(view[i])) {
        show(i);
        return;
      }
    }
    show(0);
  }

  ui.fileSel.onchange = load;
  ui.searchInput.oninput = applyFilter;
  ui.decayInput.oninput = randomPick;
  ui.randBtn.onclick = randomPick;
  ui.prevBtn.onclick = () => show(index - 1);
  ui.nextBtn.onclick = () => show(index + 1);
  ui.indexInput.oninput = () => show(+ui.indexInput.value - 1);
  ui.copyBtn.onclick = async () => {
    await navigator.clipboard.writeText(card.note || "");
    bootstrapAlert({ body: "Copied", color: "success", replace: true });
  };
  ui.quizBtn.onclick = () => {
    if (!card.note) {
      bootstrapAlert({ body: "No note", color: "danger", replace: true });
      return;
    }
    const q = `${card.note}\n\nQuiz me so I can learn this better. Search online for more information if required.`;
    window.open(`https://chatgpt.com/?model=gpt-5-thinking&q=${encodeURIComponent(q)}`, "_blank");
  };
  ui.starBtn.onclick = () => {
    card.star = !card.star;
    renderStar(ui.starBtn, card.star);
    applyFilter();
  };

  await load();
  return card;
}
