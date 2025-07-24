import { loadOpenAI } from "../common/openai.js";
import { showToast } from "../common/toast.js";

const DEFAULT_BASE_URLS = ["https://llmfoundry.straivedemo.com/openai/v1", "https://llmfoundry.straive.com/openai/v1"];

const uploadInput = document.getElementById("upload-input");
const imageUrlInput = document.getElementById("image-url");
const useUrlBtn = document.getElementById("use-url-btn");
const imageSearch = document.getElementById("image-search");
const searchBtn = document.getElementById("search-btn");
const searchResults = document.getElementById("search-results");
const samplesRow = document.getElementById("samples");
const chatLog = document.getElementById("chat-log");
const promptInput = document.getElementById("prompt-input");
const sendBtn = document.getElementById("send-btn");
const loading = document.getElementById("loading");
const openaiConfigBtn = document.getElementById("openai-config-btn");

let aiConfig = await loadOpenAI(DEFAULT_BASE_URLS);
openaiConfigBtn.addEventListener("click", async () => {
  aiConfig = await loadOpenAI(DEFAULT_BASE_URLS, true);
});

fetch("config.json")
  .then((r) => r.json())
  .then(({ samples }) => {
    samples.forEach(({ title, image, prompt }) => {
      samplesRow.insertAdjacentHTML(
        "beforeend",
        `<div class="col-6 col-md-4 col-lg-2 sample" data-url="${image}" data-prompt="${prompt}">
           <div class="card h-100 shadow-sm">
             <img src="${image}" class="card-img-top" alt="${title}">
             <div class="card-body p-2"><small class="card-title">${title}</small></div>
           </div>
         </div>`,
      );
    });
  })
  .catch((err) => showToast({ title: "Config error", body: err.message, color: "bg-danger" }));

let baseImage = null;
let selectedUrl = "";

searchBtn.addEventListener("click", async () => {
  const query = imageSearch.value.trim();
  if (!query) return;
  searchResults.innerHTML = "";
  loading.classList.remove("d-none");
  const key = "YOUR_KEY";
  const cx = "YOUR_CX";
  try {
    const url = `https://www.googleapis.com/customsearch/v1?key=${key}&cx=${cx}&searchType=image&q=${encodeURIComponent(query)}`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error("Search failed");
    const data = await resp.json();
    data.items.slice(0, 8).forEach(({ link }) => {
      searchResults.insertAdjacentHTML(
        "beforeend",
        `<img src="${link}" data-url="${link}" class="img-thumbnail search-thumb" style="height:80px;cursor:pointer">`,
      );
    });
  } catch (err) {
    showToast({ title: "Search error", body: err.message, color: "bg-danger" });
  } finally {
    loading.classList.add("d-none");
  }
});

searchResults.addEventListener("click", (e) => {
  if (e.target.dataset.url) {
    selectedUrl = e.target.dataset.url;
    document.querySelectorAll(".search-thumb").forEach((img) => img.classList.remove("border-primary"));
    e.target.classList.add("border-primary");
    baseImage = null;
    uploadInput.value = "";
    imageUrlInput.value = selectedUrl;
  }
});

uploadInput.addEventListener("change", () => {
  const file = uploadInput.files[0];
  if (!file) return;
  baseImage = file;
  selectedUrl = "";
  document.querySelectorAll(".search-thumb").forEach((img) => img.classList.remove("border-primary"));
  imageUrlInput.value = "";
});

useUrlBtn.addEventListener("click", () => {
  const url = imageUrlInput.value.trim();
  if (!url) return;
  selectedUrl = url;
  baseImage = null;
  uploadInput.value = "";
  document.querySelectorAll(".search-thumb").forEach((img) => img.classList.remove("border-primary"));
  document.querySelectorAll("#samples .sample .card").forEach((c) => c.classList.remove("border-primary"));
});

samplesRow.addEventListener("click", (e) => {
  const card = e.target.closest(".sample");
  if (!card) return;
  selectedUrl = card.dataset.url;
  promptInput.value = card.dataset.prompt;
  baseImage = null;
  uploadInput.value = "";
  imageUrlInput.value = selectedUrl;
  document.querySelectorAll("#samples .sample .card").forEach((c) => c.classList.remove("border-primary"));
  card.querySelector(".card").classList.add("border-primary");
});

function appendUserMessage(text) {
  chatLog.insertAdjacentHTML(
    "beforeend",
    `<div class="mb-2"><div class="d-flex"><i class="bi bi-person-circle me-2"></i><div>${text}</div></div></div>`,
  );
  chatLog.scrollTop = chatLog.scrollHeight;
}

function appendImageMessage(url) {
  chatLog.insertAdjacentHTML(
    "beforeend",
    `<div class="mb-2 text-center"><img src="${url}" class="img-fluid rounded"></div>`,
  );
  chatLog.scrollTop = chatLog.scrollHeight;
}

sendBtn.addEventListener("click", () => generateImage());
promptInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    generateImage();
  }
});

async function generateImage() {
  const prompt = promptInput.value.trim();
  const { apiKey, baseURL } = aiConfig;
  if (!prompt) return;
  if (!apiKey) {
    showToast({ title: "OpenAI key missing", body: "Configure your key first", color: "bg-warning" });
    return;
  }
  appendUserMessage(prompt);
  promptInput.value = "";
  loading.classList.remove("d-none");
  try {
    const endpoint = baseImage || selectedUrl ? "edits" : "generations";
    let init;
    if (endpoint === "edits") {
      const blob = baseImage || (await fetch(selectedUrl).then((r) => r.blob()));
      const form = new FormData();
      form.append("model", "gpt-image-1");
      form.append("prompt", prompt);
      form.append("n", "1");
      form.append("size", "1024x1024");
      form.append("image", blob, "image.png");
      init = { method: "POST", headers: { Authorization: `Bearer ${apiKey}` }, body: form };
    } else {
      const body = { model: "gpt-image-1", prompt, n: 1, size: "1024x1024" };
      init = {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(body),
      };
    }
    const resp = await fetch(`${baseURL}/images/${endpoint}`, init);
    if (!resp.ok) throw new Error("API error");
    const data = await resp.json();
    const b64 = data.data[0].b64_json;
    const url = `data:image/png;base64,${b64}`;
    appendImageMessage(url);
    selectedUrl = url;
    baseImage = null;
  } catch (err) {
    showToast({ title: "Generation error", body: err.message, color: "bg-danger" });
  } finally {
    loading.classList.add("d-none");
  }
}
