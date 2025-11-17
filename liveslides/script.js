import saveform from "https://cdn.jsdelivr.net/npm/saveform@1.2";
import { bootstrapAlert } from "https://cdn.jsdelivr.net/npm/bootstrap-alert@1";

// DOM Elements
const $apiKey = document.getElementById("api-key");
const $recordBtn = document.getElementById("record-btn");
const $prevSlideBtn = document.getElementById("prev-slide-btn");
const $nextSlideBtn = document.getElementById("next-slide-btn");
const $openPresentationBtn = document.getElementById("open-presentation-btn");
const $statusIndicator = document.getElementById("status-indicator");
const $connectionStatus = document.getElementById("connection-status");
const $slideCount = document.getElementById("slide-count");
const $currentSlideNum = document.getElementById("current-slide-num");
const $slidePreview = document.getElementById("slide-preview");
const $transcriptBox = document.getElementById("transcript-box");
const $bufferStatus = document.getElementById("buffer-status");

// State
let isRecording = false;
let peerConnection = null;
let dataChannel = null;
let mediaStream = null;
let presentationWindow = null;
let slides = [];
let currentSlideIndex = -1;
let transcriptBuffer = "";
let lastProcessedLength = 0;

// Minimum characters before considering creating a new slide
const MIN_BUFFER_FOR_SLIDE = 150;
// Patterns that indicate end of a logical statement
const STATEMENT_END_PATTERNS = [". ", "? ", "! ", ".\n", "?\n", "!\n"];

// Initialize saveform for persisting API key
saveform("#config-form");

// Enable record button when API key is entered
$apiKey.addEventListener("input", () => {
  $recordBtn.disabled = !$apiKey.value.trim();
  if ($apiKey.value.trim()) {
    $openPresentationBtn.disabled = false;
  }
});

// Check if API key is already saved
if ($apiKey.value.trim()) {
  $recordBtn.disabled = false;
  $openPresentationBtn.disabled = false;
}

// Recording toggle
$recordBtn.addEventListener("click", async () => {
  if (!isRecording) {
    await startRecording();
  } else {
    stopRecording();
  }
});

// Slide navigation
$prevSlideBtn.addEventListener("click", () => navigateSlide(-1));
$nextSlideBtn.addEventListener("click", () => navigateSlide(1));

// Open presentation window
$openPresentationBtn.addEventListener("click", openPresentationWindow);

