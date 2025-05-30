# AI-Powered Podcast Generator

This tool automates the creation of a two-person podcast episode, from script generation to audio synthesis, using Large Language Models (LLMs).

## What it does

The AI Podcast Generator takes user-provided text as a starting point and transforms it into a fully scripted and audible podcast conversation. Key features include:

1.  **AI Script Generation:**
    *   Utilizes an LLM (e.g., GPT-4 models) to convert input text into an engaging, conversational script between two AI personalities.
    *   Users can customize the system prompt that guides the LLM in script creation.
    *   The names, voice characteristics (e.g., energetic, warm), and specific speaking instructions for each of the two AI voices are configurable.

2.  **Editable Script:**
    *   The generated script is displayed in a text area, allowing users to review and make manual edits or refinements.

3.  **AI Audio Synthesis:**
    *   Employs OpenAI's Text-to-Speech (TTS) technology to convert each line of the edited script into audio.
    *   Supports various voices (e.g., ash, nova, alloy) and applies specific instructions for tone and delivery for each speaker.
    *   Generates audio in Opus format, which is then concatenated.

4.  **Playback and Download:**
    *   An integrated HTML5 audio player allows users to listen to the complete generated podcast.
    *   A download button enables saving the final audio as an `.ogg` file.

## Use Cases

-   **Content Creators:** Quickly generate draft podcast episodes from articles, blog posts, or notes, saving significant time in scriptwriting and initial voiceover.
-   **Prototyping & Experimentation:** Experiment with different AI voices, script styles, and content formats for podcasts.
-   **Accessibility:** Convert written content into an audio format for broader accessibility.
-   **Educational Purposes:** Create engaging audio dialogues from educational materials.
-   **Personal Projects:** Individuals can bring their written ideas to life in an audio format without needing recording equipment or voice talent.

## How It Works

1.  **Input Text:** The user pastes the source text they want to base the podcast on into the designated area.
2.  **Configure Settings (Optional):**
    *   Under "Advanced Settings," the user can:
        *   Modify the system prompt used for script generation by the LLM.
        *   Customize Voice 1 and Voice 2:
            *   **Name:** (e.g., Alex, Maya)
            *   **Voice Model:** Select from available OpenAI TTS voices (ash, nova, alloy, echo, fable, onyx, shimmer).
            *   **Instructions:** Provide specific directions for the voice's tone, style, and delivery.
        *   Enter their OpenAI API key (this is stored in `localStorage` and is required for LLM and TTS calls).
3.  **Generate Script:**
    *   The user clicks "Generate Script."
    *   The tool sends the input text and the (customized or default) system prompt to an LLM (e.g., `gpt-4.1-nano`).
    *   The LLM streams the generated script back, which appears in real-time in an editable textarea.
4.  **Edit Script (Optional):** The user can modify the generated script directly in the textarea.
5.  **Generate Audio:**
    *   The user clicks "Generate Audio."
    *   The script is processed line by line:
        *   The speaker for each line is identified (e.g., "Alex:", "Maya:").
        *   For each line, a request is made to the OpenAI TTS API (`gpt-4o-mini-tts` model) with the text, chosen voice model, and specific instructions for that speaker. Audio is returned in Opus format.
    *   Progress is displayed as each line's audio is fetched.
    *   The individual Opus audio segments are collected and combined into a single audio blob.
6.  **Playback and Download:**
    *   The combined audio is made available for playback via an `<audio>` HTML element.
    *   The user can click "Download Audio" to save the podcast as an `.ogg` file.

Error messages are displayed as Bootstrap alerts if issues occur during API calls. The tool relies on the `asyncLLM` library for streaming LLM responses.
