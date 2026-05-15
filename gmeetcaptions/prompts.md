# Prompts

## Google Meet Info

<!--

cd /home/sanand/code/tools
dev.sh
copilot --yolo --model claude-sonnet-4.6 --effort medium

-->

It is possible to poll the Google Meet captions and have the bookmarklet stream/save them to a local file?
What other information can we extract from the Google Meet page?
See gmeetcaptions/ for current code.
Use CDP as required - I have a Google Meet running now.

---

I get this error when I click the bookmarklet:

VM465:314 This document requires 'TrustedHTML' assignment. The action has been blocked.
showPanel	@	VM465:314
(anonymous)	@	VM465:345

---

The bookmarklet is working and it shows me a stop recording and a copy button.

When I click on the copy button, it copies the entire transcript along with the header information. That's fine.

But, when I click on start recording, it asks me for a file name and it has saved everything into a .md.crswap file - with the exception of the last line! I'm still speaking and it is not saving that. (This line is copied by the Copy button, though.) And when I continue speaking, it does not seem to capture that last bit.

I will be speaking intermittently on Google Meet - at least 1 word every 1 seconds - so you can test live as required.

---

When another person speaks, on every write, the entire conversation fragment gets appended. For example:

```markdown
## Anand S [0:28]

mic, so,

## Anand S [0:32]

mic, So that's a new person. Okay.

## Anand S [0:36]

mic, So that's a new person. Okay. Hey.

## Anand S [0:40]

mic, So that's a new person. Okay. Hey. oh,

## Anand S [0:42]

mic, So that's a new person. Okay. Hey. oh, but,
```

Make sure that we update, rather than append, the captions. Keep in mind that Gemini might make some corrections (e.g. "so" became "So"). I'll keep speaking so you can test live.

---

In case Google Meet changes class names, etc. is there a stabler way to identify DOM elements?

---

Document the functionality and how the bookmarklet works in gmeetcaptions/README.md.

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
