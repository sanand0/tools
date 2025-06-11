import { showToast } from "../common/toast.js";

const form = document.getElementById("speakForm");
const markdownInput = document.getElementById("markdownInput");
const modelSelect = document.getElementById("modelSelect");
const baseUrlInput = document.getElementById("baseUrlInput");
const apiKeyInput = document.getElementById("apiKeyInput");
const loading = document.getElementById("loading");
const htmlOutput = document.getElementById("htmlOutput");
const copyBtn = document.getElementById("copyBtn");
const readBtn = document.getElementById("readBtn");

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
  const apiKey = apiKeyInput.value.trim();
  if (!content || !apiKey) return;
  htmlOutput.innerHTML = "";
  loading.classList.remove("d-none");
  const baseUrl = baseUrlInput.value.trim();
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
    showToast({ title: "Error", body: err.message, color: "bg-danger" });
  } finally {
    loading.classList.add("d-none");
  }
});

copyBtn.addEventListener("click", () => navigator.clipboard.writeText(htmlOutput.innerHTML));
readBtn.addEventListener("click", () => speak(htmlOutput.innerHTML));
