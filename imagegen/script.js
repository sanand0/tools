import { loadOpenAI } from "../common/openai.js";
import { showToast } from "../common/toast.js";

const DEFAULT_BASE_URLS = ["https://llmfoundry.straivedemo.com/openai/v1", "https://llmfoundry.straive.com/openai/v1"];

const uploadInput = document.getElementById("upload-input");
const imageSearch = document.getElementById("image-search");
const searchBtn = document.getElementById("search-btn");
const searchResults = document.getElementById("search-results");
const chatLog = document.getElementById("chat-log");
const promptInput = document.getElementById("prompt-input");
const sendBtn = document.getElementById("send-btn");
const loading = document.getElementById("loading");
const openaiConfigBtn = document.getElementById("openai-config-btn");

let aiConfig = await loadOpenAI(DEFAULT_BASE_URLS);
openaiConfigBtn.addEventListener("click", async () => {
  aiConfig = await loadOpenAI(DEFAULT_BASE_URLS, true);
});

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
  }
});

uploadInput.addEventListener("change", () => {
  const file = uploadInput.files[0];
  if (!file) return;
  baseImage = file;
  selectedUrl = "";
  document.querySelectorAll(".search-thumb").forEach((img) => img.classList.remove("border-primary"));
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
    const body = { model: "gpt-image-1", prompt, n: 1, size: "1024x1024" };
    if (baseImage) {
      const b64 = await fileToBase64(baseImage);
      body.image = b64.split(",")[1];
    } else if (selectedUrl) {
      body.image_url = selectedUrl;
    }
    const resp = await fetch(`${baseURL}/images/generations`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
    });
    if (!resp.ok) throw new Error("API error");
    const data = await resp.json();
    const url = data.data[0].url;
    appendImageMessage(url);
    selectedUrl = url;
    baseImage = null;
  } catch (err) {
    showToast({ title: "Generation error", body: err.message, color: "bg-danger" });
  } finally {
    loading.classList.add("d-none");
  }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
