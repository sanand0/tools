import { html, render } from "https://cdn.jsdelivr.net/npm/lit-html/+esm";
import { unsafeHTML } from "https://cdn.jsdelivr.net/npm/lit-html/directives/unsafe-html.js";
import { marked } from "https://cdn.jsdelivr.net/npm/marked/+esm";
import { bootstrapAlert } from "https://cdn.jsdelivr.net/npm/bootstrap-alert@1";

// Note sources
const SOURCES = [
  { id: "llms", name: "LLMs", url: "https://raw.githubusercontent.com/sanand0/til/refs/heads/live/llms.md" },
  { id: "til", name: "Things I Learned", url: "https://raw.githubusercontent.com/sanand0/til/refs/heads/live/til.md" },
  {
    id: "core",
    name: "Core Concepts",
    url: "https://raw.githubusercontent.com/sanand0/til/refs/heads/live/core-concepts.md",
  },
  {
    id: "creative",
    name: "Creative Ideas",
    url: "https://raw.githubusercontent.com/sanand0/til/refs/heads/live/creative-ideas.md",
  },
  {
    id: "ai",
    name: "AI Capabilities",
    url: "https://raw.githubusercontent.com/sanand0/til/refs/heads/live/ai-capabilities.md",
  },
  {
    id: "questions",
    name: "Questions",
    url: "https://raw.githubusercontent.com/sanand0/til/refs/heads/live/questions.md",
  },
];

// Quick goal examples with icons
const GOAL_EXAMPLES = [
  { text: "Innovative web app", icon: "bi-globe" },
  { text: "Strategic business plan", icon: "bi-briefcase" },
  { text: "Data visualization tool", icon: "bi-graph-up" },
  { text: "Educational content series", icon: "bi-book" },
  { text: "Process automation system", icon: "bi-gear" },
];

// Default prompt template
const DEFAULT_TEMPLATE = `You are a radical concept synthesizer hired to astound even experts.

Generate a big, useful, non-obvious idea aligned with "{{goal}}" fusing provided <CONCEPT>s with concrete next steps.

<CONCEPT>
{{note1}}
</CONCEPT>

<CONCEPT>
{{note2}}
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

STYLE: Easy to read: ELI15. Make it interesting to read!`;

// Application state
let allNotes = [];
let notesBySource = {};
let currentNotes = { 1: null, 2: null };
let filteredNotes = { 1: [], 2: [] };

// DOM elements
const loadingIndicator = document.getElementById("loadingIndicator");
const appContent = document.getElementById("appContent");
const goalInput = document.getElementById("goalInput");
const goalCards = document.getElementById("goalCards");
const promptTemplate = document.getElementById("promptTemplate");
const resetTemplateBtn = document.getElementById("resetTemplate");

// Parse markdown to extract top-level bullets with headings
function parseMarkdownNotes(markdown, sourceName) {
  const lines = markdown.split("\n");
  const notes = [];
  let currentHeading = "";
  let currentBullet = null;
  let bulletLines = [];

  for (const line of lines) {
    // Check for headings
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      // Save previous bullet if exists
      if (currentBullet !== null && bulletLines.length > 0) {
        notes.push({
          content: bulletLines.join("\n"),
          heading: currentHeading,
          source: sourceName,
        });
        bulletLines = [];
        currentBullet = null;
      }
      currentHeading = headingMatch[2].trim();
      continue;
    }

    // Check for top-level bullets (- or * at start)
    const topLevelBulletMatch = line.match(/^[-*]\s+(.+)$/);
    if (topLevelBulletMatch) {
      // Save previous bullet if exists
      if (currentBullet !== null && bulletLines.length > 0) {
        notes.push({
          content: bulletLines.join("\n"),
          heading: currentHeading,
          source: sourceName,
        });
      }
      // Start new bullet
      bulletLines = [line];
      currentBullet = topLevelBulletMatch[1];
      continue;
    }

    // If we're inside a bullet, add the line (including sub-bullets)
    if (currentBullet !== null) {
      bulletLines.push(line);
    }
  }

  // Save last bullet if exists
  if (currentBullet !== null && bulletLines.length > 0) {
    notes.push({
      content: bulletLines.join("\n"),
      heading: currentHeading,
      source: sourceName,
    });
  }

  return notes;
}

