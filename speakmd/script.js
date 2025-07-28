import { bootstrapAlert } from "https://cdn.jsdelivr.net/npm/bootstrap-alert@1";
import saveform from "https://cdn.jsdelivr.net/npm/saveform@1.2";
import { openaiConfig } from "https://cdn.jsdelivr.net/npm/bootstrap-llm-provider@1";
import { openaiHelp } from "../common/aiconfig.js";

const DEFAULT_BASE_URLS = ["https://openrouter.ai/api/v1", "https://aipipe.org/openrouter/v1"];

const form = document.getElementById("speakForm");
const markdownInput = document.getElementById("markdownInput");
const modelSelect = document.getElementById("modelSelect");
const openaiConfigBtn = document.getElementById("openai-config-btn");
const loading = document.getElementById("loading");
const htmlOutput = document.getElementById("htmlOutput");
const copyBtn = document.getElementById("copyBtn");
saveform("#speakForm", { exclude: '[type="file"]' });
const readBtn = document.getElementById("readBtn");

openaiConfigBtn.addEventListener("click", async () => {
  await openaiConfig({ defaultBaseUrls: DEFAULT_BASE_URLS, show: true, help: openaiHelp });
});

let utterance;
function speak(text) {
  if (!("speechSynthesis" in window)) return;
  speechSynthesis.cancel();
  utterance = new SpeechSynthesisUtterance(text);
  speechSynthesis.speak(utterance);
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const content = markdownInput.value.trim();
  const { apiKey, baseUrl } = await openaiConfig({
    defaultBaseUrls: DEFAULT_BASE_URLS,
    help: openaiHelp,
  });
  if (!content || !apiKey) return;
  htmlOutput.innerHTML = "";
  loading.classList.remove("d-none");
  let model = modelSelect.value;
  if (model.startsWith("openai/") && baseUrl.includes("api.openai.com")) model = model.replace("openai/", "");
  const temperature = 0.3;
  try {
    const { asyncLLM } = await import("https://cdn.jsdelivr.net/npm/asyncllm@2");
    for await (const { content: full } of asyncLLM(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        stream: true,
        temperature,
        messages: [
          {
            role: "system",
            content: document.getElementById("systemPrompt").value,
          },
          { role: "user", content },
        ],
      }),
    })) {
      htmlOutput.innerHTML = marked.parse(full ?? "");
      htmlOutput.scrollTop = htmlOutput.scrollHeight;
    }
  } catch (err) {
    bootstrapAlert({ title: "Processing error", body: err.message, color: "danger" });
  } finally {
    loading.classList.add("d-none");
  }
});

copyBtn.addEventListener("click", () => navigator.clipboard.writeText(htmlOutput.innerHTML));
readBtn.addEventListener("click", () => speak(htmlOutput.innerHTML));
