import saveform from "https://cdn.jsdelivr.net/npm/saveform@1.2";
import { bootstrapAlert } from "https://cdn.jsdelivr.net/npm/bootstrap-alert@1";

// DOM Elements
const $apiKey = document.getElementById("api-key");
const $recordBtn = document.getElementById("record-btn");
const $prevSlideBtn = document.getElementById("prev-slide-btn");
const $nextSlideBtn = document.getElementById("next-slide-btn");
const $openPresentationBtn = document.getElementById("open-presentation-btn");
const $downloadPresentationBtn = document.getElementById("download-presentation-btn");
const $statusIndicator = document.getElementById("status-indicator");
const $connectionStatus = document.getElementById("connection-status");
const $slideCount = document.getElementById("slide-count");
const $currentSlideNum = document.getElementById("current-slide-num");
const $slidePreview = document.getElementById("slide-preview");
const $transcriptBox = document.getElementById("transcript-box");
const $bufferStatus = document.getElementById("buffer-status");
const $slideInstructions = document.getElementById("slide-instructions");
const $presentationTheme = document.getElementById("presentation-theme");

// State
let isRecording = false;
let peerConnection = null;
let dataChannel = null;
let mediaStream = null;
let presentationWindow = null;
let slides = [];
let currentSlideIndex = -1;
let currentResponseText = "";

// Default instructions for McKinsey-style slides
const DEFAULT_INSTRUCTIONS = `You are an expert presentation assistant. As you listen to the speaker, generate presentation slides in real-time with McKinsey-style action titles.

Guidelines:
- Each slide should have an ACTION-ORIENTED title that conveys the main insight or recommendation
- Titles should be clear, concise statements (not questions or topic labels)
- Support the title with relevant content: bullet points, paragraphs, quotes, or data
- Create a new slide when the speaker moves to a new topic or key point
- Keep slides focused and avoid information overload
- Format content appropriately (lists for multiple points, paragraphs for explanations)

Output each slide in this JSON format:
{"title": "Action-oriented title here", "content": "Formatted content here (use markdown for lists, emphasis, etc.)"}

Generate slides progressively as the speaker talks. When you detect a logical topic shift or complete thought, output the next slide.`;

// Initialize saveform for persisting API key and settings
saveform("#config-form");

// Set default instructions if not already set
if (!$slideInstructions.value.trim()) {
  $slideInstructions.value = DEFAULT_INSTRUCTIONS;
}

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

// Download presentation
$downloadPresentationBtn.addEventListener("click", downloadPresentation);

async function startRecording() {
  const apiKey = $apiKey.value.trim();
  if (!apiKey) {
    bootstrapAlert({ title: "Missing API Key", body: "Please enter your OpenAI API key.", color: "danger" });
    return;
  }

  try {
    updateStatus("connecting", "Connecting...");

    // Disable editing of instructions during recording
    $slideInstructions.disabled = true;
    $presentationTheme.disabled = true;

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

    // Enable download button
    $downloadPresentationBtn.disabled = false;

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

    // Configure session for slide generation
    const instructions = $slideInstructions.value.trim() || DEFAULT_INSTRUCTIONS;
    const sessionConfig = {
      type: "session.update",
      session: {
        modalities: ["text"], // Text output only - audio input still works!
        instructions: instructions,
        turn_detection: {
          type: "server_vad",
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 1000,
        },
      },
    };
    dataChannel.send(JSON.stringify(sessionConfig));

    // Note: We don't manually create responses - server_vad handles this automatically
    // when it detects speech has stopped
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
    case "session.created":
    case "session.updated":
      console.log("Session ready");
      break;

    case "input_audio_buffer.speech_started":
      $bufferStatus.textContent = "Speech detected...";
      break;

    case "input_audio_buffer.speech_stopped":
      $bufferStatus.textContent = "Processing...";
      break;

    case "conversation.item.created":
      console.log("Conversation item created:", event);
      break;

    case "response.text.delta":
      // Model is generating text response with slide content
      if (event.delta) {
        currentResponseText += event.delta;
        updateTranscriptDisplay();
      }
      break;

    case "response.text.done":
      // Model finished generating text - try to parse slides
      if (event.text) {
        currentResponseText = event.text;
        parseAndAddSlides(event.text);
        // Clear response text for next turn
        currentResponseText = "";
      }
      break;

    case "response.done":
      console.log("Response complete");
      $bufferStatus.textContent = "Ready";
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

function updateTranscriptDisplay() {
  $transcriptBox.textContent = currentResponseText || "Waiting for speech...";
  $transcriptBox.scrollTop = $transcriptBox.scrollHeight;
}

function parseAndAddSlides(text) {
  // Try to extract JSON slide objects from the response
  const jsonMatches = text.matchAll(/\{[^}]*"title"[^}]*"content"[^}]*\}/g);

  for (const match of jsonMatches) {
    try {
      const slideData = JSON.parse(match[0]);
      if (slideData.title && slideData.content) {
        // Check if this is a new slide (not duplicate)
        const isDuplicate = slides.some((s) => s.title === slideData.title && s.content === slideData.content);
        if (!isDuplicate) {
          createNewSlide(slideData.title, slideData.content);
        }
      }
    } catch (error) {
      console.error("Error parsing slide JSON:", error);
    }
  }

  // If no JSON found, try to parse as regular text and create a single slide
  if (slides.length === 0 && text.length > 50) {
    const lines = text.split("\n").filter((l) => l.trim());
    if (lines.length > 0) {
      const title = generateSlideTitle(text);
      createNewSlide(title, text);
    }
  }
}

