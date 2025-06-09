import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";

const sentenceInput = document.getElementById("sentenceInput");
const tokensContainer = document.getElementById("tokensContainer");
const logprobTableBody = document.querySelector("#logprobTable tbody");
const sentenceAInput = document.getElementById("sentenceA");
const sentenceBInput = document.getElementById("sentenceB");
const tokensAContainer = document.getElementById("tokensA");
const tokensBContainer = document.getElementById("tokensB");
const scatterSvg = document.getElementById("scatterPlot");
const modelInput = document.getElementById("modelInput");
const baseUrlInput = document.getElementById("baseUrlInput");
const apiKeyInput = document.getElementById("apiKeyInput");

let tokens = [];
let blankIndex = -1;
let tokensA = [];
let tokensB = [];
let blankIndexA = -1;
let blankIndexB = -1;

function tokenize(text) {
  return text.match(/\w+|[^\s\w]/g) || [];
}

function renderTokens() {
  tokensContainer.innerHTML = "";
  tokens.forEach((t, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn-outline-secondary btn-sm m-1";
    btn.textContent = i === blankIndex ? "____" : t;
    btn.addEventListener("click", () => selectBlank(i));
    tokensContainer.appendChild(btn);
  });
}

function selectBlank(i) {
  blankIndex = i;
  renderTokens();
  fetchCompletion();
}

function renderTokensCompare() {
  tokensAContainer.innerHTML = "";
  tokensA.forEach((t, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn-outline-secondary btn-sm m-1";
    btn.textContent = i === blankIndexA ? "____" : t;
    btn.addEventListener("click", () => selectBlankCompare("A", i));
    tokensAContainer.appendChild(btn);
  });
  tokensBContainer.innerHTML = "";
  tokensB.forEach((t, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn-outline-secondary btn-sm m-1";
    btn.textContent = i === blankIndexB ? "____" : t;
    btn.addEventListener("click", () => selectBlankCompare("B", i));
    tokensBContainer.appendChild(btn);
  });
}

function selectBlankCompare(which, i) {
  if (which === "A") {
    blankIndexA = i;
  } else {
    blankIndexB = i;
  }
  renderTokensCompare();
  fetchComparison();
}

function init() {
  tokens = tokenize(sentenceInput.value);
  blankIndex = Math.floor(Math.random() * tokens.length);
  renderTokens();
  fetchCompletion();
}

sentenceInput.addEventListener("input", init);

function initCompare() {
  tokensA = tokenize(sentenceAInput.value);
  tokensB = tokenize(sentenceBInput.value);
  blankIndexA = Math.floor(Math.random() * tokensA.length);
  blankIndexB = Math.floor(Math.random() * tokensB.length);
  renderTokensCompare();
  fetchComparison();
}

sentenceAInput?.addEventListener("input", initCompare);
sentenceBInput?.addEventListener("input", initCompare);

async function fetchCompletion() {
  if (blankIndex === -1 || !apiKeyInput.value) return;
  const prompt = tokens.map((t, i) => (i === blankIndex ? "____" : t)).join(" ");
  const body = {
    model: modelInput.value,
    messages: [
      {
        role: "system",
        content: "Return only the missing word in the user's sentence.",
      },
      { role: "user", content: prompt },
    ],
    max_tokens: 1,
    logprobs: true,
    top_logprobs: 5,
    stream: false,
  };

  try {
    const res = await fetch(`${baseUrlInput.value.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKeyInput.value}`,
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    const word = (data.choices?.[0]?.message?.content || data.choices?.[0]?.text || "").trim();
    if (word) tokens[blankIndex] = word;
    renderTokens();
    const probs = data.choices?.[0]?.logprobs?.content?.[0]?.top_logprobs || {};
    displayLogprobs(probs);
  } catch (err) {
    console.error(err);
  }
}

function displayLogprobs(probs) {
  logprobTableBody.innerHTML = "";
  const entries = Object.entries(probs);
  if (!entries.length) return;
  const values = entries.map(([, p]) => p);
  const scale = d3.scaleSequential(d3.interpolateBlues).domain([Math.min(...values), 0]);
  entries.forEach(([token, prob]) => {
    const row = document.createElement("tr");
    row.innerHTML = `<td>${token}</td><td style="background-color:${scale(prob)}">${prob.toFixed(4)}</td>`;
    logprobTableBody.appendChild(row);
  });
}

async function fetchLogprobs(tokens, index) {
  const prompt = tokens.map((t, i) => (i === index ? "____" : t)).join(" ");
  const body = {
    model: modelInput.value,
    messages: [
      {
        role: "system",
        content: "Return only the missing word in the user's sentence.",
      },
      { role: "user", content: prompt },
    ],
    max_tokens: 1,
    logprobs: true,
    top_logprobs: 50,
    stream: false,
  };

  const res = await fetch(`${baseUrlInput.value.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKeyInput.value}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  const word = (data.choices?.[0]?.message?.content || data.choices?.[0]?.text || "").trim();
  if (word) tokens[index] = word;
  return data.choices?.[0]?.logprobs?.content?.[0]?.top_logprobs || {};
}

async function fetchComparison() {
  if (blankIndexA === -1 || blankIndexB === -1 || !apiKeyInput.value) return;
  const [probsA, probsB] = await Promise.all([
    fetchLogprobs(tokensA, blankIndexA),
    fetchLogprobs(tokensB, blankIndexB),
  ]);
  renderTokensCompare();
  drawScatter(probsA, probsB);
}

function drawScatter(probsA, probsB) {
  const tokens = Object.keys(probsA).filter((t) => t in probsB);
  scatterSvg.innerHTML = "";
  if (!tokens.length) return;
  const width = +scatterSvg.getAttribute("width");
  const height = +scatterSvg.getAttribute("height");
  const margin = 40;
  const xVals = tokens.map((t) => probsA[t]);
  const yVals = tokens.map((t) => probsB[t]);
  const x = d3
    .scaleLinear()
    .domain([Math.min(...xVals), 0])
    .range([margin, width - margin]);
  const y = d3
    .scaleLinear()
    .domain([Math.min(...yVals), 0])
    .range([height - margin, margin]);
  const svg = d3.select(scatterSvg);
  svg
    .append("g")
    .attr("transform", `translate(0,${height - margin})`)
    .call(d3.axisBottom(x));
  svg.append("g").attr("transform", `translate(${margin},0)`).call(d3.axisLeft(y));
  svg
    .selectAll("text.token")
    .data(tokens)
    .enter()
    .append("text")
    .attr("class", "token")
    .attr("x", (d) => x(probsA[d]))
    .attr("y", (d) => y(probsB[d]))
    .text((d) => d)
    .attr("font-size", "0.75rem")
    .attr("text-anchor", "middle");
  svg
    .append("text")
    .attr("x", width / 2)
    .attr("y", height - 5)
    .attr("text-anchor", "middle")
    .text("Log prob A");
  svg
    .append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2)
    .attr("y", 15)
    .attr("text-anchor", "middle")
    .text("Log prob B");
}

init();
initCompare();
