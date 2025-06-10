import saveform from "https://cdn.jsdelivr.net/npm/saveform@1.2";
import { objectsToCsv, objectsToTsv, csvToTable, downloadCsv, copyText } from "../common/csv.js";

const clientId = "872568319651-r1jl15a1oektabjl48ch3v9dhipkpdjh.apps.googleusercontent.com";
let tokenClient;
let tasks = [];

const alerts = document.getElementById("alertContainer");
const tokenInput = document.getElementById("token");
const output = document.getElementById("output");
const status = document.getElementById("status");
const signinBtn = document.getElementById("signinBtn");
const fetchBtn = document.getElementById("fetchBtn");
const downloadBtn = document.getElementById("downloadBtn");
const copyBtn = document.getElementById("copyBtn");
const deleteBtn = document.getElementById("deleteBtn");

saveform("#tasks-form");

function showAlert(message, type = "info", autoClose = false) {
  alerts.insertAdjacentHTML(
    "beforeend",
    `<div class="alert alert-${type} alert-dismissible fade show">${message}<button type="button" class="btn-close" data-bs-dismiss="alert"></button></div>`,
  );
  const alert = alerts.lastElementChild;
  if (autoClose) setTimeout(() => alert.remove(), 3000);
  return alert;
}

window.onload = () => {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: "https://www.googleapis.com/auth/tasks",
    callback: (resp) => (tokenInput.value = resp.access_token),
  });
};

signinBtn.addEventListener("click", () => tokenClient.requestAccessToken());

fetchBtn.addEventListener("click", async () => {
  output.innerHTML = "";
  status.textContent = "";
  const token = tokenInput.value.trim();
  if (!token) return showAlert("Please sign in first", "warning", true);
  try {
    tasks = await fetchTasks(token);
    if (!tasks.length) return showAlert("No tasks found", "warning", true);
    const csv = objectsToCsv(tasks);
    const cols = ["list", "title", "notes", "links", "updated", "due", "parent", "id"];
    csvToTable(output, csv, cols);
    downloadBtn.classList.remove("d-none");
    copyBtn.classList.remove("d-none");
    deleteBtn.classList.remove("d-none");
    status.textContent = `Fetched ${tasks.length} tasks`;
  } catch (e) {
    showAlert(e.message, "danger");
    status.textContent = "";
  }
});

downloadBtn.addEventListener("click", () => downloadCsv(objectsToCsv(tasks), "tasks.csv"));

copyBtn.addEventListener("click", async () => {
  await copyText(objectsToTsv(tasks));
  showAlert("Copied to clipboard", "success", true);
});

deleteBtn.addEventListener("click", async () => {
  const token = tokenInput.value.trim();
  if (!token) return showAlert("Please sign in first", "warning", true);
  try {
    status.textContent = "Deleting completed tasks";
    await deleteCompleted(token);
    status.textContent = "";
    showAlert("Completed tasks deleted", "success", true);
  } catch (e) {
    showAlert(e.message, "danger");
    status.textContent = "";
  }
});

async function fetchTasks(token) {
  const headers = { Authorization: `Bearer ${token}` };
  const listRes = await fetch("https://tasks.googleapis.com/tasks/v1/users/@me/lists", { headers });
  if (!listRes.ok) throw new Error("Failed to fetch task lists");
  const lists = (await listRes.json()).items || [];
  const all = [];
  for (const list of lists) {
    status.textContent = `Fetching ${list.title}`;
    let pageToken;
    let page = 1;
    do {
      status.textContent = `Fetching ${list.title}: page ${page}`;
      const url = new URL(`https://tasks.googleapis.com/tasks/v1/lists/${list.id}/tasks`);
      url.searchParams.set("showCompleted", "true");
      url.searchParams.set("showHidden", "true");
      if (pageToken) url.searchParams.set("pageToken", pageToken);
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error(`Failed to fetch tasks for ${list.title}`);
      const data = await res.json();
      (data.items || []).forEach((t) => {
        const links = (t.links || []).map((l) => l.link).join(" ");
        all.push({ list: list.title, ...t, links });
      });
      pageToken = data.nextPageToken;
      page += 1;
    } while (pageToken);
  }
  return all;
}

async function deleteCompleted(token) {
  const headers = { Authorization: `Bearer ${token}` };
  const listRes = await fetch("https://tasks.googleapis.com/tasks/v1/users/@me/lists", { headers });
  const lists = (await listRes.json()).items || [];
  for (const list of lists) {
    status.textContent = `Clearing ${list.title}`;
    await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${list.id}/clear`, {
      method: "POST",
      headers,
    });
  }
  status.textContent = "";
}
