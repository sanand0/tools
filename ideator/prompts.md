# Prompts

## Initial spec

Create an ideator/ tool. This should, on load:

- Fetch from the following notes:
  - LLMs: https://raw.githubusercontent.com/sanand0/til/refs/heads/live/llms.md
  - Things I learned: https://raw.githubusercontent.com/sanand0/til/refs/heads/live/til.md
  - Core concepts: https://raw.githubusercontent.com/sanand0/til/refs/heads/live/core-concepts.md
  - Creative ideas: https://raw.githubusercontent.com/sanand0/til/refs/heads/live/creative-ideas.md
  - AI Capabilities: https://raw.githubusercontent.com/sanand0/til/refs/heads/live/ai-capabilities.md
  - Questions to ask: https://raw.githubusercontent.com/sanand0/til/refs/heads/live/questions.md
- Parse as Markdown using a Markdown parser
  - Extracting only the top level bullets (treating second-level bullets and anything inside that bullet as part of the same item)
  - Tagging it with the most recent heading above it
- Store them in memory

On screen, it should show an elegant, responsive single page app (index.html + script.js + config.json as required) that:

- Show a set of small cards for goals. E.g. "Innovative web app", "Strategic business plan", ... - identify 5 common complex tasks that AI agents can help brainstorm. Clicking on these should populate the "What's your goal?" input
- Have a "What's your goal?" input box
- Show two cards for 2 notes. Each card lets the user select a note with the following features:
  - Select the source (including the default, which is across all notes)
  - Search box to filter (filter as you type)
  - Arrow keys to navigate the list
  - Random button to pick a random note from the selected source
  - A number input that shows the index of the current note - allows the user to type in an index to jump to that note
  - A decay input (0-100) that controls how much to decay the importance of earlier notes when picking notes (default=50, meaning roughly that recent notes are fairly important, 0 means no decay and all notes are equally important)
  - Display the selected note as Markdown, along with the source and tag, allowing the user to scroll if it's long, but make sure at least about 8 rows are visible
  - Changing any of these inputs should update the displayed note immediately
- Show a prominent set of "Ideate with" buttons marked Claude, ChatGPT, Google, and Grok, and also a and "Copy" button.
  - Clicking on an ideate button constructs a prompt (see below) and opens the relevant URL in a new tab
    - Claude: https://claude.ai/new?q=%s
    - ChatGPT: https://chatgpt.com/?q=%s
    - Google AI Mode: https://www.google.com/search?udm=50&q=%s
    - Grok: https://grok.com/?q=hi
  - Copy copies the prompt to the clipboard
- A collapsed section with "Prompt template" below, allowing advanced users to edit it. You may replace the placeholders with anything easier for users to understand and for you to replace.
- A clear explanation of why this tool is useful and how to use it - at the top of the page

Prompt template:

```markdown
You are a radical concept synthesizer hired to astound even experts.

Generate a big, useful, non-obvious idea aligned with "${goal}$" fusing provided `<CONCEPT>`s with concrete next steps.

<CONCEPT>
${note1}
</CONCEPT>

<CONCEPT>
${note2}
</CONCEPT>

THINK:

1. Generate 5+ candidate ideas (searching online for context if useful) using mental models / lenses such as Inversion, Mechanism-transplant, Constraint-violation, Scale-jump, Oblique strategies, ... or any others.
2. Score each based on whether it is:
   - Novel: 1=common; 3=unusual; 5=not seen in field
   - Useful: 1=nice-to-have; 3=team-level impact; 5=moves a key metric in ≤90 days
   - Feasible: 1=hard; 3=doable w/ effort; 5=can start today
3. Pick top score. Tie → lower complexity.

OUTPUT:

- INSIGHT: 1-2 sentences.
- HOW TO BUILD: Explain how it works.
- HOW TO TEST: 3 bullets, doable in ≤30 days.
- WHAT'S SUPRISING: What convention does this challenge?
- CRITIQUE: 2 sentences: biggest risk & mitigation

STYLE: Easy to read: ELI15. Make it interesting to read!
```


# App Style

Read the demo skill to understand how to build demo apps and follow it.

Specifically:

- Show errors via bootstrap-alert (See unicode/, picbook/, googlesuggest/, transcribe/)
- Show a spinner while fetching data
- Use lit-html for DOM manipulation
- Embed a favicon via data URI (See index.html)
- Load script.js as `<script type="module" src="script.js"></script>`
- Import utilities from common/ where possible (e.g. See json2csv/script.js)
- Lint with `npm run lint`
- No need to write unit tests.

Common layout: each tool has `index.html` linking Bootstrap 5, bootstrap-icons@1.13.1, a base64 favicon, a container with headers and forms, and a `<script type="module" src="script.js"></script>` that manipulates the DOM with Bootstrap classes.

---

Commit as you go.

## Fixes

- The console shows: "Error: invalid template strings array". Test it - feel free to use CDP at http://localhost:9222/ to load and debug. A static web server is already running at localhost:8000, so opening http://localhost:8000/ideator/ in a tab will open the app.
- The "Random" button isn't horizontally aligned with decay and index.
- Make the "Quick goals" more prominent using typography & iconography.
- Begin with a pre-populated goal, note1, and note2 for first-time users.

## Documentation

Merge the "Source" and "Filter" fields into a single row to compact the concept cards.

Improve the UI labeling. For example, it isn't clear to a first-time user what "Decay" means. Even "Filter" may not be clear in terms of how it works. Make these more user-friendly.

Improve the documentation on the page itself. Visually explain what this is and why it's useful. Explain how to use it. The documentation needs to be visually engaging and friendly.

Create a README.md that clearly explains
- To laymen: what this app does, why it's useful, how to use it
- To developers & future maintainers: how it is built, and anything else that may be non-obvious and useful for them to know
