import { loadOpenAI } from "../common/openai.js";
import { showToast } from "../common/toast.js";

const DEFAULT_BASE_URLS = ["https://llmfoundry.straivedemo.com/openai/v1", "https://llmfoundry.straive.com/openai/v1"];
const LOADING_MESSAGES = [
  "Painting pixels...",
  "Talking to the muse...",
  "Polishing details...",
  "Finalizing masterpiece...",
];

const qs = (id) => document.getElementById(id);
const ui = {
  upload: qs("upload-input"),
  url: qs("image-url"),
  preview: qs("preview-image"),
  samples: qs("samples"),
  log: qs("chat-log"),
  prompt: qs("prompt-input"),
  form: qs("chat-form"),
  loading: qs("loading"),
  loadingMsg: qs("loading-msg"),
  configBtn: qs("openai-config-btn"),
  size: qs("size"),
  quality: qs("quality"),
  format: qs("output-format"),
  compression: qs("output-compression"),
  background: qs("background"),
};

let aiConfig = await loadOpenAI(DEFAULT_BASE_URLS);
ui.configBtn.addEventListener("click", async () => {
  aiConfig = await loadOpenAI(DEFAULT_BASE_URLS, true);
});

let baseImage = null;
let selectedUrl = "";
const history = [];
let loadingTimer;

const msg = () =>
  `Generating image (1-2 min)... ${LOADING_MESSAGES[Math.floor(Math.random() * LOADING_MESSAGES.length)]}`;
const hideDeletes = (hide) =>
  document.querySelectorAll(".user-card .btn-close").forEach((b) => b.classList.toggle("invisible", hide));

const collectOptions = () => {
  const opts = { moderation: "low" };
  if (ui.size.value !== "auto") opts.size = ui.size.value;
  if (ui.quality.value !== "auto") opts.quality = ui.quality.value;
  if (ui.format.value !== "png") opts.output_format = ui.format.value;
  if (ui.compression.value !== "50") opts.output_compression = +ui.compression.value;
  if (ui.background.checked) opts.background = "transparent";
  return opts;
};

const restorePrompt = (p) => {
  ui.prompt.value = ui.prompt.value ? `${ui.prompt.value}\n${p}` : p;
};

function startLoading() {
  ui.loadingMsg.textContent = msg();
  ui.loading.classList.remove("d-none");
  hideDeletes(true);
  loadingTimer = setInterval(() => (ui.loadingMsg.textContent = msg()), 5000);
}

function stopLoading() {
  clearInterval(loadingTimer);
  ui.loading.classList.add("d-none");
  hideDeletes(false);
}

function addHover(card) {
  card.classList.add("cursor-pointer");
  card.addEventListener("mouseenter", () => card.classList.add("shadow"));
  card.addEventListener("mouseleave", () => card.classList.remove("shadow"));
}

function deleteFrom(idx) {
  let node = ui.log.querySelector(`.user-card[data-index="${idx}"]`);
  while (node) {
    const next = node.nextElementSibling;
    node.remove();
    node = next;
  }
  history.splice(idx);
  const lastImg = ui.log.querySelector(".ai img:last-of-type");
  if (lastImg) {
    selectedUrl = lastImg.src;
    baseImage = null;
  } else if (ui.upload.files[0]) {
    baseImage = ui.upload.files[0];
    selectedUrl = "";
  } else {
    selectedUrl = ui.url.value.trim();
    baseImage = null;
  }
}

function addUserCard(text) {
  ui.log.insertAdjacentHTML(
    "beforeend",
    `<div class="card mb-3 shadow-sm user-card" data-index="${history.length}">
       <div class="card-body d-flex">
         <h5 class="h5 mb-0 flex-grow-1">${text}</h5>
         <button class="btn-close ms-2" aria-label="Delete"></button>
       </div>
     </div>`,
  );
  const card = ui.log.lastElementChild;
  addHover(card);
  card.querySelector(".btn-close").addEventListener("click", () => deleteFrom(+card.dataset.index));
  ui.log.scrollTop = ui.log.scrollHeight;
  return card;
}

function addImageCard(url) {
  ui.log.insertAdjacentHTML(
    "beforeend",
    `<div class="card mb-3 shadow-sm ai">
       <img src="${url}" class="card-img-top img-fluid">
       <div class="card-body p-2">
         <a href="${url}" download class="btn btn-sm btn-outline-secondary">
           <i class="bi bi-download"></i>
         </a>
       </div>
     </div>`,
  );
  addHover(ui.log.lastElementChild);
  ui.log.scrollTop = ui.log.scrollHeight;
}

