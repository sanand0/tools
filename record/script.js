// @ts-check

const DB_NAME = "record-audio";
const STORE_NAME = "settings";
const DIRECTORY_KEY = "recordings-directory";
const HISTORY_MS = 5000;
const SAMPLE_MS = 50;
const HISTORY_POINTS = HISTORY_MS / SAMPLE_MS;
const MIN_DB = -60;
const MIME_TYPE = "audio/webm;codecs=opus";

/** @param {Date} date */
export function formatFilename(date = new Date()) {
  const parts = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
    String(date.getHours()).padStart(2, "0"),
    String(date.getMinutes()).padStart(2, "0"),
    String(date.getSeconds()).padStart(2, "0"),
  ];
  return parts.join("-") + ".webm";
}

/** @param {Float32Array} samples */
export function peakDb(samples) {
  let peak = 0;
  for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
  return Math.max(MIN_DB, 20 * Math.log10(Math.max(peak, 0.001)));
}

/** @param {number} db */
export function classifyLevel(db) {
  if (db >= -1) return { label: "Clipping", color: "danger" };
  if (db > -6) return { label: "Hot", color: "warning" };
  if (db >= -18) return { label: "Good", color: "success" };
  if (db >= -30) return { label: "Soft", color: "info" };
  return { label: "Quiet", color: "secondary" };
}

