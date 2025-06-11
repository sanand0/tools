# Manual Testing Instructions for Github User Data Extractor

This document provides step-by-step instructions for manually testing the Github User Data Extractor application.

## I. Prerequisites

- A modern web browser (e.g., Chrome, Firefox, Edge).
- (Optional) A GitHub Personal Access Token (PAT) to test authenticated requests. This allows for a higher API rate limit.
- (Optional) A spreadsheet program (e.g., Microsoft Excel, Google Sheets, LibreOffice Calc) to test the "Copy to Excel" functionality.

## II. Testing Environment Setup

1.  Open the `githubusers/index.html` file in your web browser.
2.  You should see the "Github User Data Extractor" interface with an input field for a GitHub Token and a textarea for GitHub Usernames or URLs.

## III. Test Cases

### A. Input Testing

**Objective:** Verify the application correctly parses and handles various input formats for GitHub users.

**Test Steps:**

1.  **Test Case A1: Single Valid GitHub Username**

    - In the "Enter GitHub Usernames or URLs" textarea, type a single valid GitHub username (e.g., `octocat`).
    - Click "Extract User Data".
    - **Expected Result:** Data for 'octocat' is fetched and displayed in the table. The 'source' column should show 'octocat'.

2.  **Test Case A2: Single Valid GitHub Username with '@' prefix**

    - Clear previous inputs.
    - In the textarea, type a single valid GitHub username with an '@' prefix (e.g., `@google`).
    - Click "Extract User Data".
    - **Expected Result:** Data for 'google' is fetched and displayed. The 'source' column should show '@google'.

3.  **Test Case A3: Single Valid GitHub Profile URL**

    - Clear previous inputs.
    - In the textarea, type a single valid GitHub profile URL (e.g., `https://github.com/microsoft`).
    - Click "Extract User Data".
    - **Expected Result:** Data for 'microsoft' is fetched and displayed. The 'source' column should show `https://github.com/microsoft`.

4.  **Test Case A4: Single Valid GitHub Pages URL**

    - Clear previous inputs.
    - In the textarea, type a single valid GitHub Pages URL (e.g., `facebook.github.io`).
    - Click "Extract User Data".
    - **Expected Result:** Data for 'facebook' is fetched and displayed. The 'source' column should show `facebook.github.io`.

5.  **Test Case A5: Mix of Multiple Valid Inputs**

    - Clear previous inputs.
    - In the textarea, type a mix of valid inputs, each on a new line:
      ```
      octocat
      @google
      https://github.com/microsoft
      facebook.github.io
      ```
    - Click "Extract User Data".
    - **Expected Result:** Data for all four users (octocat, google, microsoft, facebook) is fetched and displayed in the table. The 'source' column should reflect each input line.

6.  **Test Case A6: Invalid Inputs and Blank Lines**

    - Clear previous inputs.
    - In the textarea, type a mix of invalid inputs, blank lines, and valid inputs:

      ```
      octocat

      thisisnotauser123456789
      https://github.com/!@#$%^
      @microsoft
      ```

    - Click "Extract User Data".
    - **Expected Result:**
      - An alert message should appear for "thisisnotauser123456789" (e.g., "Failed to fetch data for thisisnotauser123456789...").
      - An alert message might appear for "https://github.com/!@#$%^" or it might be filtered out by the regex. If filtered, it's ignored. If processed, an error alert is expected.
      - Data for 'octocat' and 'microsoft' should be fetched and displayed correctly.
      - Blank lines should be ignored.

7.  **Test Case A7: With GitHub Token (Optional)**

    - If you have a GitHub PAT, enter it into the "Enter GitHub Token" field.
    - Repeat Test Case A5.
    - **Expected Result:** Data for all users is fetched and displayed. Using a token might prevent API rate limit issues for extensive testing.

8.  **Test Case A8: Without GitHub Token**
    - Ensure the "Enter GitHub Token" field is empty.
    - Repeat Test Case A1.
    - **Expected Result:** Data for 'octocat' is fetched. If you encounter API rate limit errors during extensive testing without a token, this is expected.

### B. Output Table Display Testing

**Objective:** Verify the data table displays the correct information in the correct format.

**Test Steps:**

