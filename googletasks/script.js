import saveform from "https://cdn.jsdelivr.net/npm/saveform@1.2";
import { objectsToCsv, objectsToTsv, csvToTable, downloadCsv } from "../common/csv.js";

// root.node@gmail.com | Project: Personal mail etc. OAuth Client: Web apps
// https://console.cloud.google.com/auth/clients/872568319651-r1jl15a1oektabjl48ch3v9dhipkpdjh.apps.googleusercontent.com?inv=1&invt=AbzTOQ&project=encoded-ensign-221
const clientId = "872568319651-r1jl15a1oektabjl48ch3v9dhipkpdjh.apps.googleusercontent.com";
let tokenClient;
let tasks = [];

const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fmtDate = (d) => {
  if (!d) return "";
  d = new Date(d);
  return `${days[d.getUTCDay()]}, ${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};

const sortTasks = (arr) =>
  arr.sort((a, b) => {
    const ac = a.completed ? 1 : 0;
    const bc = b.completed ? 1 : 0;
    if (ac !== bc) return ac - bc;
    return new Date(b.updated) - new Date(a.updated);
  });

const alerts = document.getElementById("alertContainer");
const tokenInput = document.getElementById("token");
const output = document.getElementById("output");
const status = document.getElementById("status");
const signinBtn = document.getElementById("signinBtn");
const fetchBtn = document.getElementById("fetchBtn");
const downloadBtn = document.getElementById("downloadBtn");
const copyBtn = document.getElementById("copyBtn");
const deleteBtn = document.getElementById("deleteBtn");
const mdBtn = document.getElementById("mdBtn");

saveform("#googletasks-form", { exclude: '[type="file"], [type="button"]' });

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
    callback: (resp) => {
      tokenInput.value = resp.access_token;
      tokenInput.dispatchEvent(new Event("change", { bubbles: true }));
    },
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
    sortTasks(tasks);
    const display = tasks.map((t) => ({
      ...t,
      updated: fmtDate(t.updated),
      due: fmtDate(t.due),
    }));
    const cols = ["list", "title", "notes", "updated", "due", "parent", "id"];
    csvToTable(output, objectsToCsv(display), cols, (r) => (r.status === "completed" ? "text-muted" : ""));
    [downloadBtn, copyBtn, mdBtn, deleteBtn].forEach((b) => b.classList.remove("d-none"));
    status.textContent = `Fetched ${tasks.length} tasks`;
  } catch (e) {
    showAlert(e.message, "danger");
    status.textContent = "";
  }
});

downloadBtn.addEventListener("click", () => downloadCsv(objectsToCsv(tasks), "tasks.csv"));

copyBtn.addEventListener("click", async () => {
  await navigator.clipboard.writeText(objectsToTsv(tasks));
  showAlert("Copied to clipboard", "success", true);
});

mdBtn.addEventListener("click", async () => {
  const lines = tasks
    .filter((t) => t.status !== "completed")
    .map((t) => {
      const base = `- **${t.title}** #${t.list} (${fmtDate(t.updated)})`;
      const notes = (t.notes || "").replace(/\n+/g, " ").trim();
      const links = (t.links || "").trim();
      const extras = [];
      if (notes) extras.push(`  - ${notes}`);
      if (links) extras.push(`  - ${links}`);
      return [base, ...extras].join("\n");
    })
    .join("\n");
  await navigator.clipboard.writeText(lines);
  showAlert("Markdown copied", "success", true);
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
    status.textContent = `Deleting from ${list.title}`;
    let pageToken;
    do {
      const url = new URL(`https://tasks.googleapis.com/tasks/v1/lists/${list.id}/tasks`);
      url.searchParams.set("showCompleted", "true");
      url.searchParams.set("showHidden", "true");
      if (pageToken) url.searchParams.set("pageToken", pageToken);
      const res = await fetch(url, { headers });
      const data = await res.json();
      for (const t of data.items || []) {
        if (t.status === "completed")
          await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${list.id}/tasks/${t.id}`, {
            method: "DELETE",
            headers,
          });
      }
      pageToken = data.nextPageToken;
    } while (pageToken);
  }
  status.textContent = "";
}