function selectImage() {
  if (baseImage || selectedUrl) return true;
  selectedUrl = ui.url.value.trim();
  if (!selectedUrl) return true;
  ui.preview.src = selectedUrl;
  ui.preview.classList.remove("d-none");
  return true;
}

const buildPrompt = (p) =>
  history.length ? `${p}.\n\nFor context, here are previous messages:\n\n${history.join("\n")}\n\n${p}` : p;

async function makeRequest(prompt, opts) {
  const { apiKey, baseURL } = aiConfig;
  if (!apiKey) {
    showToast({ title: "OpenAI key missing", body: "Configure your key", color: "bg-warning" });
    return null;
  }
  const endpoint = baseImage || selectedUrl ? "edits" : "generations";
  if (endpoint === "edits") {
    const blob = baseImage || (await fetch(selectedUrl).then((r) => r.blob()));
    const form = new FormData();
    form.append("model", "gpt-image-1");
    form.append("prompt", prompt);
    form.append("n", "1");
    Object.entries(opts).forEach(([k, v]) => form.append(k, v));
    form.append("image", blob, "image.png");
    return fetch(`${baseURL}/images/${endpoint}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
  }
  return fetch(`${baseURL}/images/${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model: "gpt-image-1", prompt, n: 1, ...opts }),
  });
}

async function handleResponse(resp, userCard, prompt) {
  if (!resp || !resp.ok) {
    const text = resp ? await resp.text() : "";
    userCard.remove();
    restorePrompt(prompt);
    showToast({ title: prompt, body: `${resp?.status || "?"}: ${text}`, color: "bg-danger" });
    return null;
  }
  const data = await resp.json();
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) {
    userCard.remove();
    restorePrompt(prompt);
    showToast({ title: "Generation failed", body: JSON.stringify(data), color: "bg-danger" });
    return null;
  }
  return `data:image/png;base64,${b64}`;
}

async function generateImage() {
  const prompt = ui.prompt.value.trim();
  if (!prompt) {
    showToast({ title: "Prompt missing", body: "Describe the image modification", color: "bg-warning" });
    return;
  }
  if (!selectImage()) return;
  const card = addUserCard(prompt);
  ui.prompt.value = "";
  startLoading();
  const opts = collectOptions();
  const fullPrompt = buildPrompt(prompt);
  try {
    const resp = await makeRequest(fullPrompt, opts);
    const url = await handleResponse(resp, card, prompt);
    if (!url) return;
    addImageCard(url);
    selectedUrl = url;
    baseImage = null;
    history.push(prompt);
  } catch (err) {
    card.remove();
    restorePrompt(prompt);
    showToast({ title: "Generation error", body: err.message, color: "bg-danger" });
  } finally {
    stopLoading();
  }
}

ui.form.addEventListener("submit", (e) => {
  e.preventDefault();
  generateImage();
});

ui.upload.addEventListener("change", () => {
  const file = ui.upload.files[0];
  if (!file) return;
  baseImage = file;
  selectedUrl = "";
  ui.url.value = "";
  ui.preview.src = URL.createObjectURL(file);
  ui.preview.classList.remove("d-none");
});

ui.url.addEventListener("input", () => {
  const url = ui.url.value.trim();
  if (!url) {
    ui.preview.classList.add("d-none");
    selectedUrl = "";
    return;
  }
  selectedUrl = url;
  baseImage = null;
  ui.upload.value = "";
  ui.preview.src = url;
  ui.preview.classList.remove("d-none");
});

ui.samples.addEventListener("click", (e) => {
  const card = e.target.closest(".sample");
  if (!card) return;
  selectedUrl = card.dataset.url;
  ui.prompt.value = card.dataset.prompt;
  baseImage = null;
  ui.upload.value = "";
  ui.url.value = selectedUrl;
  ui.preview.src = selectedUrl;
  ui.preview.classList.remove("d-none");
  document.querySelectorAll("#samples .sample .card").forEach((c) => c.classList.remove("border-primary"));
  card.querySelector(".card").classList.add("border-primary");
});

fetch("config.json")
  .then((r) => r.json())
  .then(({ samples }) => {
    samples.forEach(({ title, image, prompt }) => {
      ui.samples.insertAdjacentHTML(
        "beforeend",
        `<div class="col-6 col-md-4 col-lg-3 sample" data-url="${image}" data-prompt="${prompt}">
           <div class="card h-100 shadow-sm cursor-pointer">
             <img src="${image}" class="card-img-top object-fit-cover" style="height:120px" alt="${title}">
             <div class="card-body p-2"><small class="card-title">${title}</small></div>
           </div>
         </div>`,
      );
      addHover(ui.samples.lastElementChild.querySelector(".card"));
    });
  })
  .catch((err) => showToast({ title: "Config error", body: err.message, color: "bg-danger" }));
