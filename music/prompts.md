# Prompts

## Offline and tests, 06 Oct 2026

<!--
cd ~/code/tools/
dev.sh -- codex --yolo --model gpt-6.1-sol --config model_reasoning_effort=medium
-->

When I focus on an element, say a button (e.g. using tab), I can no longer press the spacebar to play. That makes sense - space should activate the button. But I'd like to be able to press Esc when on any such focused element and that should defocus (or focus on something else if required) so that I can use the shortcuts like space normally.

Also enable offline mode. My main objective is to be able to use the music player on flights in flight mode. Think about what's required for that, minimally. But ensure that when I change the player code, it should update the player when online - or at least inform the user about an update and have them refresh. Don't make the update notice too intrusive - follow best practices.

Thirdly, add extensive test cases. Focus more on the FUNCTIONALITY and usage rather than the technology and cover realistic tasks / paths.

Implement these using sub-agents with the relevant intelligence, context, and prompts to manage context. You may decide sequential / parallel.

<!-- codex resume 01a10ed7-3a6d-7b02-9232-e36b02c33e42 --yolo -->

## Tweaks, 05 Oct 2026

<!--
cd ~/code/tools/
dev.sh -- codex --yolo --model gpt-6-luna --config model_reasoning_effort=medium
-->

Modify music/ minimally so that the queue on the right shows the album and year below the title and above the artist.
The font size can be similar to that of the artist, but make the title prominent (bold, maybe a more prominent color in light & dark modes).

<!-- codex resume 01a10b7e-8e0c-7ee2-812d-32fa26bbdfa6 -->

## Global shortcuts, 05 Oct 2026

<!--
cd ~/code/tools/
dev.sh -p ~/Music/ -- codex --yolo --model gpt-6.1-sol --config model_reasoning_effort=high
-->

<!-- Source: https://chatgpt.com/c/6ac2ec99-9728-83ec-99ef-7bde50d81976 -->

Revise music/ to add add global media controls:

- Make sure the installed/backgrounded Music app reliably responds to standard OS/browser media controls through the Media Session API. Play/Pause is essential; keep Next, Previous and seek working too where supported. All handlers must use the existing `control()` dispatcher, not duplicate playback logic.
- Keep `navigator.mediaSession.metadata`, `playbackState` and position state synchronized with the actual `<audio>` element through play, pause, track changes, seeks and end-of-track.
- Make sure `music.control({action:"toggle"})` works while the app is unfocused/backgrounded. I will bind `Ctrl+Super+Space` globally in GNOME to invoke it over CDP. It should pause when playing; otherwise resume the current song, or start the next queued song when there is no current song.
- Do not add browser-global keyboard hacks or an extension. Native media keys use Media Session; my deterministic app-specific global shortcut uses CDP.
- Add `Ctrl+Super+Space — Global play/pause` to Help, noting that this particular shortcut will be supplied by my Ubuntu setup at ~/code/scripts/setup/media-keys.dconf, not registered by the web page itself.
- Add/adjust focused tests for the Media Session handlers and `toggle`. Test CDP control against a real browser if possible. Actual Ubuntu media-key routing can remain one explicit manual check.
- Keep the changes minimal; much of this appears to be implemented already, so verify before changing.

Also:

- Search should prefer exact / word matches. For example, searching for "Ko" should match the album "Ko" before partial matches of "Ko" or case-insensitive matches.

--- <!-- steering -->

Wait, strangely, Ctrl+Super+Space already pauses. How us that? Check that first - because maybe most of this is already implemented?

---

Modify ~/code/scripts/setup/media-keys.dconf and any other relevant files so that:

- Ctrl+Super+PageUp/PageDown moves to the previous/next track instead of the current Ctrl+Super+Left/Right.
- Ctrl+Super+PageDown (or just pressing the next track), when there is no next track, adds 10 similar songs to the latest in the queue and plays the first of those.
- Ctrl+Super+Left/Right moves +/-5 seconds.
- Ctrl+Super+Space toggles play/pause.
- Ctrl+Super+M opens the Music app in the Main Edge window and focuses it. (Sort of like Ctrl+Super+C which opens ChatGPT in a new tab.)