/** @param {number} ms */
function formatDuration(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours) {
    return (
      String(hours).padStart(2, "0") +
      ":" +
      String(minutes).padStart(2, "0") +
      ":" +
      String(seconds).padStart(2, "0")
    );
  }
  return String(minutes).padStart(2, "0") + ":" + String(seconds).padStart(2, "0");
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function loadDirectoryHandle() {
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction(STORE_NAME).objectStore(STORE_NAME).get(DIRECTORY_KEY);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

/** @param {FileSystemDirectoryHandle} handle */
async function storeDirectoryHandle(handle) {
  const db = await openDatabase();
  try {
    await new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put(handle, DIRECTORY_KEY);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
}

/** @param {string} text */
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.append(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    return copied;
  }
}

/** @param {string} title @param {unknown} error */
async function showError(title, error) {
  console.error(title, error);
  const { bootstrapAlert } = await import("https://cdn.jsdelivr.net/npm/bootstrap-alert@1");
  bootstrapAlert({
    title,
    body: error instanceof Error ? error.message : String(error),
    color: "danger",
  });
}

async function init() {
  const $ = (selector) => document.querySelector(selector);
  const folderName = $("#folder-name");
  const folderStatus = $("#folder-status");
  const folderButton = $("#folder-button");
  const folderButtonText = folderButton.querySelector("span");
  const canvas = $("#waveform");
  const ctx = canvas.getContext("2d");
  const recordButton = $("#record-button");
  const activeControls = $("#active-controls");
  const pauseButton = $("#pause-button");
  const pauseButtonText = pauseButton.querySelector("span");
  const pauseIcon = pauseButton.querySelector("i");
  const stopButton = $("#stop-button");
  const timer = $("#timer");
  const recordingStatus = $("#recording-status");
  const peakLabel = $("#peak-db");
  const levelBadge = $("#level-badge");
  const pausedOverlay = $("#paused-overlay");
  const savedSection = $("#saved-section");
  const savedList = $("#saved-list");
  const savedCount = $("#saved-count");
  const saveFallback = $("#save-fallback");
  const downloadFallback = $("#download-fallback");

  if (!window.showDirectoryPicker || !window.MediaRecorder || !window.AudioContext) {
    recordButton.disabled = true;
    folderButton.disabled = true;
    recordingStatus.textContent = "This tool needs a recent desktop Chrome or Edge browser.";
    return;
  }

  /** @type {FileSystemDirectoryHandle|null} */
  let directoryHandle = null;
  /** @type {FileSystemDirectoryHandle|null} */
  let recordingDirectory = null;
  /** @type {MediaRecorder|null} */
  let recorder = null;
  /** @type {MediaStream|null} */
  let stream = null;
  /** @type {AudioContext|null} */
  let audioContext = null;
  /** @type {AnalyserNode|null} */
  let analyser = null;
  /** @type {Float32Array|null} */
  let samples = null;
  /** @type {Blob[]} */
  let chunks = [];
  /** @type {number[]} */
  let history = [];
  /** @type {Map<string, {url: string, directory: FileSystemDirectoryHandle, row: HTMLElement}>} */
  const savedRecordings = new Map();
  let animationFrame = 0;
  let lastSampleAt = 0;
  let startedAt = 0;
  let startedDate = new Date();
  let pausedAt = 0;
  let totalPaused = 0;
  let stoppedAt = 0;
  let fallbackUrl = "";

  const updateFolderUi = async () => {
    if (!directoryHandle) {
      folderName.textContent = "No folder selected";
      folderStatus.textContent = "Choose a folder";
      folderStatus.className = "badge text-bg-secondary";
      folderButtonText.textContent = "Choose folder";
      recordingStatus.textContent = "Choose a folder, then press record.";
      return;
    }
    folderName.textContent = directoryHandle.name || "Selected folder";
    folderButtonText.textContent = "Change";
    const permission = await directoryHandle.queryPermission({ mode: "readwrite" });
    folderStatus.textContent = permission === "granted" ? "Ready" : "Reconnect on record";
    folderStatus.className = "badge text-bg-" + (permission === "granted" ? "success" : "warning");
    recordingStatus.textContent =
      permission === "granted" ? "Ready to record." : "Press record to restore write access.";
  };

  const chooseDirectory = async () => {
    const handle = await window.showDirectoryPicker({ id: "recordings", mode: "readwrite" });
    await storeDirectoryHandle(handle);
    directoryHandle = handle;
    await updateFolderUi();
    return handle;
  };

  const ensureDirectory = async () => {
    if (!directoryHandle) return chooseDirectory();
    let permission = await directoryHandle.queryPermission({ mode: "readwrite" });
    if (permission === "prompt") permission = await directoryHandle.requestPermission({ mode: "readwrite" });
    if (permission !== "granted") return chooseDirectory();
    return directoryHandle;
  };

  const resizeCanvas = () => {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.round(rect.width * dpr));
    const height = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
  };

  const drawWaveform = () => {
    resizeCanvas();
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.width;
    const height = canvas.height;
    const mid = height / 2;
    const maxHalfHeight = height * 0.44;
    const gap = 2 * dpr;
    const barWidth = Math.max(1 * dpr, width / HISTORY_POINTS - gap);
    const style = getComputedStyle(document.documentElement);
    const colors = {
      secondary: style.getPropertyValue("--bs-secondary-color").trim() || "#6c757d",
      info: style.getPropertyValue("--bs-info").trim() || "#0dcaf0",
      success: style.getPropertyValue("--bs-success").trim() || "#198754",
      warning: style.getPropertyValue("--bs-warning").trim() || "#ffc107",
      danger: style.getPropertyValue("--bs-danger").trim() || "#dc3545",
    };

    ctx.clearRect(0, 0, width, height);
    const start = Math.max(0, HISTORY_POINTS - history.length);
    history.forEach((db, index) => {
      const level = classifyLevel(db);
      const normalized = Math.max(0.025, Math.min(1, (db - MIN_DB) / -MIN_DB));
      const barHeight = normalized * maxHalfHeight;
      const x = (start + index) * (width / HISTORY_POINTS) + gap / 2;
      ctx.fillStyle = colors[level.color];
      ctx.beginPath();
      ctx.roundRect(x, mid - barHeight, barWidth, barHeight * 2, barWidth / 2);
      ctx.fill();
    });
  };

  const updateLevel = () => {
    if (!history.length) {
      peakLabel.textContent = "— dBFS";
      levelBadge.textContent = "Ready";
      levelBadge.className = "badge text-bg-secondary level-badge";
      return;
    }
    const recent = history.slice(-Math.round(1000 / SAMPLE_MS));
    const db = Math.max(...recent);
    const level = classifyLevel(db);
    peakLabel.textContent = Math.round(db) + " dBFS";
    levelBadge.textContent = level.label;
    levelBadge.className = "badge text-bg-" + level.color + " level-badge";
  };

  const resetRecorderUi = () => {
    history = [];
    startedAt = 0;
    pausedAt = 0;
    totalPaused = 0;
    stoppedAt = 0;
    timer.textContent = "00:00";
    pausedOverlay.classList.add("d-none");
    updateLevel();
    drawWaveform();
    recordingStatus.textContent = "Ready to record.";
  };

  const elapsedMs = (now = performance.now()) => {
    if (!startedAt) return 0;
    const end = stoppedAt || pausedAt || now;
    return end - startedAt - totalPaused;
  };

  const animate = (now) => {
    if (recorder && recorder.state === "recording" && analyser && samples && now - lastSampleAt >= SAMPLE_MS) {
      analyser.getFloatTimeDomainData(samples);
      history.push(peakDb(samples));
      if (history.length > HISTORY_POINTS) history.shift();
      lastSampleAt = now;
      updateLevel();
    }
    timer.textContent = formatDuration(elapsedMs(now));
    drawWaveform();
    animationFrame = requestAnimationFrame(animate);
  };

  const cleanupAudio = async () => {
    cancelAnimationFrame(animationFrame);
    animationFrame = 0;
    stream?.getTracks().forEach((track) => track.stop());
    stream = null;
    if (audioContext && audioContext.state !== "closed") await audioContext.close();
    audioContext = null;
    analyser = null;
    samples = null;
  };

  const setRecordingUi = (recording) => {
    recordButton.classList.toggle("d-none", recording);
    activeControls.classList.toggle("d-none", !recording);
    activeControls.classList.toggle("d-flex", recording);
    folderButton.disabled = recording;
  };

  const getMicrophone = async () => {
    const voiceConstraints = {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: false,
    };
    try {
      return await navigator.mediaDevices.getUserMedia({
        audio: { ...voiceConstraints, channelCount: { exact: 1 } },
      });
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "OverconstrainedError")) throw error;
      return navigator.mediaDevices.getUserMedia({
        audio: { ...voiceConstraints, channelCount: { ideal: 1 } },
      });
    }
  };

  const startRecording = async () => {
    recordButton.disabled = true;
    saveFallback.classList.add("d-none");
    recordingStatus.textContent = "Preparing microphone…";
    try {
      recordingDirectory = await ensureDirectory();
      stream = await getMicrophone();

      audioContext = new AudioContext();
      await audioContext.resume();
      const source = audioContext.createMediaStreamSource(stream);
      analyser = audioContext.createAnalyser();
      // 4096 samples ≈85 ms at 48 kHz. Sampling every 50 ms overlaps windows,
      // making short clipping peaks much less likely to fall between measurements.
      analyser.fftSize = 4096;
      source.connect(analyser);
      samples = new Float32Array(analyser.fftSize);

      chunks = [];
      history = [];
      startedAt = performance.now();
      startedDate = new Date();
      pausedAt = 0;
      totalPaused = 0;
      stoppedAt = 0;
      lastSampleAt = 0;
      timer.textContent = "00:00";
      pausedOverlay.classList.add("d-none");
      pauseButtonText.textContent = "Pause";
      pauseIcon.className = "bi bi-pause-fill me-1";

      recorder = new MediaRecorder(stream, {
        mimeType: MIME_TYPE,
        audioBitsPerSecond: 12_000,
        audioBitrateMode: "variable",
      });
      recorder.addEventListener("dataavailable", (event) => {
        if (event.data.size) chunks.push(event.data);
      });
      recorder.start();

      setRecordingUi(true);
      recordingStatus.textContent = "Recording · WebM/Opus · 12 kbps";
      updateLevel();
      drawWaveform();
      animationFrame = requestAnimationFrame(animate);
    } catch (error) {
      await cleanupAudio();
      if (error instanceof DOMException && error.name === "AbortError") {
        recordingStatus.textContent = "Recording cancelled.";
      } else {
        recordingStatus.textContent = "Could not start recording.";
        await showError("Could not start recording", error);
      }
    } finally {
      recordButton.disabled = false;
    }
  };

  const togglePause = () => {
    if (!recorder) return;
    if (recorder.state === "recording") {
      recorder.pause();
      pausedAt = performance.now();
      pauseButtonText.textContent = "Resume";
      pauseIcon.className = "bi bi-play-fill me-1";
      pausedOverlay.classList.remove("d-none");
      levelBadge.textContent = "Paused";
      levelBadge.className = "badge text-bg-secondary level-badge";
      recordingStatus.textContent = "Paused.";
    } else if (recorder.state === "paused") {
      recorder.resume();
      totalPaused += performance.now() - pausedAt;
      pausedAt = 0;
      pauseButtonText.textContent = "Pause";
      pauseIcon.className = "bi bi-pause-fill me-1";
      pausedOverlay.classList.add("d-none");
      recordingStatus.textContent = "Recording · WebM/Opus · 12 kbps";
    }
  };

  const writeRecording = async (blob, filename) => {
    const file = await recordingDirectory.getFileHandle(filename, { create: true });
    const writable = await file.createWritable();
    await writable.write(blob);
    await writable.close();
  };

  const updateSavedCount = () => {
    savedCount.textContent = String(savedRecordings.size);
    savedSection.classList.toggle("d-none", savedRecordings.size === 0);
  };

  const addSavedRecording = (blob, filename, directory) => {
    const url = URL.createObjectURL(blob);
    const row = document.createElement("div");
    row.className =
      "saved-recording list-group-item d-flex flex-column flex-lg-row align-items-lg-center gap-2 py-2";

    const name = document.createElement("code");
    name.className = "saved-name flex-grow-1 small";
    name.textContent = filename;

    const audio = document.createElement("audio");
    audio.controls = true;
    audio.preload = "metadata";
    audio.src = url;
    audio.setAttribute("aria-label", "Play " + filename);

    const actions = document.createElement("div");
    actions.className = "btn-group btn-group-sm align-self-start align-self-lg-center";

    const copyButton = document.createElement("button");
    copyButton.type = "button";
    copyButton.className = "btn btn-outline-secondary";
    copyButton.title = "Copy filename";
    copyButton.setAttribute("aria-label", "Copy filename " + filename);
    copyButton.insertAdjacentHTML("beforeend", '<i class="bi bi-copy"></i>');
    copyButton.addEventListener("click", async () => {
      const copied = await copyText(filename);
      if (!copied) {
        await showError("Could not copy filename", "Clipboard access was denied.");
        return;
      }
      copyButton.replaceChildren();
      copyButton.insertAdjacentHTML("beforeend", '<i class="bi bi-check-lg"></i>');
      copyButton.classList.replace("btn-outline-secondary", "btn-outline-success");
      setTimeout(() => {
        copyButton.replaceChildren();
        copyButton.insertAdjacentHTML("beforeend", '<i class="bi bi-copy"></i>');
        copyButton.classList.replace("btn-outline-success", "btn-outline-secondary");
      }, 1000);
    });

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "btn btn-outline-danger";
    deleteButton.title = "Delete recording";
    deleteButton.setAttribute("aria-label", "Delete recording " + filename);
    deleteButton.insertAdjacentHTML("beforeend", '<i class="bi bi-trash3"></i>');
    deleteButton.addEventListener("click", async () => {
      if (!window.confirm("Delete " + filename + " from your computer? This cannot be undone.")) return;
      deleteButton.disabled = true;
      try {
        let permission = await directory.queryPermission({ mode: "readwrite" });
        if (permission === "prompt") permission = await directory.requestPermission({ mode: "readwrite" });
        if (permission !== "granted") throw new Error("Write access to the recording folder was not granted.");
        try {
          await directory.removeEntry(filename);
        } catch (error) {
          if (!(error instanceof DOMException && error.name === "NotFoundError")) throw error;
        }
        URL.revokeObjectURL(url);
        row.remove();
        savedRecordings.delete(filename);
        updateSavedCount();
      } catch (error) {
        deleteButton.disabled = false;
        await showError("Could not delete recording", error);
      }
    });

    actions.append(copyButton, deleteButton);
    row.append(name, audio, actions);
    savedList.prepend(row);
    savedRecordings.set(filename, { url, directory, row });
    updateSavedCount();
  };

  const stopRecording = async () => {
    if (!recorder || recorder.state === "inactive") return;
    stopButton.disabled = true;
    pauseButton.disabled = true;
    recordingStatus.textContent = "Saving…";
    stoppedAt = performance.now();
    if (pausedAt) {
      totalPaused += stoppedAt - pausedAt;
      pausedAt = 0;
    }

    const stopped = new Promise((resolve, reject) => {
      recorder.addEventListener("stop", resolve, { once: true });
      recorder.addEventListener("error", (event) => reject(event.error), { once: true });
    });
    recorder.stop();

    try {
      await stopped;
      const duration = elapsedMs(stoppedAt);
      const rawBlob = new Blob(chunks, { type: MIME_TYPE });
      let blob = rawBlob;
      try {
        const { fixWebmDuration } = await import(
          "https://cdn.jsdelivr.net/npm/@fix-webm-duration/fix@1.0.1/+esm"
        );
        blob = await fixWebmDuration(rawBlob, duration, { logger: false });
      } catch (error) {
        // Duration metadata improves seeking in Chromium, but never block a save if the helper is unavailable.
        console.warn("Could not add WebM duration metadata", error);
      }
      const filename = formatFilename(startedDate);
      const savedDirectory = recordingDirectory;
      await cleanupAudio();
      await writeRecording(blob, filename);
      addSavedRecording(blob, filename, savedDirectory);
      await updateFolderUi();
      resetRecorderUi();
    } catch (error) {
      await cleanupAudio();
      const blob = new Blob(chunks, { type: MIME_TYPE });
      const filename = formatFilename(startedDate);
      if (fallbackUrl) URL.revokeObjectURL(fallbackUrl);
      fallbackUrl = URL.createObjectURL(blob);
      downloadFallback.href = fallbackUrl;
      downloadFallback.download = filename;
      saveFallback.classList.remove("d-none");
      recordingStatus.textContent = "Save failed.";
      await showError("Could not save recording", error);
    } finally {
      recorder = null;
      recordingDirectory = null;
      chunks = [];
      setRecordingUi(false);
      pauseButton.disabled = false;
      stopButton.disabled = false;
      pausedOverlay.classList.add("d-none");
    }
  };

  folderButton.addEventListener("click", async () => {
    folderButton.disabled = true;
    try {
      await chooseDirectory();
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        await showError("Could not choose folder", error);
      }
    } finally {
      folderButton.disabled = false;
    }
  });
  recordButton.addEventListener("click", startRecording);
  pauseButton.addEventListener("click", togglePause);
  stopButton.addEventListener("click", stopRecording);

  window.addEventListener("beforeunload", (event) => {
    if (recorder && recorder.state !== "inactive") {
      event.preventDefault();
      event.returnValue = "";
    }
    for (const { url } of savedRecordings.values()) URL.revokeObjectURL(url);
  });

  new ResizeObserver(drawWaveform).observe(canvas);
  drawWaveform();

  try {
    directoryHandle = await loadDirectoryHandle();
    await updateFolderUi();
  } catch (error) {
    recordingStatus.textContent = "Could not restore the saved folder.";
    await showError("Could not restore saved folder", error);
  }
}

if (typeof document !== "undefined" && document.querySelector("#record-button")) init();
