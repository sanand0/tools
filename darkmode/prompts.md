# darkmode

## Hacker News, 13 Oct 2026

<!--
cd ~/code/tools/
dev.sh -- codex --yolo --model gpt-6.1-sol --config model_reasoning_effort=medium
-->

Some sites don't have dark mode. Create a bookmarklet at darkmode/ (similar to other bookmarklets in this repo) that will enable a dark mode toggle on the site. That is, every time you run the bookmarklet, it will toggle between dark mode and light mode for the site.

The first site to implement this for is Hacker News: https://news.ycombinator.com/*

Over time, we will add other sites. For now, you may bake the CSS into the bookmarklet. When we scale, if it becomes unwieldy, we can consider loading CSS dynamically.

We want minimal changes to the site, and readability & contrast of all text, hover & other states, dynamic / interactive elements is critical.

---

Reduce the contrast a bit. Keep it consistent with the contrast of popular dark mode themes. This feels like a bit too much contrast - I mean, the white feels a little bit strong.

---

Change the button title to "Dark mode toggle"

---

In tools.json, move it just before Wallhop.

<!-- codex resume 01a135b6-4cd0-72c1-9f39-e7a796e675bf --yolo -->