---

Done. This works. Document the global shortcut keys in help. Begin help with the global shortcuts, then keyboard shortcuts, then the rest.

---

When searching, change the selection to the first song. When I press enter, focus should go to the first song in the results. I can then press up/down and Enter to select and play the song.

When I press play at the end of the last song, don't play the same selected song again. Instead, add 10 similar songs to the queue and play the first of those. (Just like Ctrl+Super+PageDown when there is no next song.)

--- <!-- steering -->

Keep in mind: If the last song in the queue ends, do not automatically add more songs - UNLESS triggered via a play or next track action.

<!-- codex resume 01a10ae3-6653-70a1-8825-c646bfa7cdc4 --yolo -->

## Initial prompt, 05 Oct 2026

<!--
cd ~/code/tools/
dev.sh -p ~/Music/ -- codex --yolo --model gpt-6.1-sol --config model_reasoning_effort=high
-->

<!-- Source: https://chatgpt.com/c/6ac2ec99-9728-83ec-99ef-7bde50d81976 -->

````markdown
Implement a polished personal music player in `~/code/tools/music/`. Do not stop at a plan: implement, test, visually inspect, and leave it ready for review. Keep it a simple static web app consistent with the repo: native browser APIs, minimal dependencies/files, no framework/build step unless clearly necessary. Primary target: current Edge/Chrome on my Ubuntu desktop.

The governing principle is: **this is a thin UI over my existing `~/Music/` files, not a second music database**. Prefer existing files/conventions, simple joins and graceful degradation over metadata parsing, caches, schemas or infrastructure.

## Product

Think of the UI as **Library + Queue/History + Now Playing**. Desktop default: compact top bar with search/menu; library dominates; Queue/History at right; persistent player at bottom. Responsive, information-dense, keyboard-first, polished like mature music players without copying branding. Light/dark mode.

On first use ask for my music folder using `showDirectoryPicker({id:"music-library", mode:"readwrite", startIn:"music"})`; persist the directory handle if useful. Reconnect/change folder cleanly. Folder picking always requires genuine user interaction.

## Library: files + optional `musicdump.csv`

Recursively enumerate common audio files (`mp3,m4a,mp4,opus,ogg,flac,wav,aac,...`) so the app has usable file handles.

If `musicdump.csv` exists in the selected music folder, use it as the metadata/catalog source. Do **not** parse audio tags or build a metadata cache. Join its rows to actual files, primarily using its existing `filename` convention. Audio files missing from CSV still appear using filename/path; CSV rows whose files no longer exist can be ignored. If no CSV exists, a filename-based library is completely acceptable.

Map existing fields such as `TIT2,TPE1,TALB,TCOM,TCON,TDRC,TRCK,TEXT,length` to friendly Title, Artist, Album, Composer, Genre, Year, Track, Description, Duration columns. Keep columns in one obvious `LIBRARY_COLUMNS` data structure. Show only useful columns that actually have data; filename/path remains available.

Info should show all available CSV metadata plus basic browser `File` facts such as path/name, size and modified time. Do not add a metadata parser merely to enrich Info or extract embedded album art. Use a tasteful deterministic artwork placeholder unless useful artwork is available almost for free.

Menu: **Refresh Library**, **Change/Reconnect Music Folder**, **Help**. Refresh simply re-enumerates files and rereads `musicdump.csv` and M3Us; assume these may be changed externally while the player is open.

## Search + library interaction

Search should be forgiving, not a query language. I should be able to type:

`rahman 199 spb`

and get 1990s A R Rahman songs sung by S P Balasubrahmanyam.

Split the query into whitespace terms and make every term match somewhere across the combined row metadata + filename/path. Normalize punctuation/case/spacing and generate useful aliases/initials, so `spb` matches `S P Balasubrahmanyam`, `arr` matches `A R Rahman`, and `199` matches `1990`–`1999`. Exact/substring matches should rank strongly; modest fuzzy/typo tolerance is useful if it stays fast and simple. Avoid structured syntax like `composer:rahman`.

