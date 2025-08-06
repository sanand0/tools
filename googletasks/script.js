import saveform from "https://cdn.jsdelivr.net/npm/saveform@1.2";
import { objectsToCsv, objectsToTsv, csvToTable, downloadCsv } from "../common/csv.js";
import { copyText } from "../common/clipboard-utils.js";
// root.node@gmail.com | Project: Personal mail etc. OAuth Client: Web apps
// https://console.cloud.google.com/auth/clients/872568319651-r1jl15a1oektabjl48ch3v9dhipkpdjh.apps.googleusercontent.com?inv=1&invt=AbzTOQ&project=encoded-ensign-221
const clientId = "872568319651-r1jl15a1oektabjl48ch3v9dhipkpdjh.apps.googleusercontent.com";
const LS_KEY = "googletasks";
const getAuth = () => JSON.parse(localStorage.getItem(LS_KEY) || "{}");
const setAuth = (auth) => localStorage.setItem(LS_KEY, JSON.stringify(auth));
const clearAuth = () => localStorage.removeItem(LS_KEY);
let codeClient;
let codeVerifier;
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

const mergeSubtasks = (arr) => {
  const byId = Object.fromEntries(arr.map((t) => [t.id, { ...t, children: [] }]));
  arr.forEach((t) => {
    if (t.parent && byId[t.parent]) byId[t.parent].children.push(byId[t.id]);
  });
  const fmt = (t, lvl = 0) => {
    const indent = "  ".repeat(lvl);
    const lines = [`${indent}- ${t.title}`];
    const notes = (t.notes || "").trim();
    if (notes)
      lines.push(
        notes
          .split("\n")
          .filter(Boolean)
          .map((l) => `${indent}  ${l}`)
          .join("\n"),
      );
    const link = (t.links || "").trim();
    if (link) lines.push(`${indent}  - ${link}`);
    t.children.forEach((c) => lines.push(fmt(c, lvl + 1)));
    return lines.join("\n");
  };
  Object.values(byId).forEach((t) => {
    if (!t.parent) {
      const base = (t.notes || "").trim();
      const subs = t.children.map((c) => fmt(c));
      t.notes = [base, ...subs].filter(Boolean).join("\n");
    }
  });
  return Object.values(byId)
    .filter((t) => !t.parent)
    .map(({ children: _, ...rest }) => rest);
};

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
    /* html */ `<div class="alert alert-${type} alert-dismissible fade show">${message}<button type="button" class="btn-close" data-bs-dismiss="alert"></button></div>`,
  );
  const alert = alerts.lastElementChild;
  if (autoClose) setTimeout(() => alert.remove(), 3000);
  return alert;
}

const setSignin = (email) => {
  signinBtn.replaceChildren();
  signinBtn.insertAdjacentHTML("beforeend", `<i class="bi bi-google"></i> ${email || "Sign in"}`);
};

const toggleLoading = (btn, show) => {
  if (show) {
    btn.disabled = true;
    btn.insertAdjacentHTML("afterbegin", '<span class="spinner-border spinner-border-sm me-2"></span>');
    return;
  }
  btn.disabled = false;
  btn.querySelector(".spinner-border")?.remove();
};

const b64url = (arr) =>
  btoa(String.fromCharCode(...arr))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
const genCodeVerifier = () => b64url(crypto.getRandomValues(new Uint8Array(32)));
const genCodeChallenge = async (verifier) =>
  b64url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))));

async function initAuth() {
  codeVerifier = genCodeVerifier();
  const codeChallenge = await genCodeChallenge(codeVerifier);
  codeClient = google.accounts.oauth2.initCodeClient({
    client_id: clientId,
    scope: "https://www.googleapis.com/auth/tasks https://www.googleapis.com/auth/userinfo.email",
    ux_mode: "popup",
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    callback: handleCode,
  });
}

async function handleCode(resp) {
  toggleLoading(signinBtn, true);
  const data = await exchangeCode(resp.code);
  if (!data.access_token) {
    toggleLoading(signinBtn, false);
    return showAlert("Failed to get access token", "danger");
  }
  tokenInput.value = data.access_token;
  tokenInput.dispatchEvent(new Event("change", { bubbles: true }));
  const email = await fetchEmail(data.access_token);
  setAuth({ refresh: data.refresh_token, email });
  setSignin(email);
  toggleLoading(signinBtn, false);
}

const tokenRequest = async (params) => {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, ...params }),
  });
  return res.ok ? res.json() : {};
};

const exchangeCode = (code) =>
  tokenRequest({
    code,
    code_verifier: codeVerifier,
    grant_type: "authorization_code",
    redirect_uri: "postmessage",
  });

const refreshAccess = (refresh) => tokenRequest({ refresh_token: refresh, grant_type: "refresh_token" });

async function fetchEmail(token) {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return "";
  const { email } = await res.json();
  return email || "";
}

async function ensureToken(btn = signinBtn) {
  let token = tokenInput.value.trim();
  if (token) return token;
  const { refresh } = getAuth();
  if (!refresh) return "";
  toggleLoading(btn, true);
  const data = await refreshAccess(refresh);
  toggleLoading(btn, false);
  token = data.access_token || "";
  if (!token) return "";
  tokenInput.value = token;
  tokenInput.dispatchEvent(new Event("change", { bubbles: true }));
  return token;
}

window.onload = async () => {
  await initAuth();
  const { email } = getAuth();
  if (email) setSignin(email);
  await ensureToken();
};

signinBtn.addEventListener("click", async () => {
  const { refresh } = getAuth();
  if (refresh) {
    clearAuth();
    tokenInput.value = "";
    setSignin();
    return;
  }
  await initAuth();
  codeClient.requestCode();
});

fetchBtn.addEventListener("click", async () => {
  output.innerHTML = "";
  status.textContent = "";
  const token = await ensureToken(fetchBtn);
  if (!token) return showAlert("Please sign in first", "warning", true);
  toggleLoading(fetchBtn, true);
  try {
    tasks = mergeSubtasks(await fetchTasks(token));
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
  toggleLoading(fetchBtn, false);
});

downloadBtn.addEventListener("click", () => downloadCsv(objectsToCsv(tasks), "tasks.csv"));

copyBtn.addEventListener("click", async () => {
  await copyText(objectsToTsv(tasks));
  showAlert("Copied to clipboard", "success", true);
});

mdBtn.addEventListener("click", async () => {
  const lines = tasks
    .filter((t) => t.status !== "completed")
    .map((t) => {
      const base = `- **${t.title}** #${t.list} (${fmtDate(t.updated)})`;
      const notes = (t.notes || "").trim();
      const links = (t.links || "").trim();
      const extras = [];
      if (notes)
        extras.push(
          notes
            .split("\n")
            .filter(Boolean)
            .map((l) => `  ${l}`)
            .join("\n"),
        );
      if (links) extras.push(`  - ${links}`);
      return [base, ...extras].join("\n");
    })
    .join("\n");
  await copyText(lines);
  showAlert("Markdown copied", "success", true);
});

deleteBtn.addEventListener("click", async () => {
  const token = await ensureToken(deleteBtn);
  if (!token) return showAlert("Please sign in first", "warning", true);
  toggleLoading(deleteBtn, true);
  try {
    status.textContent = "Deleting completed tasks";
    await deleteCompleted(token);
    status.textContent = "";
    showAlert("Completed tasks deleted", "success", true);
  } catch (e) {
    showAlert(e.message, "danger");
    status.textContent = "";
  }
  toggleLoading(deleteBtn, false);
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
