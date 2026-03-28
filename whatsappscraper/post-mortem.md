## Post mortem (28 Mar 2026)

### Scope

This conversation covered a substantial rewrite and verification pass on `whatsappscraper/`:

- Fix polluted `text` extraction.
- Fix missing / incorrect `time`.
- Omit false booleans.
- Build a current-style HTML fixture first, then keep the bookmarklet aligned with it.
- Capture best-effort media metadata.
- Load older history through WhatsApp Web and test behavior at larger scale.
- Improve merge behavior so late-loading data enriches earlier rows instead of being lost.
- Preserve and commit all related workspace files, including `prompts.md`.

### Process so far

#### 1. Baseline inspection and rewrite choice

I started by treating the existing scraper as unreliable enough that incremental patching needed to be justified rather than assumed. The old behavior showed classic “whole-row DOM text” leakage:

- author labels bleeding into message text
- duplicate timestamps appended to text
- UI class names / accessibility text leaking into output
- null timestamps despite visible time in the row

The practical decision was:

- keep the bookmarklet/output shape
- replace the extraction strategy with smaller, explicit parsing helpers
- preserve only the older logic that still matched the current DOM and tests

This was the right call. The main quality gains came from changing *how* text and metadata were extracted, not from layering more filters on the old `innerText` path.

#### 2. Fixture-first parser stabilization

I created / curated `test-messages.html` as a current-style fixture and expanded `whatsappscraper.test.js` around it.

Key parser changes:

- iterate `#main [role="row"]` rows
- parse `data-id` into `messageId`, `userId`, and outgoing direction
- parse `data-pre-plain-text` for timestamp and sender label
- extract text from top-level selectable text nodes instead of the entire row
- treat `row.innerText` as a narrow fallback and for link-preview heuristics only
- normalize emoji via `data-plain-text` and `img.emoji[alt]`
- only emit booleans when true

This removed the `tail-inDennis Varghese...08:3508:35` class of errors at the source instead of trying to scrub them out afterward.

#### 3. Quote, link preview, and author handling

After the base text path was reliable, I tightened extraction for:

- author / authorPhone
- quoted author / quote text / quote message matching
- link preview title / description / hostname
- repeated-message author inheritance when WhatsApp omits redundant sender UI

This was important because the initial symptom list understated the real problem: once `innerText` is used too early, *all* of these fields become noisy and cross-contaminated.

#### 4. Live verification against WhatsApp Web via CDP

I used Playwright against the existing Chromium session at `localhost:9222` and injected the scraper into the live WhatsApp tab.

What worked:

- injecting the built `whatsappscraper.min.js` bundle via a `Blob` script tag
- evaluating `whatsappscraper.whatsappMessages(document)` directly in the live tab
- probing the DOM for selector variants and media rows before changing code

What this found:

- the cleaned parser matched the live DOM much better than the old implementation
- link preview extraction worked on current WhatsApp markup
- the visible viewport exposed a useful mix of text rows and media rows for sanity checks

#### 5. Media metadata support

I added best-effort media handling for currently observed patterns:

- GIF rows: `mediaType: "gif"` and placeholder text
- still images: `mediaType`, informative caption, width, height
- voice notes: `mediaType`, duration text, numeric duration seconds

The implementation prefers:

- informative caption text when available
- natural media dimensions over rendered box size
- caption text as `text` only when appropriate

I also updated tests and later folded media rows into the shared HTML fixture so the maintained fixture and the supported parser behaviors stayed aligned.

#### 6. Scale testing and older-history loading

I attempted to satisfy the “~1,000 messages” request by repeatedly loading older history in the live tab.

What I did:

- identified the actual WhatsApp message scroller in the DOM
- repeatedly forced top-of-chat loading with CDP
- accumulated unique `messageId` values across virtualized renders
- sampled loaded history for polluted text and media behavior

What I found:

- the session plateaued at 551 unique message IDs
- WhatsApp did not expose a visible “load older messages” / “use phone to load more” prompt in this run
- older history did load in chunks, but stopped well short of ~1,000

This means I validated scale into the hundreds, but I did **not** fully satisfy the requested ~1,000-message target because the live environment would not surface that much history during the session.

#### 7. Merge behavior improvement

