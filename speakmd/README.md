# SpeakMD

SpeakMD converts Markdown into a conversational script that is easy to narrate aloud. It streams the conversion through a Large Language Model so you can watch the text appear in real time.

To use this tool you'll need an [OpenAI API key](https://platform.openai.com/account/api-keys). The key stays in your browser and is never stored on any server. Check [the code](script.js) to confirm. Straive employees can visit [LLM Foundry](https://llmfoundry.straive.com/code) for a token.
## What it does

1. **Paste Markdown:** Provide any Markdown text in the input box.
2. **Choose an LLM:** Pick from several models and supply your OpenAI API key and base URL.
3. **Convert:** The app sends your Markdown to the chosen model with instructions to keep the content faithful while removing citations, replacing links with their text, describing images using alt text, and reading tables in a friendly format.
4. **Streamed Output:** The result is displayed as it is generated. You can copy it or have it read aloud using your browser's speech synthesis.

## Use Cases

- Turning written notes or documentation into an audio script for podcasts or accessibility.
- Quickly hearing how a document might sound when spoken.
- Creating friendly summaries of structured text.

## How It Works

The page is a small HTML application that calls the OpenAI API (or compatible services) using the `asyncLLM` library to stream responses. A system prompt guides the model to produce conversational text and handle tables, links and images appropriately. The returned Markdown is rendered with `marked` and optionally read aloud with the Web Speech API.
