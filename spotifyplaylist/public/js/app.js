import { render, html } from "https://cdn.jsdelivr.net/npm/lit-html@3/+esm";

const parseM3u = (content) =>
  content
    .split("\n")
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const [album, title] = line.split(".").slice(0, -1);
      return { album, title, results: [], isLoading: false, selectedId: null };
    });

const searchTrack = async (track, index, tracks) => {
  tracks[index].isLoading = true;
  tracks[index].error = null;
  renderTracks(tracks);

  try {
    const query = `${track.album} ${track.title}`;
    const response = await fetch(`/search?q=${encodeURIComponent(query)}&n=5`);
    const data = await response.json();

    tracks[index].results = data.tracks.items;
    tracks[index].selectedId = data.tracks.items[0]?.id;
  } catch (error) {
    console.error("Search failed:", error);
    tracks[index].error = "Search failed";
  } finally {
    tracks[index].isLoading = false;
    renderTracks(tracks);
  }
};

const trackTemplate = (track, index) => html`
  <tr>
    <td>
      <div class="input-group mb-2">
        <input
          type="text"
          class="form-control"
          value="${track.album} - ${track.title}"
          @change=${(e) => updateTrackText(index, e.target.value)}
        />
        <button class="btn btn-outline-secondary" @click=${() => retrySearch(index)}>
          <i class="bi bi-search"></i>
        </button>
      </div>
    </td>
    <td>
      ${track.isLoading
        ? html`
            <div class="spinner-border spinner-border-sm" role="status">
              <span class="visually-hidden">Loading...</span>
            </div>
          `
        : track.error
        ? html` <div class="text-danger">${track.error}</div> `
        : track.results.length
        ? html`
            <div class="list-group">
              <label class="list-group-item">
                <input
                  type="radio"
                  name="track${index}"
                  value="skip"
                  ?checked=${track.selectedId === "skip"}
                  @change=${(e) => updateSelection(index, "skip")}
                  class="form-check-input me-2"
                />
                Skip this track
              </label>
              ${track.results.map(
                (result) => html`
                  <label class="list-group-item">
                    <input
                      type="radio"
                      name="track${index}"
                      value="${result.id}"
                      ?checked=${result.id === track.selectedId}
                      @change=${(e) => updateSelection(index, e.target.value)}
                      class="form-check-input me-2"
                    />
                    <a href="${result.external_urls.spotify}" target="_blank"><i class="bi bi-spotify"></i></a>
                    ${result.album.name} (${result.album.release_date.slice(0, 4)}) - ${result.name} -
                    ${result.artists.map((d) => d.name).join(", ")}
                  </label>
                `
              )}
            </div>
          `
        : ""}
    </td>
  </tr>
`;

const tracksTemplate = (tracks, fileName) => html`
  <table class="table">
    <thead>
      <tr>
        <th>Original Track</th>
        <th>Spotify Matches</th>
      </tr>
    </thead>
    <tbody>
      ${tracks.map((track, i) => trackTemplate(track, i))}
    </tbody>
  </table>

  ${tracks.length
    ? html`
        <div class="mb-3">
          <input
            type="text"
            class="form-control"
            id="playlistName"
            value="${fileName?.replace(".m3u", "") || "My Playlist"}"
          />
        </div>
        <button class="btn btn-primary" @click=${() => createPlaylist(tracks)}>Create Playlist</button>
      `
    : ""}
`;

let globalTracks = [];
let fileName = "";

const renderTracks = (tracks) => {
  render(tracksTemplate(tracks, fileName), document.getElementById("content"));
};

const updateSelection = (index, id) => {
  globalTracks[index].selectedId = id;
  renderTracks(globalTracks);
};

const createPlaylist = async (tracks) => {
  const trackIds = tracks.map((t) => t.selectedId).filter((id) => id && id !== "skip");

  const playlistName = document.getElementById("playlistName").value;

  try {
    const response = await fetch("/playlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: playlistName,
        tracks: trackIds,
      }),
    });

    if (!response.ok) throw new Error("Failed to create playlist");

    alert("Playlist created successfully!");
  } catch (error) {
    console.error("Playlist creation failed:", error);
    alert("Failed to create playlist: " + error.message);
  }
};

// File input handler
document.getElementById("fileInput").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  fileName = file.name;
  const content = await file.text();
  globalTracks = parseM3u(content);
  renderTracks(globalTracks);

  // Search for each track
  globalTracks.forEach((track, index) => searchTrack(track, index, globalTracks));
});

const updateTrackText = (index, newText) => {
  const [album, ...titleParts] = newText.split(" - ");
  const title = titleParts.join(" - ").trim();
  globalTracks[index].album = album.trim();
  globalTracks[index].title = title;
  renderTracks(globalTracks);
};

const retrySearch = (index) => {
  searchTrack(globalTracks[index], index, globalTracks);
};
