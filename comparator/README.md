# Comparator

This tool compares tab-delimited input and output data. For each row it fetches the referenced web page, converts it to Markdown, and asks an LLM to verify the information.

## Features

- Paste tab-separated tables from Excel
- Fetch `FacultySource` URLs via a proxy and convert to Markdown
- Send the data and Markdown to an LLM for evaluation
- Show a color-coded table comparing LLM results with a baseline comparison
- Click any cell for detailed differences
