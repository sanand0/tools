# Live Poll

Run live audience polls: participants scan a QR code to vote from their phones, and the presenter reveals results and saves them to a TSV file.

## Use

1. Open the tool, optionally paste a Markdown list of prepared questions, and click **Create a room**. The page becomes the presenter screen at `poll/?room=K7QPX2MD&present`.
2. Project it. Participants scan the QR code (or open `poll/?room=K7QPX2MD`) and vote.
3. Type the question. Edit, add or remove choices (Yes / No by default). Phones update as you type.
4. Watch `responded / joined`. Press **R** (outside a text field) to show or hide the bar chart.
5. **Save** writes the question on screen to the TSV. **New** saves the current question, then starts a blank one with results hidden.
6. **Past** (or **Questions** when prepared questions remain) lists other questions for the presenter only. Click one to preview it on the projector; phones keep showing the current question. **Show to participants** switches to that question (saving the current question first if needed), keeping any existing votes. **Back to current** returns. Prepared questions with no votes can be skipped without creating a TSV. Opening or importing a TSV also adds its saved questions to the list, for viewing their results (they cannot be made live again, since individual votes are not saved).

## Prepare questions

On the room creation screen, optionally paste a list with unindented questions and choices indented by two spaces:

```md
- Should we automate invoices?
  - Yes
  - No
- Where should we start?
  - Research
  - Reporting
  - Reviews
```

The first question is live immediately. The remaining questions appear in **Questions** in their original order, marked **ready**. Preview and choose **Show to participants** to jump to any question. You can revisit a question without losing its votes. Blank seed text creates an ordinary empty room. A malformed list produces a line-numbered error before the room is created.

## Saving

- The first **Save** (or **New**) asks where to save, suggesting `poll-YYYY-MM-DD-HH-MM-SS.tsv`. Rename it or choose any folder. Save will not overwrite a file that already has content: use **Open TSV…** to add to an existing file. Later saves update the same file. **Open TSV…** picks an existing poll TSV to update, after checking its header.
- Every save re-reads the file, replaces that question's rows (matched by `question_id`), and keeps all other rows.
- Columns: `timestamp`, `question`, `choice`, `count`, `total`, `question_id`, `choice_id`, `joined`. `timestamp` is when Save or New was pressed (ISO 8601 with local offset). `total` is the number of responses to the question; `joined` is the number of participants in the room. Tabs and newlines in text become spaces.
- **New** pauses voting, saves a snapshot, and only then starts the next question. If saving fails or is cancelled, the question and its votes stay as they were, voting resumes, and you can Retry or Cancel.
- Browsers without the File System Access API (Firefox, Safari) download the full, cumulative TSV on every save. **Import TSV…** continues an existing file.

## How it works

- No server: browsers talk through a public MQTT broker (`mqtt.js`).
- The room code is a hash of the presenter's public key (`signing.js`). Phones accept only messages signed by that key, so presenter controls cannot be used from a phone, and the audience link carries no secret. The private key stays in the presenter browser's `localStorage`. Open the presenter link in that browser.
- Participants are anonymous random IDs kept in `localStorage` per room. Reloads and reconnects reuse the ID, so they are not counted twice. Each vote carries an increasing sequence number, so duplicate or delayed votes cannot override a newer one. Each question and choice has its own ID, so late votes for an old question or a removed choice are not counted.
- Anyone can publish to a public broker, so participant counts can be inflated by a deliberate attacker. Votes cannot be forged as presenter actions.

`mqtt.js` and `signing.js` are adapted from [mobile-games](https://github.com/sanand0/mobile-games).

## Test

```sh
npm test -- poll
```
