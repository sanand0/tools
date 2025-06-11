# Markdown to Unicode "Fancy Text" Converter

This tool converts standard Markdown syntax into text styled with special Unicode characters. This allows you to create visually distinct text (e.g., bold, italic, monospace) that can be used on platforms that don't support traditional rich text formatting but do render a wide range of Unicode characters.

## What it does

The "Markdown to Unicode Converter" takes Markdown input from the user and applies specific Unicode character substitutions to simulate common formatting styles:

- **Headings & Bold Text:** Converted to **sans-serif bold** Unicode characters (e.g., "Hello World" becomes "𝗛𝗲𝗹𝗹𝗼 𝗪𝗼𝗿𝗹𝗱").
- **Italics & Blockquotes:** Converted to _sans-serif italic_ Unicode characters (e.g., "Hello World" becomes "𝘏𝘦𝘭𝘭𝘰 𝘞𝘰𝘳𝘭𝘥").
- **Code (Fenced & Inline):** Converted to 𝚖𝚘𝚗𝚘𝚜𝚙𝚊𝚌𝚎 Unicode characters (e.g., "Hello World" becomes "𝙷𝚎𝚕𝚕𝚘 𝚆𝚘𝚛𝚕𝚍").
- **Links:** Formatted as `link text (URL)`.
- **Images:** Represented by their alt text.
- **Lists:** List items are prefixed with a '•' character.

The conversion happens in real-time as you type or paste Markdown.

## Use Cases

- **Social Media Posts:** Make your posts stand out on platforms like Twitter, Instagram, Facebook, LinkedIn, etc., where standard Markdown or HTML formatting isn't supported in posts or profiles.
- **Messaging Apps:** Add emphasis or style to messages in apps like WhatsApp, Telegram, Discord, or Slack.
- **Usernames & Profiles:** Create unique-looking usernames or profile descriptions.
- **Plain Text Environments:** Add visual hierarchy or emphasis where only plain text is allowed but Unicode is supported (e.g., some forums, comments sections).

**Note:** While these Unicode characters mimic styling, they are technically different characters. Screen readers or systems with limited Unicode font support may not interpret or display them as intended. Use with consideration for accessibility.

## How It Works

1.  **Input Markdown:**

    - The user types or pastes their Markdown content into the left-hand textarea.
    - An example Markdown text is provided on page load to demonstrate functionality.

2.  **Live Conversion:**

    - As the user types, the input Markdown is parsed using the `marked` JavaScript library.
    - A custom renderer intercepts standard Markdown elements (headings, bold, italic, code, etc.).
    - Instead of outputting HTML, the renderer substitutes the text content of these elements with corresponding styled Unicode characters from the Mathematical Alphanumeric Symbols block and other Unicode ranges.
    - The resulting Unicode-styled text is immediately displayed in the right-hand output panel.

3.  **Copy Output:**

    - The user can click the "Copy" button to copy the generated Unicode-styled text to their clipboard.
    - A confirmation message ("Copied!") appears briefly on the button.

4.  **Error Handling:**
    - If issues occur (e.g., trying to copy empty text), an error message is displayed.

The tool is built with HTML, Bootstrap for styling, and client-side JavaScript, primarily using the `marked` library for Markdown parsing and custom functions for Unicode character mapping. All processing happens directly in the browser.

### Comparison with "Unicode Character Viewer"

This tool (`unicoder`) is distinct from the "Unicode Character Viewer":

- **`unicoder` (this tool):** _Generates_ text styled with specific Unicode characters based on Markdown input to create "fancy text."
- **`Unicode Character Viewer`:** _Identifies and displays existing_ non-ASCII Unicode characters from arbitrary text input, showing their code points.
