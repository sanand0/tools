# Prompts

## Initial version

Create a tool colortable/ that can convert pasted tables into colored HTML tables.
Allow the user to paste a CSV or tab-delimited or pipe-delimited table.
Give them an option to select the delimiter among tab, comma, pipe, and any other common options (e.g. semicolon) as a data list they can pick from, and allowing them to type in their own delimiter as well.
Using d3, parse this, treating the first row as the header.
Make sure the values are trimmed of leading and trailing whitespace.
The columns may contain numerical or non-numerical values. Treat percentages as numerical values internally (i.e., "45%" should be treated as 0.45 for the purpose of scaling colors) but display them as provided in the final table.
Create an HTML table that has minimal styling.
Ensure the scope attribute is specified for the header th elements (and the first column th cells, if they are in fact headers - auto-detect this).
The table should have no styles other than right-aligning numerical values and left-aligning text values, and the coloring specified below.
Fill the colors by default using a red-yellow-green d3 gradient scaled from the lowest to the highest values.
If the user wants to, they can select a different standard d3 gradient from the drop-down, which gets re-rendered immediately.
In the drop-down, make sure that you have a visual indicator of what the colors in the gradient look like.
Allow the user to pick their own custom colors instead of the standard gradients by specifying two colors (for low and high) using color pickers, which immediately updates the rendering.
Allow the user to pick their own custom range values for the numbers (defaulting to the min, max) and immediately update these in the cells.
Make sure that the cell foreground always contrasts with the background by specifying either a foreground of white or black, whichever contrasts most with the background color.
Add a button to copy just the HTML to the clipboard.

Use all common utilities and style this similar to the other applications.

Add unit tests, run them, and ensure they pass.

Commit as you go.

## Reformat

Format the HTML with 2-space indentation before copying. Run and test. Commit as you go.

## Documentation

Add a colortable/README.md documenting the tool. In tools.json movie before Findsongs.

Commit as you go. I added a colortable/prompts.md file. Commit that as well.
