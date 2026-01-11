# Prompts

## Revise working code

geminiscraper/geminiscraper.js can be pasted into the Gemini browser console to extract Gemini conversations as Markdown.

Modify it to include YAML frontmatter containing `title`, `date`, and `source` fields.

- title: extract from `$(".conversation-title-container .conversation-title").textContent.trim()`
- date: is the current date in ISO format, e.g. `2026-01-11T11:47:53+08:00` -- in local timezone.
- source: is the URL of the Gemini conversation.

Then, create an index.html that displays the script (scrollable, highlighted), allows users to copy to clipboard, and guides them to paste it into the Gemini browser console. Mention that we can't use bookmarklets due to Gemini's restrictions on external scripts.

Explain the purpose of the page and make it elegant and user-friendly, similar to other tools.

Update README.md and config.json accordingly.

Commit as you go.
