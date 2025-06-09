import { getProfile } from "https://aipipe.org/aipipe.js";
import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";

const { token } = getProfile();
if (!token) window.location = `https://aipipe.org/login?redirect=${location.href}`;

const sentenceInput = document.getElementById("sentenceInput");
const tokensDiv = document.getElementById("tokens");
const modelInput = document.getElementById("modelInput");
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
      const span = document.createElement("span");
      span.textContent = t.blank ? "_____" : t.text;
      span.className = "user-select-none";
      span.addEventListener("click", () => fillToken(i));
      tokensDiv.append(span);
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
    messages: [
      {
        role: "system",
        content: "Fill in the blank with just the missing words.",
      },
      { role: "user", content: `${prefix}<|fim_middle|>${suffix}` },
    ],
  };
  try {
    const response = await fetch("https://aipipe.org/openrouter/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    }).then((r) => r.json());
    const choice = response.choices?.[0];
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
  const color = d3.scaleSequential(d3.interpolateReds).domain([-20, 0]);
  logDiv.innerHTML = items
    .map((d) => `<span style="background:${color(d.logprob)}">${d.token} ${d.logprob.toFixed(2)}</span>`)
    .join(" ");
}

sentenceInput.addEventListener("input", () => {
  tokens = splitText(sentenceInput.value);
  renderTokens();
  logDiv.textContent = "";
});

tokens = splitText(sentenceInput.value);
renderTokens();
