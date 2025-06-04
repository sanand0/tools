import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";

let quotes = [];
let models = [];
let currentPair = {};

// Load and process the data
const data = await d3.csv("quotes.csv");
quotes = data;
models = [...new Set(quotes.map((d) => d.Model))];

// Initialize or load results from localStorage
let results = JSON.parse(localStorage.getItem("quoteResults")) || {};
models.forEach((m1) => {
  if (!results[m1]) results[m1] = {};
  models.forEach((m2) => {
    if (m1 < m2 && !results[m1][m2]) results[m1][m2] = { wins: 0, total: 0 };
  });
});

function getRandomQuotes() {
  let row1, row2;
  do {
    row1 = quotes[Math.floor(Math.random() * quotes.length)];
    row2 = quotes[Math.floor(Math.random() * quotes.length)];
  } while (row1.Model === row2.Model);
  if (row1.Model > row2.Model) [row1, row2] = [row2, row1];
  return { m1: row1.Model, m2: row2.Model, q1: row1.Quote, q2: row2.Quote };
}

function displayQuotes() {
  currentPair = getRandomQuotes();
  document.getElementById("comparison").classList.toggle("flex-row-reverse", Math.random() > 0.5);
  document.getElementById("q1").textContent = currentPair.q1;
  document.getElementById("q2").textContent = currentPair.q2;
}

window.vote = function (choice) {
  const { m1, m2 } = currentPair;
  results[m1][m2].total++;
  if (choice === "A") results[m1][m2].wins++;
  else if (choice === "B") results[m1][m2].wins--;

  localStorage.setItem("quoteResults", JSON.stringify(results));
  displayQuotes();
  updateResults();
};

function updateResults() {
  // Calculate win percentages
  const wins = {};
  const games = {};
  for (let m1 in results)
    for (let m2 in results[m1]) {
      wins[m1] = results[m1][m2].wins + (wins[m1] ?? 0);
      wins[m2] = (wins[m2] ?? 0) - results[m1][m2].wins;
      games[m1] = results[m1][m2].total + (games[m1] ?? 0);
      games[m2] = results[m1][m2].total + (games[m2] ?? 0);
    }

  // Display win percentages
  document.getElementById("winStats").innerHTML = models
    .map((model) => {
      const percentage = (wins[model] / games[model]) * 100;
      return `<div>${model}: ${percentage.toFixed(1)}% (${games[model]} games)</div>`;
    })
    .join("");
}

// Tab switching logic
document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");

    const tabId = tab.dataset.tab;
    document.getElementById("comparison").classList.toggle("d-none", tabId !== "comparison");
    document.getElementById("results").classList.toggle("d-none", tabId !== "results");
    if (tabId === "results") updateResults();
  });
});

// Initial display
displayQuotes();
