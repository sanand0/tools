# Prompts

## Generate Markdown viewer bookmarklet (Claude Code - Minimax 2.7 - poor quality)

Create a bookmarklet that, when clicked, opens the currently selected page (or text of the full page if no text is selected) rendering the content as Markdown with syntax highlighting in a popup.

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

Write test cases first, run them, and ensure they pass.
Follow AGENTS.md.

<!-- claude --resume 086ea380-c3ae-48b0-8cbd-879e19c9784c -->

## Generate Markdown viewer bookmarklet (Codex - GPT 5.4 medium)

Create a bookmarklet in mdview/ that, when clicked, opens the currently selected page (or text of the full page if no text is selected) rendering the content as Markdown with syntax highlighting in a popup.

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

Write test cases first, run them, and ensure they pass.
Follow AGENTS.md.
DO NOT READ mdpopup/

---

It opens a blank popup. When I close it, it says "Allow popups for this site to open Markdown view". I don't want that.
See mdpopup/ which manages to achieve it without popup permissions. (The markdown rendering isn't perfect there, so don't use that part, just learn from the best practices there.)

<!-- codex resume 019d1d5d-11df-7401-ab9b-7abe1dab2626 -->
