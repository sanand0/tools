# Prompt

## Radar UI, 04 Apr 2026

<!--

Revised based on https://claude.ai/chat/0096f0fc-5a9d-478f-98b7-3a9effba0e0c

cd /home/sanand/code/tools
dev.sh
copilot --yolo --model claude-sonnet-4.6 --effort high

-->

Create a technology radar (inspired by, but unrelated to, the ThoughtWorks Technology Radar) as a polished, production-grade single-page web application. The radar is a tool for tracking technology adoption across four quadrants (Techniques, Tools, Platforms, Frameworks) and four rings (e.g. Adopt → Trial → Assess → Hold).

Reference thoughtworks-radar-reference.webp.

Output:

- index.html - Shell, loads all dependencies
- radar.js - All D3 logic and app state
- styles.css - All styles (no inline styles in JS except D3 dynamic attrs)
- data.json - schema below. Create 2 mocks with 100 nodes and 2,000 nodes across quadrants and rings to test

Schema:

```jsonc
{
  "version": 1,
  "title": "Technology Radar",
  "subtitle": "Tracking technology adoption across our organization",
  "logo": "https://example.com/logo.png", // optional
  "quadrants": {
    "techniques": "Techniques",
    "tools": "Tools",
    "platforms": "Platforms",
    "frameworks": "Languages & Frameworks",
  },
  "rings": {
    "adopt": "Adopt",
    "trial": "Trial",
    "assess": "Assess",
    "hold": "Hold",
  },
  "nodes": [
    {
      "id": 1, // Sequential integer, used for keyboard nav order
      "name": "Rust",
      "quadrant": "frameworks", // from quadrants array
      "ring": "trial", // from rings array
      "change": "in", // new | in | out | "" if unchanged
      "description": "Markdown string with **bold**, [links](url), etc.",
      "added": "2022-04", // YYYY-MM
      "tags": {
        // Extensible — add new tag keys freely in future
        "category": "systems-programming",
        "license": "MIT/Apache-2.0",
        "github_url": "https://github.com/rust-lang/rust",
        "alternatives": ["C++", "Zig"], // array or string
        "deprecated": false,
        "homepage": "https://rust-lang.org",
      },
      "history": [
        // Entries in reverse-chronological order
        { "date": "2024-10", "ring": "trial", "note": "Promoted from Assess after strong team adoption." },
        { "date": "2022-04", "ring": "assess", "note": "First appearance on radar." },
      ],
    },
  ],
}
```

Design the tag keys so they are human-readable labels in the UI without code changes — use snake_case keys that map naturally to small-caps "LICENSE", "GITHUB URL", etc.

**Header**

- Render `title` and `subtitle` and `logo` (if present) from the JSON. Generate them dynamically and download any public SVG logo as a reference.
- Include a dark mode toggle. IMPORTANT: Ensure that the radar's color scheme is designed to be fully functional and visually distinct in both light and dark modes, with appropriate contrast ratios for accessibility. Use CSS custom properties to define colors so they can switch seamlessly between themes.

**Radar geometry (SVG, responsive, square viewport)**

- Four quadrants are separated by thin gaps (≈3% of the diameter), not solid lines through the center
- Four concentric arcs per "quadrant" order: e.g. adopt (innermost), trial, assess, hold (outermost)
- Ring widths should NOT be equal. dynamically and EFFICIENTLY compute based on the number of nodes in each ring to optimize spacing and minimize overlap, with a minimum width threshold (e.g. 15% of radius) to prevent excessively thin rings.
- Quadrant labels (e.g. Techniques, Tools, Platforms, Languages & Frameworks) at the outer corner of each quadrant.
- Ring labels (e.g. Adopt / Trial / Assess / Hold) rendered along the arc or at the boundary — small, muted

**Nodes**

- Circles with a number inside (matching `id`)
- Visual states encoded as SVG:
  - `""`: plain filled circle
  - `"new"`: double ring (outer stroke circle + inner filled circle)
  - `"in"`: 90-degree arc "arrowhead" outside the circle pointing toward center
  - `"out"`: 90-degree arc "arrowhead" outside the circle pointing away from the center
