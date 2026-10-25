import { html, render } from "https://cdn.jsdelivr.net/npm/lit-html/+esm";
import { bootstrapAlert } from "https://cdn.jsdelivr.net/npm/bootstrap-alert@1";
import { openaiConfig } from "https://cdn.jsdelivr.net/npm/bootstrap-llm-provider@1";
import { asyncLLM } from "https://cdn.jsdelivr.net/npm/asyncllm@2";

const recordBtn = document.getElementById("record-btn");
const configBtn = document.getElementById("openai-config-btn");
const spinner = document.getElementById("spinner");
const copyBtn = document.getElementById("copy-btn");
const list = document.getElementById("notes-list");

const STORAGE_KEY = "voice-notes";
let chunks = [];
let recorder;

const loadNotes = () => JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
let notes = loadNotes();
const saveNotes = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));

export function addNote(text) {
  notes.unshift({ text, ts: Date.now() });
  saveNotes();
  renderNotes();
}

function renderNotes() {
  const items = notes.sort((a, b) => b.ts - a.ts);
  render(
    items.map(
      (n, i) =>
        html`<li class="list-group-item d-flex justify-content-between align-items-start">
          <span>${n.text}</span
          ><button class="btn btn-sm btn-outline-danger" data-index="${i}"><i class="bi bi-trash"></i></button>
        </li>`,
    ),
    list,
  );
}

renderNotes();

configBtn.addEventListener("click", () => openaiConfig({ show: true }));

recordBtn.addEventListener("click", async () => {
  if (!recorder) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recorder = new MediaRecorder(stream);
      recorder.addEventListener("dataavailable", (e) => chunks.push(e.data));
      recorder.addEventListener("stop", transcribe);
      recorder.start();
      recordBtn.classList.add("btn-danger");
      recordBtn.textContent = "Stop";
    } catch {
      bootstrapAlert({ title: "Mic error", body: "Microphone access denied", color: "danger" });
    }
  } else {
    recorder.stop();
    recorder = null;
    recordBtn.classList.remove("btn-danger");
    recordBtn.textContent = "Record";
  }
});

async function transcribe() {
  const blob = new Blob(chunks, { type: "audio/webm" });
  chunks = [];
  const buffer = await blob.arrayBuffer();
  const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
  const { apiKey, baseUrl } = await openaiConfig({});
  if (!apiKey) return;
  spinner.classList.remove("d-none");
  for await (const { content, error } of asyncLLM(`${baseUrl}/v1beta/models/gemini-2.5-flash:transcribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ audio: { content: base64, mimeType: blob.type } }),
  })) {
    spinner.classList.add("d-none");
    if (error) {
      bootstrapAlert({ title: "Transcription error", body: error, color: "danger" });
      return;
    }
    const text = content?.text ?? content ?? "";
    addNote(text);
  }
}

list.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  const i = +btn.dataset.index;
  notes.splice(i, 1);
  saveNotes();
  renderNotes();
});

export function copyNotes() {
  const md = notes.map((n) => `- ${n.text}`).join("\n");
  return navigator.clipboard.writeText(md);
}

copyBtn.addEventListener("click", () => {
  copyNotes();
});
