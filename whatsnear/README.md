# Nearby Attractions Explorer

This web application helps users discover nearby tourist attractions based on their current geolocation. It displays these attractions on a map, provides AI-generated descriptions for them, and offers a text-to-speech feature to read these descriptions aloud.

## What it does

The "Nearby Attractions Explorer" leverages browser geolocation, the Overpass API (for fetching points of interest), and an AI model (GPT-4o Mini via LLM Foundry) to provide a rich experience for discovering local attractions.

Key Features:

- **Geolocation:** Automatically detects the user's current location using the browser's geolocation service.
- **Interactive Map:** Displays an OpenStreetMap using Leaflet.js, showing the user's position and markers for nearby attractions.
- **Attraction Discovery:**
  - Queries the Overpass API (proxied via LLM Foundry) to find up to 5 tourist attractions (`tourism="attraction"`) within a 1km radius of the user.
- **AI-Generated Descriptions:**
  - For each discovered attraction, it uses an AI model (GPT-4o Mini via LLM Foundry) to generate a concise (~50 words) description based on its name and coordinates.
- **Information Display:** Attractions are listed as cards below the map, showing their names and the AI-generated descriptions (which can include Markdown formatting).
- **Text-to-Speech:** Each attraction card includes "Read Aloud," "Pause/Resume," and "Stop" buttons to narrate the description using the browser's built-in SpeechSynthesis API.
- **Dynamic Updates:** Users can refresh the list of attractions. The map also updates if the user's location changes.

**Note:** This tool requires access to the user's location and relies on external services (Overpass API and OpenAI) via `llmfoundry.straive.com`, which may require prior authentication with the LLM Foundry service.

## Use Cases

- **Tourists & Travelers:** Quickly find interesting sights and attractions in their immediate vicinity.
- **Local Exploration:** Discover new or lesser-known points of interest in one's own city.
- **On-the-Go Information:** Get brief, audible descriptions of nearby attractions without needing to read extensively.
- **Accessibility:** The text-to-speech feature can assist users who prefer auditory information.

## How It Works

1.  **Initialization & Geolocation:**

    - On page load, the application initializes a Leaflet map.
    - It requests permission to access the user's geolocation. If granted, it updates the map to the user's current position and places a marker.
    - It also sets up `watchPosition` to track location changes.
    - If geolocation fails or is denied, an error message is shown.

2.  **Fetching Nearby Attractions:**

    - Triggered by initial location detection or by clicking the "Refresh" button.
    - A query is constructed for the Overpass API to find entities tagged as `tourism="attraction"` within a 1km radius of the current coordinates (`currentPosition.coords`).
    - The request is sent to the Overpass API via an `llmfoundry.straive.com` proxy.
    - The top 5 results are processed.

3.  **Generating Descriptions & Displaying Attractions:**

    - For each of the (up to) 5 attractions retrieved:
      - A prompt is sent to an OpenAI GPT-4o Mini model (via LLM Foundry) to generate a short description of the attraction.
      - The attraction's name and its AI-generated description are displayed in a card format. The description is parsed as Markdown.
      - A marker for the attraction is added to the Leaflet map, with a popup showing its name.
      - "Read Aloud," "Pause," and "Stop" buttons are added to each card for text-to-speech functionality.

4.  **Text-to-Speech:**

    - When "Read Aloud" is clicked, the browser's `SpeechSynthesis` API is used to speak the AI-generated description for that attraction.
    - "Pause/Resume" and "Stop" buttons control the speech synthesis playback.

5.  **Map Interaction:**
    - The user's location marker updates if their position changes.
    - The map view also updates to the new location.
    - If the user manually pans/zooms the map, `currentPosition` (used for fetching attractions) is updated to the map's new center, and a manual refresh can fetch attractions for this new area.

The application uses Bootstrap for styling, Leaflet.js for map rendering, Marked for Markdown parsing, and relies on browser APIs for geolocation and speech synthesis. All external data fetching (Overpass API, OpenAI) is routed through `llmfoundry.straive.com`. Error messages are displayed using toast notifications.