// Fetch and parse all notes
async function fetchNotes() {
  loadingIndicator.classList.remove("d-none");
  const allFetches = SOURCES.map(async (source) => {
    try {
      const response = await fetch(source.url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const markdown = await response.text();
      const notes = parseMarkdownNotes(markdown, source.name);
      return { source: source.id, notes };
    } catch (error) {
      console.error(`Error fetching ${source.name}:`, error);
      return { source: source.id, notes: [], error: error.message };
    }
  });

  const results = await Promise.all(allFetches);
  loadingIndicator.classList.add("d-none");

  // Check for errors
  const errors = results.filter((r) => r.error);
  if (errors.length === results.length) {
    bootstrapAlert({
      title: "Failed to load notes",
      body: "Could not fetch any notes from the repository. Please check your internet connection.",
      color: "danger",
    });
    return false;
  }

  // Organize notes
  notesBySource = { all: [] };
  for (const result of results) {
    notesBySource[result.source] = result.notes;
    notesBySource.all.push(...result.notes);
  }
  allNotes = notesBySource.all;

  appContent.classList.remove("d-none");
  return true;
}

// Initialize source selectors
function initializeSourceSelectors() {
  const sourceOptions = [
    { value: "all", label: "All Sources" },
    ...SOURCES.map((s) => ({ value: s.id, label: s.name })),
  ];

  for (const cardNum of [1, 2]) {
    const select = document.getElementById(`source${cardNum}`);
    select.innerHTML = "";
    for (const opt of sourceOptions) {
      const option = document.createElement("option");
      option.value = opt.value;
      option.textContent = opt.label;
      select.appendChild(option);
    }
  }
}

// Get filtered notes for a card
function getFilteredNotes(cardNum) {
  const source = document.getElementById(`source${cardNum}`).value;
  const filterText = document.getElementById(`filter${cardNum}`).value.toLowerCase();

  let notes = notesBySource[source] || [];

  if (filterText) {
    notes = notes.filter((note) => {
      const searchText = `${note.heading} ${note.content}`.toLowerCase();
      return searchText.includes(filterText);
    });
  }

  return notes;
}

// Update filtered notes and adjust index
function updateFilteredNotes(cardNum) {
  filteredNotes[cardNum] = getFilteredNotes(cardNum);
  const indexInput = document.getElementById(`index${cardNum}`);
  indexInput.max = Math.max(0, filteredNotes[cardNum].length - 1);

  // Reset index if out of bounds
  if (parseInt(indexInput.value) >= filteredNotes[cardNum].length) {
    indexInput.value = 0;
  }

  displayNote(cardNum);
}

// Display note in card
function displayNote(cardNum) {
  const notes = filteredNotes[cardNum];
  const index = parseInt(document.getElementById(`index${cardNum}`).value) || 0;

  if (notes.length === 0) {
    render(
      html`<p class="text-muted"><em>No notes match your filter</em></p>`,
      document.getElementById(`note${cardNum}`),
    );
    document.getElementById(`meta${cardNum}`).textContent = "";
    currentNotes[cardNum] = null;
    return;
  }

  const note = notes[Math.min(index, notes.length - 1)];
  currentNotes[cardNum] = note;

  // Render note content as markdown
  const noteHtml = marked.parse(note.content);
  render(html`${unsafeHTML(noteHtml)}`, document.getElementById(`note${cardNum}`));

  // Update metadata
  document.getElementById(`meta${cardNum}`).textContent =
    `${note.source} / ${note.heading || "No heading"} (${index + 1} of ${notes.length})`;
}

// Pick random note with decay
function pickRandomNote(cardNum) {
  const notes = filteredNotes[cardNum];
  if (notes.length === 0) return;

  const decay = parseInt(document.getElementById(`decay${cardNum}`).value) / 100;

  // Generate weights with exponential decay favoring recent notes (end of array)
  const weights = notes.map((_, i) => {
    if (decay === 0) return 1; // No decay, all equal
    const position = i / Math.max(1, notes.length - 1);
    return Math.exp(decay * position * 5); // Scale factor of 5 for noticeable effect
  });

  const totalWeight = weights.reduce((a, b) => a + b, 0);
  let random = Math.random() * totalWeight;

  for (let i = 0; i < weights.length; i++) {
    random -= weights[i];
    if (random <= 0) {
      document.getElementById(`index${cardNum}`).value = i;
      displayNote(cardNum);
      return;
    }
  }
}

// Generate prompt
function generatePrompt() {
  const goal = goalInput.value.trim() || "a novel solution";
  const note1 = currentNotes[1]?.content || "No concept selected";
  const note2 = currentNotes[2]?.content || "No concept selected";

  const template = promptTemplate.value;
  return template
    .replace(/\{\{goal\}\}/g, goal)
    .replace(/\{\{note1\}\}/g, note1)
    .replace(/\{\{note2\}\}/g, note2);
}

// Initialize goal cards
function initializeGoalCards() {
  const cards = GOAL_EXAMPLES.map(
    (goal) => html`
      <div class="col">
        <div
          class="card goal-card h-100 text-center p-3"
          @click=${() => {
            goalInput.value = goal.text;
          }}
        >
          <div class="card-body p-2">
            <i class="bi ${goal.icon} mb-2 d-block"></i>
            <small class="fw-semibold">${goal.text}</small>
          </div>
        </div>
      </div>
    `,
  );
  render(html`${cards}`, goalCards);
}

// Set up event listeners
function setupEventListeners() {
  // Source and filter changes
  for (const cardNum of [1, 2]) {
    document.getElementById(`source${cardNum}`).addEventListener("change", () => updateFilteredNotes(cardNum));
    document.getElementById(`filter${cardNum}`).addEventListener("input", () => updateFilteredNotes(cardNum));
    document.getElementById(`index${cardNum}`).addEventListener("input", () => displayNote(cardNum));
    document.getElementById(`random${cardNum}`).addEventListener("click", () => pickRandomNote(cardNum));

    // Decay slider
    const decaySlider = document.getElementById(`decay${cardNum}`);
    const decayValue = document.getElementById(`decay${cardNum}Value`);
    decaySlider.addEventListener("input", (e) => {
      decayValue.textContent = e.target.value;
    });

    // Arrow key navigation
    document.getElementById(`filter${cardNum}`).addEventListener("keydown", (e) => {
      const indexInput = document.getElementById(`index${cardNum}`);
      const currentIndex = parseInt(indexInput.value) || 0;
      const maxIndex = parseInt(indexInput.max) || 0;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        indexInput.value = Math.min(currentIndex + 1, maxIndex);
        displayNote(cardNum);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        indexInput.value = Math.max(currentIndex - 1, 0);
        displayNote(cardNum);
      }
    });
  }

  // Ideate buttons
  document.getElementById("ideateClause").addEventListener("click", () => {
    const prompt = generatePrompt();
    window.open(`https://claude.ai/new?q=${encodeURIComponent(prompt)}`, "_blank");
  });

  document.getElementById("ideateChatGPT").addEventListener("click", () => {
    const prompt = generatePrompt();
    window.open(`https://chatgpt.com/?q=${encodeURIComponent(prompt)}`, "_blank");
  });

  document.getElementById("ideateGoogle").addEventListener("click", () => {
    const prompt = generatePrompt();
    window.open(`https://www.google.com/search?udm=50&q=${encodeURIComponent(prompt)}`, "_blank");
  });

  document.getElementById("ideateGrok").addEventListener("click", () => {
    const prompt = generatePrompt();
    // Grok doesn't support URL params, so we copy to clipboard
    navigator.clipboard
      .writeText(prompt)
      .then(() => {
        bootstrapAlert({
          title: "Copied to clipboard",
          body: "Prompt copied! Paste it in Grok at grok.com",
          color: "info",
        });
        window.open("https://grok.com/", "_blank");
      })
      .catch(() => {
        bootstrapAlert({
          title: "Copy failed",
          body: "Could not copy to clipboard",
          color: "danger",
        });
      });
  });

  document.getElementById("copyPrompt").addEventListener("click", () => {
    const prompt = generatePrompt();
    navigator.clipboard
      .writeText(prompt)
      .then(() => {
        bootstrapAlert({
          title: "Copied",
          body: "Prompt copied to clipboard",
          color: "success",
        });
      })
      .catch(() => {
        bootstrapAlert({
          title: "Copy failed",
          body: "Could not copy to clipboard",
          color: "danger",
        });
      });
  });

  // Template management
  resetTemplateBtn.addEventListener("click", () => {
    promptTemplate.value = DEFAULT_TEMPLATE;
    localStorage.removeItem("ideator_template");
  });

  promptTemplate.addEventListener("change", () => {
    localStorage.setItem("ideator_template", promptTemplate.value);
  });
}

// Initialize app
async function init() {
  // Load saved template or use default
  promptTemplate.value = localStorage.getItem("ideator_template") || DEFAULT_TEMPLATE;

  // Fetch notes
  const success = await fetchNotes();
  if (!success) return;

  // Initialize UI
  initializeSourceSelectors();
  initializeGoalCards();
  setupEventListeners();

  // Load initial notes
  for (const cardNum of [1, 2]) {
    updateFilteredNotes(cardNum);
  }

  // Pre-populate for first-time users
  const hasVisited = localStorage.getItem("ideator_visited");
  if (!hasVisited) {
    localStorage.setItem("ideator_visited", "true");

    // Set a default goal
    goalInput.value = GOAL_EXAMPLES[0].text;

    // Pick random notes for both cards
    setTimeout(() => {
      pickRandomNote(1);
      pickRandomNote(2);
    }, 100);
  }

  console.log("Ideator initialized with", allNotes.length, "notes");
}

void init();
