# Hacker News to Markdown Converter

This tool fetches top or best stories from Hacker News, converts their linked content to Markdown, and prepends Hacker News metadata as frontmatter. The primary intended use is for importing into NotebookLM.

## What it does

The tool retrieves a list of either "Top Stories" or "Best Stories" from Hacker News via the official Firebase API. For the first 10 stories in the selected list, it:

1.  Fetches metadata for the Hacker News item (title, URL, submission time).
2.  Accesses the content at the story's URL.
3.  Converts that external content into Markdown format using an external conversion service.
4.  Combines the Hacker News metadata (as YAML frontmatter) with the Markdown content.
5.  Displays the aggregated Markdown text for all processed stories, allowing the user to copy it.

## Use Cases

- **Content Archival for LLMs:** Specifically designed to prepare Hacker News content for import into AI-powered note-taking applications like NotebookLM.
- **Offline Reading:** Save interesting articles and discussions from Hacker News in a clean, readable Markdown format.
- **Content Analysis:** Collect data from Hacker News for text analysis, trend spotting, or research.
- **Personal Knowledge Base:** Integrate Hacker News content into personal knowledge management systems that support Markdown.

## How It Works

1.  **Select Story Type:** The user chooses whether to fetch "Top Stories" or "Best Stories" from a dropdown menu.
2.  **Extract News:** Upon clicking "Extract News":
    - The tool calls the Hacker News Firebase API to get the IDs of the selected stories.
    - It processes the top 10 story IDs. For each ID:
      - It fetches the item details (title, URL, time) from the Hacker News API.
      - It sends the item's URL to an external service (`llmfoundry.straive.com/-/markdown`) to get the Markdown representation of the page content.
    - The tool formats the output with YAML frontmatter containing `time`, `title`, and `url` from Hacker News, followed by the Markdown content of the linked page.
3.  **View and Copy Output:** The Markdown content for all processed stories is displayed in a textarea. The user can then click "Copy Output" to copy the entire text to their clipboard.
    - Progress and any errors encountered during the process are displayed to the user.

**Note:** This tool relies on an external service (`llmfoundry.straive.com`) for the HTML-to-Markdown conversion. Its availability may affect the tool's functionality.
