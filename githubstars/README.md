# GitHub Stars Link Updater

This tool updates GitHub repository links in Markdown text. It replaces the link text with the repository's name, star count, and the last pushed date.

## Use Cases

- **Assessing Repository Activity:** Quickly gauge the popularity and maintenance status of repositories listed in a document.
- **Enhancing Documentation:** Provide readers with up-to-date context about referenced GitHub projects directly within Markdown files.
- **Curating Resource Lists:** Maintain lists of software or libraries with clear indicators of their community traction and development freshness.

## How It Works

1.  **Paste Markdown:** The user pastes Markdown text containing GitHub repository links into a text area.
2.  **API Token (Optional):** The user can optionally provide a GitHub API token to increase rate limits for accessing GitHub's API.
3.  **Analyze and Replace:** Upon clicking "Analyze", the tool fetches repository details (name, stars, last pushed date) for each GitHub link.
4.  **View Updated Markdown:** The original Markdown is then displayed with the link texts updated to the format: `repository-name star-count ⭐ last-pushed-month 'YY`. For example, a link to `https://github.com/simonw/llm-cmd` might be transformed to show `llm-cmd 382 ⭐ Sep 2024`.
