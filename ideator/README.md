# Ideator - AI Concept Synthesizer

Break free from creative blocks by mashing up unexpected ideas.

![Ideator Screenshot](https://via.placeholder.com/800x400/0d6efd/ffffff?text=Ideator+Screenshot)

## What is this?

Ideator is a web-based tool that helps you generate **novel, useful ideas** by combining random insights from curated knowledge collections. Instead of brainstorming in isolation, you're remixing proven concepts in surprising ways to spark breakthrough thinking.

Think of it as a creative collision engine: it takes two unrelated concepts and asks AI to synthesize them into actionable ideas aligned with your goals.

## Why is this useful?

### The Problem

- Creative blocks happen when we rely on the same mental patterns
- Solo brainstorming often recycles familiar ideas
- Innovation requires connecting disparate concepts
- We need concrete starting points, not blank pages

### The Solution

Ideator solves this by:

1. **Forcing unexpected connections** - Random concept pairing breaks habitual thinking
2. **Leveraging expert knowledge** - Draws from curated notes on LLMs, AI capabilities, core concepts, and creative ideas
3. **Providing structure** - AI synthesis uses proven frameworks (Novel × Useful × Feasible scoring)
4. **Enabling serendipity** - Recency weighting favors recent insights while allowing discovery of older gems

## How to use it

### For First-Time Users

1. **Open the app** - Visit the [Ideator tool](https://s-anand.net/ideator/) in your browser
2. **Pick a Quick Goal** - Click one of the goal cards (e.g., "Innovative web app") or type your own objective
3. **Select two concepts**:
   - Use the **Random** button for serendipity (recommended!)
   - Or browse by **Source** and **Search** for specific topics
   - Adjust **Recency** slider if you want newer vs. older notes
4. **Generate ideas** - Click **"Ideate with Claude"** (or ChatGPT, Google, Grok) to open your preferred AI with a pre-filled prompt
5. **Iterate** - Try different concept combinations until you find a compelling direction

### Tips for Best Results

- **Embrace randomness** - The best ideas often come from unexpected pairings
- **Try multiple runs** - Generate 3-5 ideas, then pick the most promising
- **Adjust recency** - Set to 0 for maximum diversity, 100 for cutting-edge trends
- **Refine the prompt** - Click "Prompt Template" to customize the synthesis instructions
- **Mix sources** - Combine technical concepts (AI Capabilities) with creative thinking (Creative Ideas)

## Technical Details

### For Developers & Maintainers

#### Architecture

**Frontend-only static web app** built with:

- **Vanilla HTML/CSS/JS** - No build step required
- **Bootstrap 5** - Responsive UI framework
- **lit-html** - Efficient DOM rendering
- **marked.js** - Markdown parsing for note display
- **bootstrap-alert** - User-friendly error/success messages

#### How it Works

1. **Data Fetching** (`fetchNotes()`)

   - Fetches 6 markdown files from GitHub on page load
   - Sources: LLMs, Things I Learned, Core Concepts, Creative Ideas, AI Capabilities, Questions
   - Raw URLs: `https://raw.githubusercontent.com/sanand0/til/refs/heads/live/*.md`

2. **Markdown Parsing** (`parseMarkdownNotes()`)

   - Extracts top-level bullets (lines starting with `- ` or `* `)
   - Groups sub-bullets and content under each top-level bullet
   - Tags each note with its most recent heading
   - Result: Structured notes array with `{ content, heading, source }` objects

3. **Note Selection**

   - **Filtering**: Real-time search across note content and headings
   - **Navigation**: Arrow keys (↑/↓) in search box to browse filtered notes
   - **Random selection with decay**: Exponential weighting favors recent notes
     ```js
     weight[i] = exp(decay * position * 5);
     // decay=0: uniform distribution
     // decay=1: strong preference for recent notes
     ```

4. **Prompt Generation** (`generatePrompt()`)

   - Replaces template placeholders: `{{goal}}`, `{{note1}}`, `{{note2}}`
   - Default template uses mental models: Inversion, Mechanism-transplant, Constraint-violation, Scale-jump, Oblique strategies
   - Scores ideas on: Novel (1-5), Useful (1-5), Feasible (1-5)

5. **AI Integration**
   - **Claude**: `https://claude.ai/new?q={prompt}`
   - **ChatGPT**: `https://chatgpt.com/?q={prompt}`
   - **Google AI Mode**: `https://www.google.com/search?udm=50&q={prompt}`
   - **Grok**: Copies to clipboard (no URL param support)

#### State Management

Uses browser localStorage for:

- `ideator_visited` - First-time user detection (pre-populates goal + notes)
- `ideator_template` - Custom prompt template persistence

#### File Structure

```
ideator/
├── index.html       # UI layout, Bootstrap styling
├── script.js        # All application logic
├── prompts.md       # Development notes (archived)
└── README.md        # This file
```

#### Key Functions

- `fetchNotes()` - Fetches markdown from GitHub
- `parseMarkdownNotes(markdown, sourceName)` - Extracts structured notes
- `updateFilteredNotes(cardNum)` - Applies search filter and updates display
- `displayNote(cardNum)` - Renders selected note as markdown
- `pickRandomNote(cardNum)` - Weighted random selection with decay
- `generatePrompt()` - Replaces template placeholders with current state

#### Dependencies

All loaded from CDN (no npm install required):

- `lit-html@^3` - Template rendering
- `marked@^13` - Markdown parsing
- `bootstrap@5.3.6` - UI framework
- `bootstrap-icons@1.13.1` - Icon set
- `bootstrap-alert@1` - Alert notifications
- `bootstrap-dark-theme@1` - Dark mode support

#### Adding New Note Sources

1. Add source to `SOURCES` array in `script.js`:
   ```js
   { id: "new-source", name: "Display Name", url: "https://raw.githubusercontent.com/..." }
   ```
2. Notes automatically appear in Source dropdown
3. Markdown must use top-level bullets (`- ` or `* `) for extraction

#### Customizing the Prompt

Users can edit the template via the UI's "Prompt Template" accordion. Developers can change the default in `DEFAULT_TEMPLATE` constant:

```js
const DEFAULT_TEMPLATE = `Your custom prompt here...
{{goal}}    // Replaced with user's goal input
{{note1}}   // Replaced with Concept 1 content
{{note2}}   // Replaced with Concept 2 content
`;
```

#### Testing Locally

1. Clone the repository
2. Serve with any static web server:
   ```bash
   python -m http.server 8000
   # or
   npx serve
   ```
3. Open `http://localhost:8000/ideator/`

#### Deployment

Static hosting on GitHub Pages:

- No build step required
- Just push to `main` branch
- Access at `https://s-anand.net/ideator/`

#### Browser Compatibility

Works in all modern browsers (Chrome, Firefox, Safari, Edge) with ES6 module support. Requires:

- ES6 modules (`<script type="module">`)
- Fetch API
- localStorage
- CSS Grid & Flexbox

## Troubleshooting

### Notes not loading

- Check browser console for CORS errors
- Verify GitHub raw URLs are accessible
- Check network connectivity

### Random button not working

- Ensure notes are loaded (wait for spinner to disappear)
- Try filtering by source if "All Sources" fails
- Check browser console for JavaScript errors

### Prompt template reset

- Click "Reset to Default" button in Prompt Template section
- Or clear localStorage: `localStorage.removeItem('ideator_template')`

## Contributing

Want to add features or fix bugs?

1. Fork the repository
2. Make changes to `index.html` or `script.js`
3. Test locally with a static server
4. Submit a pull request

Suggested improvements:

- Add more note sources
- Improve markdown parsing for edge cases
- Add export/share functionality for generated prompts
- Implement URL state management for bookmarkable configurations

## License

MIT License - see [LICENSE](../LICENSE) file

## Credits

Built by [S Anand](https://github.com/sanand0) with assistance from Claude.

Note sources from [sanand0/til](https://github.com/sanand0/til) repository.
