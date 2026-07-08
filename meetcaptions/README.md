# Meeting Captions

Bookmarklets to record and save Google Meet or Microsoft Teams captions as Markdown, with speaker names, timestamps, and meeting metadata.

## Usage

1. Visit the tool page and drag the matching captions button to your bookmarks bar.
2. Join a Google Meet or Microsoft Teams meeting and enable captions.
3. Click the bookmarklet - a floating control panel appears in the top-right corner.
4. **Copy** copies a snapshot of the currently visible captions to the clipboard as Markdown.
5. **Start Recording** opens a save-file dialog, then continuously writes captions to a local `.md` file as speakers talk.
6. **Stop Recording** flushes any pending text and closes the file. The `.md` file is only finalized on Stop; Chrome writes to a `.crswap` swap file during recording.

## Output format

The recorded file is Markdown with a header followed by one section per speaker turn:

```markdown
# Meeting title

- **Started**: 7/8/2026, 8:00:00 AM
- **Participants**: Alice, Bob, Carol

---

## Alice [0:12]

Good morning everyone.

## Bob [0:18]

Let's get started with the agenda.
```

Timestamps show minutes and seconds elapsed since recording started.

## How it works

The bookmarklet injects a self-contained IIFE into the meeting page. No external requests are made after injection - everything runs locally in the browser.

Google Meet captions are read from the captions region with structural fallbacks for Meet's obfuscated class names. Microsoft Teams captions are read from visible `role="log"` entries, using `data-tid="author"` for the speaker and `data-tid="closed-caption-text"` for the caption text.

Both providers use a `MutationObserver` plus a 1-second polling interval. When a caption remains unchanged for 4 polls, it is written to the file. If the meeting app later corrects the same caption element, the bookmarklet overwrites the last file entry in place using `FileSystemWritableFileStream.seek()` and `truncate()`.
