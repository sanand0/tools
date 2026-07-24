# GMail Bookmarklets

<!--
cd ~/code/tools/
dev.sh -- codex --yolo --model gpt-5.6-sol --config model_reasoning_effort=medium
-->

Under gmail/ create a bookmarklet page similar to aiscrapers/ linkedinscraper/ etc. that holds multiple bookmarklets for GMail, Google Calendar, etc.

Create the following bookmarklet to start with:

"GMail header": This copies the From: and Subject: lines from the currently open email. The subject can be extracted from document.title. The email should be extracted from the latest relevant role="listitem" aria-expanded="true". Sample formatting:

```markdown
From: John Doe <john.doe@example.com>
Subject: Meeting Notes for Project X
```

Write failing tests first.
CDP on localhost:9222 has GMail open in a tab - you may test using that.
Keep the code robust (e.g. prefer aria-tags, meaningful attribute names that likely won't change, etc.)
Keep the code simple. Frankly, this is not a complex task.

---

A few tweaks:

- Show the Subject: first and THEN From:
- Copy ALL From: lines where aria-expanded="true"
- Show a small notification after copying that disappears after 5 seconds. Similar to other bookmarklets.

---

I don't see the notification. Can you test it on CDP on localhost:9222 and see if you can visually confirm it?

---

Make the minimal modification to create a working notification and test it.

<!-- codex resume 019f932a-b44b-76f2-b7b7-0aede33625fc --yolo -->
