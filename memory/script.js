/** Memory: Firebase auth + notes with Bootstrap UI. */
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-analytics.js";
import { bootstrapAlert } from "https://cdn.jsdelivr.net/npm/bootstrap-alert@1";
import {
  getAuth,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  query,
  where,
  getDocs,
  orderBy,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

// DOM
const el = (id) => document.getElementById(id);
const userBox = el("user-info-display");
const notesBox = el("notes-container");

// Small helpers
const toNodes = (html) => {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return [...t.content.childNodes];
};
const setHTML = (node, html) => node.replaceChildren(...toNodes(html));
const appendHTML = (node, html) => node.insertAdjacentHTML("beforeend", html);
const escapeHTML = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const spinner = () => '<div class="text-center"><div class="spinner-border" role="status"></div></div>';
const showLoading = (node) => setHTML(node, spinner());
const toast = (body, color = "danger", title = "") => bootstrapAlert({ title, body, color });

// Config from file (no error handling per spec)
async function loadConfig() {
  const r = await fetch("./config.json", { cache: "no-store" });
  const j = await r.json();
  return j.firebase;
}

// Firebase
let app, analytics, auth, db;
async function init() {
  showLoading(notesBox);
  const cfg = await loadConfig();
  app = initializeApp(cfg);
  analytics = getAnalytics(app); // measurementId optional
  auth = getAuth(app);
  db = getFirestore(app);
  // Inline auth change for clarity
  onAuthStateChanged(auth, async (user) => {
    renderUser(user);
    await renderNotes(user);
  });
}

async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  // provider.addScope('https://www.googleapis.com/auth/contacts.readonly'); // OPTIONAL
  // provider.setCustomParameters({ login_hint: 'user@example.com' }); // OPTIONAL
  await signInWithPopup(auth, provider); // or signInWithRedirect(auth, provider)
}

async function addNote(text, isPublic) {
  const user = auth.currentUser;
  if (!user) return toast("Please sign in to add a note.");
  try {
    await addDoc(collection(db, "notes"), { text, userId: user.uid, isPublic, createdAt: serverTimestamp() });
  } catch (e) {
    toast(e?.stack || e?.message || String(e));
  }
}

const mapDocs = (qs) => qs.docs.map((d) => ({ id: d.id, ...d.data() }));
async function getPublicNotes() {
  try {
    const qy = query(collection(db, "notes"), where("isPublic", "==", true), orderBy("createdAt", "desc"));
    return mapDocs(await getDocs(qy));
  } catch (e) {
    toast(e?.stack || e?.message || String(e));
    return [];
  }
}
async function getUserNotes(userId) {
  try {
    const qy = query(collection(db, "notes"), where("userId", "==", userId), orderBy("createdAt", "desc"));
    return mapDocs(await getDocs(qy));
  } catch (e) {
    toast(e?.stack || e?.message || String(e));
    return [];
  }
}

function renderUser(user) {
  if (!user) {
    setHTML(
      userBox,
      `
      <div class="alert alert-info d-flex align-items-center justify-content-between" role="alert">
        <div>No user signed in.</div>
        <button id="sign-in-google-button" class="btn btn-primary btn-sm"><i class="bi bi-google"></i> Sign in</button>
      </div>`,
    );
    el("sign-in-google-button").addEventListener("click", signInWithGoogle);
    return;
  }
  const { uid, email, displayName, photoURL } = user;
  setHTML(
    userBox,
    `
    <div class="d-flex align-items-center gap-3">
      ${photoURL ? `<img src="${photoURL}" alt="user-photo" class="rounded-circle" style="width:48px;height:48px">` : ""}
      <div>
        <div class="fw-semibold">${escapeHTML(displayName || email || "")}</div>
        <div class="text-muted small">UID: ${escapeHTML(uid)}</div>
      </div>
      <div class="ms-auto">
        <button id="sign-out-button" class="btn btn-outline-secondary btn-sm">Sign Out</button>
      </div>
    </div>`,
  );
  el("sign-out-button").addEventListener("click", async () => {
    await auth.signOut();
  });
}

async function renderNotes(user) {
  showLoading(notesBox);
  const pub = await getPublicNotes();
  let notes = pub;
  if (user) {
    const mine = await getUserNotes(user.uid);
    const byId = new Map([...pub, ...mine].map((n) => [n.id, n])); // de-dupe
    notes = [...byId.values()].sort((a, b) => createdAtMilliseconds(b) - createdAtMilliseconds(a));
  }
  drawNotes(notes, !!user);
}

const createdAtMilliseconds = (n) => (n?.createdAt?.toMillis ? n.createdAt.toMillis() : 0);

function drawNotes(notes, canAdd) {
  if (!notes.length) setHTML(notesBox, `<div class="alert alert-warning">No notes to display.</div>`);
  else {
    const items = notes
      .map(
        (n) => `
      <li class="list-group-item">
        <strong>${escapeHTML(n.text || "")}</strong><br>
        <small class="text-muted">${n.isPublic ? "Public" : "Private"} • By ${escapeHTML(n.userId?.slice(0, 8) || "")}…</small>
      </li>`,
      )
      .join("");
    setHTML(notesBox, `<ul class="list-group mb-3">${items}</ul>`);
  }
  if (canAdd) {
    appendHTML(
      notesBox,
      '<button id="add-note" class="btn btn-primary btn-sm"><i class="bi bi-plus"></i> Add note</button>',
    );
    el("add-note").addEventListener("click", async () => {
      const isPublic = Math.random() < 0.5; // quick toggle
      appendHTML(notesBox, `<div class="small text-muted">Adding ${isPublic ? "public" : "private"} note…</div>`);
      await addNote(`Added ${isPublic ? "public" : "private"} note at ${new Date()}`, isPublic);
      bootstrapAlert({ body: "Note added", color: "success" });
      await renderNotes(auth.currentUser);
    });
  }
}

init();
