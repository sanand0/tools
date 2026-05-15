# Google Meet Captions

Bookmarklet to record and save Google Meet captions as Markdown, with speaker names, timestamps, and meeting metadata.

## Usage

1. Visit the tool page and drag the **Google Meet Captions** button to your bookmarks bar.
2. Join a Google Meet and enable captions (the CC button in the call controls).
3. Click the bookmarklet — a floating control panel appears in the top-right corner.
4. **Copy** — copies a snapshot of the currently visible captions to the clipboard as Markdown.
5. **Start Recording** — opens a save-file dialog, then continuously writes captions to a local `.md` file as speakers talk.
6. **Stop Recording** — flushes any pending text and closes the file. The `.md` file is only finalised on Stop (Chrome writes to a `.crswap` swap file during recording).

## Output format

The recorded file is Markdown with a YAML-style header followed by one section per speaker turn:

```markdown
# Meeting title

- **Meeting code**: abc-defg-hij
- **Started**: 5/15/2026, 8:00:00 AM
- **Participants**: Alice, Bob, Carol

---

## Alice [0:12]

Good morning everyone.

## Bob [0:18]

Let's get started with the agenda.
```

Timestamps show minutes and seconds elapsed since recording started.

## How it works

The bookmarklet injects a self-contained IIFE into the Meet page. No external requests are made — everything runs locally in the browser.

**Caption detection** uses a `MutationObserver` on the captions region to catch additions and removals instantly. A 1-second polling interval also runs as a safety net for in-progress turns.

**Stability detection**: each active caption element accumulates a `stalePollCount`. When the text is unchanged for 4 consecutive polls (~4 seconds), the turn is considered stable and written to the file. If Google Meet (or Gemini) continues updating the same element after it was written, the entry is overwritten in-place using `FileSystemWritableFileStream.seek()` + `truncate()` — so the file always contains exactly one entry per speaker turn with the latest corrected text.

**Metadata** is extracted from the page at the time recording starts: meeting title, meeting code, visible participants, and the elapsed-time timer.

## DOM selector strategy

Google Meet's class names are obfuscated (e.g. `.nMcdL`, `.NWpY1d`, `.ygicle`) and change between deployments. The bookmarklet uses a tiered selector strategy, trying each level in order:

| Level | Selector | Stability | Rationale |
|---|---|---|---|
| 1 | `[role="region"][aria-label="Captions"]` | ✅ Very stable | ARIA standard attribute — semantic, not cosmetic |
| 2 | `img[data-iml]` / `img[src*="googleusercontent.com"]` | 🟡 Fairly stable | `data-iml` is a Meet-specific metric attribute on caption avatars; avatar URLs always come from `googleusercontent.com` |
| 3 | First `<span>` inside a caption item | 🟡 Fairly stable | Speaker name is always in the only `<span>` per item — structural convention |
| 4 | Last `<div>` without `<img>` inside a caption item | 🟡 Fairly stable | Caption text always follows the avatar div — structural position |
| 5 | `.nMcdL`, `.NWpY1d`, `.ygicle` | ❌ Fragile | Obfuscated class names, tried first for performance but expected to change |

Levels 1–4 are independent of class names. If Meet is updated and the class names change overnight, levels 1–4 keep the bookmarklet working until the class names in `SELECTORS` are updated.
