# Poll

## Initial draft

<!--
cd ~/code/tools/
claude --model opus --effort medium
-->
<!-- Source: https://chatgpt.com/c/6adf8c04-35ac-83ec-a785-7bf74fdaf05f -->

Create `poll/index.html` - a single-page web app that lets multiple users join a poll via a QR code, share a response, and allow the presenter the save the results.

Presenters should be able to create a room and specify a file to save results in (as a TSV). They can pick a directory, in which case the file defaults to poll-$YYYY-MM-DD-HH-MM-SS.tsv. The presenter can also pick an existing TSV file to update. Saving may rewrite the entire file to replace existing question rows, but must preserve all other rows.

Use the File System Access API (showDirectoryPicker, showOpenFilePicker, etc.), not FileReader, for writing files. Maintain one file handle per session, and use a cumulative TSV download fallback where direct file writing is unsupported. Validate the header before modifying an existing TSV.

The room gets a URL like `poll/?room=ABC123`. There should be a QR code prominently presented at all times that links to the room URL (dynamically created).

Users should be able to join the room. Presenter controls must be inaccessible to participants, not merely hidden. Reuse the authenticated presenter-message mechanism from ~/code/mobile-games/. The audience QR must never expose presenter credentials. See ~/code/mobile-games/ for a sample implementation of such a mechanism.

The total number of users joined should be displayed on the page.

The presenter should be able to create a new question by clicking "New" and typing the question on the page. It should be in large enough a font to be readable from a distance when projected on the screen. It should also be visible (as the presenter types) on the users' screens.

If automatic saving fails or is cancelled when pressing "New", keep the existing question and votes unchanged. Allow the presenter to retry or cancel the "New" action.

Each question has a unique internal ID so late votes from an older question cannot contaminate the new one.

By default, questions support Yes or No buttons but the presenter can edit / add / remove buttons. These should be reflected as the presenter makes changes.

- Each choice gets a stable internal ID, independent of its text.
- Renaming a choice retains its votes.
- Adding a choice starts it at zero votes.
- Removing a choice invalidates only votes for that choice and asks affected participants to vote again. Votes for other choices remain unchanged. The response count decreases accordingly.
- A participant has one current response per question; selecting another choice replaces it rather than adding another vote.

At any point, the user can choose a choice. As they submit, the number of responses is visible on the screen - against the denominator of total users joined (e.g. 14 / 30).
Count unique anonymous participants per room, retaining their IDs across reloads. Show the number currently connected separately. Reconnecting must not duplicate participants or their votes.

The presenter sees the live response count without the breakdown. Pressing `R` outside editable fields reveals the bar chart against each choice on the projector (showing absolute counts and percentages), and pressing `R` again hides it. Every new question starts with results hidden.

Clicking "Save" writes the current question's latest results to the TSV. If that question was previously saved, replace its rows rather than append duplicates, using its unique question ID. Other questions' rows remain unchanged. Clicking "New" saves the current question before creating the next one, unless the current question is blank. Stop accepting votes for the old question before capturing its final snapshot. Every Save must capture a consistent snapshot of the question and counts. Never discard data if saving fails. Multiple saves should update the same file. The TSV columns should be timestamp (ISO 8601 with local timezone offset, e.g. 2026-10-26T18:32:10+01:00), question, choice, count, total, question_id. Additional columns (e.g. if choice ID is required) may be added after these columns. The timestamp is when the Save or New action was initiated. Saving again updates the timestamp for that question.

Follow ~/code/tools/AGENTS.md. Reuse the MQTT room and signing mechanisms from ~/code/mobile-games/, adapting any necessary code so the deployed tool works independently of that repository. Handle reconnects and duplicate or delayed votes. Normalize tabs and newlines in TSV fields. Add automated tests for voting, choice edits, reconnections, repeated saves, file updates, and browser fallback behavior. Test with multiple simulated participants.

---

Save is denied for system folders like Downloads, Documents, etc. Besides, we don't need a folder, just a file. I'd like the poll to pick a default file name (`poll-$YYYY-MM-DD-HH-MM-SS.tsv`) and let me pick a folder to save it in. I should be able to pick an existing file or rename it.

Also, I think we can remove the "Folder" button. Save should ask for the file to save as. Open TSV should let me pick an existing file.

Also, since we have a count / total we don't need a separate "connected now" number.

---

Why does the spinner next to "Saving ..." keep spinning? Can we make it so that it spins only when something is actually happening?

---

Allow the presenter to show the results of previous polls. This should not change the view for the users unless the presenter explicitly switches to that. The presenter should also be able to see past questions to jump to those and see the result, but this should not be visible on screen by default - only on click - and certainly not to users.

--- <!-- steering -->

Do not allow "Save" to overwrite an existing file unless "Open TSV..." was used to select that file. Avoids accidental overwrites of existing files.

---

The "Past" button should appear even when I "Open TSV..." a saved file

<!-- claude resume ad8595c5-540e-476a-8017-be7ba8d614d8 -->
