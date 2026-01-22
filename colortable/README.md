# Color Table Builder

Paste a delimited table and get a minimal HTML table with value-based cell colors.

## What it does

- Accepts CSV, tab-delimited, pipe-delimited, semicolon, or custom delimiters
- Uses the first row as the header and trims whitespace
- Treats percentages as numeric values for scaling while displaying the original text
- Colors numeric cells using a selectable d3 gradient or custom colors
- Lets you override the numeric range used for scaling
- Copies formatted HTML (2-space indentation) to the clipboard

## How it works

1. Parse rows with d3-dsv using the selected delimiter
2. Detect numeric values (including percentages) and optional row headers
3. Build a minimal HTML table with alignment, scope attributes, and background colors
4. Choose black or white text for readable contrast on colored cells
5. Serialize the table to formatted HTML for clipboard export

## Notes

- Non-numeric cells keep a plain background and left alignment
- Numeric cells align right and are colored when a numeric range exists
