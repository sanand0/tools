# livegrid

## Initial draft, 04 Aug 2026

<!--
cd ~/code/tools/
dev.sh -- codex --yolo --model gpt-5.6-sol --config model_reasoning_effort=medium
-->

<!-- Source: https://chatgpt.com/c/6a7178b3-2a84-83ec-898a-ea5c8cd302a1 -->

Copy `tools/whatnext/` to `tools/livegrid/`. Do not modify `tools/whatnext/`.

Convert the copy into a static, browser-only, live multi-user grid using the existing default Cloud Firestore database. Preserve the existing appearance, interactions, state structure, and static hosting. Do not add npm, a bundler, a backend, or Firebase Hosting.

Use a pinned Firebase browser ESM CDN release with:

```js
const firebaseConfig = {
  apiKey: "AIzaSyBb6_rERxcWd2P6QbydzS_8hsY1OcsLG7I",
  authDomain: "tools-anand.firebaseapp.com",
  projectId: "tools-anand",
  storageBucket: "tools-anand.firebasestorage.app",
  messagingSenderId: "498747162553",
  appId: "1:498747162553:web:59609d6693b04fef2c4068",
  measurementId: "G-D7MS4ZJK8V"
};
```

Do not use Firebase Realtime Database or `databaseURL`. Initialize the existing `(default)` Cloud Firestore database with `initializeApp()` and `getFirestore()`.

Implement:

1. Use a valid UUID-v4 URL hash as the room ID. Generate one with `crypto.randomUUID()` when missing or invalid.
2. Store the complete grid state in the Firestore document `rooms/<roomId>`.
3. Use `onSnapshot()` for live synchronization, `setDoc()` for writes, and `deleteDoc()` for room deletion.
4. Retain localStorage as a cache and offline fallback.
5. Debounce remote writes and prevent `load()`/`draw_grid()`/`save()` feedback loops.
6. When a room document does not exist, initialize it from the local or default state without repeatedly recreating a deliberately deleted room.
7. Keep whole-document, last-write-wins synchronization.
8. Replace the old Publish/Refresh controls with connection status, Share, QR code, New room, and Delete room controls.
9. Share the complete URL using Web Share when available and clipboard fallback otherwise.
10. Generate QR codes entirely in the browser using a small pinned CDN library.
11. Sanitize remote item and notes HTML before inserting it into the DOM.
12. Display Firestore connection, permissions, and write errors without breaking local use.
13. Rename the UI to LiveGrid and state that anyone possessing the link can edit.
14. Add a README covering Firebase configuration, `rooms/<roomId>`, link-as-password security, Firestore rules, quotas, last-write-wins conflicts, and a two-browser test.
15. Test creation, two-browser synchronization, refresh, offline use, reconnection, separate rooms, deletion, error handling, and malicious HTML.

Do not replace unrelated Firestore rules. Document that this `rooms/{roomId}` block must be added alongside the existing `notes/{noteId}` rules:

```text
match /rooms/{roomId} {
  allow get, create, update, delete:
    if roomId.matches(
      '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    );
  allow list: if false;
}
```

Review the resulting diff and report changed files, tests performed, and remaining limitations.

---

Remove the top navbar. No dark mode - only light mode. Make it mobile responsive - think about the best way to do that.

---

On mobile, the grid is cut off at the bottom and the right and I don't see the whole grid. I am also not able to pan / zoom on the page. Make sure that by default, the entire grid is visible. Also let the user pan and zoom into any portion of the grid for fine grained control.

---

The "+" and the axes grid labels are no longer clickable or editable.

--

When the draggable bar on top goes outside the area, I'm not able to drag it back because the handle is not visible. (I'm OK if the draggable bar is visible outside the container - as long as it's not too far out, i.e. when dropped, we're making sure it stays within the bounds (the center of the note, I think). So, if the entire note is always fully visible and draggable, we should be fine.

---

This works on localhost:3767/livegrid/ but not on https://forms.s-anand.net/livegrid/ - which is served via CloudFlare tunnels pointing to the same port. You can check this via CDP on localhost:9222. Why is this?

---

Add a version number to the JS files.

---

Add a textarea at the bottom where I can paste tab-delimited text and press submit. Each row adds a note. The position should be based on the 2nd column (X-axis) and 3rd column (Y-axis) as percentages. For example "A\t20\t50%\nB\t30%\t0.8\n" should render A at x=20% y=50% and B at x=30% y=80%. Keep in mind that they should fit in the bounds. Write minimal elegant code. Update the JS versions.

<!-- codex resume 019fcb7b-417b-74c2-9e8b-647511c7e1b1 --yolo -->
