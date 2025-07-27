import saveform from "https://cdn.jsdelivr.net/npm/saveform@1.2";
import { openaiConfig } from "https://cdn.jsdelivr.net/npm/bootstrap-llm-provider@1.1";
import { bootstrapAlert } from "https://cdn.jsdelivr.net/npm/bootstrap-alert@1";
import JSZip from "https://cdn.jsdelivr.net/npm/jszip@3/+esm";

const DEFAULT_BASE_URLS = [
  "https://api.openai.com/v1",
  "https://llmfoundry.straivedemo.com/openai/v1",
  "https://llmfoundry.straive.com/openai/v1",
];

saveform("#picbook-form", { exclude: '[type="file"]' });

const ui = {
  form: document.getElementById("picbook-form"),
  context: document.getElementById("context"),
  captions: document.getElementById("captions"),
  startBtn: document.getElementById("start-btn"),
  pauseBtn: document.getElementById("pause-btn"),
  zipBtn: document.getElementById("zip-btn"),
  progress: document.getElementById("progress"),
  bar: document.getElementById("progress-bar"),
  log: document.getElementById("picbook-log"),
  upload: document.getElementById("upload-input"),
  url: document.getElementById("image-url"),
  preview: document.getElementById("preview-image"),
  configBtn: document.getElementById("openai-config-btn"),
  size: document.getElementById("size"),
  quality: document.getElementById("quality"),
  format: document.getElementById("output-format"),
  compression: document.getElementById("output-compression"),
  background: document.getElementById("background"),
};

let aiConfig = await openaiConfig({ defaultBaseUrls: DEFAULT_BASE_URLS });
ui.configBtn.addEventListener("click", async () => {
  aiConfig = await openaiConfig({ defaultBaseUrls: DEFAULT_BASE_URLS, show: true });
});

let baseFile = null;
let baseUrl = "";
let cards = [];
let state = "idle";
let startTime = 0;
let index = 0;
const times = [];

const slug = (t) =>
  t
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);

function collectOptions() {
  const opts = { moderation: "low" };
  if (ui.size.value !== "auto") opts.size = ui.size.value;
  if (ui.quality.value !== "auto") opts.quality = ui.quality.value;
  if (ui.format.value !== "png") {
    opts.output_format = ui.format.value;
    opts.output_compression = +ui.compression.value;
  }
  if (ui.background.checked) opts.background = "transparent";
  return opts;
}

function updateProgress(current, total) {
  const elapsed = (Date.now() - startTime) / 1000;
  const avg = times.length ? times.reduce((a, b) => a + b, 0) / times.length : 60;
  const est = avg * total;
  ui.bar.style.width = `${(current / total) * 100}%`;
  ui.bar.textContent = `${current}/${total} - ${Math.round(elapsed)}s / ~${Math.round(est)}s`;
}

function setState(s) {
  state = s;
  ui.pauseBtn.disabled = false;
  ui.pauseBtn.classList.toggle("d-none", s === "idle");
  if (s === "running") ui.pauseBtn.textContent = "Pause";
  else if (s === "pausing") ui.pauseBtn.textContent = "Pausing...";
  else if (s === "paused") ui.pauseBtn.textContent = "Continue";
  else {
    ui.pauseBtn.textContent = "Done";
    ui.pauseBtn.disabled = true;
  }
}

ui.pauseBtn.onclick = () => {
  if (state === "running") setState("pausing");
  else if (state === "paused") run();
};

ui.upload.onchange = () => {
  const file = ui.upload.files[0];
  if (!file) return;
  baseFile = file;
  baseUrl = "";
  ui.url.value = "";
  ui.preview.src = URL.createObjectURL(file);
  ui.preview.classList.remove("d-none");
};

ui.url.oninput = () => {
  const url = ui.url.value.trim();
  if (!url) {
    ui.preview.classList.add("d-none");
    baseUrl = "";
    return;
  }
  baseUrl = url;
  baseFile = null;
  ui.upload.value = "";
  ui.preview.src = url;
  ui.preview.classList.remove("d-none");
};

