# Prompts

## Google Meet Captions bookmarklet (Codex Yolo - GPT 5.4 high)

Create a bookmarklet in gmeetcaptions/ that, when clicked, copies the contents of the Google Meet captions to the clipboard as Markdown.

To understand what the DOM looks like in a Google Meet when captions are enabled, I've saved the full page with captions running at gmeetcaptions/full-page.html. I also extracted just the captions a little earlier into gmeetcaptions/captions.html. I did this by copying the outerHTML on Chrome DevTools. Use these as a reference.

See these tools to understand how we create bookmarklets and align with the style.

bootstrappicker/
copylinks/
discoursescraper/
geminiscraper/
hnmd/
page2md/
straivecodex/
whatsappscraper/
xscraper/

You don't have to read all of them - prefer the later ones, get a sense, prioritize best practices.
Note how they copy Markdown (e.g. geminiscraper/ or hnmd/ or page2md/ or discoursescraper/) to the clipboard.
Note how they re-use code across tools.

Write test cases first by creating ANONYMIZED test snippets, run them, and ensure they pass.

---

Change the button label from "Meet Captions" to "Google Meet Captions". Add this to the home page (README.md and tools.json). Commit.

<!-- codex resume 019d1dba-6373-7b01-af2b-bc882430b8cb -->
