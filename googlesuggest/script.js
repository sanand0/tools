import { html, render } from "https://cdn.jsdelivr.net/npm/lit-html/+esm";
import { asyncLLM } from "https://cdn.jsdelivr.net/npm/asyncllm@2";
import { marked } from "https://cdn.jsdelivr.net/npm/marked/+esm";
import { showToast } from "../common/toast.js";
import saveform from "https://cdn.jsdelivr.net/npm/saveform@1.2";

const COUNTRIES = {
  US: "United States",
  GB: "United Kingdom",
  CA: "Canada",
  AU: "Australia",
  NZ: "New Zealand",
  IE: "Ireland",
  ZA: "South Africa",
  IN: "India",
  SG: "Singapore",
  PH: "Philippines",
  PK: "Pakistan",
  NG: "Nigeria",
};

// --- DOM Elements ---
const searchTermInput = document.getElementById("searchTerm");
const fetchSuggestionsButton = document.getElementById("fetchSuggestions");
const resultsDiv = document.getElementById("results");
const loadingIndicator = document.getElementById("loadingIndicator");
const explainButton = document.getElementById("explainButton");
const searchHistoryDiv = document.getElementById("searchHistory");
const llmModelSelect = document.getElementById("llmModel");
const openaiBaseUrlInput = document.getElementById("openaiBaseUrl");
const openaiApiKeyInput = document.getElementById("openaiApiKey");
const llmResponseDiv = document.getElementById("llmResponse");
const llmResponseCard = document.getElementById("llmResponseCard");
const llmLoadingIndicator = document.getElementById("llmLoadingIndicator");
const systemPromptTextarea = document.getElementById("systemPrompt");
const resetPromptButton = document.getElementById("resetPrompt");
const copyResponseButton = document.getElementById("copyResponse");
saveform("#googlesuggest-form", { exclude: '[type="file"]' });

// --- Application State ---
let currentSuggestions = null;
let currentQuery = "";
let lastLLMResponse = "";

// --- Constants ---
const CACHE_VERSION = "v1.1";
const GOOGLE_SUGGEST_CACHE_PREFIX = `googleSuggest_${CACHE_VERSION}_`;
const SEARCH_HISTORY_KEY = `searchHistory_${CACHE_VERSION}`;
const DEFAULT_SYSTEM_PROMPT = `You are a humorous cultural commentator.
You will be given a keyword and the Google Search suggestion data for the keyword.
Analyze how people in different English-speaking countries might be searching for this term.
Provide a humorous interpretation of common themes, outliers (suggestions from a single country), and countries with unique or unusual perspectives on the search term.
Begin paragraphs with a **bold** summary of the paragraph for easy visual scanning.
Keep your analysis concise (around 200-250 words) and engaging.
Use simple language.`;

// --- UI Helper Functions ---
function setLoadingState(type, isLoading) {
  if (type === "suggestions") {
    loadingIndicator.classList.toggle("d-none", !isLoading);
    fetchSuggestionsButton.disabled = isLoading;
    if (isLoading) {
      explainButton.disabled = true;
      explainButton.textContent = "Explain This";
    }
  } else if (type === "llm") {
    llmLoadingIndicator.classList.toggle("d-none", !isLoading);
    explainButton.disabled = isLoading;
    explainButton.textContent = isLoading ? "Generating..." : "Explain This";
  }
}

function resetUIElements(areas = ["suggestions", "llm"]) {
  if (areas.includes("llm")) {
    llmResponseCard.classList.add("d-none");
    llmResponseDiv.innerHTML = "";
    copyResponseButton.classList.add("d-none");
    lastLLMResponse = "";
  }
}

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
  }
}

// --- Search History ---
function getSearchHistory() {
  return getFromCache(SEARCH_HISTORY_KEY) || [];
}

function addToSearchHistory(query) {
  if (!query || !query.trim()) return;
  let history = getSearchHistory();
  history = history.filter((item) => item !== query);
  history.unshift(query);
  if (history.length > 20) history.pop();
  setToCache(SEARCH_HISTORY_KEY, history);
  renderSearchHistory();
}

function renderSearchHistory() {
  const history = getSearchHistory();
  const historyElements = history.map((query) => {
    const termButton = document.createElement("button");
    termButton.type = "button";
    termButton.className = "btn btn-sm btn-outline-primary history-term-button";
    termButton.textContent = query;
    termButton.addEventListener("click", () => performSearchFromHistory(query));

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "btn btn-sm btn-outline-danger delete-history-item";
    deleteButton.innerHTML = '<i class="bi bi-x-lg"></i>';
    deleteButton.title = `Remove "${query}" from history`;
    deleteButton.addEventListener("click", (event) => {
      event.stopPropagation();
      removeSearchHistoryItem(query);
    });

    const group = document.createElement("div");
    group.className = "btn-group history-item-group me-2";
    group.appendChild(termButton);
    group.appendChild(deleteButton);
    return group;
  });

  searchHistoryDiv.innerHTML = "";
  historyElements.forEach((el) => searchHistoryDiv.appendChild(el));
}

