# Tools

A collection of single page web apps, mostly LLM generated. Hosted at [tools.s-anand.net](./https://tools.s-anand.net).

## Tools

## Available Tools

- **[Unicoder](./unicoder/)**: Converts standard Markdown syntax into text styled with special Unicode characters to create "fancy text" for platforms without rich text support.
- **[Recall](./recall/)**: Randomly recall list items from Markdown.
- **[Ideator](./ideator/)**: Fuse notes into a ChatGPT ideation prompt.
- **[Podcast](./podcast/)**: Automates the creation of a two-person podcast episode, from script generation to audio synthesis, using Large Language Models (LLMs).
- **[Image Generator](./imagegen/)**: Chat to generate or update images.
- **[Postergen](./postergen/)**: Create posters and social media banners based on templates
- **[Daydream](./daydream/)**: Browse and rate creative ideas stored as JSONL.
- **[JSON to CSV](./json2csv/)**: Converts JSON data into Comma Separated Values (CSV) format and can also prepare data for pasting into spreadsheet applications by converting to Tab Separated Values (TSV).
- **[PicBook](./picbook/)**: Generate a sequence of images from multiline captions.
- **[Page to MD](./page2md/)**: A browser bookmarklet that converts the content of the current web page, or a user's selection on that page, into Markdown format, copying it to the clipboard.
- **[GitHub Stars](./githubstars/)**: Updates GitHub repository links in Markdown text, replacing link text with the repository's name, star count, and last pushed date.
- **[Google Tasks](./googletasks/)**: Download all your Google Tasks as CSV or Markdown and delete completed tasks
- **[WhatsApp Scraper](./whatsappscraper/)**: A browser bookmarklet that allows users to scrape messages from an active WhatsApp Web chat session into JSON format.
- **[Discourse Thread Scraper](./discoursescraper/)**: Bookmarklet that copies every post in a Discourse topic into structured JSON with replies, reactions, and metadata.
- **[X Thread Scraper](./xscraper/)**: Bookmarklet to copy a tweet and all its replies into JSON (ads dropped), including metrics and computed buzz/keep scores.
- **[Straive Intelligence](./straiveintelligence/)**: Bookmarklet to convert ChatGPT into a Straive-style user interface
- **[GitHub Summary](./githubsummary/)**: Generates a blog-post-style summary of a GitHub user's activity within a specified date range.
- **[Join CSV Tables](./joincsv/)**: Join multiple tables on the first column.
- **[Google Suggest Explorer](./googlesuggest/)**: Explore Google Search suggestions from different countries and get AI-powered humorous explanations.
- **[GitHub Users](./githubusers/)**: A web-based tool that allows you to fetch publicly available information for specified GitHub users.
- **[Unicode](./unicode/)**: Helps users identify, view, and copy non-ASCII Unicode characters present in a given text, showing their hexadecimal and decimal code points.
- **[Hacker News MD](./hackernewsmd/)**: Fetches top or best stories from Hacker News, converts their linked content to Markdown, and prepends Hacker News metadata as frontmatter.
- **[Hacker News Links Extractor](./hnlinks/)**: Scrape main article links from Hacker News or HN Top Links.
- **[Google Fit](./googlefit/)**: Allows you to view and summarize your Google Fit activity data obtained from Google Takeout.
- **[JSON Trim](./jsontrim/)**: Recursively traverses a JSON object or array and truncates string values that exceed a user-specified maximum length.
- **[MD to CSV](./md2csv/)**: Extract the first Markdown table and download it as CSV. Useful to extract from ChatGPT.
- **[Excel Converter](./excelconvert/)**: Convert Excel data to JSONL, YAML, XML, or TOML.
- **[Transcribe](./transcribe/)**: Provides real-time speech-to-text transcription using the browser's built-in SpeechRecognition API, capturing audio from the microphone.
- **[SpeakMD](./speakmd/)**: Converts Markdown into conversational text suitable for audio narration. Useful to read out copied ChatGPT output.
- **[RevealJS](./revealjs/)**: Provides a simple web interface to convert Markdown text into a Reveal.js HTML slideshow.
- **[WhatsApp View](./whatsappview/)**: Renders a JSON array of WhatsApp messages (typically from `whatsappscraper`) into a readable, threaded discussion format.
- **[WhatsApp](./whatsapp/)**: Generates a direct WhatsApp API link (`wa.me`) to start a chat with a given phone number without needing to save it to contacts.
- **[What Next](./whatnext/)**: A flexible, offline-first single-page application for visual prioritization on a customizable grid (e.g., Eisenhower Matrix).
- **[Whats Near](./whatsnear/)**: Helps users discover nearby tourist attractions using geolocation, displaying them on a map with AI-generated descriptions and text-to-speech.
- **[SG Bike Park](./sgbikepark/)**: Displays bicycle parking locations in Singapore on an interactive map, helping users find nearby bike parking facilities.
- **[Quotes Arena](./quotesarena/)**: A web application that allows users to compare short, AI-generated quotes side-by-side and vote for their preferred one, tracking AI model performance.
- **[LLM BoundingBox](./llmboundingbox/)**: Uploads an image and uses various Large Language Models (LLMs) via the LLM Foundry service to perform object detection, displaying results with bounding boxes and labels.

Tools from others:

- **[Render Markdown](https://tools.simonwillison.net/render-markdown)**: Render Markdown to HTML using the GitHub Markdown API.
- **[Terminal to HTML](https://tools.simonwillison.net/terminal-to-html)**: Convert terminal session text to HTML with ANSI colors.
- **[YouTube Thumbnails](https://tools.simonwillison.net/youtube-thumbnails)**: Get YouTube video thumbnails.

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
