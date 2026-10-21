# Record

Record audio, camera, or screen and save it locally.

## Modes

- **Audio**: microphone only, WebM/Opus at 12 kbps VBR, requesting mono input with a compatibility fallback.
- **Camera**: webcam at 320×240, ≤15 fps, ~48 kbps video plus the same 12 kbps Opus audio (≤27 MB/hour).
- **Screen**: a screen, window, or tab at up to 1280×720 so text stays legible, but only 5 fps and ~96 kbps. Tab/system audio is mixed in with the mic when shared. Clicking the browser's "Stop sharing" saves the take.

Video uses AV1 when MediaRecorder supports it (Chrome/Edge 113+), falling back to VP9, then VP8. Camera and screen give a 3-second countdown with a live preview so you can frame the shot or switch windows.

## Recording

- Shows a rolling five-second microphone level history with a fixed dBFS scale so quiet and loud speech remain visually comparable.
- Marks recent speech levels as Quiet, Soft, Good, Hot, or Clipping; the target band is −18 to −6 dBFS.
- Warns if the mic has been silent for 3 seconds (muted or wrong device).
- Shows the growing file size, and puts the timer in the tab title so a background recording isn't forgotten.
- Supports pause/resume, and Discard for false starts.
- Keyboard shortcuts: <kbd>R</kbd> record, <kbd>Space</kbd> pause, <kbd>S</kbd> stop and save, <kbd>Esc</kbd> discard or cancel the countdown.
- Lets you pick the microphone and camera; the choice is remembered.
- The mode is kept in the URL (`#?mode=screen`), so each mode can be bookmarked.

## Saving

- Saves each recording as `YYYY-MM-DD-HH-MM-SS[-camera|-screen][-name].webm` in a folder selected with the File System Access API. Type an optional name before or during recording.
- Stores the directory handle in IndexedDB, so Chrome/Edge can reuse the same folder on later visits when permission persists.
- Lists the recordings in that folder, newest first and grouped by day, with playback, filename copy, rename, and delete.
- Provides a normal browser download link if writing to the selected folder fails.

The microphone uses echo cancellation and noise suppression, but automatic gain control is disabled so the level visualization reflects the recorded input level.