All visible columns sort asc/desc naturally. Keyboard: Up/Down selects visible tracks; Enter queues; Shift+Enter plays next; double-click queues. Row actions: Play now, Queue, Play next, Info. `/` focuses search; Escape behaves naturally.

Play now interrupts the current track but preserves the future queue.

## M3U playlists

Treat existing `.m3u` / `.m3u8` files anywhere under the selected folder as first-class playlists. Show them somewhere unobtrusive, allow opening their contents and playing/queuing them.

Resolve entries forgivingly: relative paths relative to the M3U, paths under the selected root, `file://` paths where sensible, and basename fallback when unambiguous. Ignore comments/blank lines. Preserve playlist order unless shuffle is requested.

Any script must be able to play any M3U with explicit shuffle and repeat settings, e.g.:

```js id="65ucex"
music.control({
  action: "play-m3u",
  path: "New.m3u",
  shuffle: true,
  repeat: "all",
});
```

Support `repeat: "off" | "all" | "one"`; default shuffle=false, repeat=off. Expose the same through `music-control` custom events and a convenient `music.playM3U(...)` API. `Appa*.m3u` is still playable normally; just don't infer anything special about my preferences from playlists because this player doesn't need recommendation logic.

## Register as the OS handler for MP3/M3U

The deployed app will live at `https://tools.s-anand.net/music/`. Make it installable in Edge/Chrome as a minimal PWA so Ubuntu can register it as a file handler for `.mp3`, `.m3u` and `.m3u8`.

Use the standard PWA File Handling API, not an extension or custom protocol. Add the smallest valid web app manifest and link it from the page. Include `file_handlers` for at least:

```json
{
  "audio/mpeg": [".mp3"],
  "audio/x-mpegurl": [".m3u"],
  "application/vnd.apple.mpegurl": [".m3u", ".m3u8"]
}
```

Set the handler action within `/music/`. Use `window.launchQueue.setConsumer(...)` to receive files opened by the OS. File-handler registration happens when the PWA is installed; merely visiting the site is not enough. Make this clear in Help and, if useful, expose a compact Install app affordance when the browser supports it. Chromium desktop supports OS-level PWA file associations via manifest `file_handlers` + `launchQueue`.

Desired behavior:

- Opening an `.mp3` from Ubuntu should launch/focus the installed Music app and immediately play that file.
- Opening an `.m3u`/`.m3u8` should launch/focus the app and play that playlist in file order, with normal defaults unless the file itself was opened through some explicit internal command carrying shuffle/repeat options.
- If the app is already running, prefer focusing/reusing it rather than creating unnecessary extra instances; use `launch_handler` / `focus-existing` if it works cleanly.
- A launched MP3 may be outside the currently selected Music folder; play the received file handle directly.
- A launched M3U only grants a handle to the playlist itself, not automatically to every referenced sibling file. Resolve entries against the already-authorized Music folder/library when possible. If referenced tracks are inaccessible, explain clearly that the Music folder must be selected/reconnected rather than silently failing.
- Continue writing normal track starts to `music-history.tsv` when launched through the OS handler.

Keep this PWA support minimal. A service worker/offline cache is not required merely for installation/file handling, so do not add one unless current Chromium actually requires it. Edge documents service workers as optional for installable PWAs.

Respect the repo rule against generated binary files. Prefer existing suitable icons or text-based SVG assets if Chromium accepts them for installability; verify the deployed manifest/installability in Edge/Chrome rather than assuming it works. Chromium installation requires a valid manifest, HTTPS, and suitable app icons.

Test both manifest registration and `launchQueue` handling as far as automation permits, and list the one-time manual steps I need to perform after deployment: install the PWA and, if Ubuntu prompts, select it as the default handler for `.mp3` / `.m3u`.

## Queue + History

