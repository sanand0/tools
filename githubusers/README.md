# Github User Data Extractor

## Description

The Github User Data Extractor is a web-based tool that allows you to fetch publicly available information for specified GitHub users. You can input multiple GitHub usernames or profile URLs, and the tool will display their data in a structured table. This data can then be easily exported as a CSV file or copied to your clipboard for pasting into spreadsheet applications like Excel.

## Features

*   **Flexible Input:** Accepts GitHub usernames (e.g., `username`, `@username`) or full GitHub profile URLs (e.g., `https://github.com/username`).
*   **Comprehensive Data Display:** Shows key user information including:
    *   Avatar image
    *   Name, bio, company, location
    *   Contact details (email, blog, Twitter username)
    *   Public activity statistics (repositories, gists, followers, following)
    *   Account creation and last update dates
*   **Readable Formatting:**
    *   Dates (like `created_at`, `updated_at`) are displayed in a user-friendly format (e.g., "Wed, May 29, 2024").
    *   Numbers (like repository counts, followers) are formatted with thousands separators for easy reading.
*   **Export Options:**
    *   **Download CSV:** Saves all extracted user data to a `github_users.csv` file.
    *   **Copy to Excel:** Copies the data in a tab-separated format (TSV) suitable for pasting directly into Excel or other spreadsheet software.
*   **GitHub Token Support:** Optionally, you can provide a GitHub Personal Access Token (PAT) to benefit from higher API rate limits, which is useful when fetching data for many users.

## How to Use

1.  **Open the Tool:**
    *   Navigate to the `githubusers` directory.
    *   Open the `index.html` file in your web browser (e.g., Chrome, Firefox, Edge).

2.  **Enter GitHub Usernames or URLs:**
    *   In the "Enter GitHub Usernames or URLs (one per line)" textarea, input the GitHub users you want to fetch data for. You can enter:
        *   Plain usernames (e.g., `octocat`)
        *   Usernames with an "@" prefix (e.g., `@google`)
        *   Full profile URLs (e.g., `https://github.com/microsoft`)
        *   GitHub Pages URLs (e.g., `username.github.io`)
    *   Each input should be on a new line.

3.  **Enter GitHub Token (Optional):**
    *   If you have a GitHub Personal Access Token and wish to use it (for higher API rate limits), paste it into the "Enter GitHub Token" field. Otherwise, leave this field blank.

4.  **Extract Data:**
    *   Click the "Extract User Data" button.
    *   The tool will fetch the data and display it in a table below the form.
    *   A progress bar will show the status if multiple users are being processed.

5.  **Export Data:**
    *   **Download CSV:** Click the "Download CSV" button to save the data as a CSV file.
    *   **Copy to Excel:** Click the "Copy to Excel" button. A confirmation message will appear, and the data will be copied to your clipboard, ready to be pasted into a spreadsheet.

## Displayed Fields

The following fields are fetched, displayed in the table, and included in the exports:

*   `source`: The original input string for the user (e.g., `octocat`, `https://github.com/octocat`).
*   `html_url`: Link to the user's GitHub profile.
*   `avatar_url`: Link to the user's avatar image. (Displayed as an image in the table).
*   `name`: The user's public name.
*   `company`: The user's company.
*   `blog`: Link to the user's blog or website.
*   `location`: The user's public location.
*   `email`: The user's public email address.
*   `hireable`: Indicates if the user is marked as hireable (true/false or empty).
*   `bio`: The user's biography.
*   `twitter_username`: The user's Twitter username (if provided).
*   `public_repos`: Number of public repositories.
*   `public_gists`: Number of public gists.
*   `followers`: Number of followers.
*   `following`: Number of users the user is following.
*   `created_at`: Date the user's account was created.
*   `updated_at`: Date the user's account was last updated.

---
This README provides an overview of the tool, its features, and how to use it. For detailed manual testing steps, please refer to `TESTING_INSTRUCTIONS.md`.
