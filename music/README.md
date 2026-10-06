# Music

Play your local music files and M3U playlists offline with ranked search, global media controls, continuous queue and listening history.

Static desktop music player for current Edge/Chrome. Choose your Music folder using a real click. The only IndexedDB entry is its directory handle; preferences use localStorage. Audio is never uploaded. No tag parser, metadata database, framework or build step.

The app includes an offline shell on HTTPS or localhost. Visit it online before travel, choose your Music folder, and wait for “Ready for offline listening”; the page, player code, shared parsing modules, manifest, icon and CDN dependencies are then available after switching to flight mode. Keep the music files downloaded on the device and open the same URL in the same browser profile; the saved folder handle may need Reconnect permission after a browser restart, which works offline. Clearing browser site data removes the cached player. Installation is optional. Changes to player code or assets are checked on opening, reconnecting and returning to the page after five minutes. A quiet update notice offers Refresh or Later; playback continues until you choose Refresh. Failed setup or checks offer Retry and preserve the existing cached player.

- Recursively reads audio files, joins optional root `musicdump.csv` by filename/path, and reads M3Us anywhere in the folder. Duplicate basenames are never guessed. Info includes all CSV fields and browser File facts.
- Search ANDs forgiving words across all metadata and paths, with initials and one-edit typo tolerance. Complete field matches rank first (case-sensitive before case-insensitive), then whole words, substrings and typos; `Ko` prefers the album `Ko`. Try `rahman 199 spb`. Click headings to sort. M3Us are listed newest-modified first. A selected M3U keeps file order until you sort or shuffle. Duration appears before Track.
- `/` focuses search and selects the text; Escape or the clear button clears it; P focuses and opens the playlist selector; ? opens Help; searching selects the first result; Enter in search focuses that row, then arrows select and focus results; Enter or a double-click anywhere on a library row plays now, inserting a new occurrence immediately after the current Queue item. Ctrl+Enter queues; Shift+Enter inserts next. Library right-click lists Filter first, then Play now, Play next, Play at end, Play 10 similar next and Info. Drag Queue rows to reorder without a handle; right-click for Play now, Locate in playlist, Play 10 similar next, remove, up/down, top/bottom and Remove all above/below. Locate clears search, selects and scrolls to the song, keeping the current playlist when it contains the song and switching to All tracks otherwise. It reveals tracks beyond the initial 200 rows. Playing a Queue item selects that occurrence without removing it. Played songs remain visible and the current occurrence is highlighted, even for duplicate paths. Removing the current item or clearing the Queue stops playback.
- Play Any appends ten random songs from the selected playlist/search and starts at the first newly appended item. It samples without replacement when there are at least ten results; smaller results repeat to fill ten. Shuffle queue rearranges only items after the current occurrence. The script action `shuffle-visible` still replaces the Queue with all shuffled visible results. Previous restarts after three seconds or goes back through actual starts. Repeat all cycles the full Queue; playing an M3U replaces the Queue in file order unless shuffle is requested.
- The full Queue persists to root `queue.tsv`: standard quoted TSV, header `path\tstatus`, one folder-relative path and `played`, `current` or `next` per row. Order and duplicates are preserved; reload restores paused and does not log a start. Changes use serialized replacement writes, separate from the append-only history. Refresh rereads external queue edits; missing paths are reported and ignored. Malformed files are preserved until an explicit Queue mutation replaces them. Files launched outside the Music folder stay in the current session; saving them across sessions would require storing additional file handles, which this player avoids. Write failures are visible and do not stop playback.
- M toggles mute while preserving the level; + (or =) increases volume 5 percentage points, − decreases it. Volume defaults to 100% for new users, preserves existing saved preferences, and uses a mild power curve (`audio.volume = value ** 1.2`: 90% becomes about 88%, 50% about 44%). Native audio caps at 100%; amplification would require extra audio processing. Native audio controls stay synchronized. Help lists all shortcuts; relevant controls show them in tooltips. The native audio seek control spans the full player width, and library controls share a compact header.
- Now Playing gives album/year a separate prominent line and includes the composer with the artist. Alerts use a full-width row with a dismiss button.
- Resume points are session-only memory, saved at pauses, seeks and track changes after actual playback. Replaying resumes where you stopped; points expire after 24 hours or within 15 seconds of completion. Previous’s restart and repeat-one start at zero. No resume timestamps or positions are written to disk.
- Play 10 similar next ports the [existing play-music algorithm](https://github.com/sanand0/scripts/blob/main/play-music): genre/language, composer, singer, year and album weighted 2.5/2.5/2.5/1.5/1. People use set overlap, year similarity halves each decade. It chooses from the top 30 with jitter up to 0.65 and album/composer/singer repetition penalties of 1/0.45/0.35. It queues up to ten immediately after the current item without interrupting playback, preserving future songs. Only available files with positive metadata similarity qualify; duplicate paths and known title/composer duplicates are excluded. Playlist preference bonuses and MusicBrainz matching are omitted. Scoring runs on demand with no cache. The CLI was unavailable in this container, so its current public upstream copy supplied the reference.
- Refresh rereads files and history. Only actual track starts append `local ISO timestamp\tfilename\tmusic-tool\n` to root `music-history.tsv`, with serialized, byte-positioned writes and `keepExistingData:true`. Pause/resume and seeks do not log. External processes should avoid writing queue/history files simultaneously with the player (File System Access has no cross-process atomic append).
- Tables render 200 rows at a time with Show more; search/sort/shuffle use all results. History panel shows the latest 100 file/session entries; scripts can request more. File handles are retained in memory, not in a catalog cache.

## Script / CDP API

Native OS/browser Play/Pause, Next, Previous and seek controls use Media Session handlers through the same `control()` dispatcher. Metadata, playback and position state follow native audio events, including track changes and completion. Unsupported actions are ignored individually.

Global shortcuts are supplied by the Ubuntu setup at `~/code/scripts/setup/media-keys.dconf`, never registered by this page. Space toggles play/pause, PageUp/PageDown changes tracks, and Left/Right seeks five seconds, all with Ctrl+Super held. These call `music.control()` via `edge js` without focusing Music; Space pauses if playing, otherwise resumes the current song or starts the next queued song. Ctrl+Super+M uses `edge open --reuse --window mail.google` to open/focus Music in the same Main Edge window as the ChatGPT shortcut. It currently opens `http://127.0.0.1:8000/music/` because the published Music URL returns 404; change the binding URL after deployment. CDP must be listening on localhost:9222, and multiple matching Music tabs are rejected rather than controlled arbitrarily.

Natural completion at the end of the Queue stops playback without adding songs. Only an explicit Play or Next action appends similar songs there. Player Play after completion continues the Queue instead of replaying the finished song, including native audio controls and global toggle. Next at the end appends ten songs similar to its latest song and starts the first, preserving the old Queue. This applies to the button, CDP and native media controls; repeat-one/all retain their behavior. A small library may provide fewer than ten distinct similar songs. If none qualify, playback pauses and shows a message; an empty Queue has no seed and remains empty.

Run these expressions in the Music page context (DevTools Console or CDP `Runtime.evaluate`):

```js
music.control({ action: "play" });
music.control({ action: "pause" });
music.control({ action: "toggle" });
music.control({ action: "forward", seconds: 5 });
music.control({ action: "backward", seconds: 5 });
music.control({ action: "next" });
music.control({ action: "previous" });
music.control({ action: "speed", value: 1.33 });
music.control({ action: "mute" });
music.control({ action: "volume-up" });
music.control({ action: "play-any" });
music.findSimilar(id); // up to ten related tracks
music.similarity(id, otherId); // {score, parts}; also accepts CSV rows / track objects
music.control({ action: "play-similar", track: id });
music.control({ action: "locate-track", track: id });
music.control({ action: "clear-search" });
music.playM3U("New.m3u", { shuffle: true, repeat: "all" });
// Equivalent:
music.control({
  action: "play-m3u",
  path: "New.m3u",
  shuffle: true,
  repeat: "all",
});
window.dispatchEvent(
  new CustomEvent("music-control", { detail: { action: "pause" } }),
);
music.find("rahman 199 spb");
music.getTrack(id);
music.getState();
music.getQueue();
music.getHistory({ limit: 20 });
music.control({ action: "queue-track", track: music.find("rahman")[0].id });
```

`control` returns a promise with state (and `error` on failure). `music-state` events carry compact state. Actions also include toggle, seek (seconds), volume (value 0–1 perceptual), repeat (value off/all/one or omit to cycle), play-track/play-next/show-info (track: id), remove-queue/play-queue/remove-above/remove-below (index), move-queue (index, to: index or "up"/"down"/"top"/"bottom"), clear-queue, shuffle-queue, shuffle-visible, play-any, mute (optional boolean value), volume-up/volume-down, filter (query), select (id), clear-search, focus-search, focus-results, focus-playlists, play-similar/locate-track (track: id or index: queue occurrence). `getQueue()` returns the whole Queue with `status` and `current` on each song; `getState().queueIndex` identifies the current occurrence (−1 when none). The folder picker and permission requests require genuine user activation; automation cannot grant access.

## Install and open files from Ubuntu

1. After deployment, visit https://tools.s-anand.net/music/ in Edge/Chrome. Install via Install app here or the browser menu/address bar. Visiting alone does not register file handlers.
2. Allow file handling if prompted. In Ubuntu Open With / default application, choose Music for `.mp3`, `.m3u`, `.m3u8` if needed.
3. Choose/reconnect Music Folder for metadata, history and playlist track access. An OS-launched MP3 can play outside that folder. A launched playlist grants access only to itself; unavailable entries show a reconnect message. Playlist launches use shuffle=false and repeat=off.

The manifest uses an SVG icon, `/music/` scope/action, standard `file_handlers` and `focus-existing` launch handling. After deployment check DevTools Application → Manifest, app icon/install affordance, and actual Ubuntu file association behavior; OS install/association prompts require manual verification.

## Validation

Offline and keyboard changes (6 October 2026): `npm test -- music` passes 91 tests, including Escape/Space recovery, keyboard queue building, folder cancellation and permission reconnect, decode recovery, offline navigation, interrupted downloads/writes, worker restart, unchanged and reverted deployments, and accepting or deferring updates. A separate Edge 154 browser check cached actual dependencies, reloaded with network disabled, played an in-memory WAV, and used Escape then Space to pause/resume. A change to only `script.js` offered an update without reloading; accepting it survived another offline reload. A service-worker code change waited for explicit Refresh. Narrow and desktop layouts had no horizontal overflow, and the browser reported no JavaScript errors. Lighthouse accessibility and best-practices scores were both 100. The full repository run had three unrelated failures in HN Links and Research Me; the repository has no lint script. Browser fixtures used memory-only music handles; no real music files were read or written and no binary artifacts were generated.

Earlier validation before offline support:

`npm test -- music` covers helpers and full-page integration with fake file handles, including Media Session handlers, native audio state changes, unsupported actions, background toggle and exact search ranking; it never writes your real history or queue. No generated binary assets or screenshots are committed.

The revised player passes 61 focused tests; `just test-edge` in the scripts repository passes 58 tests. A separate CDP check on Edge 154 used decoded, in-memory WAV fixtures: the global shortcut command payloads ran through the real Edge CLI while Music was unfocused, including toggle, previous/next and five-second seeks. Next at the end appended ten songs and played the first; natural completion advances existing queued songs and stops at the end without adding songs, and clearing the Queue cleared metadata. A separate real-browser check confirmed that the last song stopped with ten recommendations available; pressing native Play then appended those ten and started the first without replaying the finished song. The actual open/reuse command focused the existing Music tab without creating a duplicate. GLib parsed every dconf value and its custom shortcut paths/bindings passed validation. No real music files were written. The last full suite run had three unrelated failures in HN Links and Research Me; `npm run lint` is unavailable because the repository has no lint script.

Verified on Edge 154 (Ubuntu): local manifest parsed without errors, installability reported no errors with the SVG icon and no service worker, and real MP3 playback worked. A read-only fixture scan found all 1,526 audio files and 21 M3Us; `rahman 199 spb` returned 59 tracks. Desktop dark and narrow light layouts were visually inspected again after the latest changes, with no page overflow and a full-width audio control. Real playback resumed at its remembered position; `/` selected search text and P opened the native playlist selector. Similarity scores matched the upstream Python function for 100 sampled real catalog pairs; a full-library lookup selected ten songs in roughly 14–20 ms on the test browser. Test history/queue writes use fake handles; browser checks reject writes to real music files and save the queue in memory. Native File System Access writes, UTF-8 append preservation and IndexedDB directory-handle restoration were also checked using an isolated, temporary origin-private directory; restoring the Queue stayed paused and added no history. Lighthouse accessibility and best-practices checks scored 100.

Installation and Ubuntu file associations must be verified after deployment. Volume perception should also be checked on your speakers/headphones. See [Edge’s File Handling API documentation](https://learn.microsoft.com/en-us/microsoft-edge/progressive-web-apps/how-to/handle-files) for the install/permission flow.

Manual shortcut check after loading dconf: with Music playing in the background, check Ctrl+Super+Space, PageUp/PageDown, Left/Right and M; Next at the Queue's end should start a similar batch, and M should focus the same Music tab in Main on repeated presses. Check native Next/Previous and seek controls where available; native Media Session controls follow the browser's active media session, while the CDP shortcuts target Music.