async function startRecording() {
  const apiKey = $apiKey.value.trim();
  if (!apiKey) {
    bootstrapAlert({ title: "Missing API Key", body: "Please enter your OpenAI API key.", color: "danger" });
    return;
  }

  try {
    updateStatus("connecting", "Connecting...");

    // Get microphone access
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });

    // Create WebRTC peer connection
    peerConnection = new RTCPeerConnection();

    // Add audio track
    mediaStream.getAudioTracks().forEach((track) => {
      peerConnection.addTrack(track, mediaStream);
    });

    // Create data channel for events
    dataChannel = peerConnection.createDataChannel("oai-events");
    setupDataChannel();

    // Create offer
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    // Send offer to OpenAI Realtime API
    const response = await fetch("https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/sdp",
      },
      body: offer.sdp,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error: ${response.status} - ${errorText}`);
    }

    const answerSdp = await response.text();
    await peerConnection.setRemoteDescription({ type: "answer", sdp: answerSdp });

    // Update UI
    isRecording = true;
    $recordBtn.classList.add("btn-danger", "recording");
    $recordBtn.classList.remove("btn-outline-danger");
    $recordBtn.querySelector("span").textContent = "Stop Recording";
    $recordBtn.querySelector("i").className = "bi bi-stop-circle me-2";

    updateStatus("connected", "Connected");

    // Open presentation window if not already open
    if (!presentationWindow || presentationWindow.closed) {
      openPresentationWindow();
    }
  } catch (error) {
    console.error("Connection error:", error);
    bootstrapAlert({
      title: "Connection Failed",
      body: error.message || "Failed to connect to OpenAI Realtime API",
      color: "danger",
    });
    cleanup();
    updateStatus("disconnected", "Connection Failed");
  }
}

function setupDataChannel() {
  dataChannel.addEventListener("open", () => {
    console.log("Data channel opened");
    // Configure session for transcription
    const sessionConfig = {
      type: "session.update",
      session: {
        modalities: ["text", "audio"],
        instructions:
          "You are a helpful assistant. Listen to the user's speech and provide transcription. Focus on accurate transcription of what is being said.",
        input_audio_transcription: {
          model: "whisper-1",
        },
        turn_detection: {
          type: "server_vad",
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 500,
        },
      },
    };
    dataChannel.send(JSON.stringify(sessionConfig));
  });

  dataChannel.addEventListener("message", (event) => {
    try {
      const message = JSON.parse(event.data);
      handleRealtimeEvent(message);
    } catch (error) {
      console.error("Error parsing message:", error);
    }
  });

  dataChannel.addEventListener("close", () => {
    console.log("Data channel closed");
    if (isRecording) {
      stopRecording();
    }
  });

  dataChannel.addEventListener("error", (error) => {
    console.error("Data channel error:", error);
    bootstrapAlert({ title: "Connection Error", body: "Data channel error occurred", color: "danger" });
  });
}

function handleRealtimeEvent(event) {
  console.log("Received event:", event.type, event);

  switch (event.type) {
    case "conversation.item.input_audio_transcription.completed":
      // Handle completed transcription
      if (event.transcript) {
        addToTranscript(event.transcript);
      }
      break;

    case "conversation.item.input_audio_transcription.delta":
      // Handle incremental transcription (if available)
      if (event.delta) {
        updateTranscriptDelta(event.delta);
      }
      break;

    case "input_audio_buffer.speech_started":
      $bufferStatus.textContent = "Speech detected...";
      break;

    case "input_audio_buffer.speech_stopped":
      $bufferStatus.textContent = "Processing...";
      break;

    case "response.audio_transcript.delta":
      // Model's text response (we can ignore for transcription purposes)
      break;

    case "error":
      console.error("API Error:", event.error);
      bootstrapAlert({
        title: "API Error",
        body: event.error?.message || "Unknown error occurred",
        color: "danger",
      });
      break;
  }
}

function addToTranscript(text) {
  transcriptBuffer += text + " ";
  updateTranscriptDisplay();
  checkForNewSlide();
}

function updateTranscriptDelta(delta) {
  transcriptBuffer += delta;
  updateTranscriptDisplay();
  checkForNewSlide();
}

function updateTranscriptDisplay() {
  $transcriptBox.textContent = transcriptBuffer || "Waiting for speech...";
  $transcriptBox.scrollTop = $transcriptBox.scrollHeight;
  $bufferStatus.textContent = `${transcriptBuffer.length} characters`;
}

function checkForNewSlide() {
  const newContent = transcriptBuffer.slice(lastProcessedLength);

  // Check if we have enough content and a logical ending
  if (newContent.length >= MIN_BUFFER_FOR_SLIDE) {
    const hasStatementEnd = STATEMENT_END_PATTERNS.some((pattern) => newContent.includes(pattern));

    if (hasStatementEnd) {
      // Find the last statement ending
      let lastEndIndex = -1;
      for (const pattern of STATEMENT_END_PATTERNS) {
        const idx = newContent.lastIndexOf(pattern);
        if (idx > lastEndIndex) {
          lastEndIndex = idx + pattern.length;
        }
      }

      if (lastEndIndex > 0) {
        const slideContent = newContent.slice(0, lastEndIndex).trim();
        if (slideContent.length > 50) {
          // Minimum meaningful content
          createNewSlide(slideContent);
          lastProcessedLength = transcriptBuffer.length - (newContent.length - lastEndIndex);
        }
      }
    }
  }
}

function createNewSlide(content) {
  // Generate a summary/title for the slide
  const title = generateSlideTitle(content);

  const slide = {
    title: title,
    content: content,
    timestamp: new Date().toISOString(),
  };

  slides.push(slide);
  currentSlideIndex = slides.length - 1;

  updateSlideCount();
  updateSlidePreview();
  updatePresentationWindow();

  $prevSlideBtn.disabled = slides.length <= 1;
  $nextSlideBtn.disabled = true;
}

function generateSlideTitle(content) {
  // Extract first sentence or first few words as title
  const firstSentence = content.split(/[.!?]/)[0];
  if (firstSentence.length <= 60) {
    return firstSentence.trim();
  }
  // Truncate to first few words
  const words = firstSentence.split(" ").slice(0, 8);
  return words.join(" ") + "...";
}

function updateSlideCount() {
  $slideCount.textContent = slides.length;
  $currentSlideNum.textContent = currentSlideIndex >= 0 ? currentSlideIndex + 1 : "-";
}

function updateSlidePreview() {
  if (currentSlideIndex < 0 || currentSlideIndex >= slides.length) {
    $slidePreview.innerHTML = '<p class="text-muted text-center">No slides yet.</p>';
    return;
  }

  const slide = slides[currentSlideIndex];
  $slidePreview.innerHTML = `
    <h4 class="text-primary">${escapeHtml(slide.title)}</h4>
    <hr>
    <p>${escapeHtml(slide.content)}</p>
  `;
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function navigateSlide(direction) {
  const newIndex = currentSlideIndex + direction;
  if (newIndex >= 0 && newIndex < slides.length) {
    currentSlideIndex = newIndex;
    updateSlideCount();
    updateSlidePreview();
    syncPresentationSlide();

    $prevSlideBtn.disabled = currentSlideIndex === 0;
    $nextSlideBtn.disabled = currentSlideIndex === slides.length - 1;
  }
}

function openPresentationWindow() {
  if (presentationWindow && !presentationWindow.closed) {
    presentationWindow.focus();
    return;
  }

  const presentationHTML = createPresentationHTML();
  presentationWindow = window.open("", "LiveSlidesPresentation", "width=1280,height=720,scrollbars=no,resizable=yes");

  if (!presentationWindow) {
    bootstrapAlert({
      title: "Popup Blocked",
      body: "Please allow popups for this site to open the presentation window.",
      color: "warning",
    });
    return;
  }

  presentationWindow.document.write(presentationHTML);
  presentationWindow.document.close();

  // Wait for Reveal.js to initialize
  presentationWindow.addEventListener("load", () => {
    syncPresentationSlide();
  });
}

function createPresentationHTML() {
  const slidesHTML =
    slides.length > 0
      ? slides
          .map((slide) => `<section><h2>${escapeHtml(slide.title)}</h2><p>${escapeHtml(slide.content)}</p></section>`)
          .join("\n")
      : "<section><h2>Live Slides</h2><p>Waiting for speech...</p></section>";

  return `<!DOCTYPE html>
