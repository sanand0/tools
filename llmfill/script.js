import saveform from "https://cdn.jsdelivr.net/npm/saveform@1.2";
import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";

const form = document.getElementById("fill-form");
const sentenceInput = document.getElementById("sentence");
const tokensDiv = document.getElementById("tokens");
const modelInput = document.getElementById("model");
const keyInput = document.getElementById("openai-key");
const baseUrlInput = document.getElementById("openai-base-url");
const logDiv = document.getElementById("logprobs");

let tokens = [];

function splitText(text) {
  return (text.match(/\w+|[^\w\s]+|\s+/g) || []).map((t) => ({ text: t, blank: false }));
}

function renderTokens() {
  tokensDiv.innerHTML = "";
  tokens.forEach((t, i) => {
    if (/\s+/.test(t.text)) {
      tokensDiv.append(t.text);
    } else {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn btn-sm btn-outline-secondary me-1 mb-1";
      btn.textContent = t.blank ? "_____" : t.text;
      btn.addEventListener("click", () => fillToken(i));
      tokensDiv.append(btn);
    }
  });
}

async function fillToken(i) {
  tokens[i].blank = true;
  renderTokens();
  const prefix = tokens
    .slice(0, i)
    .map((t) => t.text)
    .join("");
  const suffix = tokens
    .slice(i + 1)
    .map((t) => t.text)
    .join("");

  const body = {
    model: modelInput.value.trim(),
    max_tokens: 5,
    logprobs: true,
    top_logprobs: 20,
    messages: [
      { role: "system", content: "Fill in the blank with just the missing words." },
      { role: "user", content: `${prefix}<|fim_middle|>${suffix}` },
    ],
  };

  const endpoint = baseUrlInput.value.replace(/\/$/, "") + "/chat/completions";

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${keyInput.value.trim()}`,
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    const choice = data.choices?.[0];
    const word = choice.message.content.trim();
    tokens[i] = { text: word, blank: false };
    renderTokens();
    showLogprobs(choice.logprobs?.content);
  } catch (err) {
    alert("Error: " + err.message);
  }
}

function showLogprobs(items) {
  if (!items) {
    logDiv.textContent = "";
    return;
  }
  const color = d3.scaleSequential(d3.interpolateReds).domain([0, -20]);
  logDiv.innerHTML = items
    .map(
      (d) =>
        `<span class="badge me-1 mb-1" style="background:${color(d.logprob)}">${d.token} ${d.logprob.toFixed(2)}</span>`,
    )
    .join(" ");
}

sentenceInput.addEventListener("input", () => {
  tokens = splitText(sentenceInput.value);
  renderTokens();
  logDiv.textContent = "";
});

document.addEventListener("DOMContentLoaded", () => {
  saveform("#fill-form");
  tokens = splitText(sentenceInput.value);
  renderTokens();
});
