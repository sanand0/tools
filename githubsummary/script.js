import { asyncLLM } from "https://cdn.jsdelivr.net/npm/asyncllm@2";
import saveform from "https://cdn.jsdelivr.net/npm/saveform@1.2";

// GitHub API field mappings
const GITHUB_FIELDS = {
  ForkEvent: ["type", "repo.name", "payload.forkee.full_name", "created_at"],
  IssueCommentEvent: ["type", "payload.action", "repo.name", "payload.comment.body", "created_at"],
  IssuesEvent: ["type", "payload.action", "repo.name", "payload.issue.title", "payload.issue.body", "created_at"],
  PullRequestEvent: ["type", "payload.action", "repo.name", "payload.pull_request.title", "created_at"],
  PullRequestReviewEvent: ["type", "payload.review.state", "repo.name", "payload.pull_request.title", "created_at"],
  PullRequestReviewCommentEvent: ["type", "repo.name", "payload.comment.body", "created_at"],
  PushEvent: ["type", "repo.name", "payload.ref", "payload.commits[*].message", "created_at"],
  ReleaseEvent: [
    "type",
    "payload.action",
    "repo.name",
    "payload.release.tag_name",
    "short_description_html",
    "created_at",
  ],
  CreateEvent: ["type", "payload.ref_type", "repo.name", "payload.ref", "created_at"],
  DeleteEvent: ["type", "payload.ref_type", "repo.name", "payload.ref", "created_at"],
  WatchEvent: ["type", "payload.action", "repo.name", "created_at"],
};

// IndexedDB cache management
const DB_NAME = "github-cache";
const DB_VERSION = 1;
const STORE_NAME = "urls";
const CACHE_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days

let db = null;

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
                    <label class="form-label">${label}</label>
                    <div class="progress">
                        <div id="${id}" class="progress-bar" role="progressbar" style="width: 0%">0%</div>
                    </div>
                </div>
            `;
  container.insertAdjacentHTML("beforeend", html);
}

function updateProgress(id, current, total) {
  const progressBar = document.getElementById(id);
  const percent = Math.round((current / total) * 100);
  progressBar.style.width = `${percent}%`;
  progressBar.textContent = `${percent}%`;
}

function showCurrentUrl(url) {
  document.getElementById("current-url").textContent = `Fetching: ${url}`;
}

function showError(message) {
  document.getElementById("error-section").style.display = "block";
  document.getElementById("error-message").textContent = message;
}

// JMESPath-like object navigation
function getNestedValue(obj, path) {
  const parts = path.split(".");
  let current = obj;

  for (const part of parts) {
    if (part.includes("[*]")) {
      const [key, rest] = part.split("[*]");
      current = current[key];
      if (Array.isArray(current)) {
        return current.map((item) => (rest ? getNestedValue(item, rest.slice(1)) : item)).flat();
      }
      return [];
    } else if (part.includes("[") && part.includes("]")) {
      const [key, index] = part.split("[");
      const idx = parseInt(index.replace("]", ""));
      current = current[key][idx];
    } else {
      current = current?.[part];
    }

    if (current === undefined) return null;
  }

  return current;
}

// Fetch GitHub events
async function fetchEvents(user, headers, since) {
  let url = `https://api.github.com/users/${user}/events/public`;
  const events = [];

  createProgressBar("events-progress", "Fetching GitHub Events");
  let pageCount = 0;

  while (url) {
    showCurrentUrl(url);
    pageCount++;
    updateProgress("events-progress", pageCount, pageCount + 1);

    const page = await fetchWithCache(url, { headers });
    events.push(...page);

    // Stop if all events on this page are before our start date
    const sinceDate = new Date(since);
    if (page.every((ev) => new Date(ev.created_at) < sinceDate)) break;

    // Get next page URL from Link header (simplified)
    url = null; // GitHub API doesn't provide easy pagination in JSON response
    if (page.length === 30) {
      // Standard page size
      url = `https://api.github.com/users/${user}/events/public?page=${pageCount + 1}`;
    }
  }

  updateProgress("events-progress", 1, 1);
  return events;
}

// Fetch repository details
async function fetchRepoDetails(repos, headers) {
  const details = {};
  const repoList = [...new Set(repos)];

  createProgressBar("repos-progress", "Fetching Repository Details");

  for (let i = 0; i < repoList.length; i++) {
    const repo = repoList[i];
    updateProgress("repos-progress", i, repoList.length);

    try {
      showCurrentUrl(`https://api.github.com/repos/${repo}`);
      const info = await fetchWithCache(`https://api.github.com/repos/${repo}`, { headers });

      showCurrentUrl(`https://api.github.com/repos/${repo}/readme`);
      let readme = "";
      try {
        const readmeResp = await fetchWithCache(`https://api.github.com/repos/${repo}/readme`, { headers });
        readme = atob(readmeResp.content || "");
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

  updateProgress("repos-progress", repoList.length, repoList.length);
  return details;
}

// Fetch GitHub activity
async function fetchGitHubActivity(user, since, until, headers) {
  const events = await fetchEvents(user, headers, since);
  const activity = [];
  const repos = new Set();

  createProgressBar("activity-progress", "Processing Events");

  const sinceDate = new Date(since);
  const untilDate = new Date(until);

  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    updateProgress("activity-progress", i, events.length);

    const ts = new Date(ev.created_at);
    if (!(sinceDate <= ts && ts < untilDate)) continue;

    const repo = ev.repo.name;
    repos.add(repo);

    if (GITHUB_FIELDS[ev.type]) {
      const info = {};
      for (const path of GITHUB_FIELDS[ev.type]) {
        const val = getNestedValue(ev, path);
        info[path] = Array.isArray(val) ? val.join(", ") : val;
      }
      activity.push(info);
    }

    // Handle push events specially
    if (ev.type === "PushEvent") {
      for (const commit of ev.payload.commits || []) {
        try {
          const url = `https://api.github.com/repos/${repo}/commits/${commit.sha}`;
          showCurrentUrl(url);
          const commitData = await fetchWithCache(url, { headers });

          activity.push({
            type: "commit",
            "repo.name": repo,
            created_at: commitData.commit.author.date,
            sha: commit.sha,
            message: commitData.commit.message,
            files: (commitData.files || []).map((f) => ({
              filename: f.filename,
              additions: f.additions,
              deletions: f.deletions,
              changes: f.changes,
              patch: f.patch || "",
            })),
          });
        } catch (e) {
          console.warn(`Error fetching commit ${commit.sha}:`, e);
        }
      }
    }
  }

  updateProgress("activity-progress", events.length, events.length);
  return { activity, repos: [...repos] };
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

// Main form handler
document.getElementById("github-form").addEventListener("submit", async (e) => {
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
    openaiKey: document.getElementById("openai-key").value,
    baseUrl: document.getElementById("openai-base-url").value,
    systemPrompt: document.querySelector("#system-prompt-tab-content .active textarea").value,
  };

  // Show progress section
  document.getElementById("progress-section").style.display = "block";

  try {
    // Clear cache if required
    if (document.getElementById("clear-cache").value) await clearCache();

    // Fetch GitHub data
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.githubToken}`,
    };

    const { activity, repos } = await fetchGitHubActivity(config.username, config.since, config.until, headers);

    const context = await fetchRepoDetails(repos, headers);

    // Show results section
    document.getElementById("results-section").style.display = "block";

    // Generate summary
    await generateSummary({ activity, repos, context }, config.systemPrompt, config.openaiKey, config.baseUrl);
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