- Nodes are spread within their ring+quadrant zone using **seeded deterministic jitter** (e.g. via `seedrandom` library) so layout is reproducible and ensures no overlap and is visually balanced.
- Hover: nodes scale up slightly (CSS transform), tooltip appears (see below), all other nodes fade to `opacity: var(--node-fade-opacity)` with a `transition: opacity 200ms ease`
- Hover tooltip: small floating label showing `name` only, positioned near the node, never clipping the SVG boundary

**Quadrant color palette**: Pick a neutral, professional, clean, categorical system and assign.

**Legend** — bottom center: New / Moved / No change icons matching the node encoding

**Filter & search bar**: Rendered as a horizontal bar above the radar (not overlapping it).

- **Search-as-you-type**: fuzzy-matches `name`, `description`, `quadrant`, `ring` and all tag values; debounced 150ms; unmatched nodes fade out, matched stay full opacity
- **Filter chips**: dynamically generated from all unique tag keys present in the data. Each tag key becomes a filter group (e.g. "License", "Category"). Clicking a tag value applies it as a filter. Multiple filters within a group = OR; across groups = AND
- **Quadrant filter buttons**: quick filter to a single quadrant
- **Ring filter buttons**: quick filter to a single ring
- Active filters show as removable chips; "Clear all" resets everything
- Filter state is bookmarkable (see URL state)

**Popup / detail panel**

