import { asyncLLM } from "https://cdn.jsdelivr.net/npm/asyncllm@2";
import saveform from "https://cdn.jsdelivr.net/npm/saveform@1.2";
import { openaiConfig } from "https://cdn.jsdelivr.net/npm/bootstrap-llm-provider@1";
import { html, render } from "https://cdn.jsdelivr.net/npm/lit-html@3";
import { openaiHelp } from "../common/aiconfig.js";
import { createActivityClient } from "./activity.js";

const DEFAULT_BASE_URLS = [
  "https://api.openai.com/v1",
  "https://aipipe.org/api/v1",
  "https://llmfoundry.straivedemo.com/openai/v1",
  "https://llmfoundry.straive.com/openai/v1",
];

// IndexedDB cache management
const DB_NAME = "github-cache";
const DB_VERSION = 1;
const STORE_NAME = "urls";
const CACHE_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days

let db = null;
let activityClient;
let fetchedActivity = { activity: [], repos: [] };
let fetchedContext = {};
const progressState = {
  repos: { current: 0, total: 0 },
  commits: { current: 0, total: 0 },
  currentRepo: "",
};

const openaiConfigBtn = document.getElementById("openai-config-btn");
openaiConfigBtn.addEventListener("click", async () => {
  await openaiConfig({ defaultBaseUrls: DEFAULT_BASE_URLS, show: true, help: openaiHelp });
});

async function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      const store = db.createObjectStore(STORE_NAME, { keyPath: "url" });
      store.createIndex("timestamp", "timestamp");
    };
  });
}

async function clearCache() {
  if (!db) await initDB();
  const transaction = db.transaction([STORE_NAME], "readwrite");
  const store = transaction.objectStore(STORE_NAME);
  await store.clear();
}

async function getCached(url) {
  if (!db) await initDB();
  const transaction = db.transaction([STORE_NAME], "readonly");
  const store = transaction.objectStore(STORE_NAME);
  const request = store.get(url);
  return new Promise((resolve) => {
    request.onsuccess = () => {
      const result = request.result;
      if (result && Date.now() - result.timestamp < CACHE_TTL) {
        resolve(result.data);
      } else {
        resolve(null);
      }
    };
    request.onerror = () => resolve(null);
  });
}

async function setCached(url, data) {
  if (!db) await initDB();
  const transaction = db.transaction([STORE_NAME], "readwrite");
  const store = transaction.objectStore(STORE_NAME);
  await store.put({ url, data, timestamp: Date.now() });
}

// Fetch with caching
async function fetchWithCache(url, options = {}) {
  const cached = await getCached(url);
  if (cached) return cached;

  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

  const data = await response.json();
  await setCached(url, data);
  return data;
}

// Progress tracking
function createProgressBar(id, label) {
  const container = document.getElementById("progress-container");
  const html = `
                <div class="mb-3">
                    <label class="form-label" id="${id}-label">${label}</label>
                    <div class="progress">
                        <div id="${id}" class="progress-bar" role="progressbar" style="width: 0%">0%</div>
                    </div>
                </div>
            `;
  container.insertAdjacentHTML("beforeend", html);
}

function updateProgress(id, current, total) {
  const progressBar = document.getElementById(id);
  const safeTotal = Math.max(total || 0, 1);
  const percent = Math.round((current / safeTotal) * 100);
  progressBar.style.width = `${percent}%`;
  progressBar.textContent = `${percent}%`;
}

function resetProgressState() {
  progressState.repos.current = 0;
  progressState.repos.total = 0;
  progressState.commits.current = 0;
  progressState.commits.total = 0;
  progressState.currentRepo = "";
}

function createActivityProgressBars() {
  resetProgressState();
  createProgressBar("repos-progress", "Discovering contributed repositories");
  createProgressBar("commits-progress", "Fetching commits");
}

