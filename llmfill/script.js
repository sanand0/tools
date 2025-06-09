import { asyncLLM } from "https://cdn.jsdelivr.net/npm/asyncllm@2";
import saveform from "https://cdn.jsdelivr.net/npm/saveform@1.2";
import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";

const form = document.getElementById("llm-form");
const sentenceInput = document.getElementById("sentence-input");
const tokensContainer = document.getElementById("tokens-container");
const logprobsContainer = document.getElementById("logprobs-container");
const loading = document.getElementById("loading");

const apiKeyInput = document.getElementById("api-key");
const apiBaseInput = document.getElementById("api-base");
const modelInput = document.getElementById("model");

let tokens = [];
let saved;

document.addEventListener("DOMContentLoaded", () => {
  saved = saveform("#llm-form", { exclude: '[type="file"]' });
  updateTokens();
});

function split(text) {
  return text.match(/[\w']+|[^\w\s]+/g) || [];
}

function renderTokens() {
  tokensContainer.innerHTML = tokens
    .map(
      (t, i) => `
      <button type="button" class="btn btn-sm ${t.blank ? "btn-primary" : "btn-outline-secondary"} m-1" data-idx="${i}">
        ${t.blank ? "_______" : t.text}
      </button>`,
    )
    .join(" ");
}

function updateTokens() {
  tokens = split(sentenceInput.value).map((t) => ({ text: t, blank: false }));
  renderTokens();
  logprobsContainer.innerHTML = "";
}

sentenceInput.addEventListener("input", updateTokens);

tokensContainer.addEventListener("click", (e) => {
  const idx = e.target.dataset.idx;
  if (idx === undefined) return;
  tokens[idx].blank = !tokens[idx].blank;
  renderTokens();
  logprobsContainer.innerHTML = "";
  if (tokens[idx].blank) fillBlank(idx);
});

function modelName() {
  const base = apiBaseInput.value.trim();
  let m = modelInput.value.trim();
  if (m.startsWith("openai/") && base.includes("api.openai.com"))
    m = m.replace("openai/", "");
  return m;
}

async function fillBlank(idx) {
  const apiKey = apiKeyInput.value.trim();
  const baseUrl = apiBaseInput.value.trim().replace(/\/$/, "");
  if (!apiKey || !baseUrl) return;

  const prompt = tokens.map((t, i) => (i === idx ? "_____" : t.text)).join(" ");

  loading.classList.remove("d-none");
  const filled = [];
  const probs = [];

  try {
    for await (const chunk of asyncLLM(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelName(),
        stream: true,
        max_tokens: 5,
        logprobs: true,
        top_logprobs: 20,
        messages: [
          {
            role: "system",
            content:
              "Fill in the blank in the sentence. Reply with only the missing text.",
          },
          { role: "user", content: prompt },
        ],
      }),
    })) {
      const choice = chunk.choices?.[0];
      if (!choice) continue;
      const delta = choice.delta?.content;
      const lp = choice.logprobs?.content?.[0];
      if (delta) filled.push(delta);
      if (lp) probs.push(lp);
    }
    tokens[idx] = { text: filled.join("").trim(), blank: false };
    renderTokens();
    renderLogprobs(probs);
  } catch (e) {
    logprobsContainer.innerHTML = `<div class="alert alert-danger">${e.message}</div>`;
  } finally {
    loading.classList.add("d-none");
  }
}

function renderLogprobs(probs) {
  logprobsContainer.innerHTML = "";
  if (!probs.length) return;
  const color = d3.scaleSequential(d3.interpolateReds).domain([-20, 0]);
  probs.forEach((p) => {
    const rows = p.top_logprobs
      .map((tp) => {
        const prob = Math.exp(tp.logprob);
        const display =
          prob > 0.001 ? `${(prob * 100).toFixed(1)}%` : prob.toExponential(2);
        const bg = color(Math.max(-20, Math.min(0, tp.logprob)));
        const style = `background:${bg};color:${tp.logprob < -10 ? "#fff" : "#000"}`;
        return `<tr><td>${tp.token}</td><td style="${style}">${display}</td></tr>`;
      })
      .join("");
    logprobsContainer.insertAdjacentHTML(
      "beforeend",
      `<table class="table table-bordered me-2 mb-2 small w-auto"><thead><tr><th colspan="2" class="text-center">${p.token}</th></tr></thead><tbody>${rows}</tbody></table>`,
    );
  });
}
