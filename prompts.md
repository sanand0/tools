# Prompts

## Markdown + JSON scrapers, 09 Aug 2026

<!--
cd ~/code/tools
dev.sh -- codex --yolo --model gpt-5.6-sol --config model_reasoning_effort=medium
-->

Some bookmarklet tools, such as xscraper/, discoursescraper, whatsappscraper/ (possibly others) scrape pages as JSON.
Modify these to scrape as Markdown OR JSON by providing two buttons - one to copy as Markdown and one to copy as JSON.
Inspect and plan before executing.

---

Delete PLAN.md, commit the rest (including prompts.md)

<!-- codex resume 019fe5c2-97e0-7ab0-92e0-19bfa78f063a --yolo -->

## Documentation, 21 Apr 2026

<!--
cd ~/code/tools
dev.sh
codex --yolo --model gpt-5.4 --config model_reasoning_effort=medium
-->

Go through each tool subdirectory's README.md, i.e. */README.md and ensure that it has this structure:

```
# Tool Name

One-line tool description.

... (anything else - optional)
```

i.e. line 1 is the tool name as a H1 header and line 3 is the one-line tool description.

Several tools already have this. Ensure that every tool (as per tools.json) has this.

---

Update AGENTS.md to ensure tools.json and README.md are in sync and new tools follow the same format.

<!-- codex resume 019daf83-23ba-77c3-8015-3a6f6c8654a0 --yolo -->
