# Record

Record audio and save it locally.

## Audio recording

- Records microphone audio as WebM/Opus at 12 kbps VBR, requesting mono input with a compatibility fallback.
- Shows a rolling five-second microphone level history with a fixed dBFS scale so quiet and loud speech remain visually comparable.
- Marks recent speech levels as Quiet, Soft, Good, Hot, or Clipping; the target band is −18 to −6 dBFS.
- Supports pause and resume.
- Saves each recording as YYYY-MM-DD-HH-MM-SS.webm in a folder selected with the File System Access API.
- Stores the directory handle in IndexedDB, so Chrome/Edge can reuse the same folder on later visits when permission persists.
- Keeps recordings saved during the current page session in a list with native playback controls, filename copy, and file deletion.
- Clears the meter and timer after every successful save so the recorder is visibly ready for the next note.
- Provides a normal browser download link if writing to the selected folder fails.

The microphone uses echo cancellation and noise suppression, but automatic gain control is disabled so the level visualization reflects the recorded input level.