function removeSearchHistoryItem(queryToRemove) {
  let history = getSearchHistory();
  history = history.filter((query) => query !== queryToRemove);
  setToCache(SEARCH_HISTORY_KEY, history);
  localStorage.removeItem(GOOGLE_SUGGEST_CACHE_PREFIX + queryToRemove.toLowerCase());
  console.log("Removed from history:", queryToRemove.toLowerCase());
  renderSearchHistory();
}

function performSearchFromHistory(query) {
  searchTermInput.value = query;
  handleFetchAction();
}

// --- Google Suggest ---
window.handleSuggestResponse = (data) => {
  // Global for JSONP
  window.currentGoogleSuggestData = data[1];
};

function fetchJsonp(url, timeout = 5000) {
  return new Promise((resolve) => {
    const script = document.createElement("script");
    let timerId;
    let completed = false; // Flag to prevent double resolve

    const cleanup = () => {
      if (completed) return;
      completed = true;
      clearTimeout(timerId);
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
      delete window.currentGoogleSuggestData;
    };

    script.src = url;
    window.currentGoogleSuggestData = null; // Reset before call

    script.onerror = () => {
      console.error(`Error loading script: ${url}`);
      cleanup();
      resolve({ error: "Failed to load script" });
    };

    script.onload = () => {
      const data = window.currentGoogleSuggestData;
      cleanup();
      resolve({ data: data || [], error: data ? null : "No data returned" });
    };

    timerId = setTimeout(() => {
      if (!completed) {
        console.warn(`Timeout fetching: ${url}`);
        cleanup();
        resolve({ error: "Timeout" });
      }
    }, timeout);

    document.head.appendChild(script);
  });
}

async function fetchGoogleSuggestions(query) {
  currentQuery = query;
  if (!query.trim()) {
    showToast({ title: "Input needed", body: "Please enter a search term.", color: "bg-danger" });
    return null;
  }

  const cacheKey = GOOGLE_SUGGEST_CACHE_PREFIX + query.toLowerCase();
  const cachedSuggestions = getFromCache(cacheKey);

  if (cachedSuggestions) {
    console.log("Serving Google suggestions from cache for:", query);
    currentSuggestions = cachedSuggestions;
    renderSuggestions(cachedSuggestions, query);
    explainButton.disabled = false;
    resetUIElements(["llm"]);
    addToSearchHistory(query);
    return cachedSuggestions;
  }

  setLoadingState("suggestions", true);
  resetUIElements(["suggestions", "llm"]);

  const suggestionsByCountry = {};
  const promises = Object.entries(COUNTRIES).map(async ([code, countryName]) => {
    const params = new URLSearchParams({
      client: "chrome", // for JS response
      callback: "handleSuggestResponse", // for JSONP
      hl: "en",
      gl: code,
      pws: 0, // personal-ised web search = off
      q: query,
    });
    const apiUrl = `https://suggestqueries.google.com/complete/search?${params}`;
    const response = await fetchJsonp(apiUrl);
    suggestionsByCountry[code] = {
      country: countryName,
      code,
      suggestions: response.data || [],
      error: response.error,
    };
  });

  await Promise.all(promises);
  setLoadingState("suggestions", false);

  if (Object.values(suggestionsByCountry).some((s) => s.suggestions.length > 0 && !s.error)) {
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
  const queryHeader = html`<h3 class="mb-3">Suggestions for "<em>${query}</em>"</h3>`;
  const countryCards = Object.entries(suggestionsByCountry).map(([code, data]) => {
    const countryName = data.country || COUNTRIES[code] || code;
    let content;
    if (data.error) {
      content = html`<p class="text-danger m-0">${data.error}</p>`;
    } else if (data.suggestions && data.suggestions.length > 0) {
      content = html` <ul class="suggestions-list">
        ${data.suggestions.map(
          (s) =>
            html`<li>
              <a
                href="https://www.google.com/search?q=${encodeURIComponent(s)}"
                target="_blank"
                rel="noopener noreferrer"
                >${s}</a
              >
            </li>`,
        )}
      </ul>`;
    } else {
      content = html`<p class="m-0"><em>No suggestions found.</em></p>`;
    }
    return html` <div class="col-xl-2 col-lg-3 col-md-4 col-sm-6 col-12 mb-4 d-flex align-items-stretch">
      <div class="card country-results-container w-100">
        <div class="card-header country-name">${countryName} (${code})</div>
        <div class="card-body py-0">${content}</div>
      </div>
    </div>`;
  });
  render(
    html`${queryHeader}
      <div class="row suggestions-grid">${countryCards}</div>`,
    resultsDiv,
  );
}

// --- LLM Interaction ---
const llmSettingInputs = {
  llm_model: { element: llmModelSelect, defaultValue: "openai/gpt-4.1-mini" },
  openai_base_url: { element: openaiBaseUrlInput, defaultValue: "https://api.openai.com/v1" },
  openai_api_key: { element: openaiApiKeyInput, defaultValue: "" },
  system_prompt: { element: systemPromptTextarea, defaultValue: DEFAULT_SYSTEM_PROMPT },
};

function loadLlmSettings() {
  for (const key in llmSettingInputs) {
    const setting = llmSettingInputs[key];
    setting.element.value = localStorage.getItem(key) || setting.defaultValue;
  }
}

function formatSuggestionsForLLMPrompt(suggestions, query) {
  let suggestionsText = `Google Search Suggestions for "${query}":\n\n`;
  for (const code in suggestions) {
    const countryData = suggestions[code];
    suggestionsText += `Country: ${countryData.country} (${code})\n`;
    if (countryData.error) {
      suggestionsText += `  Error: ${countryData.error}\n`;
    } else if (countryData.suggestions && countryData.suggestions.length > 0) {
      countryData.suggestions.forEach((sugg) => {
        suggestionsText += `  - ${sugg}\n`;
      });
    } else {
      suggestionsText += `  No suggestions found.\n`;
    }
    suggestionsText += "\n";
  }
  return suggestionsText;
}

async function fetchLLMExplanation(suggestions, query) {
  const model = llmModelSelect.value;
  let baseUrl = openaiBaseUrlInput.value.trim();
  const apiKey = openaiApiKeyInput.value.trim();

  if (!apiKey) {
    showToast({ title: "Missing key", body: "Please enter your OpenAI API Key.", color: "bg-danger" });
    return;
  }
  if (!baseUrl) {
    showToast({ title: "Missing base URL", body: "Please enter the OpenAI Base URL.", color: "bg-danger" });
    return;
  }

  resetUIElements(["llm"]); // Clear previous LLM response before new fetch
  setLoadingState("llm", true);
  llmResponseCard.classList.remove("d-none"); // Show card for loading indicator

  let effectiveModel =
    model.startsWith("openai/") && baseUrl.includes("api.openai.com") ? model.replace("openai/", "") : model;
  if (baseUrl.endsWith("/")) baseUrl = baseUrl.slice(0, -1);

  const suggestionsText = formatSuggestionsForLLMPrompt(suggestions, query);
  const systemPrompt = systemPromptTextarea.value.trim() || DEFAULT_SYSTEM_PROMPT;
  const userPrompt = `<keyword>${query}</keyword>\n\n<suggestions>\n${suggestionsText}\n</suggestions>`;

  try {
    let fullContent = "";
    // Corrected endpoint determination:
    const endpoint = `${baseUrl}/chat/completions`;

    for await (const { content } of asyncLLM(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: effectiveModel,
        stream: true,
        temperature: 0.7,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    })) {
      if (content) {
        fullContent = content;
        llmResponseDiv.innerHTML = marked.parse(fullContent);
      }
    }
    if (fullContent) {
      lastLLMResponse = fullContent;
      copyResponseButton.classList.remove("d-none");
    } else {
      llmResponseDiv.innerHTML = marked.parse("No response from LLM.");
    }
  } catch (error) {
    console.error("LLM API Error:", error);
    llmResponseDiv.innerHTML = `<p class="text-danger">Error fetching explanation: ${error.message}. Check console.</p>`;
  } finally {
    setLoadingState("llm", false);
  }
}

