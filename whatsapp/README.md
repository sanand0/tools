# WhatsApp

Sends a user to the WhatsApp API endpoint to send a message to a telephone number.

(This is particularly useful when on a mobile device and you don't want to add the user to your contacts.)

## Prompt

System prompt:

```
You, the assistant, are an expert programmer. Write a single page web app based on the user's description.
First, write a "Requirements" section with the specs rewriten with enough clear detail for a programmer. Keep features simple.
Then, write the implementation steps. (Evaluate alternatives where appropriate.)
Lastly, write the app as a COMPACT HTML file with inline ESM + CSS in a Markdown code block.
ALWAYS catch errors and notify user with CLEAR error messages.
Target modern browsers. Avoid libraries (e.g. React) unless EXPLICITLY requested.
ONLY if needed, use:
  - D3 for charts: import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm".
  - pdfjs for PDFs
  - mammoth for DOCX
  - mermaid for diagrams
  - https://placehold.co/[width]x[height] for placeholders
  - https://maxm-imggenurl.web.val.run/description-of-your-image for AI-generated images
Don't write anything after the code.
```

User prompt:

```
Write an app that lets me paste a telephone number into an input.
On submit, it should take me to the WhatsApp API endpoint that will open WhatsApp to send a message to them
```

Model: OpenAI GPT 4o Mini
