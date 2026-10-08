# Scraper notes

## ChatGPT DOM update, 26 Sep 2026

ChatGPT's rendered transcript no longer exposes the older
`data-message-author-role` attributes or `section[data-testid^="conversation-turn-"]`
wrappers. The scraper therefore found no messages on current chats. In the
current DOM, user text is inside `[data-user-message-bubble="true"]` and
assistant Markdown is marked with
`[data-markdown-text-style="assistant-message"]`. User Markdown may also carry
`data-markdown-text-tone="user-message"`. Message IDs live on nearby
`data-chatgpt-search-message-ids` or
`data-chatgpt-selection-message-id` attributes; message timestamps are in a
nearby `time[datetime]` under a `data-content-search-turn-key` container.

The scraper now prefers the old role-marked nodes when present and falls back to
the current user bubble and assistant Markdown markers. It reads the nearby
immutable message ID and timestamp, then uses DOM order while capturing. ChatGPT
still virtualizes long chats, so scroll through older messages to let the
existing capture loop accumulate them. Extraction remains passive and does not
open reasoning controls.

The close button assigns the glyph from the ASCII JavaScript escape `\u00d7`,
avoiding mojibake in bookmarklet injection paths that decode UTF-8 bytes as
Latin-1.

## ChatGPT rich-message DOM catalog, 8 Oct 2026

### Live observations from the three supplied snapshots

The snapshots were inspected passively from saved DOM. No popovers, downloads,
buttons, or other controls were opened. The observed `data-d-component` names
are: `text`, `title`, `code`, `list`, `list-item`, `table`, `table-row`,
`table-cell`, `box`, `row`, `grid`, `grid-item`, `caption`, `divider`,
`badge`, `favicon`, `icon`, `popover-trigger`, `pressable`, and `button`.
Component names are presentation primitives, but they provide useful stable
boundaries when extracting semantic content.

`text` and `title` contain ordinary prose and headings. `code` occurs both as
inline code in prose/table cells and as a fenced code surface. A fenced code
surface is marked by `[data-markdown-copy="code-block"]`; its toolbar is marked
`[data-markdown-copy="exclude"]` and contains controls such as word-wrap and
copy. Exclude that toolbar from code content, while retaining the language
label and the `pre code` text. `list`/`list-item` and the explicit table
components should be emitted as lists and rows/cells rather than flattened
text. Table headers use `th` and `scope="col"`; cells can carry alignment and
long-token hints.

Assistant streaming is represented by spans carrying `data-d-stream-word`
(with `data-d-text-flow="word"`); adjacent spans form a single text run. Join
their text in DOM order and avoid treating each span as a separate message or
paragraph. A capture made while streaming may contain only a prefix, so the
existing accumulation logic must remain tolerant of later replacement or
extension.

`grid` contains `grid-item` metric cards. The card pattern is a label in a
`text` node followed by a large `title` value, sometimes with semantic color
attributes such as success. Preserve the label/value pair and the grid order;
do not infer a numeric type from typography or color. `caption` is a distinct
short annotation associated with nearby content. `divider` is a visual
separator and should not become literal prose, but it can delimit adjacent
cards/sections when reconstructing structure.

Citation/source chips use `popover-trigger` containing a `badge`, optional
`favicon`, source label, and sometimes a visible `+N` count. Keep the visible
label and count. The trigger's `role` was observed as both `button` and
`link`; role alone does not establish that a URL is available. Some inline
reference phrases also use `popover-trigger` with `role="link"`, dotted
underline, and an external-link icon. The popover itself was intentionally not
opened, so no hidden URL, title, or source metadata may be inferred.

The observed image/card fallback is a `box` with `role="img"` and
`aria-label="Image unavailable"`; preserve that explicit unavailable state and
nearby visible caption text. Do not manufacture an image URL from the favicon,
CSS, or icon SVG. Download affordances use `pressable` with `role="link"` and
an accessible label or visible filename, including ZIP names. They had no
`href` in the saved DOM; preserve the filename/label and mark the destination
unknown rather than guessing a URL or activating the control. A semantic
follow-up/action control was observed as `button`, with visible action text
and an arrow icon. Preserve its label and position, but do not click it.

### Online-documented capabilities not observed in these snapshots

These official sources describe other ChatGPT surfaces that may appear in
future transcripts, but they were not present in the three saved DOM samples:

- Web search answers can show inline citations, a Sources section, related
  links, images, and specialized visual results (maps, weather, sports,
  finance). [Searching the web with ChatGPT](https://help.openai.com/en/articles/9237897-chatgpt-search)
- Deep Research can produce a fullscreen report with table of contents,
  sources, activity history, and downloadable Markdown/Word/PDF output.
  [Deep research in ChatGPT](https://help.openai.com/en/articles/10500283-deep-research-in-chatgpt)
- Data Analysis can render expandable interactive tables and charts, with
  chart customization and downloads. [Improvements to data analysis](https://openai.com/index/improvements-to-data-analysis-in-chatgpt/)
- Connected apps can inject interactive maps, cards, documents, playlists,
  search results, and approval/action controls. [Connected apps](https://help.openai.com/en/articles/11487775-connected-apps-in-chatgpt)
- Canvas is a separate writing/code artifact with inline edits/comments,
  version restore, and sharing. [Introducing canvas](https://openai.com/index/introducing-canvas/)
- Library/file cards can represent uploaded or generated documents,
  spreadsheets, presentations, PDFs, and images. [Library](https://help.openai.com/en/articles/20001052-file-storage-and-library-in-chatgpt)
- Shopping Research progressively shows product cards and comparison fields;
  Study Mode and newer interactive math/science explanations can show guided
  checks and manipulable visuals. [Shopping Research](https://help.openai.com/en/articles/12911370-using-shopping-research-in-chatgpt), [Study Mode](https://help.openai.com/en/articles/11780217-study-mode), [Interactive learning](https://openai.com/index/new-ways-to-learn-math-and-science-in-chatgpt/)
- Agent/browser work can expose tool activity, progress, screenshots,
  confirmations, and result files. [ChatGPT agent](https://help.openai.com/en/articles/11794368)

These documented surfaces are research leads, not claims about the supplied
DOM. Passive scraping cannot recover content held behind a closed popover,
virtualized panel, canvas/artifact workspace, download handler, or interactive
widget. The scraper should report only visible text, explicit attributes,
stable IDs, and actual `href`/`src` values; it must not infer URLs or data and
must not open controls as a side effect of extraction.

### Additional live observations from the generated demo

The generated [demonstration chat](https://chatgpt.com/c/6ac7398c-909c-83ec-a5ae-e6a16d0bf276) exposed the following additional structures. These were recorded passively; no expandable explanation, checkbox, chart, or editor control was activated. The sanitized regression fixture is `__fixtures__/chatgpt-rich.html`.

The demo did not contain generated images.

- Cards use `data-d-component="card"` and the same `box`/`row`/`grid-item` primitives, but a
  card can carry a distinct accessible label and a nested action area. Preserve
  the card's visible heading, body, image state, and action label as one
  ordered unit.
- Checkboxes use a real element with `role="checkbox"`, `aria-checked`, and a
  visible label connected through `label[for]`. Preserve checked state and
  label text; do not assume an unchecked visual means false if the ARIA state
  is present.
- Mathematical content has TeX/MathML-style annotation. Inline and block
  math carry `data-d-stream-inline` or `data-d-block` markers alongside
  `data-d-stream-word` content. Keep the math source/annotation and whether it
  is inline or block; do not reduce a formula to its screen-reader rendering
  alone.
- Block quotes are a separate semantic block (`blockquote`), so retain quote
  boundaries instead of flattening them into the surrounding paragraph.
- Native charts are marked `[data-w-component="chart"]`. They include an
  accessible, screen-reader-only `ul` with data summaries. Preserve the chart
  marker, visible title/labels, and every summary-list item. The summary list
  is the only data representation observed without activating the chart, so do
  not infer a URL, chart series, or hidden values from canvas/SVG geometry.
- Editable code can be a CodeMirror surface rather than `pre code`: it uses
  `[role="textbox"][data-language]` and child `.cm-line` nodes. Extract the
  ordered `.cm-line` text and language attribute. Keep this separate from
  ordinary prose code and continue excluding editor chrome/toolbars.
- Explanation controls are ordinary `button` elements with expandable-looking
  labels. They are not native `<details>` elements. Preserve their labels without
  assuming they represent collapsible sections; passive scraping must not click
  them to obtain hidden content.

The earlier online-research classification should therefore be read as
follows: a native chart is now live-observed in the demo, including its
accessible summary list. Interactive chart behaviors, downloadable chart
outputs, and the other documented data-analysis surfaces remain unobserved.

### Associated previews

Link and citation previews were also inspected in dedicated background copies of
the supplied chats. A trigger's `aria-controls` identifies a portaled `role="dialog"`.
Ordinary link previews expose a full URL in a `pressable` element's `aria-label`;
the visible URL can be truncated. Source-chip previews instead expose a `col`
containing `pressable` source cards with publisher and document title. Those cards
can still lack URLs. The scraper preserves the titles without treating the
favicon domain as the cited page. It reads only an already associated preview,
never opens one, and caches exposed references by immutable message ID and
occurrence so virtualized remounts do not discard them.