// --- Event Listeners ---
function handleFetchAction() {
  const query = searchTermInput.value;
  fetchGoogleSuggestions(query);
}

fetchSuggestionsButton.addEventListener("click", handleFetchAction);
searchTermInput.addEventListener("keypress", (event) => {
  if (event.key === "Enter") handleFetchAction();
});

explainButton.addEventListener("click", () => {
  if (currentSuggestions && Object.keys(currentSuggestions).length > 0 && currentQuery) {
    fetchLLMExplanation(currentSuggestions, currentQuery);
  } else {
    showToast({
      title: "No suggestions",
      body: "Please fetch some suggestions first for a valid query.",
      color: "bg-danger",
    });
  }
});

Object.keys(llmSettingInputs).forEach((key) => {
  const setting = llmSettingInputs[key];
  setting.element.addEventListener("change", (e) => localStorage.setItem(key, e.target.value));
});

document.querySelectorAll("#initialKeywords .history-item").forEach((button) => {
  button.addEventListener("click", () => {
    searchTermInput.value = button.textContent;
    handleFetchAction();
  });
});

resetPromptButton.addEventListener("click", () => {
  systemPromptTextarea.value = DEFAULT_SYSTEM_PROMPT;
  localStorage.setItem("system_prompt", DEFAULT_SYSTEM_PROMPT);
});

copyResponseButton.addEventListener("click", async () => {
  if (!lastLLMResponse) return;
  try {
    await navigator.clipboard.writeText(lastLLMResponse);
    showToast({ title: "Copied", body: "LLM response copied", color: "bg-success" });
  } catch {
    showToast({ title: "Copy error", body: "Unable to copy text", color: "bg-danger" });
  }
});

// --- Initial Load ---
function init() {
  loadLlmSettings();
  renderSearchHistory();
  resetUIElements(["suggestions", "llm"]); // Set initial placeholder for suggestions
  console.log("Google Suggest Explorer Initialized with Caching and History.");
}

init();
