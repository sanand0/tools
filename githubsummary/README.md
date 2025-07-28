# GitHub User Activity Summarizer

This tool generates a blog-post-style summary of a GitHub user's activity within a specified date range.

To use this tool you'll need an [OpenAI API key](https://platform.openai.com/account/api-keys). The key stays in your browser and is never stored on any server. Check [the code](script.js) to confirm. Straive employees can visit https://llmfoundry.straive.com/code for a token.

## Use Cases

- **Track Contributions:** Quickly understand a developer's work and contributions over a period.
- **Prepare Reports:** Generate summaries for performance reviews, team updates, or project retrospectives.
- **Stay Updated:** Follow the progress of specific users or projects on GitHub.
- **Content Creation:** Create draft blog posts or updates based on recent development activities.

## How It Works

1.  **Input Parameters:**

    - The user enters a GitHub username.
    - The user specifies a start date and an end date for the activity period.
    - The user provides a GitHub API token for accessing the GitHub API.
    - Optionally, the user can provide an OpenAI API base URL, API key, and a custom system prompt if they want to use their own LLM for summarization. Otherwise, a default model and prompt are used.

2.  **Fetch Activity:**

    - The tool fetches public event data for the specified user from the GitHub API (e.g., commits, pull requests, issues, reviews).
    - It also retrieves details for the repositories involved in these activities, such as descriptions, topics, and README content.
    - Fetched data is cached in the browser's IndexedDB to speed up future requests.

3.  **Generate Summary:**

    - The collected activity data and repository context are compiled.
    - This information is then sent to an LLM (Large Language Model).
    - The LLM processes the data based on a system prompt that instructs it to create a concise, engaging weekly roundup blog post. The output includes sections for each repository with summaries of changes and links to commits.

4.  **Display Summary:**
    - The generated summary is streamed to the page and rendered as Markdown.
    - The tool shows progress indicators during data fetching and processing.

All form fields are saved locally so they can be easily reused on subsequent visits.

This tool generates a blog-post-style summary of a GitHub user's activity within a specified date range.

## Use Cases

- **Track Contributions:** Quickly understand a developer's work and contributions over a period.
- **Prepare Reports:** Generate summaries for performance reviews, team updates, or project retrospectives.
- **Stay Updated:** Follow the progress of specific users or projects on GitHub.
- **Content Creation:** Create draft blog posts or updates based on recent development activities.

## How It Works

1.  **Input Parameters:**

    - The user enters a GitHub username.
    - The user specifies a start date and an end date for the activity period.
    - The user provides a GitHub API token for accessing the GitHub API.
    - Optionally, the user can provide an OpenAI API base URL, API key, and a custom system prompt if they want to use their own LLM for summarization. Otherwise, a default model and prompt are used.

2.  **Fetch Activity:**

    - The tool fetches public event data for the specified user from the GitHub API (e.g., commits, pull requests, issues, reviews).
    - It also retrieves details for the repositories involved in these activities, such as descriptions, topics, and README content.
    - Fetched data is cached in the browser's IndexedDB to speed up future requests.

3.  **Generate Summary:**

    - The collected activity data and repository context are compiled.
    - This information is then sent to an LLM (Large Language Model).
    - The LLM processes the data based on a system prompt that instructs it to create a concise, engaging weekly roundup blog post. The output includes sections for each repository with summaries of changes and links to commits.

4.  **Display Summary:**
    - The generated summary is streamed to the page and rendered as Markdown.
    - The tool shows progress indicators during data fetching and processing.

All form fields are saved locally so they can be easily reused on subsequent visits.