The bookmarklet already had de-duplication by `messageId`, but its merge rule was too naive:

- longer strings won
- otherwise first-seen non-empty values stuck

That was not enough for WhatsApp’s delayed rendering behavior. I changed merging to be field-aware:

- longer strings still win for text-like fields
- larger numeric metadata wins for fields like media dimensions
- `true` booleans are preserved
- later `reactions` values win
- same-length replacements are allowed for `time` and `mediaDuration`

This directly addresses the problem where a row first appears partially rendered and gains richer metadata a moment later.

#### 8. Current state at the end of this turn

The main artifacts now in play are:

- rewritten parser logic in `whatsappscraper.js`
- rebuilt bookmarklet bundle in `whatsappscraper.min.js`
- stronger integration coverage in `whatsappscraper.test.js`
- curated shared fixture in `test-messages.html`
- updated usage / schema notes in `README.md`
- preserved working notes in `prompts.md`

The test suite passes and the bundle builds.

### Successes

#### Techniques that worked well

1. Fixture-first parsing

- Building a curated DOM fixture before trusting live ad hoc scraping gave a stable target.
- It made refactors much safer and forced the code toward maintainable selectors and helpers.

2. Parsing `data-pre-plain-text` aggressively

- This was the highest-value metadata source for time and sender identity.
- It was much more reliable than trying to infer everything from visible row text.

3. Extracting only top-level selectable text

- This was the biggest quality improvement.
- It prevented author labels, quote bodies, timestamps, and reaction UI from polluting `text`.

4. Using the built bundle for live injection

- Injecting the IIFE bundle matched the actual bookmarklet/runtime environment.
- It avoided module-format mismatches and CSP surprises.

5. Combining unit-style fixtures with live CDP checks

- Tests caught regressions quickly.
- Live CDP checks exposed WhatsApp-specific DOM behavior that no static fixture could predict.
- The two together were much stronger than either one alone.

6. De-dup + merge while scrolling

- Keeping message state keyed by `messageId` is the right overall model for a virtualized chat UI.
- Once the merge semantics became field-aware, it aligned well with WhatsApp’s delayed hydration behavior.

7. Narrow, composable parser helpers

- Small helpers for author extraction, quote extraction, media extraction, link extraction, and normalization made the rewrite easier to reason about.
- This reduced the tendency to add ad hoc fixes in one giant function.

#### Changes that would make these successes easier to repeat

1. Add a reusable live-history verifier script

Suggested addition:

- `whatsappscraper/verify-history.mjs`

Purpose:

- inject the built bundle
- scroll upward until history plateaus
- merge results using the same logic as the bookmarklet
- print total unique IDs, media counts, null-time counts, and likely plateau reason

Practical benefit:

- removes repeated ad hoc CDP scripting
- makes scale verification reproducible
- reduces quoting / scripting mistakes

2. Make fixture coverage an explicit acceptance rule

Prompt / process tweak:

- “Any newly supported message shape must appear in `test-messages.html` and be asserted from that fixture.”

Practical benefit:

- prevents the shared fixture from lagging behind inline one-off tests
- keeps the parser grounded in a maintained reference DOM

3. Keep “bundle-only live injection” as a standing rule

Prompt / process tweak:

- “When testing bookmarklet code via CDP, inject the built IIFE bundle, not the source module.”

Practical benefit:

- avoids an entire class of live-test false starts

### Problems faced

#### 1. I initially relied too much on ad hoc live scripts

Root cause:

- there was no checked-in, reusable live-history verification script
- the environment encourages quick `node <<'NODE'` iterations, which is fast initially but noisy and brittle as the task grows

Practical impact:

- repeated custom scripts
- inconsistent metrics across runs
- extra time spent distinguishing true parser issues from script-quality issues

Safe fix:

- check in a dedicated `verify-history.mjs`
- prefer it over inline shell heredocs for future CDP validation

#### 2. Raw source injection vs bundle injection caused avoidable confusion

Root cause:

- the source file is ESM-style code, but the live page needs the bundled bookmarklet/runtime form

Practical impact:

- misleading live results early in the process
- extra time spent validating whether the parser or the injection method was at fault

Safe fix:

