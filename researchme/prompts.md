# Prompts

## Research Me Tool, 07 Apr 2026 (Copilot)

<!--

cd ~/code/tools/
dev.sh
copilot --yolo --model gpt-5.4 --effort medium

-->

Create a "Research Me" tool at researchme/index.html (similar in design to bootstrappicker/ or picbook/ or githubsummary/) that asks the user for their name and role and allows them to research themselves.

Use this text as the introduction - rewritten well!

- Lead: What does AI know about you — and what has it gotten wrong?
- Instructions:
  - Fill in your name and role.
  - Click on the links below to open ChatGPT and Claude with a pre-filled prompt.
  - For best results, choose the best model available and turn on "Extended thinking".
- Result: You'll get your AI dossier - every role, public record, and news mention it can find. **And** where sources contradict each other. Most people find at least one factual error. Some find more.

Allow them to fill in their name and role. When they fill both in, enable two (disasbled) buttons at the bottom lablled "ChatGPT" and "Claude" (both having the right icons - search for the best (SVG) icon source).

Clicking on the buttons should open a new window pointing to:

- ChatGPT: https://chatgpt.com/?q=%s&model=gpt-5.4
- Claude: https://claude.ai/new?q=%s&model=claude-sonnet-4.6

... where %s is replaced by a URL-encoded version of the following prompt, with $NAME and $ROLE replaced by the user's input:

```text
Search online and build a **COMPREHENSIVE** public dossier on:

Name: $NAME
Role: $ROLE

Structure it as:

1. Career Timeline — Every posting and tenure you can find, with source and year. Flag any gaps.
2. Public Record — All public forums mentioning them, regulatory filings, court cases, audit observations, company directorships, government notifications, or institutional affiliations.
3. Media Presence — Notable speeches, interviews, quotes attributed to them.
4. Contradictions — Any case where two sources give conflicting facts about the same event, posting, or date. List each conflict explicitly.
5. Probable Errors — Claims that appear factually wrong based on cross-referencing. Explain why.
6. Confidence Rating — For each section, rate how complete you think your information is (High / Medium / Low) and why.

Be specific. Use web search. Cite sources. If you're uncertain, say so.
```

---

This is WAY too fancy a design! Keep it simple. Plain colors. Default system fonts. Make sure the color theme toggle works (did you include the Bootstrap JS and bootstrap-dark-theme JS?)

JUST like bootstrappicker/ or picbook/ or githubsummary/. No fancy design - just Bootstrap.

---

Change the label "Your name" to "Your full name".
Change the label "Your role" to "Your role / any other info".
Color the Claude button "success" as well.
Link to researchme/ to the beginning of README.md and tools.json.

<!-- copilot --resume=8664da17-615a-4b12-aa31-ed429ccf7aa5 -->

## Research Me Tool, 07 Apr 2026 (Claude - disaster!)

<!--

cd ~/code/tools/
dev.sh
claude --dangerously-skip-permissions # Messed things up

-->

Create an ELEGANT tool at researchme/index.html that asks the user for their name and role and allows them to research themselves.

Use this text as the introduction - rewritten well!

- Lead: What does AI know about you — and what has it gotten wrong?
- Instructions:
  - Fill in your name and role.
  - Click on the links below to open ChatGPT and Claude with a pre-filled prompt.
  - For best results, choose the best model available and turn on "Extended thinking".
- Result: You'll get your AI dossier - every role, public record, and news mention it can find. **And** where sources contradict each other. Most people find at least one factual error. Some find more.

Allow them to fill in their name and role. When they fill both in, enable two (disasbled) buttons at the bottom lablled "ChatGPT" and "Claude" (both having the right icons - search for the best (SVG) icon source).

Clicking on the buttons should open a new window pointing to:

- ChatGPT: https://chatgpt.com/?q=%s&model=gpt-5.4
- Claude: https://claude.ai/new?q=%s&model=claude-sonnet-4.6

... where %s is replaced by a URL-encoded version of the following prompt, with $NAME and $ROLE replaced by the user's input:

```text
Search online and build a **COMPREHENSIVE** public dossier on:

Name: $NAME
Role: $ROLE

Structure it as:

1. Career Timeline — Every posting and tenure you can find, with source and year. Flag any gaps.
2. Public Record — All public forums mentioning them, regulatory filings, court cases, audit observations, company directorships, government notifications, or institutional affiliations.
3. Media Presence — Notable speeches, interviews, quotes attributed to them.
4. Contradictions — Any case where two sources give conflicting facts about the same event, posting, or date. List each conflict explicitly.
5. Probable Errors — Claims that appear factually wrong based on cross-referencing. Explain why.
6. Confidence Rating — For each section, rate how complete you think your information is (High / Medium / Low) and why.

Be specific. Use web search. Cite sources. If you're uncertain, say so.
```

<!-- claude --resume 281c7b64-5d8d-48a1-8ab3-4c3e529bae42 -->
