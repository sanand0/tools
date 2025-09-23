// @ts-check
import { openaiHelp } from "../common/aiconfig.js";

/** @typedef {{ session: any, pc: RTCPeerConnection | null, dc: RTCDataChannel | null, localStream: MediaStream | null }} VoiceState */

const DEFAULT_BASE_URLS = [
  "https://api.openai.com/v1",
  "https://aipipe.org/openai/v1",
  "https://llmfoundry.straive.com/openai/v1",
];

const callState = /** @type {VoiceState} */ ({ session: null, pc: null, dc: null, localStream: null });
const transcriptItems = /** @type {Array<{ key: string, role: "user" | "assistant", text: string }>} */ ([]);
let openaiConfigLoader;

const root = document;
const configureBtn = root.getElementById("configure-btn");
const startBtn = /** @type {HTMLButtonElement} */ (root.getElementById("start-call"));
const stopBtn = /** @type {HTMLButtonElement} */ (root.getElementById("stop-call"));
const voiceInput = /** @type {HTMLInputElement} */ (root.getElementById("voice-name"));
const modelInput = /** @type {HTMLInputElement} */ (root.getElementById("model-name"));
const instructionsInput = /** @type {HTMLTextAreaElement} */ (root.getElementById("system-instructions"));
const spinner = root.getElementById("connect-spinner");
const statusLabel = root.getElementById("call-status");
const audioEl = /** @type {HTMLAudioElement} */ (root.getElementById("remote-audio"));
const messageForm = /** @type {HTMLFormElement} */ (root.getElementById("message-form"));
const messageInput = /** @type {HTMLInputElement} */ (root.getElementById("user-message"));
const transcriptEl = root.getElementById("transcript-log");
const alertContainer = root.getElementById("alert-container");

const getOverrides = () => /** @type {any} */ (window.voicebotTestOverrides ?? {});

/**
 * @param {boolean} show
 */
async function requestCredentials(show = false) {
  const overrides = getOverrides();
  if (overrides.openaiConfig) return overrides.openaiConfig();
  if (!openaiConfigLoader)
    openaiConfigLoader = import("https://cdn.jsdelivr.net/npm/bootstrap-llm-provider@1").then((mod) => mod.openaiConfig);
  const openaiConfig = await openaiConfigLoader;
  return openaiConfig({ defaultBaseUrls: DEFAULT_BASE_URLS, show, help: openaiHelp });
}

function buildUrl(baseUrl, path) {
  const normalized = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(path, normalized).toString();
}

function setStatus(message, loading) {
  statusLabel.textContent = message;
  if (!spinner) return;
  spinner.classList.toggle("d-none", !loading);
}

function resetTranscript() {
  transcriptItems.length = 0;
  if (transcriptEl) transcriptEl.replaceChildren();
}

function renderTranscript() {
  if (!transcriptEl) return;
  transcriptEl.replaceChildren(
    ...transcriptItems.map((item) => {
      const p = document.createElement("p");
      p.className = `mb-1 ${item.role === "user" ? "text-primary fw-semibold" : ""}`.trim();
      p.textContent = item.text;
      return p;
    }),
  );
}

function pushTranscript(role, text, key) {
  if (!text) return;
  const id = key ?? `${role}-${Date.now()}-${transcriptItems.length}`;
  let entry = transcriptItems.find((item) => item.key === id);
  if (!entry) {
    entry = { key: id, role, text: role === "assistant" ? "" : text };
    transcriptItems.push(entry);
  }
  if (role === "assistant") entry.text += text;
  else entry.text = text;
  renderTranscript();
}

function showAlert(message, variant = "danger") {
  if (!alertContainer) return;
  alertContainer.innerHTML = `
    <div class="alert alert-${variant} alert-dismissible fade show" role="alert">
      ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    </div>`;
}

function clearAlert() {
  if (alertContainer) alertContainer.innerHTML = "";
}

function fetchImpl(input, init) {
  const overrides = getOverrides();
  if (overrides.fetch) return overrides.fetch(input, init);
  return fetch(input, init);
}

function createPeerConnection() {
  const overrides = getOverrides();
  if (overrides.createPeerConnection) return overrides.createPeerConnection();
  return new RTCPeerConnection();
}

async function getMicrophoneStream() {
  const overrides = getOverrides();
  if (overrides.getUserMedia) return overrides.getUserMedia({ audio: true });
  return navigator.mediaDevices.getUserMedia({ audio: true });
}

function cleanupStream() {
  callState.localStream?.getTracks().forEach((track) => track.stop());
  callState.localStream = null;
}