function createNewSlide(title, content) {
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
    <div>${formatSlideContent(slide.content)}</div>
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
  const theme = $presentationTheme.value || "black";
  const slidesHTML =
    slides.length > 0
      ? slides
          .map(
            (slide) =>
              `<section><h2>${escapeHtml(slide.title)}</h2><div>${formatSlideContent(slide.content)}</div></section>`,
          )
          .join("\n")
      : "<section><h2>Live Slides</h2><p>Waiting for speech...</p></section>";

  return `<!DOCTYPE html>
<html>
<head>
  <title>Live Presentation</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@4.5.0/dist/reset.css">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@4.5.0/dist/reveal.css">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@4.5.0/dist/theme/${theme}.css">
  <style>
    .reveal h2 { font-size: 1.8em; margin-bottom: 0.5em; }
    .reveal p { font-size: 1.2em; line-height: 1.5; text-align: left; }
    .reveal ul, .reveal ol { font-size: 1.1em; text-align: left; }
    .reveal li { margin-bottom: 0.5em; }
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
      section.innerHTML = '<h2>' + title + '</h2><div>' + content + '</div>';
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

function formatSlideContent(content) {
  // Simple markdown-like formatting
  let formatted = escapeHtml(content);

  // Convert bullet points (- item or * item)
  formatted = formatted.replace(/^[*-]\s+(.+)$/gm, "<li>$1</li>");
  if (formatted.includes("<li>")) {
    formatted = "<ul>" + formatted + "</ul>";
  }

  // Convert numbered lists (1. item)
  formatted = formatted.replace(/^\d+\.\s+(.+)$/gm, "<li>$1</li>");

  // Convert **bold**
  formatted = formatted.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

  // Convert *italic*
  formatted = formatted.replace(/\*(.+?)\*/g, "<em>$1</em>");

  // Convert line breaks to paragraphs
  if (!formatted.includes("<ul>") && !formatted.includes("<li>")) {
    formatted = formatted
      .split("\n\n")
      .filter((p) => p.trim())
      .map((p) => `<p>${p.trim()}</p>`)
      .join("");
  }

  return formatted;
}

function updatePresentationWindow() {
  if (!presentationWindow || presentationWindow.closed) {
    return;
  }

  const slide = slides[slides.length - 1];
  try {
    presentationWindow.addSlide(escapeHtml(slide.title), formatSlideContent(slide.content));
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

  // Re-enable editing of instructions
  $slideInstructions.disabled = false;
  $presentationTheme.disabled = false;

  // Update UI
  $recordBtn.classList.remove("btn-danger", "recording");
  $recordBtn.classList.add("btn-outline-danger");
  $recordBtn.querySelector("span").textContent = "Start Recording";
  $recordBtn.querySelector("i").className = "bi bi-record-circle me-2";

  updateStatus("disconnected", "Disconnected");
  $bufferStatus.textContent = "Paused";
}

function downloadPresentation() {
  if (slides.length === 0) {
    bootstrapAlert({ title: "No Slides", body: "Generate some slides before downloading.", color: "warning" });
    return;
  }

  const presentationHTML = createPresentationHTML();
  const blob = new Blob([presentationHTML], { type: "text/html" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `live-slides-${new Date().toISOString().slice(0, 10)}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  bootstrapAlert({ title: "Downloaded", body: "Presentation saved successfully!", color: "success" });
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