- Opens when a node is clicked
- **Dimensions**: 38% viewport width, max 520px, full viewport height minus some margin; positioned on the right side of the viewport
- Slides in smoothly (`transform: translateX` transition)
- Does **not** cover the radar center — radar should remain partially visible and INTERACTIVE behind a semi-transparent backdrop scrim
- Clicking the scrim or pressing `Escape` closes the panel
- **Contents**:
  - Node number badge + quadrant color indicator + ring indicator
  - `name` as H1
  - `description` rendered from Markdown to HTML (use [marked.js](https://cdn.jsdelivr.net/npm/marked/marked.min.js)); sanitize with DOMPurify
  - Tags section: rendered as a definition list with human-readable key labels; tag values that are URLs render as links; arrays render as comma-separated chips
  - Added date: "First appeared: April 2022"
  - History timeline: chronological list showing ring transitions with dates and notes
- **Keyboard navigation**: while the panel is open, `←`/`→` arrow keys cycle through nodes **in id order**, filtered to currently visible (non-faded) nodes only. Panel content updates with a brief crossfade. Show "2 of 7 visible" counter

**URL state**: Use `history.replaceState` to keep the URL in sync with app state. Support these params:

```
?q=search+term          # search query
&filter=license:MIT,category:cloud   # tag filters, comma-separated key:value pairs
&quadrant=tools         # active quadrant filter
&ring=adopt             # active ring filter
&node=42                # open popup for node id 42
```

On page load, parse URL params and restore full state before first render. Share URL should reproduce the exact view.

**Implementation constraints & notes**

1. **D3 v7** from jsDelivr CDN
2. **marked.js** + **DOMPurify** from jsDelivr CDN
3. No build step, no bundler — vanilla ES modules or plain scripts
4. `fetch('./data.json')` for data loading; show a simple loading state
5. SVG must be **responsive**: use `viewBox`, let CSS control the rendered size; radar should fill available width up to ~800px square
6. Do not hardcode pixel positions for nodes — compute all geometry from the `viewBox` dimensions and ring/quadrant definitions
7. Use CSS custom properties, e.g. `--ring-adopt-outer`, `--ring-trial-outer` etc. for ring radii, colors, layouts, etc. so they are easy to tune
8. All interactive states (hover, active, filtered) should be driven by CSS classes toggled via D3, not inline style mutations, except for `cx`/`cy`/`r` SVG attrs
9. **Accessibility**: nodes should have `role="button"` and `aria-label="[name], [ring]"`, popup should trap focus while open, close on Escape
10. Comment the seeded PRNG clearly — the jitter algorithm must be reproducible given the same `id`

**Aesthetic direction**

Clean, editorial, data-journalism tone — think the Economist graphics team. Professional color palette, generous whitespace, sharp typography. Use a **system font stack** for body and a **monospace** font for node numbers and code references. Avoid drop shadows except for the popup panel. Subtle hover animations only.

**Deliverable checklist**

Before finishing, verify:

- [ ] All 4 quadrants and 4 rings render with correct geometry
- [ ] Nodes positioned without overlap and well distributed in mock data (jitter works)
- [ ] Hover fade + tooltip functional
- [ ] Click opens popup with full content rendered
- [ ] Markdown + DOMPurify both working
- [ ] Search filters nodes correctly
- [ ] Tag filters work with AND/OR logic
- [ ] Keyboard nav cycles correctly through filtered nodes
- [ ] URL state round-trips correctly (paste URL into new tab → same view)
- [ ] Good contrast and visibility in both light and dark modes
- [ ] Responsive layout works on different screen sizes
- [ ] No console errors

A few things to note when I hand you the real `data.json` later:

- Tag keys will follow the same snake_case schema you defined — do not hardcode any specific key names in the UI logic
- The `history` array may be empty for newly added nodes
- New nodes in the real data will have only one history entry

Feel free to review, suggest edits to the schema, or flag any ambiguities before starting implementation.

This is a large task. Plan. Break it into steps. Use sub-agents as needed (e.g. mock data generation, verification, etc.)

IMPORTANT: Because Claude will almost certainly stall when generating such a large file at one shot, you MUST break this into parts, generating the .html in small chunks (e.g. scaffolding first) or layered edits (keeping each chunk small, max 50KB of edits) and saving it, checking it, then updating it with the next iteration, and so on.

---

Corrections:

- Left-align the radar so that the popup on the right side will overlap less with the radar. On the right side, include the following:
  - The title and description. Remove the navbar - and move the dark mode toggle into the filter-bar on the right.
  - Explanation of how to read the radar, and what the quadrants and rings mean (add this to the JSON as appropriate and render it here, so that it's editable without code changes)
  - The legend at the bottom. You can now remove the footer
  - This gives the entire vertical space to #filter-bar and #radar-main
- Currently, you're using quadrants less than 90 degrees. They should be 90 degrees, the MOVED so that there is a constant gap between the quadrants horizontally and vertically. Add the ring labels in that gap. See the reference image carefully.
- Modify the data.json schema for .rings to allow specifying how thick each ring should be relative to each other. This can vary across different data.jsons.
- Add a URL query parameter option to fetch any data.json URL, so that I can test with (or share) different data sets.
- .node-new-ring has a fill: none which is overridden by .node-q-techniques, etc. Avoid that.
- Clicking on a quadrant should filter by a quadrant. When the quadrant is filtered, smoothly zoom the SVG so that the filtered quadrant fills the available space.
- The labels for the quadrants at the four corners look too small - increase their size. Underling them doesn't look good - use a different, better aesthetic.
- In dark mode, the ring labels have low contrast. The white text on top of the nodes is not as clearly visible.

Inspect visually and make sure it looks good across different screen sizes. Also check light/dark mode contrast.

---

Corrections:

- When a popup is open, I should be able to click on another node without the popup needing to close first. We may not even need a panel scrim. Use --node-fade-opacity of 0.3.
- When the popup is closed, all nodes should return to full opacity. Right now, they return to full opacity only when I hover out of another node, which is not ideal.
- Rather than a grid, make .sidebar-dl display one below the other. Also increase the #sidebar width to match the popup width
- Make sure #filter-bar is OUTSIDE the radar column. It's like a header. Then #radar-main and #sidebar are next to each other. The dark/light mode toggle should be in #filter-bar

---

Corrections:

- Numbers above 100 are not displayed. Allow display of numbers up to 999, with 3-digit numbers in a smaller font.
- Add a configuration in the JSON that allows scaling all node radiuses and allows a fill opacity. For example: `{ ui: { node_scale: 1.5, node_fill_opacity: 0.8 } }`
- In .tag-filters-panel:
  - Skip tags where over 90% of the value have only a single node. This will eliminate links, IDs, sources, etc.
  - Don't auto-close .tag-filters-panel when a filter is applied. Let the user apply multiple filters in a row without needing to reopen the panel each time.
- Remove the padding on #radar-main
- Clicking on any area outside a node in any quadrant (i.e. in any empty area or in a .ring-arc - basically, anything in that quadrant) should filter by that quadrant. Clicking again should toggle the filter off.
- Make .dark-theme-toggle a .btn-outline-secondary instead of .btn-primary. Also make sure that the .active items inside it are colored the same way as the active filters.

<!-- copilot --resume=35e7e6a6-dfbe-46f4-9b10-cf9c3b6f31bf -->

## Radar Data, 04 Apr 2026

<!--

cd /home/sanand/code/tools/radar/
dev.sh \
  -v /home/sanand/code:/home/sanand/code:ro \
  -v /home/sanand/Dropbox/notes/transcripts:/home/sanand/Dropbox/notes/transcripts:ro
codex --yolo --model gpt-5.4 --config model_reasoning_effort=xhigh

-->

Create an `ai-radar.json` with a schema similar to ./data.json (see ./prompts.md to understand) that captures my point of view on LLM / Generative AI tools, techniques, platforms, and frameworks.

To do this, review the following information: (⭐ is a relevance rating)

- /home/sanand/code/til/:
  - ⭐⭐ llms.md: notes on LLMs, regularly updated
  - ⭐ trending-repos.tsv: Trending GitHub repos and my perspectives on them
  - til.md: things I learned - mostly outside of AI but may have some relevant insights
- /home/sanand/code/blog/:
  - ⭐⭐ posts/{2026,2025,2024} with a category that includes `llms` (just search for `  - llms` to find them): my LLM-related blog posts
  - ⭐⭐ pages/ai-advice.md: summarizes my AI advice
  - ⭐ /home/sanand/code/blog/pages/{prompts/,notes/}: has my prompts
- /home/sanand/code/scripts/:
  - ⭐⭐ agents/ has my prompts and skills. agents/AGENTS.md and agents/code/SKILL.md are particularly good starting points
  - ⭐⭐ dev.dockerfile and dev.sh: the dev environment in which I run my AI coding agents
  - ⭐ setup/linux.md has my preferred setup
  - ⭐ setup.fish has my fish setup with preferred tools and aliases
  - ask, agentlog.py, mcpserver.py, prompts/transcribe_calls.md, q, transcribe_calls.py: may be of some help
- /home/sanand/Dropbox/notes/transcripts:
  - ⭐⭐ extract/ai/*: extracts from advice I've given on AI topics
  - ⭐ learnings/ai*: learnings on AI
- /home/sanand/code/datastories/: has my data stories, mostly LLM generated
- /home/sanand/code/tools/: has my tools, mostly LLM generated
- /home/sanand/code/: my code base - which may have insights from tools, commits, frameworks, approaches, etc.
- ~/.codex, ~/.claude, ~/.copilot - my interactions with AI coding agents.

This is a MASSIVE collection of information. And you don't need to be limited by this!

So, just PLAN first, storying your work in ./plan/

- Inventory what's available and store it in a way that you can retrieve easily
- Use tools in /home/sanand/code/scripts or download / build tools yourself that will help you scan, retrieve, and summarize this information
- Create a plan for how to review this information and extract insights from it to populate the radar. Use sub-agents as needed.

Let me know if you can't access something, or install something, or have questions for me.

---

Go ahead with the plan. When building ai-radar.json:

- include source tag(s): file name and verbatim search text that justifies the node.
- include an importance score for each node (1-10) that reflects how important it is to me personally, based on the frequency and emphasis.
- include a confidence score for each node (1-10) that reflects how confident you are that this is an accurate reflection of my point of view, based on the clarity and consistency of the evidence.
- include history when there is clear evidence of how my perspective on this node has evolved over time (e.g. if it moved from assess to trial, or if the description changed significantly). Include source tags for each history entry as well.

---

Extend this extensively. Target ~150 nodes across quadrants - without compromising on the quality of the evidence or the accuracy of the representation. Prioritize quality over quantity.

PLAN first. For example, think about:

- How can you find more diverse nodes, not just the obvious ones?
- How can you scale to a large number of INSIGHTFUL nodes efficiently without losing signal-to-noise ratio?
- How can you ensure that the nodes are well-distributed across quadrants and rings, and not just clustered in one area?

Build tools where required.
Execute EFFICIENTLY. Use sub-agents as required.

---

Go ahead.