function teardownConnection() {
  callState.dc?.close?.();
  callState.pc?.close?.();
  callState.dc = null;
  callState.pc = null;
  callState.session = null;
  cleanupStream();
  startBtn.classList.remove("d-none");
  stopBtn.classList.add("d-none");
  setStatus("Disconnected", false);
}

function handleDataMessage(event) {
  let payload;
  try {
    payload = JSON.parse(event.data);
  } catch (error) {
    console.warn("voicebot: cannot parse event", error);
    return;
  }
  if (payload.type === "response.text.delta" || payload.type === "response.output_text.delta") {
    const idx = payload.content_index ?? 0;
    pushTranscript("assistant", payload.delta ?? payload.text ?? "", `${payload.response_id}:${idx}`);
  } else if (payload.type === "conversation.item.created" && payload.item?.role === "user") {
    pushTranscript("user", payload.item.content?.[0]?.text ?? "");
  }
}

async function startCall() {
  if (callState.pc) return;
  clearAlert();
  resetTranscript();
  setStatus("Connecting…", true);
  startBtn.disabled = true;
  try {
    const credentials = await requestCredentials();
    if (!credentials?.apiKey) throw new Error("Configure your API key first.");
    const baseUrl = credentials.baseUrl?.trim();
    if (!baseUrl) throw new Error("Enter an API base URL.");

    const model = modelInput.value.trim() || "gpt-realtime";
    const voice = voiceInput.value.trim() || "verse";
    const instructions = instructionsInput.value.trim();

    const sessionResponse = await fetchImpl(buildUrl(baseUrl, "realtime/sessions"), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${credentials.apiKey}`,
        "Content-Type": "application/json",
        "OpenAI-Beta": "realtime=v1",
        "Cache-Control": "no-cache",
      },
      body: JSON.stringify({ model, voice, instructions, modalities: ["text", "audio"] }),
    });
    if (!sessionResponse.ok) throw new Error(`Session error: ${sessionResponse.status}`);
    const session = await sessionResponse.json();

    const pc = createPeerConnection();
    callState.pc = pc;
    callState.session = session;

    pc.ontrack = (event) => {
      if (event.streams?.[0]) audioEl.srcObject = event.streams[0];
    };
    pc.addEventListener("connectionstatechange", () => {
      if (!pc) return;
      if (pc.connectionState === "connected") setStatus("Connected", false);
      else if (pc.connectionState === "failed") showAlert("Connection failed. Try again.");
    });

    const localStream = await getMicrophoneStream();
    callState.localStream = localStream;
    localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

    const dc = pc.createDataChannel("oai-events");
    callState.dc = dc;
    dc.addEventListener("open", () => setStatus("Connected", false));
    dc.addEventListener("close", () => setStatus("Disconnected", false));
    dc.addEventListener("message", handleDataMessage);

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    const realtimeUrl = new URL(buildUrl(baseUrl, "realtime"));
    realtimeUrl.searchParams.set("model", model);

    const sdpResponse = await fetchImpl(realtimeUrl.toString(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.client_secret?.value ?? ""}`,
        "Content-Type": "application/sdp",
        "OpenAI-Beta": "realtime=v1",
      },
      body: offer.sdp,
    });
    if (!sdpResponse.ok) throw new Error(`SDP error: ${sdpResponse.status}`);

    const answer = { type: "answer", sdp: await sdpResponse.text() };
    await pc.setRemoteDescription(answer);

    startBtn.classList.add("d-none");
    stopBtn.classList.remove("d-none");
    setStatus("Connected", false);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start call.";
    showAlert(message);
    teardownConnection();
  } finally {
    startBtn.disabled = false;
    setStatus(callState.pc ? "Connected" : "Disconnected", !callState.pc);
  }
}

function stopCall() {
  teardownConnection();
}

function sendMessage(event) {
  event.preventDefault();
  const text = messageInput.value.trim();
  if (!text) return;
  const { dc } = callState;
  if (!dc || dc.readyState !== "open") {
    showAlert("Wait for the call to connect before sending text.", "warning");
    return;
  }
  pushTranscript("user", text);
  dc.send(
    JSON.stringify({
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "user",
        content: [{ type: "input_text", text }],
      },
    }),
  );
  dc.send(
    JSON.stringify({
      type: "response.create",
      response: {
        modalities: ["text", "audio"],
      },
    }),
  );
  messageInput.value = "";
}

configureBtn?.addEventListener("click", () => {
  requestCredentials(true).catch((error) => showAlert(error.message ?? "Could not open configuration."));
});

startBtn?.addEventListener("click", () => {
  if (callState.pc) return;
  startCall();
});

stopBtn?.addEventListener("click", () => {
  stopCall();
});

messageForm?.addEventListener("submit", sendMessage);

window.addEventListener("beforeunload", stopCall);
