import { marked } from "https://cdn.jsdelivr.net/npm/marked/+esm";
import { bootstrapAlert } from "https://cdn.jsdelivr.net/npm/bootstrap-alert@1";
import { files, fetchAll, filterNotes, renderStar } from "./notes.js";

export async function createCard(parent, opts = {}) {
  const { deletable = false, exclude = () => [], showAllOnSearch = false } = opts;
  parent.insertAdjacentHTML(
    "beforeend",
    /* html */ `
    <div class="card mb-3 note-card">
      <div class="card-header d-flex flex-wrap align-items-center gap-2">
        <div class="d-flex flex-wrap gap-2">
          <select class="form-select form-select-sm w-auto note-file"></select>
          <input type="search" class="form-control form-control-sm w-auto note-search" placeholder="Search" />
        </div>
        <div class="d-flex flex-wrap gap-2 ms-auto">
          <button class="btn btn-outline-warning btn-sm note-star" title="Star"><i class="bi bi-star"></i></button>
          <button class="btn btn-secondary btn-sm note-copy" title="Copy"><i class="bi bi-clipboard"></i> <span class="d-none d-sm-inline">Copy</span></button>
          <button class="btn btn-success btn-sm note-quiz" title="Quiz"><i class="bi bi-question-circle"></i> <span class="d-none d-sm-inline">Quiz</span></button>
          <button class="btn btn-outline-danger btn-sm note-delete" title="Delete"><i class="bi bi-x"></i></button>
        </div>
      </div>
      <div class="card-body">
        <h5 class="card-title"></h5>
        <div class="note-content"></div>
      </div>
      <div class="card-footer d-flex flex-wrap align-items-center gap-2">
        <div class="d-flex flex-wrap gap-2">
          <button class="btn btn-outline-primary btn-sm note-prev" title="Previous"><i class="bi bi-arrow-left"></i></button>
          <button class="btn btn-primary btn-sm note-random" title="Random"><i class="bi bi-shuffle"></i> <span class="d-none d-sm-inline">Random</span></button>
          <button class="btn btn-outline-primary btn-sm note-next" title="Next"><i class="bi bi-arrow-right"></i></button>
        </div>
        <div class="d-flex flex-wrap gap-2 ms-auto">
          <input type="number" class="form-control form-control-sm w-auto note-decay d-none d-md-block" min="0" max="1" step="0.01" value="0.02" style="max-width:7rem" />
          <input type="number" class="form-control form-control-sm w-auto note-index d-none d-md-block" min="1" style="max-width:6rem" />
        </div>
      </div>
    </div>
  `,
  );
  const card = parent.lastElementChild;
  const fileSel = card.querySelector(".note-file");
  const searchInput = card.querySelector(".note-search");
  const starBtn = card.querySelector(".note-star");
  const copyBtn = card.querySelector(".note-copy");
  const quizBtn = card.querySelector(".note-quiz");
  const delBtn = card.querySelector(".note-delete");
  const prevBtn = card.querySelector(".note-prev");
  const randBtn = card.querySelector(".note-random");
  const nextBtn = card.querySelector(".note-next");
  const decayInput = card.querySelector(".note-decay");
  const indexInput = card.querySelector(".note-index");
  const title = card.querySelector(".card-title");
  const content = card.querySelector(".note-content");
  files.forEach((f) => fileSel.insertAdjacentHTML("beforeend", `<option value="${f.url}">${f.name}</option>`));
  fileSel.insertAdjacentHTML("afterbegin", `<option value="">Random</option>`);
  if (!deletable) delBtn.classList.add("d-none");
  delBtn.onclick = () => card.remove();
  let items = [],
    view = [],
    index = 0;
  card.star = false;

  async function load() {
    content.innerHTML = `<div class="text-center"><div class="spinner-border" role="status"></div></div>`;
    const url = fileSel.value;
    const urls = url ? [url] : files.map((f) => f.url);
    items = await fetchAll(urls);
    searchInput.value = "";
    index = 0;
    applyFilter();
    title.textContent = url ? files.find((f) => f.url === url)?.name : "All";
  }

  const weight = (i) => (1 - +decayInput.value) ** i;

  function applyFilter() {
    if (!items.length) {
      content.innerHTML = "";
      indexInput.value = "";
      bootstrapAlert({ body: "No notes", color: "danger", replace: true });
      return;
    }
    view = filterNotes(items, searchInput.value, card.star);
    if (!view.length) {
      content.innerHTML = "";
      indexInput.value = "";
      bootstrapAlert({ body: card.star ? "No ⭐ items" : "No match", color: "danger", replace: true });
      return;
    }
    const term = searchInput.value.trim();
    if (showAllOnSearch && term) {
      content.innerHTML = marked.parse(view.join("\n"));
      indexInput.value = "";
      return;
    }
    if (term) {
      show(0);
      return;
    }
    randomPick();
  }

  function show(i) {
    if (i < 0 || i >= view.length) {
      bootstrapAlert({ body: "Index out of range", color: "danger", replace: true });
      return;
    }
    index = i;
    const note = view[i];
    card.note = note;
    content.innerHTML = `<div class="form-control note-text" contenteditable>${marked.parse(note)}</div>`;
    indexInput.value = i + 1;
    content.querySelector(".note-text").oninput = (e) => (card.note = e.target.innerText);
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

  fileSel.onchange = load;
  searchInput.oninput = applyFilter;
  decayInput.oninput = randomPick;
  randBtn.onclick = randomPick;
  prevBtn.onclick = () => show(index - 1);
  nextBtn.onclick = () => show(index + 1);
  indexInput.oninput = () => show(+indexInput.value - 1);
  copyBtn.onclick = async () => {
    await navigator.clipboard.writeText(card.note || "");
    bootstrapAlert({ body: "Copied", color: "success", replace: true });
  };
  quizBtn.onclick = () => {
    if (!card.note) {
      bootstrapAlert({ body: "No note", color: "danger", replace: true });
      return;
    }
    const q = `${card.note}\n\nQuiz me so I can learn this better. Search online for more information if required.`;
    window.open(`https://chatgpt.com/?model=gpt-5-thinking&q=${encodeURIComponent(q)}`, "_blank");
  };
  starBtn.onclick = () => {
    card.star = !card.star;
    renderStar(starBtn, card.star);
    applyFilter();
  };

  await load();
  return card;
}
