import { html, render } from "https://cdn.jsdelivr.net/npm/lit-html/+esm";
import { asyncLLM } from "https://cdn.jsdelivr.net/npm/asyncllm@2";
import { marked } from "https://cdn.jsdelivr.net/npm/marked@12";

const COUNTRIES = {
  US: "United States", GB: "United Kingdom", CA: "Canada", AU: "Australia", NZ: "New Zealand",
  IE: "Ireland", ZA: "South Africa", IN: "India", SG: "Singapore", PH: "Philippines",
};

const searchTermInput = document.getElementById("searchTerm");
const fetchSuggestionsButton = document.getElementById("fetchSuggestions");
const resultsDiv = document.getElementById("results");
const loadingIndicator = document.getElementById("loadingIndicator");
const explainButton = document.getElementById("explainButton");
const initialKeywordsContainer = document.getElementById("initialKeywords");
const searchHistoryDiv = document.getElementById("searchHistory");

const llmModelSelect = document.getElementById("llmModel");
const openaiBaseUrlInput = document.getElementById("openaiBaseUrl");
const openaiApiKeyInput = document.getElementById("openaiApiKey");
const llmResponseDiv = document.getElementById("llmResponse");
const llmResponseCard = document.getElementById("llmResponseCard");
const llmLoadingIndicator = document.getElementById("llmLoadingIndicator");

let currentSuggestions = null;
let currentQuery = "";

const CACHE_VERSION = "v1.1"; // Increment to invalidate old caches if structure changes significantly
const GOOGLE_SUGGEST_CACHE_PREFIX = `googleSuggest_${CACHE_VERSION}_`;
const LLM_EXPLANATION_CACHE_PREFIX = `llmExplanation_${CACHE_VERSION}_`;
const SEARCH_HISTORY_KEY = `searchHistory_${CACHE_VERSION}`;

// --- Caching Functions ---
function getFromCache(key) {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : null;
  } catch (e) {
    console.error("Error reading from cache", e);
    return null;
  }
}

function setToCache(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error("Error writing to cache", e);
    // Potentially handle quota exceeded errors more gracefully
  }
}

// --- Search History ---
function getSearchHistory() {
  return getFromCache(SEARCH_HISTORY_KEY) || [];
}

function addToSearchHistory(query) {
  if (!query || !query.trim()) return;
  let history = getSearchHistory();
  // Remove if already exists to move it to the top (most recent)
  history = history.filter(item => item !== query);
  history.unshift(query); // Add to the beginning
  if (history.length > 20) history.pop(); // Keep history to a reasonable size
  setToCache(SEARCH_HISTORY_KEY, history);
  renderSearchHistory();
}

function renderSearchHistory() {
  const history = getSearchHistory();
  const historyButtons = history.map(query =>
    html`<button type="button" class="btn btn-sm btn-outline-info history-item me-1 mb-1" @click=${() => performSearchFromHistory(query)}>${query}</button>`
  );
  render(html`${historyButtons}`, searchHistoryDiv);
}

function performSearchFromHistory(query) {
  searchTermInput.value = query;
  handleFetchAction();
}

// Attach event listeners to initial keywords
document.querySelectorAll("#initialKeywords .history-item").forEach(button => {
  button.addEventListener("click", () => {
    searchTermInput.value = button.textContent;
    handleFetchAction();
  });
});


// --- Google Suggest ---
window.handleSuggestResponse = (data) => {
  window.currentGoogleSuggestData = data[1];
};

