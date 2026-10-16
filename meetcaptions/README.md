# Meeting Captions

Bookmarklets to record Google Meet or Teams captions as Markdown and upload MP4 video backgrounds to Google Meet.

## Usage

1. Visit the tool page and drag the matching captions button to your bookmarks bar.
2. Join a Google Meet or Microsoft Teams meeting and enable captions.
3. Click the bookmarklet - a floating control panel appears in the top-right corner.
4. **Copy** copies a snapshot of the currently visible captions to the clipboard as Markdown.
5. **Start Recording** opens a save-file dialog, then continuously writes captions to a local `.md` file as speakers talk.
6. **Stop Recording** flushes any pending text and closes the file. The `.md` file is only finalized on Stop; Chrome writes to a `.crswap` swap file during recording.

## MP4 backgrounds

1. Drag the **Meet MP4 Background** button from the tool page to your bookmarks bar.
2. Join or preview a Google Meet meeting. Open **Backgrounds and effects → Backgrounds** (so the personal-background uploader is available).
3. Click the bookmarklet. It adds `video/mp4` to Meet's existing background file picker and opens the file chooser.
4. Select an MP4 file. Processing may take a few seconds; once uploaded, it appears among your personal backgrounds.

This uses an **unofficial** Meet file-picker workaround tested in October 2026. It changes the upload filter in the current page only; it does not convert the video or guarantee compatibility after future Meet updates. Run it again if Meet replaces the picker.

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

Each bookmarklet injects JavaScript into the meeting page. No external requests are made after injection - everything runs locally in the browser. The MP4 bookmarklet changes the existing background input's `accept` attribute and clicks that input within the bookmarklet's user gesture.

Google Meet captions are read from the captions region with structural fallbacks for Meet's obfuscated class names. Microsoft Teams captions are read from visible `role="log"` entries, using `data-tid="author"` for the speaker and `data-tid="closed-caption-text"` for the caption text.

Both providers use a `MutationObserver` plus a 1-second polling interval. When a caption remains unchanged for 4 polls, it is written to the file. If the meeting app later corrects the same caption element, the bookmarklet overwrites the last file entry in place using `FileSystemWritableFileStream.seek()` and `truncate()`.
