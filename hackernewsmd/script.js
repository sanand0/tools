import saveform from "https://cdn.jsdelivr.net/npm/saveform@1.2";
import { copyText } from "../common/clipboard-utils.js";
const extractButton = document.getElementById("extractButton");
const copyButton = document.getElementById("copyButton");
const progressBar = document.getElementById("progressBar");
const outputTextarea = document.getElementById("outputTextarea");
const errorContainer = document.getElementById("errorContainer");
const storyTypeSelect = document.getElementById("storyTypeSelect");
saveform("#hackernews-form");

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  return await response.json();
}

async function fetchMarkdown(url) {
  const response = await fetch(`https://llmfoundry.straive.com/-/markdown?n=0&url=${encodeURIComponent(url)}`);
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  return await response.text();
}

function updateProgress(current, total) {
  const percentage = (current / total) * 100;
  progressBar.style.width = `${percentage}%`;
  progressBar.setAttribute("aria-valuenow", percentage);
  progressBar.textContent = `${Math.round(percentage)}%`;
}

function displayError(message) {
  const alertDiv = document.createElement("div");
  alertDiv.className = "alert alert-danger alert-dismissible fade show";
  alertDiv.innerHTML = /* html */ `
                ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
              `;
  errorContainer.appendChild(alertDiv);
}

async function extractNews() {
  extractButton.disabled = true;
  outputTextarea.value = "";
  errorContainer.innerHTML = "";
  progressBar.style.width = "0%";
  progressBar.setAttribute("aria-valuenow", 0);
  progressBar.textContent = "0%";

  const storyType = storyTypeSelect.value;
  const url = `https://hacker-news.firebaseio.com/v0/${storyType}.json`;

  try {
    const ids = await fetchJson(url);
    const topIds = ids.slice(0, 10);

    for (let i = 0; i < topIds.length; i++) {
      try {
        const item = await fetchJson(`https://hacker-news.firebaseio.com/v0/item/${topIds[i]}.json`);
        const markdown = await fetchMarkdown(item.url);
        const content = `---
      time: ${item.time}
      title: ${item.title}
      url: ${item.url}
      ---

      ${markdown}

      `;
        outputTextarea.value += content;
      } catch (error) {
        displayError(`Error processing item ${topIds[i]}: ${error.message}`);
      }
      updateProgress(i + 1, topIds.length);
    }
  } catch (error) {
    displayError(`Failed to fetch ${storyType}: ${error.message}`);
  } finally {
    extractButton.disabled = false;
  }
}

function copyOutput() {
  copyText(outputTextarea.value);
}

extractButton.addEventListener("click", extractNews);
copyButton.addEventListener("click", copyOutput);