async function fetchGoogleSuggestions(query) {
  currentQuery = query; // Store current query
  if (!query.trim()) {
    alert("Please enter a search term.");
    return null;
  }

  const cacheKey = GOOGLE_SUGGEST_CACHE_PREFIX + query.toLowerCase();
  const cachedSuggestions = getFromCache(cacheKey);
  if (cachedSuggestions) {
    console.log("Serving Google suggestions from cache for:", query);
    currentSuggestions = cachedSuggestions;
    renderSuggestions(cachedSuggestions, query);
    explainButton.disabled = false;
    document.getElementById("llmResponseCard").classList.add("d-none");
    document.getElementById("llmResponse").innerHTML = "";
    addToSearchHistory(query); // Ensure it's in history even if served from cache
    return cachedSuggestions;
  }

  loadingIndicator.classList.remove("d-none");
  fetchSuggestionsButton.disabled = true;
  explainButton.disabled = true;
  explainButton.textContent = "Explain This";
  resultsDiv.innerHTML = "";
  document.getElementById("llmResponseCard").classList.add("d-none");
  document.getElementById("llmResponse").innerHTML = "";

  const suggestionsByCountry = {};
  let allFetchesSuccessful = true;

  for (const code in COUNTRIES) {
    const countryName = COUNTRIES[code];
    const script = document.createElement("script");
    const promise = new Promise((resolve, reject) => {
      window.currentGoogleSuggestData = null;
      script.src = `https://suggestqueries.google.com/complete/search?client=firefox&hl=en&gl=${code}&q=${encodeURIComponent(query)}&callback=handleSuggestResponse`;
      script.onerror = () => {
        console.error(`Error fetching suggestions for ${countryName}`);
        resolve({ country: countryName, code, suggestions: [], error: "Failed to load" });
      };
      script.onload = () => {
        resolve({ country: countryName, code, suggestions: window.currentGoogleSuggestData || [], error: window.currentGoogleSuggestData ? null : "No data" });
      };
      // Timeout for JSONP
      setTimeout(() => {
        if (!window.currentGoogleSuggestData && !script.completed) { // Check if it hasn't completed
            console.warn(`Timeout fetching suggestions for ${countryName}`);
            resolve({ country: countryName, code, suggestions: [], error: "Timeout" });
            script.completed = true; // Mark as completed to avoid double resolve
            if (script.parentNode) script.parentNode.removeChild(script); // Clean up
            delete window.currentGoogleSuggestData;
        }
      }, 5000); // 5 second timeout
    });
    document.head.appendChild(script);
    try {
      const result = await promise;
      suggestionsByCountry[code] = result;
      if (result.error) allFetchesSuccessful = false;
    } catch (error) {
      suggestionsByCountry[code] = { country: countryName, code, suggestions: [], error: error.message };
      allFetchesSuccessful = false;
    } finally {
      if (script.parentNode) script.parentNode.removeChild(script);
      delete window.currentGoogleSuggestData;
      script.completed = true; // Mark as completed
    }
  }

  loadingIndicator.classList.add("d-none");
  fetchSuggestionsButton.disabled = false;

  if (Object.keys(suggestionsByCountry).length > 0 && Object.values(suggestionsByCountry).some(s => s.suggestions.length > 0 && !s.error)) {
    currentSuggestions = suggestionsByCountry;
    setToCache(cacheKey, suggestionsByCountry);
    renderSuggestions(suggestionsByCountry, query);
    explainButton.disabled = false;
    addToSearchHistory(query);
  } else {
    resultsDiv.innerHTML = `<p class="text-danger">Could not fetch any valid suggestions for "${query}". Please check your internet connection or try a different query.</p>`;
    currentSuggestions = null;
    explainButton.disabled = true;
  }
  return suggestionsByCountry;
}

function renderSuggestions(suggestionsByCountry, query) {
  const queryHeader = html`<h3>Suggestions for "<em>${query}</em>"</h3>`;
  const templates = Object.entries(suggestionsByCountry).map(([code, data]) => {
    if (data.error) {
      return html`
        <div class="country-results card mb-3">
          <div class="card-header country-name">${data.country} (${code}) - <span class="text-danger">Error</span></div>
          <div class="card-body"><p class="text-danger">${data.error}</p></div>
        </div>`;
    }
    return html`
      <div class="country-results card mb-3">
        <div class="card-header country-name">${data.country} (${code})</div>
        <div class="card-body">
          ${data.suggestions && data.suggestions.length > 0
            ? html`<ul class="suggestions-list">${data.suggestions.map((s) => html`<li>${s}</li>`)}</ul>`
            : html`<p><em>No suggestions found.</em></p>`}
        </div>
      </div>`;
  });
  render(html`${queryHeader}${templates}`, resultsDiv);
}

// --- LLM Interaction ---
openaiBaseUrlInput.value = localStorage.getItem("openai_base_url") || "https://api.openai.com/v1";
openaiApiKeyInput.value = localStorage.getItem("openai_api_key") || "";
llmModelSelect.value = localStorage.getItem("llm_model") || "openai/gpt-4.1";

openaiBaseUrlInput.addEventListener("change", (e) => localStorage.setItem("openai_base_url", e.target.value));
openaiApiKeyInput.addEventListener("change", (e) => localStorage.setItem("openai_api_key", e.target.value));
llmModelSelect.addEventListener("change", (e) => localStorage.setItem("llm_model", e.target.value));