Right panel: `UP NEXT | HISTORY`. Queue supports append, Play next, remove, clear, Shuffle queue; also Shuffle visible results. Reordering is optional if it stays simple.

Previous should use actual playback history sensibly. Repeat cycle: off → all → one → off.

Persist lightweight player state/preferences such as volume, speed, repeat and optionally queue/current position using simple browser storage; don't build a separate state database.

History should derive from `music-history.tsv` and/or the current session rather than introducing another logging store.

## Player

Use a real `<audio controls>` plus explicit Previous, −5s, play/pause, +5s, Next, repeat, speed and volume controls.

Speeds: 0.25, 0.33, 0.5, 0.75, 1, 1.25, 1.33, 1.5, 1.75, 2, 2.5, 3, 4, 5, 10. Use `playbackRate`, preserve pitch, persist speed, and fail gracefully at unsupported extremes.

Use a perceptually natural/log-like volume slider rather than linear perceived loudness; persist volume. Avoid Web Audio unless genuinely useful.

Now Playing should compactly show the best metadata available from `musicdump.csv`, otherwise filename, plus a tasteful placeholder visual.

Integrate Media Session when available: title/artist/album plus play, pause, nexttrack, previoustrack, seekforward, seekbackward, seekto and position/playback-state synchronization.

## Simple interoperable history log

Whenever a track **actually starts playing**, append exactly one TSV line to `<music-folder>/music-history.tsv`:

```text id="m1itav"
2026-09-12T23:15:21+08:00	Chandramukhi.Athithom.mp3	music-tool
```

Exactly three fields: local ISO timestamp with numeric timezone offset, filename, literal tool name `music-tool`.

Do not log pauses, seeks, queue operations, speed changes, provenance, scores, experiments, JSON, headers, etc. A pause/resume must not create another entry; starting the next track or replaying/restarting a track should.

Append without destroying existing contents. With the File System Access API this means preserving existing data and writing at the previous file size rather than accidentally truncating the file. Serialize concurrent writes so rapid track changes cannot lose lines. Logging failure should be visible but must not stop playback.

## Script/agent control

All normal controls should converge on one dispatcher shared by UI, keyboard and automation.

Support:

```js id="mh8ese"
window.dispatchEvent(
  new CustomEvent("music-control", {
    detail: { action: "forward", seconds: 5 },
  }),
);
```

Keep a small coherent vocabulary covering play, pause, toggle, forward/backward, next/previous, speed, volume, repeat, play-track, queue-track, play-next, remove/clear/shuffle queue, shuffle-visible, filter/select/show-info, and `play-m3u`.

Also expose:

```js id="xojjcd"
music.control({ action: "forward", seconds: 5 });
music.playM3U("New.m3u", { shuffle: true, repeat: "all" });
music.getState();
music.getTrack(id);
music.find("rahman 199 spb");
music.getQueue();
music.getHistory({ limit: 20 });
```

Emit a compact `music-state` custom event after meaningful state changes.

Near the top of `index.html`, include a concise HTML comment documenting `music-control`, `window.music`, `music-state`, `play-m3u`, examples, and the folder-picker user-activation restriction. Put the same concise documentation in Help so both humans and agents can discover it quickly.

## Failure handling + scope

Handle revoked folder permission, missing/deleted files, unsupported browser/audio format, malformed CSV/M3U, duplicate filenames, empty library, external file changes and rejected autoplay cleanly. A bad entry/file must not break the library or playlist.

Do **not** add metadata parsing/editing, metadata caches, MusicBrainz identity logic, embedded-art extraction, structured search syntax, built-in recommendations, rich provenance/event schemas, playlist editing, lyrics, EQ/waveforms/crossfade, accounts/cloud backend, offline/service-worker complexity, or framework complexity. The minimal PWA manifest/file-handler support specified above is intentional.

## Validation

Test the important logic: CSV/file joining and fallback, forgiving search including `rahman 199 spb`, sorting, M3U parsing/path resolution and `play-m3u` options, queue/history/repeat/shuffle, playback controls, music-history.tsv append without truncation/duplicates, keyboard navigation, `music-control` and `window.music`.

