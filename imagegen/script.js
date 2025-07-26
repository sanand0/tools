import { loadOpenAI } from "../common/openai.js";
import { showToast } from "../common/toast.js";

const DEFAULT_BASE_URLS = ["https://llmfoundry.straivedemo.com/openai/v1", "https://llmfoundry.straive.com/openai/v1"];
const LOADING_MESSAGES = [
  "Painting pixels...",
  "Talking to the muse...",
  "Polishing details...",
  "Finalizing masterpiece...",
];

const uploadInput = document.getElementById("upload-input");
const imageUrlInput = document.getElementById("image-url");
const previewImage = document.getElementById("preview-image");
const samplesRow = document.getElementById("samples");
const chatLog = document.getElementById("chat-log");
const promptInput = document.getElementById("prompt-input");
const chatForm = document.getElementById("chat-form");
const loading = document.getElementById("loading");
const loadingMsg = document.getElementById("loading-msg");
const openaiConfigBtn = document.getElementById("openai-config-btn");
const sizeInput = document.getElementById("size");
const qualityInput = document.getElementById("quality");
const outputFormatInput = document.getElementById("output-format");
const compressionInput = document.getElementById("output-compression");
const backgroundInput = document.getElementById("background");
let loadingTimer;

const history = [];

function collectOptions() {
  const opts = { moderation: "low" };
  if (sizeInput.value !== "auto") opts.size = sizeInput.value;
  if (qualityInput.value !== "auto") opts.quality = qualityInput.value;
  if (outputFormatInput.value !== "png") opts.output_format = outputFormatInput.value;
  if (compressionInput.value !== "50") opts.output_compression = +compressionInput.value;
  if (backgroundInput.checked) opts.background = "transparent";
  return opts;
}

function restorePrompt(p) {
  promptInput.value = promptInput.value ? `${promptInput.value}\n${p}` : p;
}

function randomMessage() {
  return LOADING_MESSAGES[Math.floor(Math.random() * LOADING_MESSAGES.length)];
}

function startLoading() {
  loadingMsg.textContent = `Generating image (1-2 min)... ${randomMessage()}`;
  loading.classList.remove("d-none");
  loadingTimer = setInterval(() => (loadingMsg.textContent = randomMessage()), 5000);
}

function stopLoading() {
  clearInterval(loadingTimer);
  loading.classList.add("d-none");
}

function addHover(el) {
  el.classList.add("cursor-pointer");
  el.addEventListener("mouseenter", () => el.classList.add("shadow"));
  el.addEventListener("mouseleave", () => el.classList.remove("shadow"));
}

let aiConfig = await loadOpenAI(DEFAULT_BASE_URLS);
openaiConfigBtn.addEventListener("click", async () => {
  aiConfig = await loadOpenAI(DEFAULT_BASE_URLS, true);
});

chatForm.addEventListener("submit", (e) => {
  e.preventDefault();
  generateImage();
});

fetch("config.json")
  .then((r) => r.json())
  .then(({ samples }) => {
    samples.forEach(({ title, image, prompt }) => {
      samplesRow.insertAdjacentHTML(
        "beforeend",
        `<div class="col-6 col-md-4 col-lg-3 sample" data-url="${image}" data-prompt="${prompt}">
           <div class="card h-100 shadow-sm cursor-pointer">
             <img src="${image}" class="card-img-top object-fit-cover" style="height:120px" alt="${title}">
             <div class="card-body p-2"><small class="card-title">${title}</small></div>
           </div>
         </div>`,
      );
      addHover(samplesRow.lastElementChild.querySelector(".card"));
    });
  })
  .catch((err) => showToast({ title: "Config error", body: err.message, color: "bg-danger" }));

let baseImage = null;
let selectedUrl = "";

uploadInput.addEventListener("change", () => {
  const file = uploadInput.files[0];
  if (!file) return;
  baseImage = file;
  selectedUrl = "";
  imageUrlInput.value = "";
  previewImage.src = URL.createObjectURL(file);
  previewImage.classList.remove("d-none");
});

imageUrlInput.addEventListener("input", () => {
  const url = imageUrlInput.value.trim();
  if (!url) {
    previewImage.classList.add("d-none");
    selectedUrl = "";
    return;
  }
  selectedUrl = url;
  baseImage = null;
  uploadInput.value = "";
  previewImage.src = url;
  previewImage.classList.remove("d-none");
});

