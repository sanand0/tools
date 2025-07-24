# AI Image Chat

Interactively generate and modify images using OpenAI's `gpt-image-1` model. Upload or search for a starting picture, describe the changes you want, and keep chatting to refine the result.

## What it does

1. **Image Selection**
   - Upload your own image or search the web (via Google Custom Search) and pick a result.
2. **Prompt-Based Editing**
   - Describe how you want the image updated. If no image is chosen, a brand new one is generated.
3. **Iterative Chat**
   - Each generated image becomes the new base so you can keep refining it in subsequent prompts.

## How it works

1. Configure your OpenAI key and select an allowed base URL from LLM Foundry.
2. Search or upload an image and type a prompt describing your desired output.
3. The tool calls `gpt-image-1` to generate an updated image and displays it in the chat.
4. Continue chatting with new prompts to iteratively improve the image.

Use dummy values for the Google Custom Search API key and search engine ID; replace them with real values to enable image search.
