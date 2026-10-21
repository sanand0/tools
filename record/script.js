// @ts-check

const DB_NAME = "record-audio";
const STORE_NAME = "settings";
const DIRECTORY_KEY = "recordings-directory";
const HISTORY_MS = 5000;
const SAMPLE_MS = 50;
const HISTORY_POINTS = HISTORY_MS / SAMPLE_MS;
const MIN_DB = -60;
const SILENT_DB = -50;
const SILENT_MS = 3000;
const AUDIO_MIME_TYPE = "audio/webm;codecs=opus";
const AUDIO_BITS_PER_SECOND = 12_000;
// AV1 compresses best at very low bitrates; Chromium supports it in MediaRecorder from M113+. VP9/VP8 are fallbacks.
const VIDEO_MIME_TYPES = ["video/webm;codecs=av01,opus", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus"];
const LIST_LIMIT = 10;

/**
 * Capture settings per mode. Video is deliberately tiny: the goal is the smallest file that still shows
 * a face (camera) or legible text (screen, which needs more pixels but very few frames).
 */
const MODES = {
  audio: { icon: "mic-fill", countdown: 0 },
  camera: {
    icon: "camera-video-fill",
    countdown: 3,
    videoBitsPerSecond: 48_000,
    video: { width: { ideal: 320 }, height: { ideal: 240 }, frameRate: { ideal: 15, max: 15 } },
  },
  screen: {
    icon: "display",
    countdown: 3,
    videoBitsPerSecond: 96_000,
    video: { width: { max: 1280 }, height: { max: 720 }, frameRate: { ideal: 5, max: 5 } },
    // "detail" tells the encoder to keep text sharp and drop frames instead of resolution.
    contentHint: "detail",
  },
};

const CODEC_NAMES = { av01: "AV1", vp9: "VP9", vp8: "VP8", opus: "Opus" };

/** @param {string} title */
export function slugify(title) {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Returns YYYY-MM-DD-HH-MM-SS[-camera|-screen][-title].webm. Audio keeps the original bare-timestamp name.
 * @param {Date} date
 * @param {{kind?: string, title?: string}} options
 */
export function formatFilename(date = new Date(), { kind = "audio", title = "" } = {}) {
  const parts = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
    String(date.getHours()).padStart(2, "0"),
    String(date.getMinutes()).padStart(2, "0"),
    String(date.getSeconds()).padStart(2, "0"),
  ];
  if (kind !== "audio") parts.push(kind);
  const slug = slugify(title);
  if (slug) parts.push(slug);
  return parts.join("-") + ".webm";
}

/** Infers the recording mode from a filename written by formatFilename. @param {string} name */
export function recordingKind(name) {
  return name.match(/^\d{4}(?:-\d\d){5}-(camera|screen)(?:-|\.)/)?.[1] ?? "audio";
}

/** @param {(type: string) => boolean} isSupported @param {boolean} video */
export function pickMimeType(isSupported, video) {
  if (!video) return AUDIO_MIME_TYPE;
  return VIDEO_MIME_TYPES.find(isSupported) ?? "video/webm";
}

/** @param {string} mimeType */
export function codecLabel(mimeType) {
  const codecs = mimeType.match(/codecs=(.+)$/)?.[1].split(",") ?? [];
  return codecs.map((codec) => CODEC_NAMES[codec] ?? codec).join(" + ");
}

/** @param {number} bytes */
export function formatBytes(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + " KB";
  return (bytes / 1024 / 1024).toFixed(1) + " MB";
}

/** "Today", "Yesterday", or a short date, for grouping the library. @param {Date} date @param {Date} now */
export function dayLabel(date, now = new Date()) {
  const days = Math.round((new Date(now).setHours(0, 0, 0, 0) - new Date(date).setHours(0, 0, 0, 0)) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  const options = { weekday: "short", day: "numeric", month: "short" };
  if (date.getFullYear() !== now.getFullYear()) options.year = "numeric";
  return date.toLocaleDateString(undefined, options);
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

/** @param {string} key */
function loadSetting(key) {
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

/** @param {string} key @param {string} value */
function saveSetting(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Device choice is a convenience; ignore storage failures.
  }
}

async function init() {
  const $ = (selector) => document.querySelector(selector);
  const folderName = $("#folder-name");
  const folderStatus = $("#folder-status");
  const folderButton = $("#folder-button");
  const folderButtonText = folderButton.querySelector("span");
  const modeInputs = [...document.querySelectorAll('input[name="mode"]')];
  const device = $("#device");
  const lcdMode = $("#lcd-mode");
  const stagePlaceholder = $("#stage-placeholder");
  const stageHint = $("#stage-hint");
  const preview = $("#preview");
  const countdown = $("#countdown");
  const canvas = $("#waveform");
  const ctx = canvas.getContext("2d");
  const recordButton = $("#record-button");
  const pauseButton = $("#pause-button");
  const pauseButtonText = pauseButton.querySelector(".legend span");
  const pauseIcon = pauseButton.querySelector("i");
  const stopButton = $("#stop-button");
  const discardButton = $("#discard-button");
  const timer = $("#timer");
  const recordingStatus = $("#recording-status");
  const peakLabel = $("#peak-db");
  const levelBadge = $("#level-badge");
  const pausedOverlay = $("#paused-overlay");
  const titleInput = $("#title-input");
  const micSelect = $("#mic-select");
  const cameraSelect = $("#camera-select");
  const cameraSelectColumn = $("#camera-select-column");
  const saveFallback = $("#save-fallback");
  const downloadFallback = $("#download-fallback");
  const recordingsList = $("#recordings-list");
  const recordingsEmpty = $("#recordings-empty");
  const recordingsSummary = $("#recordings-summary");
  const refreshButton = $("#refresh-button");
  const reconnectButton = $("#reconnect-button");
  const showAllButton = $("#show-all-button");

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
  /** @type {MediaStream[]} Every captured source stream, so cleanup can stop camera/screen/mic lights. */
  let streams = [];
  /** @type {AudioContext|null} */
  let audioContext = null;
  /** @type {AnalyserNode|null} */
  let analyser = null;
  /** @type {Float32Array|null} */
  let samples = null;
  /** @type {Blob[]} */
  let chunks = [];
  let recordedBytes = 0;
  /** @type {number[]} */
  let history = [];
  /** @type {string[]} */
  let listUrls = [];
  /** "idle" | "starting" | "countdown" | "recording" | "saving" */
  let phase = "idle";
  let mode = "audio";
  let mimeType = AUDIO_MIME_TYPE;
  let statusLabel = "";
  let showAll = false;
  /** @type {(() => void)|null} */
  let cancelCountdown = null;
  let animationFrame = 0;
  let lastSampleAt = 0;
  let startedAt = 0;
  let startedDate = new Date();
  let pausedAt = 0;
  let totalPaused = 0;
  let stoppedAt = 0;
  let fallbackUrl = "";

  const setMode = (value) => {
    mode = MODES[value] ? value : "audio";
    modeInputs.forEach((input) => (input.checked = input.value === mode));
    device.dataset.mode = mode;
    lcdMode.textContent = mode;
    cameraSelectColumn.hidden = mode !== "camera";
    stageHint.textContent =
      mode === "screen" ? "Pick a screen, window, or tab when you press record" : "Camera preview appears when you record";
    stagePlaceholder.querySelector("i").className = "bi bi-" + (mode === "screen" ? "display" : "camera-video");
    window.history.replaceState(null, "", "#?mode=" + mode);
  };

  const updateFolderUi = async () => {
    if (!directoryHandle) {
      folderName.textContent = "No folder selected";
      folderStatus.textContent = "Choose a folder";
      folderStatus.dataset.tone = "off";
      folderButtonText.textContent = "Choose folder";
      recordingStatus.textContent = "Choose a folder, then press record.";
      return;
    }
    folderName.textContent = directoryHandle.name || "Selected folder";
    folderButtonText.textContent = "Change";
    const permission = await directoryHandle.queryPermission({ mode: "readwrite" });
    folderStatus.textContent = permission === "granted" ? "Ready" : "Reconnect on record";
    folderStatus.dataset.tone = permission === "granted" ? "ready" : "warn";
    recordingStatus.textContent =
      permission === "granted" ? "Ready to record." : "Press record to restore write access.";
  };

  const chooseDirectory = async () => {
    const handle = await window.showDirectoryPicker({ id: "recordings", mode: "readwrite" });
    await storeDirectoryHandle(handle);
    directoryHandle = handle;
    await updateFolderUi();
    await renderRecordings();
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
    // Read colours from the canvas so the display can override them for its dark background.
    const style = getComputedStyle(canvas);
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
      levelBadge.dataset.level = "secondary";
      return;
    }
    const recent = history.slice(-Math.round(1000 / SAMPLE_MS));
    const db = Math.max(...recent);
    const level = classifyLevel(db);
    peakLabel.textContent = Math.round(db) + " dBFS";
    levelBadge.textContent = level.label;
    levelBadge.dataset.level = level.color;
  };

  const elapsedMs = (now = performance.now()) => {
    if (!startedAt) return 0;
    const end = stoppedAt || pausedAt || now;
    return end - startedAt - totalPaused;
  };

  // Warn early if the mic is muted or the wrong device is selected, rather than discovering it after a long take.
  const isSilent = (now) =>
    elapsedMs(now) > SILENT_MS + 1000 && history.slice(-SILENT_MS / SAMPLE_MS).every((db) => db < SILENT_DB);

  const updateStatus = (now = performance.now()) => {
    if (!recorder) return;
    const paused = recorder.state === "paused";
    const silent = !paused && isSilent(now);
    recordingStatus.classList.toggle("warn", silent);
    recordingStatus.textContent = paused
      ? "Paused · " + formatBytes(recordedBytes)
      : silent
        ? "No sound for 3s. Is your microphone muted?"
        : statusLabel + " · " + formatBytes(recordedBytes);
  };

  const animate = (now) => {
    if (recorder && recorder.state === "recording" && analyser && samples && now - lastSampleAt >= SAMPLE_MS) {
      analyser.getFloatTimeDomainData(samples);
      history.push(peakDb(samples));
      if (history.length > HISTORY_POINTS) history.shift();
      lastSampleAt = now;
      updateLevel();
      updateStatus(now);
    }
    const time = formatDuration(elapsedMs(now));
    timer.textContent = time;
    // Show state in the tab title so a recording running in a background tab isn't forgotten.
    const title = (recorder?.state === "paused" ? "❚❚ " : "● ") + time + " · Record";
    if (document.title !== title) document.title = title;
    drawWaveform();
    animationFrame = requestAnimationFrame(animate);
  };

  const cleanupMedia = async () => {
    cancelAnimationFrame(animationFrame);
    animationFrame = 0;
    streams.forEach((stream) => stream.getTracks().forEach((track) => track.stop()));
    streams = [];
    preview.srcObject = null;
    preview.classList.add("d-none");
    stagePlaceholder.classList.remove("d-none");
    countdown.classList.add("d-none");
    if (audioContext && audioContext.state !== "closed") await audioContext.close();
    audioContext = null;
    analyser = null;
    samples = null;
  };

  const resetRecorderUi = (status = "Ready to record.") => {
    history = [];
    startedAt = 0;
    pausedAt = 0;
    totalPaused = 0;
    stoppedAt = 0;
    recordedBytes = 0;
    timer.textContent = "00:00";
    document.title = "Record";
    pausedOverlay.classList.add("d-none");
    recordingStatus.classList.remove("warn");
    updateLevel();
    drawWaveform();
    recordingStatus.textContent = status;
  };

  /** Derives every control's enabled state, and the device's data-state (which drives the CSS), from `phase`. */
  const syncUi = () => {
    device.dataset.state = phase === "recording" && recorder?.state === "paused" ? "paused" : phase;
    recordButton.disabled = phase !== "idle";
    pauseButton.disabled = phase !== "recording";
    stopButton.disabled = phase !== "recording";
    discardButton.disabled = phase !== "recording" && phase !== "countdown";
    for (const control of [folderButton, micSelect, cameraSelect, ...modeInputs]) control.disabled = phase !== "idle";
  };

  const populateDevices = async () => {
    const devices = await navigator.mediaDevices.enumerateDevices();
    for (const [select, kind, label, key] of [
      [micSelect, "audioinput", "Microphone", "record-mic"],
      [cameraSelect, "videoinput", "Camera", "record-camera"],
    ]) {
      const options = devices
        .filter((device) => device.kind === kind && device.deviceId)
        .map((device, index) => new Option(device.label || label + " " + (index + 1), device.deviceId));
      select.replaceChildren(new Option("Default " + label.toLowerCase(), ""), ...options);
      const saved = loadSetting(key);
      select.value = options.some((option) => option.value === saved) ? saved : "";
    }
  };

  /** @param {string} deviceId */
  const getMicrophone = async (deviceId) => {
    const voiceConstraints = {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: false,
      ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
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

  /**
   * Opens the sources for the current mode and returns the single stream to record.
   * Screen mode asks for the picker first, so cancelling it doesn't leave the mic open.
   */
  const captureStream = async () => {
    const settings = MODES[mode];
    /** @type {MediaStream|null} */
    let video = null;
    if (mode === "screen") {
      video = await navigator.mediaDevices.getDisplayMedia({
        video: settings.video,
        audio: true,
        systemAudio: "include",
        selfBrowserSurface: "exclude",
      });
      streams.push(video);
    }
    const mic = await getMicrophone(micSelect.value);
    streams.push(mic);
    if (mode === "camera") {
      const deviceId = cameraSelect.value;
      video = await navigator.mediaDevices.getUserMedia({
        video: { ...settings.video, ...(deviceId ? { deviceId: { exact: deviceId } } : {}) },
      });
      streams.push(video);
    }

    audioContext = new AudioContext();
    await audioContext.resume();
    const micSource = audioContext.createMediaStreamSource(mic);
    analyser = audioContext.createAnalyser();
    // 4096 samples ≈85 ms at 48 kHz. Sampling every 50 ms overlaps windows,
    // making short clipping peaks much less likely to fall between measurements.
    analyser.fftSize = 4096;
    micSource.connect(analyser);
    samples = new Float32Array(analyser.fftSize);

    if (!video) return mic;
    const [videoTrack] = video.getVideoTracks();
    if (settings.contentHint) videoTrack.contentHint = settings.contentHint;
    // Clicking the browser's "Stop sharing" bar should save the take, not silently freeze it.
    videoTrack.addEventListener("ended", () => (phase === "countdown" ? cancelCountdown?.() : stopRecording()));
    preview.srcObject = video;
    preview.classList.remove("d-none");
    stagePlaceholder.classList.add("d-none");

    // The meter shows only the mic, but tab/system audio (if shared) is mixed into the recording.
    let [audioTrack] = mic.getAudioTracks();
    if (video.getAudioTracks().length) {
      const mix = audioContext.createMediaStreamDestination();
      mix.channelCount = 1;
      micSource.connect(mix);
      audioContext.createMediaStreamSource(video).connect(mix);
      [audioTrack] = mix.stream.getAudioTracks();
    }
    return new MediaStream([videoTrack, audioTrack]);
  };

  /** Resolves true after the countdown, or false if cancelled. @param {number} seconds */
  const runCountdown = (seconds) =>
    new Promise((resolve) => {
      if (!seconds) return resolve(true);
      let left = seconds;
      countdown.textContent = String(left);
      countdown.classList.remove("d-none");
      recordingStatus.textContent = "Starting in " + left + "… Press Esc to cancel.";
      const tick = setInterval(() => {
        left -= 1;
        if (left > 0) {
          countdown.textContent = String(left);
          recordingStatus.textContent = "Starting in " + left + "… Press Esc to cancel.";
          return;
        }
        finish(true);
      }, 1000);
      const finish = (ok) => {
        clearInterval(tick);
        cancelCountdown = null;
        countdown.classList.add("d-none");
        resolve(ok);
      };
      cancelCountdown = () => finish(false);
    });

  const startRecording = async () => {
    if (phase !== "idle") return;
    phase = "starting";
    syncUi();
    saveFallback.classList.add("d-none");
    recordingStatus.textContent = mode === "audio" ? "Preparing microphone…" : "Waiting for permission…";
    try {
      recordingDirectory = await ensureDirectory();
      const stream = await captureStream();
      populateDevices().catch((error) => console.warn("Could not list devices", error));

      if (MODES[mode].countdown) {
        phase = "countdown";
        syncUi();
        if (!(await runCountdown(MODES[mode].countdown))) {
          await cleanupMedia();
          phase = "idle";
          syncUi();
          resetRecorderUi("Cancelled.");
          return;
        }
      }

      chunks = [];
      history = [];
      recordedBytes = 0;
      startedAt = performance.now();
      startedDate = new Date();
      pausedAt = 0;
      totalPaused = 0;
      stoppedAt = 0;
      lastSampleAt = 0;
      timer.textContent = "00:00";
      pausedOverlay.classList.add("d-none");
      pauseButtonText.textContent = "Pause";
      pauseIcon.className = "bi bi-pause-fill";

      const video = mode !== "audio";
      mimeType = pickMimeType((type) => MediaRecorder.isTypeSupported(type), video);
      recorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: AUDIO_BITS_PER_SECOND,
        audioBitrateMode: "variable",
        ...(video ? { videoBitsPerSecond: MODES[mode].videoBitsPerSecond } : {}),
      });
      recorder.addEventListener("dataavailable", (event) => {
        if (!event.data.size) return;
        chunks.push(event.data);
        recordedBytes += event.data.size;
      });
      // 1s slices let the status line show the file size growing.
      recorder.start(1000);

      phase = "recording";
      syncUi();
      const kbps = (AUDIO_BITS_PER_SECOND + (video ? MODES[mode].videoBitsPerSecond : 0)) / 1000;
      statusLabel = "Recording · " + codecLabel(mimeType) + " · ≤" + kbps + " kbps";
      updateStatus();
      updateLevel();
      drawWaveform();
      animationFrame = requestAnimationFrame(animate);
    } catch (error) {
      await cleanupMedia();
      phase = "idle";
      recorder = null;
      syncUi();
      if (error instanceof DOMException && ["AbortError", "NotAllowedError"].includes(error.name)) {
        resetRecorderUi(error.name === "NotAllowedError" ? "Permission denied." : "Recording cancelled.");
      } else {
        recordingStatus.textContent = "Could not start recording.";
        await showError("Could not start recording", error);
      }
    }
  };

  const togglePause = () => {
    if (!recorder) return;
    if (recorder.state === "recording") {
      recorder.pause();
      pausedAt = performance.now();
      pauseButtonText.textContent = "Resume";
      pauseIcon.className = "bi bi-play-fill";
      pausedOverlay.classList.remove("d-none");
      levelBadge.textContent = "Paused";
      levelBadge.dataset.level = "secondary";
    } else if (recorder.state === "paused") {
      recorder.resume();
      totalPaused += performance.now() - pausedAt;
      pausedAt = 0;
      pauseButtonText.textContent = "Pause";
      pauseIcon.className = "bi bi-pause-fill";
      pausedOverlay.classList.add("d-none");
    }
    syncUi();
    updateStatus();
  };

  /** Stops the recorder and resolves once the final chunk has arrived. */
  const stopRecorder = () => {
    const stopped = new Promise((resolve, reject) => {
      recorder.addEventListener("stop", resolve, { once: true });
      recorder.addEventListener("error", (event) => reject(event.error), { once: true });
    });
    recorder.stop();
    return stopped;
  };

  const writeRecording = async (blob, filename) => {
    const file = await recordingDirectory.getFileHandle(filename, { create: true });
    const writable = await file.createWritable();
    await writable.write(blob);
    await writable.close();
  };

  const stopRecording = async () => {
    if (phase !== "recording" || !recorder || recorder.state === "inactive") return;
    phase = "saving";
    syncUi();
    recordingStatus.textContent = "Saving…";
    stoppedAt = performance.now();
    if (pausedAt) {
      totalPaused += stoppedAt - pausedAt;
      pausedAt = 0;
    }
    const filename = formatFilename(startedDate, { kind: mode, title: titleInput.value });

    try {
      await stopRecorder();
      const duration = elapsedMs(stoppedAt);
      const rawBlob = new Blob(chunks, { type: mimeType });
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
      await cleanupMedia();
      await writeRecording(blob, filename);
      titleInput.value = "";
      await updateFolderUi();
      resetRecorderUi("Saved " + filename + " · " + formatBytes(blob.size));
      await renderRecordings(filename);
    } catch (error) {
      await cleanupMedia();
      const blob = new Blob(chunks, { type: mimeType });
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
      phase = "idle";
      syncUi();
      pausedOverlay.classList.add("d-none");
    }
  };

  const discardRecording = async () => {
    if (phase === "countdown") return cancelCountdown?.();
    if (phase !== "recording" || !recorder) return;
    // Guard long takes against an accidental Esc; short false starts are discarded instantly.
    if (elapsedMs() > 30_000 && !window.confirm("Discard this " + formatDuration(elapsedMs()) + " recording?")) return;
    phase = "saving";
    syncUi();
    await stopRecorder().catch(() => {});
    await cleanupMedia();
    recorder = null;
    recordingDirectory = null;
    chunks = [];
    phase = "idle";
    syncUi();
    resetRecorderUi("Discarded.");
  };

  /** @param {HTMLButtonElement} button @param {string} iconName */
  const flashButton = (button, iconName) => {
    const original = button.innerHTML;
    button.replaceChildren();
    button.insertAdjacentHTML("beforeend", `<i class="bi bi-${iconName}"></i>`);
    setTimeout(() => {
      button.replaceChildren();
      button.insertAdjacentHTML("beforeend", original);
    }, 1000);
  };

  /** @param {string} title @param {string} iconName @param {string} color */
  const actionButton = (title, iconName, className = "") => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.title = title;
    button.setAttribute("aria-label", title);
    button.insertAdjacentHTML("beforeend", `<i class="bi bi-${iconName}"></i>`);
    return button;
  };

  /** @param {FileSystemFileHandle} handle @param {File} file */
  const recordingRow = (handle, file) => {
    const { name } = file;
    const kind = recordingKind(name);
    const url = URL.createObjectURL(file);
    listUrls.push(url);

    const row = document.createElement("article");
    row.className = "take";
    row.dataset.name = name;

    const head = document.createElement("div");
    head.className = "take-head";
    head.insertAdjacentHTML("beforeend", `<span class="take-kind"><i class="bi bi-${MODES[kind].icon}"></i></span>`);
    const info = document.createElement("div");
    info.className = "take-text";
    const nameLabel = document.createElement("span");
    nameLabel.className = "take-name";
    nameLabel.textContent = name;
    const meta = document.createElement("div");
    meta.className = "take-meta";
    const time = new Date(file.lastModified).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    meta.textContent = time + " · " + formatBytes(file.size);
    info.append(nameLabel, meta);

    const media = document.createElement(kind === "audio" ? "audio" : "video");
    media.controls = true;
    media.preload = "metadata";
    media.src = url;
    media.setAttribute("aria-label", "Play " + name);
    if (media instanceof HTMLVideoElement) media.playsInline = true;

    const actions = document.createElement("div");
    actions.className = "take-actions";

    const copyButton = actionButton("Copy filename " + name, "copy");
    copyButton.addEventListener("click", async () => {
      if (await copyText(name)) flashButton(copyButton, "check-lg");
      else await showError("Could not copy filename", "Clipboard access was denied.");
    });
    actions.append(copyButton);

    // FileSystemHandle.move() renames in place (Chromium). Hide rename where it's missing.
    if ("move" in handle) {
      const renameButton = actionButton("Rename " + name, "pencil");
      renameButton.addEventListener("click", () => {
        const input = document.createElement("input");
        input.className = "take-name-input";
        input.value = name.replace(/\.webm$/, "");
        input.setAttribute("aria-label", "New name for " + name);
        nameLabel.replaceWith(input);
        input.focus();
        input.select();
        let done = false;
        const commit = async (save) => {
          if (done) return;
          done = true;
          const newName = slugify(input.value) ? input.value.trim().replace(/[\\/:*?"<>|]+/g, "-") + ".webm" : name;
          input.replaceWith(nameLabel);
          if (!save || newName === name) return;
          try {
            const exists = await directoryHandle.getFileHandle(newName).then(
              () => true,
              () => false,
            );
            if (exists) throw new Error(newName + " already exists.");
            await handle.move(newName);
            await renderRecordings(newName);
          } catch (error) {
            await showError("Could not rename recording", error);
          }
        };
        input.addEventListener("keydown", (event) => {
          if (event.key === "Enter") commit(true);
          if (event.key === "Escape") commit(false);
        });
        input.addEventListener("blur", () => commit(true));
      });
      actions.append(renameButton);
    }

    const deleteButton = actionButton("Delete " + name, "trash3", "danger");
    deleteButton.addEventListener("click", async () => {
      if (!window.confirm("Delete " + name + " from your computer? This cannot be undone.")) return;
      deleteButton.disabled = true;
      try {
        await directoryHandle.removeEntry(name);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "NotFoundError")) {
          deleteButton.disabled = false;
          await showError("Could not delete recording", error);
          return;
        }
      }
      await renderRecordings();
    });
    actions.append(deleteButton);

    head.append(info, actions);
    // Video gets a thumbnail-sized player on top; audio a slim player under the name.
    if (kind === "audio") row.append(head, media);
    else row.append(media, head);
    return row;
  };

  /** Lists .webm files in the folder, newest first. @param {string} [highlight] filename to flash */
  const renderRecordings = async (highlight) => {
    listUrls.forEach((url) => URL.revokeObjectURL(url));
    listUrls = [];
    reconnectButton.classList.add("d-none");
    showAllButton.classList.add("d-none");
    recordingsSummary.textContent = "";
    if (!directoryHandle) {
      recordingsList.replaceChildren();
      recordingsEmpty.textContent = "Choose a folder. Your recordings will appear here.";
      recordingsEmpty.classList.remove("d-none");
      return;
    }
    // Reading the folder on page load needs a click to re-grant access; don't prompt unprompted.
    if ((await directoryHandle.queryPermission({ mode: "readwrite" })) !== "granted") {
      recordingsList.replaceChildren();
      recordingsEmpty.classList.add("d-none");
      reconnectButton.classList.remove("d-none");
      return;
    }
    recordingsEmpty.textContent = "Loading…";
    const entries = [];
    for await (const handle of directoryHandle.values()) {
      if (handle.kind === "file" && handle.name.endsWith(".webm")) entries.push(handle);
    }
    const files = await Promise.all(entries.map(async (handle) => ({ handle, file: await handle.getFile() })));
    files.sort((a, b) => b.file.lastModified - a.file.lastModified || b.file.name.localeCompare(a.file.name));
    const shown = showAll ? files : files.slice(0, LIST_LIMIT);
    const items = [];
    let lastDay = "";
    for (const { handle, file } of shown) {
      const day = dayLabel(new Date(file.lastModified));
      if (day !== lastDay) {
        const heading = document.createElement("h3");
        heading.className = "day";
        heading.textContent = lastDay = day;
        items.push(heading);
      }
      items.push(recordingRow(handle, file));
    }
    recordingsList.replaceChildren(...items);
    recordingsEmpty.textContent = "No takes yet. Press R to record your first.";
    recordingsEmpty.classList.toggle("d-none", files.length > 0);
    const total = files.reduce((sum, { file }) => sum + file.size, 0);
    if (files.length) {
      recordingsSummary.textContent =
        files.length + " recording" + (files.length === 1 ? "" : "s") + " · " + formatBytes(total);
    }
    if (files.length > shown.length) {
      showAllButton.textContent = "Show all " + files.length;
      showAllButton.classList.remove("d-none");
    }
    if (highlight) recordingsList.querySelector(`[data-name="${CSS.escape(highlight)}"]`)?.classList.add("just-saved");
  };

  /** @param {unknown} error */
  const reportListError = (error) => showError("Could not list recordings", error);

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
  modeInputs.forEach((input) => input.addEventListener("change", () => setMode(input.value)));
  micSelect.addEventListener("change", () => saveSetting("record-mic", micSelect.value));
  cameraSelect.addEventListener("change", () => saveSetting("record-camera", cameraSelect.value));
  recordButton.addEventListener("click", startRecording);
  pauseButton.addEventListener("click", togglePause);
  stopButton.addEventListener("click", stopRecording);
  discardButton.addEventListener("click", discardRecording);
  refreshButton.addEventListener("click", () => renderRecordings().catch(reportListError));
  showAllButton.addEventListener("click", () => {
    showAll = true;
    renderRecordings().catch(reportListError);
  });
  reconnectButton.addEventListener("click", async () => {
    try {
      if ((await directoryHandle.requestPermission({ mode: "readwrite" })) === "granted") await updateFolderUi();
      await renderRecordings();
    } catch (error) {
      await reportListError(error);
    }
  });
  titleInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") titleInput.blur();
  });

  document.addEventListener("keydown", (event) => {
    const target = /** @type {HTMLElement} */ (event.target);
    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
    if (target.closest("input, textarea, select, [contenteditable]")) return;
    const key = event.key.toLowerCase();
    if (key === "r" && phase === "idle") startRecording();
    // Let a focused button handle its own Space press so it doesn't toggle twice.
    else if (key === " " && phase === "recording" && target.tagName !== "BUTTON") {
      event.preventDefault();
      togglePause();
    } else if (key === "s" && phase === "recording") stopRecording();
    else if (key === "escape") discardRecording();
  });

  window.addEventListener("beforeunload", (event) => {
    if (phase !== "idle") {
      event.preventDefault();
      event.returnValue = "";
    }
  });
  navigator.mediaDevices.addEventListener?.("devicechange", () => populateDevices().catch(console.warn));

  setMode(new URLSearchParams(location.hash.replace(/^#\??/, "")).get("mode") ?? "audio");
  new ResizeObserver(drawWaveform).observe(canvas);
  drawWaveform();
  populateDevices().catch((error) => console.warn("Could not list devices", error));

  try {
    directoryHandle = await loadDirectoryHandle();
    await updateFolderUi();
    await renderRecordings();
  } catch (error) {
    recordingStatus.textContent = "Could not restore the saved folder.";
    await showError("Could not restore saved folder", error);
  }
}

if (typeof document !== "undefined" && document.querySelector("#record-button")) init();
