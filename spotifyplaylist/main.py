# Helper script to create a playlist on Spotify from a .m3u playlist
# Usage: uv run main.py
# Authorize on Spotify. Paste the return URL in the console. Visit localhost:[port]

# /// script
# requires-python = ">=3.13"
# dependencies = [
#     "fastapi",
#     "spotipy",
#     "uvicorn",
# ]
# ///
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from spotipy.oauth2 import SpotifyOAuth
import spotipy
from fastapi.responses import RedirectResponse

auth_manager = SpotifyOAuth(
    scope="playlist-modify-public",
    redirect_uri="http://localhost:8000/callback",
    open_browser=False,
)
sp = spotipy.Spotify(auth_manager=auth_manager)
user_id = sp.current_user()["id"]

app = FastAPI(title="Spotify Playlist Generator")

@app.get("/search")
async def search_tracks(q: str, n: int = 10, type: str = "track") -> dict:
    return sp.search(q=q, limit=n, type=type)

@app.get("/login")
async def login() -> RedirectResponse:
    """Redirect user to Spotify login."""
    auth_url = auth_manager.get_authorize_url()
    return RedirectResponse(url=auth_url)

@app.get("/callback")
async def callback(code: str) -> RedirectResponse:
    """Handle Spotify OAuth callback."""
    auth_manager.get_access_token(code)
    return RedirectResponse(url="/")

@app.post("/playlist")
async def create_playlist(data: dict) -> dict:
    """Create a new playlist with the given tracks."""
    try:
        playlist = sp.user_playlist_create(user_id, data["name"], public=True)
        sp.playlist_add_items(playlist["id"], data["tracks"])
        return playlist
    except spotipy.exceptions.SpotifyException as e:
        if e.http_status == 401:
            return {"error": "Please login first", "login_url": "/login"}
        raise

app.mount("/", StaticFiles(directory="public", html=True), name="static")


if __name__ == "__main__":
    from argparse import ArgumentParser
    import uvicorn
    import webbrowser

    parser = ArgumentParser()
    parser.add_argument("-p", "--port", type=int, default=8000)
    port = parser.parse_args().port

    url = f"http://localhost:{port}"
    print(f"\nStarting server at {url}")
    webbrowser.open(url)
    uvicorn.run(app, host="0.0.0.0", port=port)