Use my actual files read-only where available for realistic checks, except that writing test history must not pollute my real `music-history.tsv`. Visually inspect desktop/narrow layouts and fix obvious overflow, focus, contrast and player overlap issues.

When finished, summarize what changed, tests actually run/results, remaining manual browser checks, and copy/paste CDP examples for play/pause, ±5 seconds, next/previous, speed, and playing `New.m3u` shuffled/repeat-all.
````

---

Changes:

- Allow reordering "Up next" by drag and drop. Add a handle if required - but if it can be handled without a handle, even better.
- Double-clicking the title of a song or pressing Enter on a song in the library should play it now - that doesn't seem to be working.
- List all keyboard shortcuts in the Help menu. Show them on the tooltips of the relevant buttons.
- Add a right-click menu the the library. It should show an option to filter by that value - and we may add future values.
- Add a right-click menu to the queue. It should show an option to remove, move up/down, top/bottom, play now - and we may add more in the future.

---

Changes:

- Increase the vertical space available for the playlist, compressing the .navbar, .section-header, .playlist-bar into fewer elements or slightly more compact elements, vertically.
- Let the audio control use maximum horizontal space available. Easier to seek
- Add a mute toggle button
- Change the "Shuffle" button next to "Reconnect" to "Play Any". It should append 10 random songs to the queue from the playlist and start playing from that point in the queue.
- Modify the volume control to have more control at the higher end. Right now, when I drop from 100% to 90%, the volume feels like it's dropping 75% and at 50%, it feels like 25%. That's rough numbers - but I wanted to give you a sense of the problem.
- Replace the "Up next" with a "Queue" that includes songs played in this session as well as what's up next. That way, I can see what's played as well as coming next in one view. Highlight what's currently being played in the Queue.
- Persist the queue across sessions in "queue.tsv" in the music folder and keep it synced with the UI.
- Double-clicking a song anywhere on the playlist should play it now - not just the title. It should add it right below the currently played item in the queue if something's being played and play it. The rest of the queue should move down.
- The playlist song right-click menu should include an option to Play now, Play next, Queue, Info - i.e. same as the actions.
- The queue right-click menu should include an option to Remove all above, Remove all below.
- Add keyboard shortcuts to increase / decrease volume

---

Changes:

- Move Duration column before Track.
- In the playlist right-click
  - rename Queue to Play at end.
  - move the filter option to the first position in the menu.
- In the queue right-click, add a "Locate in playlist" scrolls to and highlights the song in the current playlist (clearing the current search).
  If the song isn't in the current playlist, switch to all tracks, scroll to it, and highlight it.
- Add a button (with keyboard shortcut) to clear the search.
- Pressing `/` should not just focus on search, it should also select the text, so that I can start typing immediately.
- Default the volume to 100%. If possible, allow volume to go over 100% (say up to 200%). If not, skip.
- Sort the playlists based on the last updated time of the .m3u files - latest first.
- Add a shortcut to focus on and open the playlist selector.
- Add ? as a shortcut to open the Help menu.
- Store (in memory, not persisted) the time until which a song was played last. Do this resource efficiently. (If we miss a few edge cases, I'm OK.)
  When playing a song again, continue from where it stopped playing last.
  Clear the last played time after 24 hours or if the song is played almost to completion (15s buffer).
- The volume control is now too concentrated at the higher end. 50% feels like 70%. Get it somewhere between where it was and where it is now.
- In the Now Playing section, show the album and year more prominently. Also show the composer.
- Alerts (for warnings, etc.) currently have a heading and a body one below the other and don't occupy the full width. Make it one row, let it occupy the full width.

Also, take a look at ~/code/scripts/play-music and the similarity algorithm implemented.
Implement that similarity algorithm as a function.
In the right-click option for any song in the playlist or queue add an option to "Play 10 similar next" based on this function. These should be added to the queue after the current song.

<!-- codex resume 01a1099c-f1b1-7f30-a41c-c3d8be8a0dbb --yolo -->