1.  Perform a successful data extraction (e.g., using Test Case A5).
2.  Examine the displayed table:
    - **B1: Field Order and Presence:**
      - Verify the columns appear in this exact order: `source`, `html_url`, `avatar_url`, `name`, `company`, `blog`, `location`, `email`, `hireable`, `bio`, `twitter_username`, `public_repos`, `public_gists`, `followers`, `following`, `created_at`, `updated_at`.
      - Verify no other columns are present.
    - **B2: Avatar URL (`avatar_url`)**
      - Verify the `avatar_url` column displays an image (the user's avatar). The image should be small (approx 50x50px) and have rounded corners.
    - **B3: Clickable Links (`html_url`, `blog`, `email`, `twitter_username`)**
      - `html_url`: Verify the URL is a clickable link opening the user's GitHub profile in a new tab.
      - `blog`: Verify the URL (if present) is a clickable link opening the user's blog in a new tab. Test with a user who has a blog listed (e.g., `torvalds`). If the blog URL doesn't start with `http://` or `https://`, verify it's prepended with `http://`.
      - `email`: Verify the email address (if present) is a clickable `mailto:` link.
      - `twitter_username`: Verify the Twitter username (if present) is displayed as `@username` and is a clickable link to their Twitter profile (e.g., `https://twitter.com/username`).
    - **B4: Date Formatting (`created_at`, `updated_at`)**
      - Verify dates in these columns are formatted like: "Wed, May 29, 2024" (Day, Month Date, Year).
    - **B5: Number Formatting (`public_repos`, `public_gists`, `followers`, `following`)**
      - Verify numbers in these columns are formatted with commas as thousands separators (e.g., "1,234").
    - **B6: Missing Fields**
      - For users who do not have certain information (e.g., no blog, no email, no bio), verify the corresponding cell in the table is empty.

### C. Button Functionality Testing

**Objective:** Verify the "Download CSV" and "Copy to Excel" buttons work as expected.

**Test Steps:**

1.  Perform a successful data extraction (e.g., using Test Case A5).
2.  **Test Case C1: Download CSV**

    - Click the "Download CSV" button.
    - **Expected Result:** A file named `github_users.csv` is downloaded.
    - Open the downloaded CSV file with a text editor or spreadsheet program.
    - Verify:
      - The first row contains the headers in the correct order (as specified in B1).
      - Subsequent rows contain data for each user.
      - Data matches what was displayed in the HTML table (for fields like name, bio, etc.).
      - `created_at` and `updated_at` fields contain the formatted date strings (e.g., "Wed, May 29, 2024").
      - `public_repos`, `public_gists`, `followers`, `following` fields contain formatted number strings (e.g., "1,234").
      - `html_url`, `avatar_url`, `blog`, `email`, `twitter_username` fields contain the raw URLs or data (e.g., `https://github.com/octocat`, not HTML tags like `<a>` or `<img>`).

3.  **Test Case C2: Copy to Excel**
    - Click the "Copy to Excel" button.
    - An alert should confirm "Results copied to clipboard!".
    - Open a spreadsheet program (Excel, Google Sheets, etc.).
    - Paste the content (Ctrl+V or Cmd+V).
    - **Expected Result:**
      - Data is pasted into the spreadsheet, correctly separated into columns.
      - The first row contains the headers in the correct order (as specified in B1).
      - Data matches what was displayed in the HTML table.
      - `created_at` and `updated_at` fields contain the formatted date strings.
      - `public_repos`, `public_gists`, `followers`, `following` fields contain formatted number strings.
      - `html_url`, `avatar_url`, `blog`, `email`, `twitter_username` fields contain the raw URLs or data.

### D. Alerts and Messages Testing

**Objective:** Verify appropriate feedback messages are shown to the user.

**Test Steps:**

1.  **Test Case D1: No Valid Inputs**

    - Clear the textarea or enter only invalid text (e.g., "this is not a valid user @#$").
    - Click "Extract User Data".
    - **Expected Result:** An alert message like "No valid GitHub URLs found!" is displayed.

2.  **Test Case D2: Fetching Data Progress**

    - Enter a few valid usernames (e.g., `octocat`, `torvalds`, `microsoft`).
    - Click "Extract User Data".
    - **Expected Result:** While data is being fetched, an alert message like "<i class="bi bi-arrow-repeat"></i> Fetching data for 3 users..." is displayed, along with a progress bar.

3.  **Test Case D3: Data Fetched Successfully**

    - After data is successfully fetched (from Test Case D2).
    - **Expected Result:** The progress alert is replaced by a success message like "Data fetched successfully! Click 'Copy to Excel' or 'Download CSV'."

4.  **Test Case D4: User Not Found / API Error**
    - In the textarea, enter a valid username and a non-existent username (e.g., `octocat`, `thisuserdoesnotexist1234567`).
    - Click "Extract User Data".
    - **Expected Result:**
      - Data for `octocat` is displayed.
      - An error alert message is shown for the non-existent user (e.g., "Failed to fetch data for thisuserdoesnotexist1234567: Not Found").

## IV. Reporting Issues

If any of the actual results do not match the expected results, please document the issue with:

- Test Case ID (e.g., A1, B2).
- Steps to reproduce the issue.
- Expected result.
- Actual result.
- Any relevant screenshots.

---

## End of Testing Instructions