<html>
<head>
  <title>Live Presentation</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@4.5.0/dist/reset.css">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@4.5.0/dist/reveal.css">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@4.5.0/dist/theme/black.css">
  <style>
    .reveal h2 { font-size: 1.8em; margin-bottom: 0.5em; }
    .reveal p { font-size: 1.2em; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="reveal">
    <div class="slides" id="slides-container">
      ${slidesHTML}
    </div>
  </div>
  <script src="https://cdn.jsdelivr.net/npm/reveal.js@4.5.0/dist/reveal.js"></script>
  <script>
    let reveal;
    Reveal.initialize({
      width: 1280,
      height: 720,
      margin: 0.1,
      minScale: 0.2,
      maxScale: 1.5,
      hash: false,
      transition: 'slide',
      controls: true,
      progress: true,
      center: true
    }).then(() => {
      reveal = Reveal;
      window.reveal = reveal;
    });

    window.addSlide = function(title, content) {
      const container = document.getElementById('slides-container');
      const section = document.createElement('section');
      section.innerHTML = '<h2>' + title + '</h2><p>' + content + '</p>';
      container.appendChild(section);
      Reveal.sync();
      Reveal.slide(Reveal.getTotalSlides() - 1);
    };

    window.goToSlide = function(index) {
      Reveal.slide(index);
    };
  </script>
</body>
</html>`;
}

function updatePresentationWindow() {
  if (!presentationWindow || presentationWindow.closed) {
    return;
  }

  const slide = slides[slides.length - 1];
  try {
    presentationWindow.addSlide(escapeHtml(slide.title), escapeHtml(slide.content));
  } catch (error) {
    console.error("Error updating presentation:", error);
  }
}

function syncPresentationSlide() {
  if (!presentationWindow || presentationWindow.closed) {
    return;
  }

  try {
    presentationWindow.goToSlide(currentSlideIndex);
  } catch (error) {
    console.error("Error syncing slide:", error);
  }
}

function stopRecording() {
  isRecording = false;

  // Close connections
  if (dataChannel) {
    dataChannel.close();
    dataChannel = null;
  }

  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }

  // Stop media tracks
  if (mediaStream) {
    mediaStream.getTracks().forEach((track) => track.stop());
    mediaStream = null;
  }

  // Update UI
  $recordBtn.classList.remove("btn-danger", "recording");
  $recordBtn.classList.add("btn-outline-danger");
  $recordBtn.querySelector("span").textContent = "Start Recording";
  $recordBtn.querySelector("i").className = "bi bi-record-circle me-2";

  updateStatus("disconnected", "Disconnected");
  $bufferStatus.textContent = "Paused";
}

function cleanup() {
  stopRecording();
}

function updateStatus(status, text) {
  $statusIndicator.className = `status-indicator status-${status}`;
  $connectionStatus.textContent = text;
}

// Handle window close
window.addEventListener("beforeunload", () => {
  cleanup();
  if (presentationWindow && !presentationWindow.closed) {
    presentationWindow.close();
  }
});
