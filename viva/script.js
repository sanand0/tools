import { bootstrapAlert } from "https://cdn.jsdelivr.net/npm/bootstrap-alert@1";

const DEFAULT_BASE_URLS = ["https://openrouter.ai/api/v1", "https://aipipe.org/openrouter/v1"];
const state = { exams: [], current: null, index: 0, recordings: [], micDone: false };
window.vivaState = state;

const $list = document.getElementById("exam-list");
const $mic = document.getElementById("mic-card");
const $runner = document.getElementById("exam-runner");
const $prompt = document.getElementById("question-prompt");
const $record = document.getElementById("record-btn");
const $player = document.getElementById("player");
const $transcript = document.getElementById("transcript");
const $toggle = document.getElementById("toggle-transcript");
const $status = document.getElementById("question-status");
const $next = document.getElementById("next-btn");
const $submit = document.getElementById("submit-btn");
const $results = document.getElementById("results");
const $micStart = document.getElementById("mic-start");
const $micAudio = document.getElementById("mic-audio");
const $micContinue = document.getElementById("mic-continue");

init();

async function init() {
  try {
    const res = await fetch("config.json");
    state.exams = (await res.json()).exams || [];
    renderList();
  } catch (e) {
    showError("Config error", e);
  }
}

function renderList() {
  if (!state.exams.length) return $list.insertAdjacentHTML("afterbegin", "<p>No exams</p>");
  const items = state.exams
    .map((e) => `<li><button class="btn btn-link p-0 exam-btn" data-id="${e.id}">${e.title}</button></li>`)
    .join("");
  $list.innerHTML = `<ul class="list-unstyled">${items}</ul>`;
  $list.querySelectorAll(".exam-btn").forEach((b) => b.addEventListener("click", () => start(b.dataset.id)));
}

function start(id) {
  state.current = state.exams.find((e) => e.id === id);
  if (!state.current) return;
  state.index = 0;
  state.recordings = state.current.questions.map(() => ({ audio: null, transcript: "", count: 0 }));
  $list.classList.add("d-none");
  $mic.classList.remove("d-none");
}

let rec;
$micStart.addEventListener("click", async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const chunks = [];
    rec = new MediaRecorder(stream);
    rec.ondataavailable = (e) => chunks.push(e.data);
    rec.onstop = () => {
      const blob = new Blob(chunks, { type: "audio/webm" });
      $micAudio.src = URL.createObjectURL(blob);
      $micAudio.classList.remove("d-none");
      $micContinue.disabled = false;
    };
    rec.start();
    setTimeout(() => rec.stop(), 10000);
  } catch (e) {
    showError("Mic error", e);
  }
});
$micContinue.addEventListener("click", () => {
  state.micDone = true;
  $mic.classList.add("d-none");
  $runner.classList.remove("d-none");
  renderQuestion();
});

function renderQuestion() {
  const q = state.current.questions[state.index];
  $prompt.textContent = q.prompt;
  const r = state.recordings[state.index];
  $player.src = r.audio || "";
  $status.textContent = r.transcript ? "Saved" : "Not recorded";
  $transcript.textContent = r.transcript;
  $transcript.classList.add("d-none");
  $toggle.textContent = "Show transcript";
}

$toggle.addEventListener("click", () => {
  $transcript.classList.toggle("d-none");
  $toggle.textContent = $transcript.classList.contains("d-none") ? "Show transcript" : "Hide transcript";
});

let media;
$record.addEventListener("click", async () => {
  if (media && media.state === "recording") return media.stop();
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const chunks = [];
    media = new MediaRecorder(stream);
    media.ondataavailable = (e) => chunks.push(e.data);
    media.onstop = async () => {
      const blob = new Blob(chunks, { type: "audio/webm" });
      const url = URL.createObjectURL(blob);
      const r = state.recordings[state.index];
      if (r.audio) URL.revokeObjectURL(r.audio);
      r.audio = url;
      r.count++;
      if (r.count > 2) bootstrapAlert({ title: "Hint", body: "Consider moving on and return later", color: "info" });
      await transcribe(blob);
      renderQuestion();
    };
    media.start();
    $status.textContent = "Recording";
    $record.textContent = "Stop";
  } catch (e) {
    showError("Mic error", e);
  }
});

async function transcribe(blob) {
  try {
    $status.textContent = "Transcribing";
    const { openaiConfig } = window.openaiConfig
      ? { openaiConfig: window.openaiConfig }
      : await import("https://cdn.jsdelivr.net/npm/bootstrap-llm-provider@1");
    const { apiKey, baseUrl } = await openaiConfig({ defaultBaseUrls: DEFAULT_BASE_URLS });
    const fd = new FormData();
    fd.append("file", blob, "audio.webm");
    fd.append("model", state.current.llmModel);
    const res = await fetch(`${baseUrl}/audio/transcriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: fd,
    });
    const data = await res.json();
    state.recordings[state.index].transcript = data.text || "";
    $status.textContent = "Saved";
  } catch (e) {
    showError("Transcription failed", e);
  }
}

$next.addEventListener("click", () => {
  if (state.index < state.current.questions.length - 1) {
    state.index++;
    renderQuestion();
  }
});

$submit.addEventListener("click", submitExam);

async function submitExam() {
  const aud = state.recordings.map((r) => r.audio);
  try {
    if (state.current.evaluationMode !== "student") return showResults(null);
    $results.innerHTML = spinner();
    const evals = await evaluate();
    showResults(evals);
  } finally {
    aud.forEach((u) => u && URL.revokeObjectURL(u));
    state.recordings.forEach((r) => (r.audio = null));
  }
}

function spinner() {
  return '<div class="spinner-border" role="status"></div>';
}

async function evaluate() {
  const { openaiConfig } = window.openaiConfig
    ? { openaiConfig: window.openaiConfig }
    : await import("https://cdn.jsdelivr.net/npm/bootstrap-llm-provider@1");
  const { asyncLLM } = window.asyncLLM
    ? { asyncLLM: window.asyncLLM }
    : await import("https://cdn.jsdelivr.net/npm/asyncllm@2");
  const { apiKey, baseUrl } = await openaiConfig({ defaultBaseUrls: DEFAULT_BASE_URLS });
  const out = [];
  for (const [i, q] of state.current.questions.entries()) {
    let full;
    const ans = state.recordings[i].transcript;
    for await (const { content } of asyncLLM(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: state.current.llmModel,
        messages: [
          { role: "system", content: `Score using rubric ${q.rubricJson}` },
          { role: "user", content: ans },
        ],
      }),
    }))
      full = content;
    out.push(JSON.parse(full || "{}"));
  }
  return out;
}

function showResults(evals) {
  const label = '<div class="alert alert-info">Practice—Not a Grade</div>';
  if (!evals) return ($results.innerHTML = label + "<p>Results will be published later.</p>");
  const details = evals
    .map((r, i) => `<div><strong>Q${i + 1}</strong>: ${(r.totalScore ?? 0).toFixed(2)}</div>`)
    .join("");
  $results.innerHTML = label + details;
  [$record, $player, $toggle, $next, $submit].forEach((el) => el.classList.add("d-none"));
}

function showError(title, e) {
  bootstrapAlert({ title, body: e.message, color: "danger" });
}
