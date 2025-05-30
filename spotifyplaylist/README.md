# M3U to Spotify Playlist Creator

This tool allows users to convert an M3U playlist file into a new public playlist on their Spotify account. It consists of a Python FastAPI backend for interacting with the Spotify API and a simple HTML frontend for file upload and interaction.

## What it does

The application enables users to:
1.  Upload an M3U playlist file.
2.  Authenticate with their Spotify account using OAuth.
3.  Have the tool search for tracks from the M3U file on Spotify.
4.  Create a new public playlist on their Spotify account populated with the found tracks.

## Use Cases

-   **Migrate Local Playlists:** Easily transfer playlists from local music players or systems that use M3U format to Spotify.
-   **Share Playlists:** Convert personal M3U playlists into Spotify playlists that can be shared with others.
-   **Recreate Playlists:** Rebuild playlists on Spotify that might have originated from other services or devices if an M3U export is available.

## How It Works

The tool operates with a client-server architecture:

**Backend (`main.py` - FastAPI & Spotipy):**
1.  **Setup & Dependencies:**
    *   Requires Python 3.13+ and the following libraries: `fastapi`, `spotipy`, `uvicorn`. These can be installed by running `uv run main.py` if `uv` is installed and the script's embedded dependency information is processed, or manually via pip.
2.  **Authentication:**
    *   Uses Spotify's OAuth 2.0 authorization flow to get permission to create and modify public playlists on the user's behalf (`playlist-modify-public` scope).
    *   The `/login` endpoint initiates the Spotify login process by redirecting the user to Spotify's authorization page.
    *   The `/callback` endpoint handles the redirect from Spotify after the user authorizes the application, capturing the authorization code to obtain an access token.
3.  **API Endpoints:**
    *   `/search?q=<query>&n=<limit>&type=<type>`: Searches Spotify for tracks (or other content types). This is used by the frontend to find Spotify track IDs corresponding to entries in the M3U file.
    *   `/playlist` (POST): Receives a playlist name and a list of Spotify track IDs from the frontend. It then:
        *   Creates a new public playlist for the authenticated user.
        *   Adds the provided track IDs to this new playlist.
        *   Handles potential errors, such as a 401 Unauthorized error if the user's Spotify token is invalid, prompting for re-login.
4.  **Serving Frontend:**
    *   The backend also serves the static frontend files (HTML, JavaScript) located in the `public` directory.

**Frontend (`public/index.html` & `public/js/app.js` - JavaScript):**
1.  **User Interface:**
    *   Provides a file input field for users to select an `.m3u` playlist file.
    *   A designated area (`<div id="content">`) is used to display results, progress, or errors.
2.  **Client-Side Logic (handled by `public/js/app.js` - functionality inferred):**
    *   **Authentication Flow:** If the user is not yet authenticated with Spotify (e.g., no valid token), it likely redirects or prompts the user to initiate the login flow via the backend's `/login` endpoint.
    *   **M3U Parsing:** When a user uploads an M3U file, the JavaScript parses this file to extract track information (titles, artists, etc.).
    *   **Track Searching:** For each track parsed from the M3U, the script calls the backend's `/search` API to find matching tracks on Spotify and retrieve their Spotify track IDs.
    *   **Playlist Creation:** After gathering Spotify track IDs, the frontend allows the user to specify a name for the new playlist. It then sends this name and the list of track IDs to the backend's `/playlist` API endpoint.
    *   **Feedback:** Displays success messages (e.g., link to the created playlist) or error messages received from the backend.

**Running the Tool:**
1.  Ensure Python and the required dependencies are installed.
2.  Run the backend server: `python main.py` or `uvicorn main:app --reload` (or `uv run main.py`).
3.  The script will attempt to open `http://localhost:8000` (or the specified port) in your web browser.
4.  The first time, you will likely need to authorize the application with Spotify. Follow the on-screen prompts or check the console output from `main.py` for an authorization URL to paste into your browser if redirection fails.
5.  Once authorized, you can use the file input on the webpage to upload your M3U file and create the Spotify playlist.

This README provides an overview of the tool's functionality, architecture, and usage instructions. For detailed setup of Python dependencies, refer to the `/// script` section within `main.py` or use `pip install fastapi spotipy uvicorn`.