ui.zipBtn.onclick = downloadZip;

function createCard(caption) {
  ui.log.insertAdjacentHTML(
    "beforeend",
    `<div class="card mb-3 text-center picture-card"><div class="card-body"><div class="spinner-border m-5" role="status"></div><div class="small opacity-75 mt-3">${caption}</div></div></div>`,
  );
  return ui.log.lastElementChild;
}

async function downloadZip() {
  if (!cards.length) return;
  const zip = new JSZip();
  for (const card of cards) {
    const img = card.querySelector("img");
    if (!img) continue;
    const blob = await fetch(img.src).then((r) => r.blob());
    const ext = img.src.split(";")[0].split("/")[1] || "png";
    zip.file(`${String(cards.indexOf(card) + 1).padStart(3, "0")}-${slug(img.alt)}.${ext}`, blob);
  }
  const content = await zip.generateAsync({ type: "blob" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(content);
  a.download = "picbook.zip";
  a.click();
  URL.revokeObjectURL(a.href);
}

async function requestImage(prompt, reference, opts) {
  const { apiKey, baseURL } = aiConfig;
  if (!apiKey) {
    bootstrapAlert({ title: "OpenAI key missing", body: "Configure your key", color: "warning" });
    return null;
  }
  if (reference) {
    const blob = await fetch(reference).then((r) => r.blob());
    const form = new FormData();
    form.append("model", "gpt-image-1");
    form.append("prompt", prompt);
    form.append("n", "1");
    Object.entries(opts).forEach(([k, v]) => form.append(k, v));
    form.append("image", blob, "image.png");
    return fetch(`${baseURL}/images/edits`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
  }
  return fetch(`${baseURL}/images/generations`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: "gpt-image-1", prompt, n: 1, ...opts }),
  });
}

async function run() {
  const captions = ui.captions.value
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (!captions.length) {
    bootstrapAlert({ title: "Captions missing", color: "warning" });
    return;
  }
  if (state === "idle") {
    ui.log.innerHTML = "";
    cards = captions.map(createCard);
    index = 0;
    startTime = Date.now();
    times.length = 0;
  }
  setState("running");
  ui.progress.classList.remove("d-none");
  ui.zipBtn.classList.remove("d-none");
  const opts = collectOptions();
  const ctx = ui.context.value.trim();
  while (index < captions.length && state === "running") {
    const caption = captions[index];
    const prompt = ctx ? `${ctx} ${caption}` : caption;
    const reference =
      index === 0 ? (baseFile ? URL.createObjectURL(baseFile) : baseUrl) : cards[index - 1].querySelector("img")?.src;
    const t0 = performance.now();
    try {
      const resp = await requestImage(prompt, reference, opts);
      if (!resp || !resp.ok) throw new Error(await resp.text());
      const data = await resp.json();
      const b64 = data.data?.[0]?.b64_json;
      if (!b64) throw new Error("No image returned");
      const imgUrl = `data:image/${ui.format.value};base64,${b64}`;
      cards[index].innerHTML =
        `<img src="${imgUrl}" title="${caption}" alt="${caption}" class="card-img-top object-fit-contain" style="height:250px"><div class="card-body p-2"><a download="${String(index + 1).padStart(3, "0")}-${slug(caption)}.${ui.format.value}" href="${imgUrl}" class="btn btn-sm btn-outline-secondary"><i class="bi bi-download"></i></a></div>`;
      times.push((performance.now() - t0) / 1000);
      index++;
      updateProgress(index, captions.length);
    } catch (err) {
      cards[index].querySelector(".spinner-border")?.remove();
      bootstrapAlert({ title: caption, body: err.message, color: "danger" });
      setState("paused");
      return;
    }
    if (state === "pausing") {
      setState("paused");
      return;
    }
  }
  if (index >= captions.length) setState("done");
}

ui.startBtn.onclick = (e) => {
  e.preventDefault();
  run();
};
ui.form.addEventListener("submit", (e) => {
  e.preventDefault();
  run();
});
