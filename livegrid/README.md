# LiveGrid

Live multi-user prioritization grid synchronized through Cloud Firestore.

[Use LiveGrid](https://tools.s-anand.net/livegrid/)

LiveGrid is a static, browser-only version of the What Next? priority matrix. It preserves editable items, drag-and-drop placement, color cycling, editable axes, notes, and locally cached rooms while synchronizing every participant through the URL’s room ID.

The complete grid fits its viewport by default. Browser-native page scrolling, panning, and pinch zoom remain enabled on mobile.

The form at the bottom imports tab-delimited `text`, X, and Y columns. Coordinates accept percentages or 0–1 fractions, with Y measured from the bottom; imported notes are kept within the grid bounds.

## Firebase configuration

`script.js` uses the pinned Firebase browser ESM release `12.1.0`, calls `initializeApp(firebaseConfig)`, and opens the project’s existing `(default)` Cloud Firestore database with `getFirestore()`. It does not use Realtime Database, `databaseURL`, Firebase Hosting, a backend, npm, or a bundler.

```js
const firebaseConfig = {
  apiKey: "AIzaSyBb6_rERxcWd2P6QbydzS_8hsY1OcsLG7I",
  authDomain: "tools-anand.firebaseapp.com",
  projectId: "tools-anand",
  storageBucket: "tools-anand.firebasestorage.app",
  messagingSenderId: "498747162553",
  appId: "1:498747162553:web:59609d6693b04fef2c4068",
  measurementId: "G-D7MS4ZJK8V",
};
```

Each valid UUID-v4 hash maps to one whole-document, last-write-wins record:

```text
https://tools.s-anand.net/livegrid/#550e8400-e29b-41d4-a716-446655440000
                                           └─ rooms/550e8400-e29b-41d4-a716-446655440000
```

The full grid state is written with `setDoc()`, received with `onSnapshot()`, and removed with `deleteDoc()`. `localStorage` is an immediate cache and offline fallback. Firestore’s browser client reconnects automatically; LiveGrid also writes the latest cached whole document when the browser reports that it is online again.

## Security rules

The room link acts as a password: anyone possessing the complete URL can read and edit the room. UUIDs are difficult to guess but are bearer secrets, not authentication. Do not put confidential data in a grid, expose links publicly, or assume participant identity can be audited.

Add this block **alongside the existing `notes/{noteId}` rules**. Do not replace unrelated rules:

```text
match /rooms/{roomId} {
  allow get, create, update, delete:
    if roomId.matches(
      '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    );
  allow list: if false;
}
```

These rules only validate the unguessable document name. They do not authenticate users, restrict fields or document size, validate HTML, rate-limit writes, or prevent a link holder from deleting a room. The UI sanitizes received item and notes HTML, but rules should still be tightened if the threat model changes.

## Operational limits

- Synchronization is whole-document, last-write-wins. Concurrent edits to different items can still overwrite one another; there is no merge, revision history, presence, or conflict UI.
- Editing, dragging, and axis changes are debounced, but every write and live update counts toward [Cloud Firestore quotas and pricing](https://firebase.google.com/docs/firestore/quotas). Monitor usage and billing for a publicly shared deployment.
- Offline edits remain in the browser cache. Reconnection writes the latest local whole document, which can overwrite changes made elsewhere while that browser was offline.
- Deletion is permanent in Firestore. Browsers that deleted or previously observed the room remember its tombstone and do not recreate it. Because a deleted Firestore document leaves no server-side tombstone, a completely new browser opening that old link cannot distinguish it from a never-created room and may initialize it again.
- The page depends on pinned Firebase, DOMPurify, QR-code, Bootstrap, icon, and alert CDN assets. Existing cached room data remains locally usable when Firestore is unavailable, but a first uncached page load still needs those static assets.

## Two-browser test

1. Serve the repository statically and open `/livegrid/` in browser A. Confirm the URL gains a UUID-v4 hash and the status becomes **Connected**.
2. Use **Share** or **QR code** to open the complete URL in browser B. Add, edit, drag, recolor, and delete items; edit labels, title, and notes in each browser. Confirm the other browser updates without refreshing.
3. Refresh browser B and confirm the same room returns. Create a **New room** and confirm its edits do not appear in the first room.
4. Take browser A offline, edit the grid, and confirm the offline status and local persistence. Refresh if the CDN assets are cached, reconnect, and confirm the latest state synchronizes.
5. Delete a test room and confirm both already-connected browsers show **Room deleted** without recreating it.
6. Temporarily deny `rooms/{roomId}` access in a development project or use browser network blocking. Confirm connection, permission, and write errors appear while local edits continue to save.
7. In a development room, write item or notes HTML containing `<script>`, an `onerror` handler, and a `javascript:` URL. Confirm none execute and the unsafe nodes or attributes are absent from the rendered DOM.

Run the automated browser integration coverage with:

```sh
npm test -- livegrid
```