async function fetchLLMExplanation(suggestions, query) {
  const model = llmModelSelect.value;
  let baseUrl = openaiBaseUrlInput.value.trim();
  const apiKey = openaiApiKeyInput.value.trim();

  if (!apiKey) { alert("Please enter your OpenAI API Key."); return; }
  if (!baseUrl) { alert("Please enter the OpenAI Base URL."); return; }

  // Simple hash for suggestions object to use in cache key
  // This is not cryptographically secure, just a simple way to get a somewhat unique string
  const suggestionsHash = JSON.stringify(suggestions).split("").reduce((a,b)=>{a=((a<<5)-a)+b.charCodeAt(0);return a&a},0).toString(16);
  const cacheKey = LLM_EXPLANATION_CACHE_PREFIX + query.toLowerCase() + "_" + model + "_" + suggestionsHash;
  const cachedExplanation = getFromCache(cacheKey);

  if (cachedExplanation) {
    console.log("Serving LLM explanation from cache for:", query, model);
    llmResponseCard.classList.remove("d-none");
    llmResponseDiv.innerHTML = marked.parse(cachedExplanation);
    llmLoadingIndicator.classList.add("d-none");
    explainButton.disabled = false;
    explainButton.textContent = "Explain This";
    return;
  }

  let effectiveModel = model;
  if (model.startsWith("openai/") && baseUrl.includes("api.openai.com")) {
    effectiveModel = model.replace("openai/", "");
  }
  if (baseUrl.endsWith("/v1")) { /* keep /v1 */ }
  else if (baseUrl.endsWith("/")) { baseUrl = baseUrl.slice(0, -1); }


  let suggestionsText = `Google Search Suggestions for "${query}":\n\n`;
  for (const code in suggestions) {
    const countryData = suggestions[code];
    suggestionsText += `Country: ${countryData.country} (${code})\n`;
    if (countryData.error) suggestionsText += `  Error: ${countryData.error}\n`;
    else if (countryData.suggestions && countryData.suggestions.length > 0) {
      countryData.suggestions.forEach(sugg => { suggestionsText += `  - ${sugg}\n`; });
    } else suggestionsText += `  No suggestions found.\n`;
    suggestionsText += "\n";
  }

  const promptContent = `You are a witty and insightful cultural commentator.
Based on the following Google Search suggestion data for the keyword "${query}", analyze how people in different English-speaking countries might be searching for this term.
Provide a humorous interpretation of the differences or similarities you observe.
Format your response using Markdown with emphasis (bold, italics) for easy visual scanning.
Keep your analysis concise and engaging. Max 200 words.

${suggestionsText}`;

  llmResponseCard.classList.remove("d-none");
  llmResponseDiv.innerHTML = "";
  llmLoadingIndicator.classList.remove("d-none");
  explainButton.disabled = true;
  explainButton.textContent = "Generating...";

  try {
    let fullContent = "";
    const endpoint = baseUrl.endsWith("/v1") ? `${baseUrl}/chat/completions` : `${baseUrl}/chat/completions`;

    for await (const { content } of asyncLLM(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: effectiveModel, stream: true, temperature: 0.7, messages: [{ role: "user", content: promptContent }]}),
    })) {
      if (content) {
        fullContent = content;
        llmResponseDiv.innerHTML = marked.parse(fullContent);
      }
    }
    llmResponseDiv.innerHTML = marked.parse(fullContent || "No response from LLM.");
    if (fullContent) {
        setToCache(cacheKey, fullContent); // Cache successful response
    }
  } catch (error) {
    console.error("LLM API Error:", error);
    llmResponseDiv.innerHTML = `<p class="text-danger">Error fetching explanation: ${error.message}. Check console.</p>`;
  } finally {
    llmLoadingIndicator.classList.add("d-none");
    explainButton.disabled = false;
    explainButton.textContent = "Explain This";
  }
}

// --- Event Listeners ---
function handleFetchAction() {
    const query = searchTermInput.value;
    fetchGoogleSuggestions(query);
}

fetchSuggestionsButton.addEventListener("click", handleFetchAction);
searchTermInput.addEventListener("keypress", (event) => {
    if (event.key === "Enter") {
        handleFetchAction();
    }
});

explainButton.addEventListener("click", () => {
  if (currentSuggestions && Object.keys(currentSuggestions).length > 0 && currentQuery) {
    fetchLLMExplanation(currentSuggestions, currentQuery);
  } else {
    alert("Please fetch some suggestions first for a valid query.");
  }
});

// --- Initial Load ---
function init() {
  renderSearchHistory();
  // Load last search term if desired, or leave blank
  // const lastSearch = getSearchHistory()[0];
  // if (lastSearch) {
  //   searchTermInput.value = lastSearch;
  //   handleFetchAction();
  // }
  console.log("Google Suggest Explorer Initialized with Caching and History.");
}

init();
