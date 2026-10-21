# Tools

A collection of single page web apps, mostly LLM generated. Hosted at [tools.s-anand.net](./https://tools.s-anand.net).

## Tools

## Available Tools

- **[Music](./music/)**: Play your local music files and M3U playlists offline with ranked search, global media controls, continuous queue and listening history.
- **[Meeting Captions](./meetcaptions/)**: Bookmarklets to record and save Google Meet or Microsoft Teams captions as Markdown, with speaker names, timestamps, and meeting metadata.
- **[AI Conversation Scrapers](./aiscrapers/)**: Copy AI conversations, rich ChatGPT responses, or sidebar chat links as Markdown and JSON with bookmarklets.
- **[WhatsApp Scraper](./whatsappscraper/)**: Scrape WhatsApp chat messages as Markdown or JSON.
- **[Google Bookmarklets](./gmail/)**: Bookmarklets for copying useful data from GMail, Google Calendar, and other Google apps.
- **[Unicoder](./unicoder/)**: Convert Markdown to text to unicode equivalent with formatting.
- **[X Thread Scraper](./xscraper/)**: Bookmarklet to copy a tweet and all its replies as Markdown or JSON (with buzz/keep).
- **[Hacker News Thread Markdown](./hnmd/)**: Bookmarklet to copy a Hacker News thread as nested Markdown bullets.
- **[LinkedIn Scraper Bookmarklets](./linkedinscraper/)**: Collection of LinkedIn bookmarklets that copy structured page data from your browser.
- **[Page to Markdown](./page2md/)**: Bookmarklet to copy a web page or selection as Markdown.
- **[Wallhop](./readability/)**: Bookmarklet to open the current page through Wallhop for one-off paywall-free reads.
- **[Trending Repositories](./trending-repos/)**: Scan weekly trending GitHub repos with status and language filters.
- **[Google Tasks](./googletasks/)**: Download all your Google Tasks as CSV or Markdown and delete completed tasks.
- **[Discourse Thread Scraper](./discoursescraper/)**: Bookmarklet to copy a Discourse topic and replies as Markdown or JSON.
- **[JSON to CSV](./json2csv/)**: Convert arrays of JSON objects to CSV format.
- **[GitHub Stars](./githubstars/)**: Replaces GitHub links in Markdown with the repo name, stars, and last pushed date.
- **[GitHub Summary](./githubsummary/)**: Summarize all activity by a user over a time period.
- **[GitHub Users](./githubusers/)**: Get information about GitHub users.
- **[Technology Radar](./radar/)**: Track technology adoption across four quadrants (Techniques, Tools, Platforms, Frameworks) and four rings (Adopt, Trial, Assess, Hold).
- **[Copy Links](./copylinks/)**: Bookmarklets to copy all page URLs as TSV or copy the current URL with a selected text fragment.
- **[Record](./record/)**: Record audio, camera, or screen and save it locally.
- **[Recall](./recall/)**: Randomly recall list items from Markdown.
- **[Ideator](./ideator/)**: Fuse notes into a ChatGPT ideation prompt.
- **[Ask AI](./askai/)**: Send a question to your preferred AI chat engine in one click.
- **[Podcast Generator](./podcast/)**: Generate podcasts from text using LLMs.
- **[Color Table Builder](./colortable/)**: Paste a delimited table and get a colored HTML table.
- **[Findsongs](./findsongs/)**: Generate playlists from your favourite songs, rate them, and refine picks.
- **[Image Generator](./imagegen/)**: Chat to generate or update images.
- **[Postergen](./postergen/)**: Create posters and social media banners based on templates
- **[Daydream](./daydream/)**: View and sort creative ideas from a JSONL file.
- **[Codex Log Converter](./codexlog/)**: Turn Codex CLI session JSONL logs into Markdown recaps.
- **[PicBook](./picbook/)**: Create a sequence of images from captions.
- **[Bootstrap Theme Picker](./bootstrappicker/)**: Bookmarklet to preview and swap Bootstrap color palettes live on any page.
- **[Scroller Bookmarklet](./scroller/)**: Bookmarklet that adds a compact smooth autoscroller with live speed and direction controls.
- **[Markdown View Popup](./mdview/)**: Bookmarklet to render selected Markdown, or full-page text, in a syntax-highlighted popup.
- **[Straive Intelligence](./straiveintelligence/)**: Bookmarklet to convert ChatGPT into a Straive-style user interface.
- **[Straive Codex](./straivecodex/)**: Bookmarklet to convert Codex into a Straive-style user interface.
- **[Join CSV Tables](./joincsv/)**: Join multiple tables on the first column.
- **[Google Suggest Explorer](./googlesuggest/)**: Explore Google Search suggestions from different countries and get AI-powered humorous explanations.
- **[Unicode Characters](./unicode/)**: Find non-ASCII Unicode characters in the clipboard.
- **[Hacker News Extractor](./hackernewsmd/)**: Extract Hacker News articles to Markdown format for NotebookLM.
- **[Hacker News Links Extractor](./hnlinks/)**: Scrape main article links from Hacker News or HN Top Links.
- **[Google Fit](./googlefit/)**: Upload Google Fit activity data and see a summary of the activity data by date.
- **[JSON Trimmer](./jsontrim/)**: Trim JSON strings to a specified length.
- **[Markdown to CSV](./md2csv/)**: Extract the first Markdown table and download it as CSV. Useful to extract from ChatGPT
- **[Excel Converter](./excelconvert/)**: Convert Excel data to JSONL, YAML, XML, or TOML.
- **[Transcribe Audio](./transcribe/)**: Transcribe audio from the speakers and microphone.
- **[Research Me](./researchme/)**: Launch a public-dossier research prompt in ChatGPT or Claude using your name and role.
- **[SpeakMD](./speakmd/)**: Turn Markdown into conversational text. Useful to read out copied ChatGPT output.
- **[RevealJS Slides](./revealjs/)**: Convert Markdown to RevealJS HTML.
- **[WhatsApp Thread Viewer](./whatsappview/)**: View WhatsApp chat messages in a threaded discussion.
- **[WhatsApp](./whatsapp/)**: Enter a mobile number and open a WhatsApp chat to them.
- **[LiveGrid](./livegrid/)**: Live multi-user prioritization grid synchronized through Cloud Firestore.
- **[What Next?](./whatnext/)**: Prioritization matrix helping you pick what to do next.
- **[What's Near Me?](./whatsnear/)**: Find nearby attractions and places of interest.
- **[SG Bike Park](./sgbikepark/)**: Find out where to park your bicycle nearby in Singapore.
- **[Quotes arena](./quotesarena/)**: Evaluate quotes from different models and see which one wins.
- **[LLM Bounding Boxes](./llmboundingbox/)**: Check how well LLMs draw object bounding boxes in images.
- **[Data Extractor](./dataextractor/)**: Extract chart and table data from images into CSV.
- **[Render Markdown](https://tools.simonwillison.net/render-markdown)**: Render Markdown to HTML using the GitHub Markdown API.
- **[Terminal to HTML](https://tools.simonwillison.net/terminal-to-html)**: Convert terminal session text to HTML with ANSI colors.
- **[YouTube Thumbnails](https://tools.simonwillison.net/youtube-thumbnails)**: Get YouTube video thumbnails.
- **[Voicebot](./voicebot/)**: Talk to GPT Realtime with live audio.

## Local Development

1. Clone the repository: `git clone https://github.com/s-anand/tools.git && cd tools`
2. Serve the directory using any static file server. E.g. `python -m http.server 8000` or `npx serve` or `caddy file-server`
3. Open `http://localhost:[PORT]` in your browser

## Adding New Tools

1. Create a new directory for your tool
2. Add your tool's files (HTML, JS, CSS)
3. Update `tools.json` with your tool's metadata:
   ```js
   {
     "tools": [
       {
         "icon": "bi-[icon-name]",
         "title": "Tool Name",
         "description": "Tool description",
         "url": "/path/to/tool/"
       }
     ]
   }
   ```

## Deployment

The site is automatically deployed to GitHub Pages when changes are pushed to the main branch. The deployment process:

1. Push changes to the main branch
2. GitHub Actions builds and deploys to GitHub Pages
3. The site becomes available at tools.s-anand.net

## Project Structure

- `index.html` - Main landing page
- `tools.js` - Dynamic tool card generator
- `tools.json` - Tool metadata
- `/[tool-name]/` - Individual tool directories, with an `index.html` and ESM `script.js` imported as `<script type="module" src="script.js"></script>`

## License

[MIT](./LICENSE)
