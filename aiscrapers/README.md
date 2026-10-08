# AI Conversation Scrapers

Copy AI conversations, rich ChatGPT responses, or sidebar chat links as Markdown and JSON with bookmarklets.

## Bookmarklets

- **Gemini Scraper**, **Claude Scraper**, and **ChatGPT Scraper** export the current conversation.
- **ChatGPT Chats** collects the title and URL of every rendered chat in the ChatGPT sidebar. Leave its copy controls open while scrolling to retain chats as ChatGPT reveals them, then copy either a Markdown list or a JSON array of `{ "title", "url" }` objects.
- Copy controls stay open so you can choose another format; the chosen button shows **Copied** for three seconds. Close the toolbar with **×** when finished.

Drag a bookmarklet from the landing page to the bookmarks bar, open the matching AI site, and run it there.

## Rich ChatGPT responses

The ChatGPT scraper preserves cards, label/value metrics, tables, chart summaries,
checkbox states, math, code editors, citations, files, images, and action labels.
Markdown is the readable transcript. JSON keeps `{ id, role, content, timestamp? }`
and adds ordered `parts` for rich messages. Nested `children` retain card/grid
boundaries; `content` remains the full Markdown message for existing consumers.

Parts have a `type` and semantic fields: metrics have `label`/`value`, tables have
`rows`, charts have accessible `summary` lines and optional `caption`, code has
`language`/`code`, math has `latex`/`display`, and checkboxes have `label`/`checked`.
Links, citations, files, and actions retain their labels. An open citation preview
also contributes source-card titles in `sources`, even when URLs are unavailable.
File parts include a `name` when the label exposes a filename; citation chips
retain `additionalSources`.
Unknown components retain their name and readable children in a `group` part.

For example, a rich message's `parts` can contain:

```json
[
  { "type": "metric", "label": "Option A cost", "value": "100" },
  { "type": "checkbox", "label": "Confirm budget", "checked": false },
  {
    "type": "file",
    "label": "Download options.csv",
    "name": "options.csv",
    "unresolved": true
  }
]
```

Extraction is passive. It does not activate buttons, checkboxes, downloads,
reasoning panels, or widgets. A link without an exposed target gets
`unresolved: true`; images and embeds without accessible content are marked
unavailable. Opening a link preview yourself can expose its URL for the next
capture. Scroll through older turns to capture virtualized history; editor code
is limited to rendered lines. Separate Canvas workspaces, closed previews, and
widget internals are not exported as if their content were available.

See [notes.md](notes.md) for the observed DOM catalog and research sources.
