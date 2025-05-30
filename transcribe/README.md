# Real-Time Speech Transcription Tool

This tool provides real-time speech-to-text transcription using the browser's built-in SpeechRecognition API. It captures audio from the user's microphone and displays the recognized text on the screen.

## What it does

The application allows users to:
-   Start and stop audio capture from their microphone via a toggle button.
-   View a live transcription of their speech in a large, clear display area.
-   Accumulate transcribed text over multiple start/stop sessions.

The transcription is performed locally in the browser and does not rely on external APIs for the speech-to-text conversion.

## Use Cases

-   **Voice Notes:** Quickly capture spoken thoughts and ideas as text.
-   **Drafting Content:** Dictate initial drafts of emails, documents, or messages.
-   **Accessibility Aid:** Assist users who may find typing difficult by providing a voice-to-text input method.
-   **Practicing Speech:** See a real-time text version of spoken words, which can be helpful for language learners or public speaking practice.
-   **Simple Real-time Captioning:** In quiet environments, it could provide a basic live caption of ongoing speech for personal use.

## How It Works

1.  **Permissions & Setup:**
    *   When the page loads, it checks if the browser supports the `SpeechRecognition` API (common in modern browsers like Chrome and Edge). If not, an error message is displayed.
    *   The browser will typically ask for permission to access the microphone when transcription is first initiated.

2.  **Starting Transcription:**
    *   The user clicks the "Click to talk" button (which has a microphone icon).
    *   The button text changes to "Listening...", and its color changes to indicate it's active.
    *   The `SpeechRecognition` service starts capturing audio from the microphone.
    *   The status display updates to "Status: Started" or similar.

3.  **Real-Time Display:**
    *   As the user speaks, the browser's speech recognition engine processes the audio.
    *   Recognized words and phrases (including interim, less accurate results) are displayed in real-time in the central transcript area.
    *   The transcript area automatically scrolls to keep the latest text in view.

4.  **Stopping Transcription:**
    *   The user clicks the "Listening..." button again.
    *   The button reverts to "Click to talk."
    *   The `SpeechRecognition` service stops.
    *   The currently displayed transcript remains on screen. If the user starts transcription again, the new text will be appended to the existing transcript.

5.  **Error Handling:**
    *   If an error occurs during recognition (e.g., microphone issues, no speech detected for a while), an error message is displayed in the transcript area, and the status updates accordingly.
    *   The recognition service attempts to auto-restart if it stops unexpectedly while the user intends for it to be listening.

The tool uses JavaScript's built-in `SpeechRecognition` or `webkitSpeechRecognition` API. The user interface is styled with Bootstrap and includes a dark mode theme toggle.

**Note:** The accuracy and availability of the speech recognition are dependent on the browser's implementation and the quality of the microphone input. An active internet connection may be required by some browser speech recognition services. The `index.html` includes a non-functional, hidden link related to "LLM Foundry," which is not used by the current transcription script.