function handleActivityProgress(update) {
  if (update.stage === "repos") {
    if (typeof update.total === "number") progressState.repos.total = update.total;
    if (typeof update.current === "number") progressState.repos.current = update.current;
    if (update.repo) {
      const label = document.getElementById("repos-progress-label");
      if (label) {
        const repoUrl = `https://github.com/${update.repo}`;
        label.innerHTML = `Discovering contributed repositories — <a href="${repoUrl}" target="_blank" rel="noopener noreferrer">${update.repo}</a>`;
      }
    }
    updateProgress("repos-progress", progressState.repos.current, progressState.repos.total);
  }

  if (update.stage === "commits") {
    if (update.repo && update.repo !== progressState.currentRepo) {
      progressState.currentRepo = update.repo;
      progressState.commits.current = 0;
    }
    if (typeof update.total === "number") progressState.commits.total = update.total;
    if (typeof update.current === "number") progressState.commits.current = update.current;
    const label = document.getElementById("commits-progress-label");
    if (label && progressState.currentRepo) {
      const repoUrl = `https://github.com/${progressState.currentRepo}`;
      label.innerHTML = `Fetching commits — <a href="${repoUrl}" target="_blank" rel="noopener noreferrer">${progressState.currentRepo}</a>`;
    }
    updateProgress("commits-progress", progressState.commits.current, progressState.commits.total);
  }

  if (update.url) showCurrentUrl(update.url);
}

const buildGitHubHeaders = (token) => {
  const headers = { Accept: "application/vnd.github+json", "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

activityClient = createActivityClient({ onRequest: showCurrentUrl });
window.githubActivityClient = activityClient;

function showCurrentUrl(url) {
  const el = document.getElementById("current-url");
  if (!url) {
    el.textContent = "";
    return;
  }
  el.textContent = `Fetching: ${url}`;
}

function showError(message) {
  document.getElementById("error-section").style.display = "block";
  document.getElementById("error-message").textContent = message;
}

function setContextTextarea(contextObj) {
  const textarea = document.getElementById("context-textarea");
  textarea.value = JSON.stringify(contextObj, null, 2);
}

function getContextFromTextarea() {
  const textarea = document.getElementById("context-textarea");
  const value = textarea.value.trim();
  if (!value) return {};
  return JSON.parse(value);
}

function renderActivityTable(activity) {
  const container = document.getElementById("events-table-section");
  const dateFormatter = new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
  });

  if (!activity.length) {
    container.textContent = "No commits found for this period.";
    return;
  }

  render(
    html`
      <table class="table table-striped table-sm">
        <thead>
          <tr>
            <th>Time</th>
            <th>Repo</th>
            <th>Commit</th>
          </tr>
        </thead>
        <tbody>
          ${activity.map(
            (commit) => html`
              <tr>
                <td class="text-nowrap">${dateFormatter.format(new Date(commit.created_at))}</td>
                <td>
                  <a href="https://github.com/${commit["repo.name"]}" target="_blank">${commit["repo.name"]}</a>
                </td>
                <td>
                  ${commit.url
                    ? html`<a href=${commit.url} class="btn btn-sm btn-outline-primary" target="_blank">🔗</a>`
                    : ""}
                  ${commit.message?.split("\n")[0] || ""}
                </td>
              </tr>
            `,
          )}
        </tbody>
      </table>
    `,
    container,
  );
}

const fetchActivity = async (user, since, until, headers) => {
  createActivityProgressBars();
  const result = await activityClient.fetchGitHubActivity(user, since, until, headers, {
    onProgress: handleActivityProgress,
    onCommit: (activity) => renderActivityTable(activity),
  });
  renderActivityTable(result.activity);
  return result;
};

// Fetch repository details
async function fetchRepoDetails(repos, headers) {
  const details = {};
  const repoList = [...new Set(repos)];

  createProgressBar("repo-details-progress", "Fetching Repository Details");

  for (let i = 0; i < repoList.length; i++) {
    const repo = repoList[i];
    updateProgress("repo-details-progress", i, repoList.length);

    try {
      showCurrentUrl(`https://api.github.com/repos/${repo}`);
      const info = await fetchWithCache(`https://api.github.com/repos/${repo}`, { headers });

      showCurrentUrl(`https://api.github.com/repos/${repo}/readme`);
      let readme = "";
      try {
        const readmeResp = await fetchWithCache(`https://api.github.com/repos/${repo}/readme`, { headers });
        readme = atob(readmeResp.content || "");
        if (readme.length > 2000) readme = `${readme.slice(0, 2000)}\n... [README truncated]`;
      } catch {
        // README might not exist
      }

      details[repo] = {
        description: info.description || "",
        topics: info.topics || [],
        readme,
      };
    } catch (e) {
      console.warn(`Error fetching ${repo}:`, e);
    }
  }

  updateProgress("repo-details-progress", repoList.length, repoList.length);
  return details;
}