- institutionalize “live tests use `whatsappscraper.min.js` only”
- optionally make `verify.mjs` the only supported entry point for live sanity checks

#### 3. Early scale scripts measured the wrong thing

Root cause:

- WhatsApp Web virtualizes rows
- naive accumulation overwrote richer older versions with poorer later renders
- stagnation heuristics were too simplistic in some early runs

Practical impact:

- misleading `null time` counts in some runs
- several extra iterations to separate scraper quality from measurement artifacts

Safe fix:

- use the same merge logic in live verification that the bookmarklet uses in production
- report two numbers explicitly:
  - unique IDs observed
  - merged final rows with quality stats

This resolves a broader class of “virtualized UI measurement” errors, not just this project.

#### 4. The curated fixture lagged media support for a while

Root cause:

- I added inline JS tests for media faster than I updated the shared HTML fixture

Practical impact:

- partial compliance with the user’s explicit “HTML test set first” request
- maintainability gap: the central fixture was less representative than the parser/test surface

Safe fix:

- make “fixture parity” an explicit done criterion
- reject new parser support for a DOM shape unless it is represented in `test-messages.html`

#### 5. Merge semantics were initially too simplistic

Root cause:

- the first pass assumed “prefer longer strings” was sufficient for late-loading enrichment

Practical impact:

- numeric metadata like image dimensions could get stuck on the first, smaller value
- same-length but newer fields like reactions could remain stale

Safe fix:

- keep `mergeValue()` field-aware
- preserve the regression test that covers numeric upgrades and tie-break behavior

This is a good example of where adhering to the letter of “merge richer values” without modeling field types was not enough.

#### 6. I could not fully satisfy the ~1,000-message target

Root cause:

- the live WhatsApp session stopped surfacing older history after 551 unique IDs
- no visible “load older” prompt or alternate retrieval path appeared

Practical impact:

- scale confidence is good into the hundreds, but not to the exact target requested
- there is still untested risk in much older message ranges

Safe fix:

- document the actual observed ceiling in the output
- add an explicit prerequisite to future prompts / runbooks:
  - ensure the device / chat has older history synchronized before testing
  - be prepared for a hard UI ceiling that blocks exact-count validation

This does not guarantee 1,000, but it turns a silent mismatch into a known environmental constraint.

#### 7. Some live `time` gaps are environmental, not purely parser bugs

Root cause:

- certain admin/system/partial rows do not consistently expose timestamp metadata in the current DOM

Practical impact:

- occasional `time` gaps can remain even when the normal parser path is correct

Safe fix:

- document this clearly as best-effort behavior
- if the project needs stronger guarantees later, capture and parse date-separator chips and admin-row variants explicitly

#### 8. The shell transcript of multiline Node commands was harder to trust than the actual execution

Root cause:

- JSON -> shell -> heredoc quoting creates ugly echoed command text in this environment even when the command still runs

Practical impact:

- harder debugging
- wasted attention on whether quoting artifacts reflected real execution problems

Safe fix:

- prefer checked-in verifier scripts over long inline heredocs
- if ad hoc scripting is still needed, use short `node -e` snippets or temp files instead of large embedded scripts

### What I would do differently next time

1. Start by creating two checked-in live verification helpers, not one:

- `verify.mjs` for current viewport sanity
- `verify-history.mjs` for scale / plateau checks

2. Treat `test-messages.html` as the canonical supported-DOM inventory from the start.

3. Make merge semantics field-aware immediately for any scraper that runs against a delayed-hydration UI.

4. Report scale validation using exact observed ceilings early, instead of aiming at the user’s target until the UI clearly blocks it.

5. Separate parser bugs from measurement-script bugs sooner by reusing the same merge logic in both places.

### Recommended next steps

1. Add `verify-history.mjs` so future scale checks are one command instead of repeated manual CDP scripting.

2. Add fixture coverage for:

- admin/system rows
- date separators
- video rows
- document rows
- non-voice audio rows

3. If older-history validation is important, test on a chat known to have more than 1,000 synced messages and document any WhatsApp-side ceiling explicitly.

4. Keep `prompts.md` as an archived working log for this effort. It is useful context for later maintenance because it records the actual request evolution: rewrite, media capture, scale validation, merge improvement, and now this post-mortem.
