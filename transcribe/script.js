import { html, render } from "https://cdn.jsdelivr.net/npm/lit-html/+esm";

const $transcript = document.querySelector("#transcript");
const $app = document.querySelector("#app");
const $toggleMic = document.querySelector("#toggleMic");
const $status = document.querySelector("#status");

/**
 * Real-time speech transcription script
 * @returns {void}
 */
async function initTranscription() {
  const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
  let isListening = false;
  let transcriptHistory = "";

  // Configure recognition
  recognition.lang = "en-US";
  recognition.continuous = true;
  recognition.interimResults = true;

  // Setup UI
  render(
    html`
      <div id="transcript-container" class="teleprompter-container bg-dark p-4 rounded overflow-auto">
        <div id="transcript" class="teleprompter-text display-4 text-white text-center"></div>
      </div>
    `,
    $app
  );

  // Toggle listening
  $toggleMic.addEventListener("click", () => {
    isListening = !isListening;
    $toggleMic.classList.toggle("btn-danger", isListening);
    $toggleMic.classList.toggle("btn-primary", !isListening);
    $toggleMic.querySelector("span").textContent = isListening ? "Listening..." : "Click to talk";

    if (isListening) {
      recognition.start();
    } else {
      recognition.stop();
      transcriptHistory = $transcript.textContent;
    }
  });

  // Add status logging
  recognition.addEventListener("start", () => {
    console.log("Recognition started");
    $status.textContent = "Status: Started";
  });

  recognition.addEventListener("end", () => {
    console.log("Recognition ended");
    $status.textContent = "Status: Ended";

    // Auto-restart if still supposed to be listening
    if (isListening) {
      console.log("Attempting to restart...");
      recognition.start();
    }
  });

  // Update result handler with auto-scroll
  recognition.addEventListener("result", (event) => {
    const results = Array.from(event.results);
    const text = results.map((result) => result[0].transcript).join("");
    render(`${transcriptHistory} ${text}`, $transcript);
    $transcript.scrollIntoView({ behavior: "smooth", block: "end" });
  });

  // Update error handler to match new styling
  recognition.addEventListener("error", (event) => {
    console.error("Recognition Error:", event.error, event);
    render(html`<div class="text-danger">Error: ${event.error}</div>`, $transcript);
    $status.textContent = `Status: Error - ${event.error}`;
  });
}

// Initialize if browser supports speech recognition
try {
  $app.classList.remove("d-none");
  initTranscription();
} catch (err) {
  render(html`<div class="alert alert-danger">Your browser does not support speech recognition.</div>`, $app);
}