// Generate summary using OpenAI
async function generateSummary(context, systemPrompt, openaiKey, baseUrl) {
  const resultsDiv = document.getElementById("results-content");
  const model = document.getElementById("model").value;
  resultsDiv.innerHTML = "Generating summary...";

  const messages = [
    { role: "system", content: systemPrompt },
    {
      role: "user",
      content: `Repository Context:\n${JSON.stringify(context.context)}\n\nCommits:\n${JSON.stringify(
        context.activity,
      )}`,
    },
  ];

  try {
    for await (const { content } of asyncLLM(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({ model, stream: true, messages }),
    })) {
      const html = marked.parse(content);
      resultsDiv.innerHTML = html;
    }
  } catch (error) {
    throw new Error(`OpenAI API error: ${error.message}`);
  }
}

document.getElementById("github-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = document.getElementById("github-form");
  if (!form.checkValidity()) return form.classList.add("was-validated");

  const username = document.getElementById("username").value;
  const since = document.getElementById("since").value;
  const until = document.getElementById("until").value;
  const githubToken = document.getElementById("github-token").value;

  document.getElementById("progress-section").style.display = "block";
  document.getElementById("error-section").style.display = "none";
  document.getElementById("results-section").style.display = "none";
  document.getElementById("progress-container").innerHTML = "";
  document.getElementById("events-table-section").textContent = "";
  fetchedContext = {};

  const headers = buildGitHubHeaders(githubToken);

  try {
    if (document.getElementById("clear-cache").value) await clearCache();
    fetchedActivity = await fetchActivity(username, since, until, headers);
    fetchedContext = await fetchRepoDetails(fetchedActivity.repos, headers);
    setContextTextarea(fetchedContext);
    document.getElementById("generate-summary-btn").disabled = fetchedActivity.activity.length === 0;
    if (!fetchedActivity.activity.length) {
      showError("No commits found for this period.");
    }
    showCurrentUrl("");
  } catch (error) {
    showError(error.message);
  }
});

document.getElementById("generate-summary-btn").addEventListener("click", async (e) => {
  e.preventDefault();

  // Clear previous results
  document.getElementById("progress-section").style.display = "none";
  document.getElementById("error-section").style.display = "none";
  document.getElementById("results-section").style.display = "none";
  document.getElementById("progress-container").innerHTML = "";

  // Validate form
  const form = e.target;
  if (!form.checkValidity()) return form.classList.add("was-validated");

  // Get form values
  const config = {
    username: document.getElementById("username").value,
    githubToken: document.getElementById("github-token").value,
    since: document.getElementById("since").value,
    until: document.getElementById("until").value,
    systemPrompt: document.querySelector("#system-prompt-tab-content .active textarea").value,
  };

  // Show progress section
  document.getElementById("progress-section").style.display = "block";

  try {
    if (!fetchedActivity.activity.length) {
      showError("No activity fetched yet. Run Get events first.");
      return;
    }

    if (!Object.keys(fetchedContext).length) {
      const headers = buildGitHubHeaders(config.githubToken);
      fetchedContext = await fetchRepoDetails(fetchedActivity.repos, headers);
      setContextTextarea(fetchedContext);
    }

    let contextForSummary = fetchedContext;
    try {
      contextForSummary = getContextFromTextarea();
    } catch (err) {
      showError(`Context JSON is invalid: ${err.message}`);
      return;
    }

    // Show results section
    document.getElementById("results-section").style.display = "block";

    // Generate summary
    const { apiKey, baseUrl } = await openaiConfig({ defaultBaseUrls: DEFAULT_BASE_URLS, help: openaiHelp });
    await generateSummary(
      { activity: fetchedActivity.activity, repos: fetchedActivity.repos, context: contextForSummary },
      config.systemPrompt,
      apiKey,
      baseUrl,
    );
  } catch (error) {
    showError(error.message);
  }
});

// Initialize saveform and set default dates
document.addEventListener("DOMContentLoaded", () => {
  saveform("#github-form", { exclude: '[type="file"]' });

  // Set default dates (last week)
  const today = new Date();
  const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

  document.getElementById("until").value = today.toISOString().split("T")[0];
  document.getElementById("since").value = lastWeek.toISOString().split("T")[0];
});