samplesRow.addEventListener("click", (e) => {
  const card = e.target.closest(".sample");
  if (!card) return;
  selectedUrl = card.dataset.url;
  promptInput.value = card.dataset.prompt;
  baseImage = null;
  uploadInput.value = "";
  imageUrlInput.value = selectedUrl;
  previewImage.src = selectedUrl;
  previewImage.classList.remove("d-none");
  document.querySelectorAll("#samples .sample .card").forEach((c) => c.classList.remove("border-primary"));
  card.querySelector(".card").classList.add("border-primary");
});

function appendUserMessage(text) {
  chatLog.insertAdjacentHTML(
    "beforeend",
    `<div class="card mb-3 shadow-sm"><div class="card-body"><h5 class="h5 mb-0">${text}</h5></div></div>`,
  );
  const card = chatLog.lastElementChild;
  addHover(card);
  chatLog.scrollTop = chatLog.scrollHeight;
  return card;
}

function appendImageMessage(url) {
  chatLog.insertAdjacentHTML(
    "beforeend",
    `<div class="card mb-3 shadow-sm"><img src="${url}" class="card-img-top"><div class="card-body p-2"><a href="${url}" download class="btn btn-sm btn-outline-secondary"><i class="bi bi-download"></i></a></div></div>`,
  );
  const card = chatLog.lastElementChild;
  addHover(card);
  chatLog.scrollTop = chatLog.scrollHeight;
}

async function generateImage() {
  const prompt = promptInput.value.trim();
  if (!prompt)
    return showToast({
      title: "Prompt missing",
      body: "Describe the image modification",
      color: "bg-warning",
    });
  const { apiKey, baseURL } = aiConfig;
  if (!apiKey)
    return showToast({
      title: "OpenAI key missing",
      body: "Configure your key",
      color: "bg-warning",
    });

  if (!baseImage && !selectedUrl) {
    selectedUrl = imageUrlInput.value.trim();
    if (!selectedUrl) return showToast({ title: "Image missing", body: "Upload or paste a URL", color: "bg-warning" });
    previewImage.src = selectedUrl;
    previewImage.classList.remove("d-none");
  }

  const userCard = appendUserMessage(prompt);
  promptInput.value = "";
  startLoading();
  try {
    const endpoint = baseImage || selectedUrl ? "edits" : "generations";
    const opts = collectOptions();
    const fullPrompt = history.length
      ? `${prompt}.\n\nFor context, here are previous messages:\n\n${history.join("\n")}\n\n${prompt}`
      : prompt;
    let init;
    if (endpoint === "edits") {
      const blob = baseImage || (await fetch(selectedUrl).then((r) => r.blob()));
      const form = new FormData();
      form.append("model", "gpt-image-1");
      form.append("prompt", fullPrompt);
      form.append("n", "1");
      Object.entries(opts).forEach(([k, v]) => form.append(k, v));
      form.append("image", blob, "image.png");
      init = {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
      };
    } else {
      const body = { model: "gpt-image-1", prompt: fullPrompt, n: 1, ...opts };
      init = {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      };
    }
    const resp = await fetch(`${baseURL}/images/${endpoint}`, init);
    if (!resp.ok) {
      const text = await resp.text();
      userCard.remove();
      restorePrompt(prompt);
      return showToast({
        title: prompt,
        body: `${resp.status}: ${text}`,
        color: "bg-danger",
      });
    }
    const data = await resp.json();
    const b64 = data.data?.[0]?.b64_json;
    if (!b64) {
      userCard.remove();
      restorePrompt(prompt);
      return showToast({
        title: "Generation failed",
        body: JSON.stringify(data),
        color: "bg-danger",
      });
    }
    const url = `data:image/png;base64,${b64}`;
    appendImageMessage(url);
    selectedUrl = url;
    baseImage = null;
    history.push(prompt);
  } catch (err) {
    userCard.remove();
    restorePrompt(prompt);
    showToast({
      title: "Generation error",
      body: err.message,
      color: "bg-danger",
    });
  } finally {
    stopLoading();
  }
}
