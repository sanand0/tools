# Findsongs

Build AI-powered playlists from a short description, rate the results, and refine the mix while keeping your favourites.

## What it does

1. **Capture Preferences** – Describe a vibe or list a few songs, pick an OpenAI model, and generate suggestions.
2. **Review & Rate** – Click a track to open it on YouTube, or rate it thumbs up/down to keep or swap it later.
3. **Refine & Share** – Regenerate around your feedback without losing liked songs, then copy the playlist to share elsewhere.

## How it works

1. Configure an API key with the Bootstrap LLM provider dialog.
2. Send the prompt and optional ratings to OpenRouter-compatible chat completions using streaming responses.
3. Parse the structured `{ "songs": [] }` JSON reply, deduplicate, and merge it with rated picks.
4. Render the playlist with lit-html, wiring buttons for ratings, copying, and YouTube searches.
