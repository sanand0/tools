import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import { Browser } from "happy-dom";
import path from "node:path";
import { LocalBus } from "./mqtt.js";
import { presenterKey, verifier } from "./signing.js";
import { pastQuestions, topics, PollHost, PollParticipant, ResultsFile, mergeTSV, parseTSV, isoLocal, fileName, clean, HEADER } from "./poll.js";

const until = async (fn, ms = 4000) => {
  const end = Date.now() + ms;
  while (!fn()) {
    if (Date.now() > end) throw new Error(`Timed out waiting for ${fn}`);
    await new Promise((r) => setTimeout(r, 10));
  }
};
const settle = () => new Promise((r) => setTimeout(r, 60));
const pid = (i) => `user${String(i).padStart(8, "0")}`;

// A presenter and N participants on an in-memory bus, using real signing and verification.
async function room(n = 0) {
  const bus = new LocalBus(), key = await presenterKey(), t = topics(key.room);
  let chain = Promise.resolve();
  const net = bus.client({ onMessage: (_t, msg) => host.handle(msg) });
  const host = new PollHost({
    send: (to, data) => (chain = chain.then(async () => net.publish(to === "all" ? t.all : t.client(to), await key.sign(data)))),
    onChange: (kind) => kind !== "reveal" && host.broadcast(),
  });
  net.subscribe(t.up);
  net.connect();
  const join = (id, seq = 0) => {
    const verify = verifier(key.room);
    let inbox = Promise.resolve();
    const client = bus.client({
      onMessage: (_t, envelope) => { inbox = inbox.then(() => verify(envelope)).then((data) => data && poll.receive(data)); },
      onLive: () => poll.hello(),
    });
    const poll = new PollParticipant({ id, send: (data) => client.publish(t.up, data), seq });
    client.subscribe(t.all);
    client.subscribe(t.client(id));
    client.connect();
    return { id, poll, client };
  };
  const people = Array.from({ length: n }, (_, i) => join(pid(i)));
  if (n) await until(() => host.joined === n && people.every((p) => p.poll.question));
  return { bus, key, t, host, net, join, people };
}
const choiceId = (host, label) => host.question.choices.find((c) => c.text === label).id;

describe("voting with many participants", () => {
  it("counts one current response per participant across 40 phones", async () => {
    const { host, people } = await room(40);
    expect(host.joined).toBe(40);
    expect(host.connected).toBe(40);
    host.setText("Is the room awake?");
    await until(() => people.every((p) => p.poll.question.text === "Is the room awake?"));
    const [yes, no] = host.question.choices.map((c) => c.id);
    people.forEach((p, i) => p.poll.vote(i < 25 ? yes : no));
    await until(() => host.responses === 40);
    expect(host.counts()).toEqual({ [yes]: 25, [no]: 15 });
    // Changing your mind replaces your vote rather than adding one
    people.slice(0, 5).forEach((p) => p.poll.vote(no));
    await until(() => host.counts()[no] === 20);
    expect(host.counts()).toEqual({ [yes]: 20, [no]: 20 });
    expect(host.responses).toBe(40);
    await until(() => people.every((p) => p.poll.responses === 40 && p.poll.joined === 40 && !p.poll.pending));
    expect(people[0].poll.mine).toBe(no);
    // Participants never receive the per-choice breakdown
    expect(JSON.stringify(host.publicState())).not.toContain('"votes"');
  });

  it("ignores duplicate, delayed and stale-question votes", async () => {
    const { host } = await room();
    const [yes, no] = host.question.choices.map((c) => c.id), qid = host.question.id, id = pid(1);
    host.handle({ t: "vote", id, qid, cid: yes, n: 5 });
    host.handle({ t: "vote", id, qid, cid: yes, n: 5 }); // duplicate
    host.handle({ t: "vote", id, qid, cid: no, n: 3 }); // delayed older vote
    expect(host.counts()).toEqual({ [yes]: 1, [no]: 0 });
    host.handle({ t: "vote", id, qid, cid: no, n: 6 });
    expect(host.counts()).toEqual({ [yes]: 0, [no]: 1 });
    // Malformed messages are ignored
    host.handle({ t: "vote", id: "BAD ID", qid, cid: yes, n: 9 });
    host.handle(null);
    expect(host.joined).toBe(1);
    // Late votes for the old question cannot touch the new one
    host.next();
    host.handle({ t: "vote", id, qid, cid: yes, n: 7 });
    host.handle({ t: "vote", id: pid(2), qid, cid: no, n: 1 });
    expect(host.responses).toBe(0);
    expect(host.question.id).not.toBe(qid);
    expect(host.question.revealed).toBe(false);
  });

  it("holds votes while paused and resends them when voting reopens", async () => {
    const { host, people } = await room(3);
    const yes = choiceId(host, "Yes");
    host.close();
    await until(() => people.every((p) => !p.poll.question.open));
    expect(people[0].poll.vote(yes)).toBe(false); // buttons are disabled while paused
    // A vote already in flight when voting paused stays pending
    host.reopen();
    await until(() => people[1].poll.question.open);
    people[1].poll.vote(yes);
    host.question.open = false; // pause before the vote arrives
    await settle();
    expect(host.responses).toBe(0);
    expect(people[1].poll.pending).not.toBeNull();
    host.reopen();
    await until(() => host.responses === 1 && !people[1].poll.pending);
  });

  it("rejects presenter messages that are unsigned or signed by another key", async () => {
    const { t, bus, people, host } = await room(2);
    const attacker = bus.client(), fake = await presenterKey();
    attacker.connect();
    const forged = { t: "state", rev: Date.now() + 1e9, q: { id: "qhacked", text: "Hacked", choices: [], open: true }, responses: 0, joined: 0 };
    attacker.publish(t.all, await fake.sign(forged));
    attacker.publish(t.all, forged);
    attacker.publish(t.all, { d: JSON.stringify({ ...forged, at: Date.now() }), k: (await fake.sign({})).k, s: "x" });
    await settle();
    for (const p of people) expect(p.poll.question.id).toBe(host.question.id);
  });
});

describe("reconnections", () => {
  it("does not duplicate participants or votes after drops and reloads", async () => {
    const { host, people, join } = await room(5);
    const yes = choiceId(host, "Yes");
    for (const p of people) p.poll.vote(yes);
    await until(() => host.responses === 5);
    // Network drop: vote while offline, then reconnect
    const [a, b] = people;
    a.client.drop();
    a.poll.vote(choiceId(host, "No"));
    expect(a.poll.pending).not.toBeNull();
    a.client.connect(); // onLive → hello → resend
    await until(() => host.counts()[choiceId(host, "No")] === 1 && !a.poll.pending);
    // Reload: a new page with the same stored id and sequence number
    b.client.close();
    const b2 = join(b.id, b.poll.seq);
    await until(() => b2.poll.mine === yes);
    expect(host.joined).toBe(5);
    expect(host.responses).toBe(5);
    // Re-sending hellos and pings never adds people
    for (const p of people) { p.poll.hello(); p.poll.ping(); }
    await settle();
    expect(host.joined).toBe(5);
    // Leaving reduces "connected" but not "joined"
    a.poll.bye();
    await until(() => host.connected === 4);
    expect(host.joined).toBe(5);
  });

  it("keeps participant identity across presenter reloads", async () => {
    const { host, people } = await room(3);
    const yes = choiceId(host, "Yes");
    people[0].poll.vote(yes);
    await until(() => host.responses === 1);
    const copy = new PollHost({ send: () => {} });
    expect(copy.restore(host.serialize())).toBe(true);
    expect(copy.joined).toBe(3);
    expect(copy.counts()[yes]).toBe(1);
    expect(copy.rev).toBe(host.rev);
  });

  it("tracks connected participants by recent activity", () => {
    let now = 1_000_000;
    const host = new PollHost({ send: () => {}, now: () => now });
    host.handle({ t: "hello", id: pid(1) });
    host.handle({ t: "hello", id: pid(2) });
    now += 20_000;
    host.handle({ t: "ping", id: pid(1) });
    now += 10_000;
    expect([host.joined, host.connected]).toEqual([2, 1]);
  });
});

describe("past questions", () => {
  it("archives questions, keeps their votes private, and can make one live again", async () => {
    const { host, people } = await room(4);
    host.setText("First?");
    const first = host.question.id, [yes, no] = host.question.choices.map((c) => c.id);
    people.forEach((p, i) => p.poll.vote(i < 3 ? yes : no));
    await until(() => host.responses === 4);
    host.next();
    host.setText("Second?");
    await until(() => people.every((p) => p.poll.question.text === "Second?" && p.poll.mine === null));
    expect(host.history.map((q) => [q.text, q.open, q.joined])).toEqual([["First?", false, 4]]);
    expect(host.counts(host.find(first))).toEqual({ [yes]: 3, [no]: 1 });
    expect(host.snapshot(new Date(), first)).toMatchObject({ question_id: first, total: 4, joined: 4 });
    // Late votes for the archived question are ignored; history never reaches participants
    host.handle({ t: "vote", id: pid(0), qid: first, cid: no, n: Date.now() * 2 });
    expect(host.counts(host.find(first))[no]).toBe(1);
    expect(JSON.stringify(host.publicState())).not.toContain("First?");
    // A blank, unanswered question is not archived
    host.next();
    expect(host.history).toHaveLength(2);
    // Make "First?" live again: votes and each participant's own choice come back
    expect(host.next(first)).toBe(true);
    expect(host.question).toMatchObject({ id: first, open: true, revealed: false });
    expect(host.history.map((q) => q.text)).toEqual(["Second?"]);
    await until(() => people.every((p, i) => p.poll.question.id === first && p.poll.mine === (i < 3 ? yes : no)));
    people[3].poll.vote(yes);
    await until(() => host.counts()[yes] === 4);
    expect(host.next("qmissing")).toBe(false);
    // Survives a presenter reload
    const copy = new PollHost({ send: () => {} });
    copy.restore(host.serialize());
    expect(copy.history.map((q) => q.text)).toEqual(["Second?"]);
  });
});

describe("past questions from a TSV", () => {
  const header = [...HEADER, "choice_id", "joined"].join("\t");
  const tsv = [
    header,
    "2026-10-26T18:00:00+01:00\tLunch?\tYes\t3\t4\tqa\tc1\t5",
    "2026-10-26T18:00:00+01:00\tLunch?\tNo\t1\t4\tqa\tc2\t5",
    "2026-10-26T18:05:00+01:00\tDinner?\tSoon\t2\t2\tqb\tc1\t5",
  ].join("\n");

  it("reads saved questions with their counts", () => {
    const [a, b] = pastQuestions(tsv);
    expect(a).toMatchObject({ id: "qa", text: "Lunch?", total: 4, joined: 5, tally: { c1: 3, c2: 1 }, open: false });
    expect(a.choices).toEqual([{ id: "c1", text: "Yes" }, { id: "c2", text: "No" }]);
    expect(b.closedAt).toBeGreaterThan(a.closedAt);
    // Files without the optional columns still work
    const [plain] = pastQuestions(`${HEADER.join("\t")}\nT\tQ\tA\t2\t3\tqz\nT\tQ\tB\t1\t3\tqz\n`);
    expect(plain).toMatchObject({ total: 3, joined: 3, tally: { c0: 2, c1: 1 } });
  });

  it("adds them to history for viewing only, never replacing questions with live votes", () => {
    const sent = [];
    const host = new PollHost({ send: (to, data) => sent.push(to) });
    host.setText("Lunch?");
    const live = host.question.id;
    host.handle({ t: "vote", id: pid(1), qid: live, cid: host.question.choices[0].id, n: 1 });
    host.next();
    const saved = pastQuestions(tsv.replaceAll("\tqa\t", `\t${live}\t`));
    sent.length = 0;
    expect(host.importHistory(saved)).toBe(1); // only "Dinner?"; the live copy of "Lunch?" wins
    expect(sent).toEqual([]); // nothing goes to participants
    expect(host.history.map((q) => q.text)).toEqual(["Dinner?", "Lunch?"]);
    expect(host.counts(host.find(live))).toEqual({ [host.find(live).choices[0].id]: 1, [host.find(live).choices[1].id]: 0 });
    expect(host.responsesOf(host.find("qb"))).toBe(2);
    expect(host.snapshot(new Date(), "qb")).toMatchObject({ total: 2, joined: 5, choices: [{ id: "c1", text: "Soon", count: 2 }] });
    expect(host.next("qb")).toBe(false); // no individual votes to continue from
    expect(host.importHistory(saved)).toBe(1); // re-opening refreshes without duplicating
    expect(host.history).toHaveLength(2);
  });
});

describe("choice edits", () => {
  it("renames, adds and removes choices without disturbing other votes", async () => {
    const { host, people } = await room(6);
    const [yes, no] = host.question.choices.map((c) => c.id);
    people.forEach((p, i) => p.poll.vote(i < 4 ? yes : no));
    await until(() => host.responses === 6);
    host.renameChoice(yes, "Absolutely");
    await until(() => people.every((p) => p.poll.question.choices[0].text === "Absolutely"));
    expect(host.counts()[yes]).toBe(4);
    const maybe = host.addChoice("Maybe");
    expect(host.counts()[maybe.id]).toBe(0);
    await until(() => people.every((p) => p.poll.question.choices.length === 3));
    people[0].poll.vote(maybe.id);
    await until(() => host.counts()[maybe.id] === 1);
    // Remove "No": only its 2 voters must vote again
    expect(host.removeChoice(no).sort()).toEqual([pid(4), pid(5)]);
    expect(host.counts()).toEqual({ [yes]: 3, [maybe.id]: 1 });
    expect(host.responses).toBe(4);
    await until(() => people[4].poll.revote && people[5].poll.revote);
    expect(people[4].poll.mine).toBeNull();
    expect(people.slice(0, 4).every((p) => !p.poll.revote && p.poll.mine)).toBe(true);
    await until(() => people.every((p) => p.poll.responses === 4));
    people[4].poll.vote(yes);
    await until(() => host.responses === 5 && !people[4].poll.revote);
    // The last choice cannot be removed
    host.removeChoice(yes);
    expect(host.removeChoice(maybe.id)).toEqual([]);
    expect(host.question.choices.length).toBe(1);
  });

  it("asks for a new vote when the vote arrives after its choice was removed", () => {
    const sent = [];
    const host = new PollHost({ send: (to, data) => sent.push([to, data]) });
    const [yes, no] = host.question.choices.map((c) => c.id);
    host.removeChoice(no);
    host.handle({ t: "vote", id: pid(1), qid: host.question.id, cid: no, n: 1 });
    expect(host.responses).toBe(0);
    expect(sent.at(-1)).toEqual([pid(1), expect.objectContaining({ t: "you", cid: null, revote: true })]);
    host.handle({ t: "vote", id: pid(1), qid: host.question.id, cid: yes, n: 2 });
    expect(host.responses).toBe(1);
  });

  it("participants ignore delayed presenter messages", () => {
    const p = new PollParticipant({ id: pid(1), send: () => true });
    const q = (text) => ({ id: "q1", text, choices: [{ id: "c1", text: "Yes" }], open: true });
    p.receive({ t: "state", rev: 10, q: q("new"), responses: 1, joined: 1 });
    p.receive({ t: "state", rev: 9, q: q("old"), responses: 0, joined: 1 });
    expect(p.question.text).toBe("new");
  });
});

describe("TSV", () => {
  const snap = (over = {}) => ({
    at: new Date(2026, 9, 26, 18, 32, 10), question_id: "q1", question: "Lunch?", total: 3, joined: 5,
    choices: [{ id: "c1", text: "Yes", count: 2 }, { id: "c2", text: "No", count: 1 }], ...over,
  });

  it("formats timestamps with the local offset and file names", () => {
    expect(isoLocal(new Date(2026, 9, 26, 18, 32, 10))).toMatch(/^2026-10-26T18:32:10[+-]\d\d:\d\d$/);
    expect(fileName(new Date(2026, 0, 2, 3, 4, 5))).toBe("poll-2026-01-02-03-04-05.tsv");
  });

  it("creates, replaces and appends rows by question_id, keeping other rows", () => {
    let text = mergeTSV("", snap());
    expect(text.split("\n")[0]).toBe("timestamp\tquestion\tchoice\tcount\ttotal\tquestion_id\tchoice_id\tjoined");
    expect(text.trim().split("\n")).toHaveLength(3);
    text = mergeTSV(text, snap({ question_id: "q2", question: "Dinner?" }));
    text = mergeTSV(text, snap({ at: new Date(2026, 9, 26, 19, 0, 0), total: 4, choices: [{ id: "c1", text: "Yes", count: 4 }] }));
    const rows = text.trim().split("\n").map((l) => l.split("\t"));
    expect(rows.map((r) => r[5])).toEqual(["question_id", "q1", "q2", "q2"]); // q1 replaced in place
    expect(rows[1].slice(0, 5)).toEqual([expect.stringMatching(/^2026-10-26T19:00:00/), "Lunch?", "Yes", "4", "4"]);
  });

  it("preserves unrelated rows and extra columns of an existing file", () => {
    const existing = [[...HEADER, "notes"].join("\t"), "2026-01-01T00:00:00+00:00\tOld\tA\t1\t1\tq0\tkeep me", "", "2026-01-01T00:00:00+00:00\tStale\tA\t9\t9\tq1\tx"].join("\r\n");
    const text = mergeTSV(existing, snap());
    expect(text).toContain("q0\tkeep me");
    expect(text).not.toContain("Stale");
    expect(text.split("\n")[0]).toBe([...HEADER, "notes"].join("\t"));
    expect(text.split("\n")[3]).toMatch(/\tLunch\?\tYes\t2\t3\tq1\t$/);
  });

  it("validates the header and normalizes tabs and newlines", () => {
    expect(() => parseTSV("name\tvalue\nA\t1")).toThrow(/header/);
    expect(() => mergeTSV("timestamp,question\n", snap())).toThrow(/header/);
    expect(clean("a\tb\r\nc\n\nd ")).toBe("a b c d");
    const text = mergeTSV("", snap({ question: "Multi\nline\tquestion", choices: [{ id: "c1", text: "Y\te\ns", count: 1 }] }));
    expect(text.trim().split("\n")[1].split("\t")).toHaveLength(8);
    expect(text).toContain("Multi line question\tY e s\t");
  });
});

// Fake File System Access API: a folder of in-memory files
function fakeFS(initial = {}) {
  const files = new Map(Object.entries(initial));
  const writes = [];
  const handle = (name, { failWrite = false } = {}) => ({
    name,
    kind: "file",
    queryPermission: async () => "granted",
    getFile: async () => ({ name, text: async () => files.get(name) ?? "" }),
    createWritable: async () => {
      let buffer = null;
      return {
        write: async (data) => { if (failWrite) throw new Error("Disk full"); buffer = data; },
        close: async () => { files.set(name, buffer); writes.push(name); },
        abort: async () => {},
      };
    },
  });
  // The save dialog accepts the suggested name unless a test overrides it (e.g. a rename or an existing file)
  const win = {
    showSaveFilePicker: vi.fn(async ({ suggestedName }) => handle(suggestedName)),
    showOpenFilePicker: vi.fn(async () => [handle("existing.tsv")]),
  };
  return { files, writes, handle, win };
}
const abort = () => Object.assign(new Error("The user aborted a request."), { name: "AbortError" });

describe("results file", () => {
  const snap = (qid, count = 1, at = new Date(2026, 9, 26, 18, 32, 10)) => ({
    at, question_id: qid, question: `Question ${qid}`, total: count, joined: 9, choices: [{ id: "c1", text: "Yes", count }],
  });

  it("asks where to save once, suggesting a timestamped name, and keeps updating the same file", async () => {
    const fs = fakeFS();
    const file = new ResultsFile({ win: fs.win });
    expect(file.supported).toBe(true);
    await file.save(snap("q1", 1));
    await file.save(snap("q2", 2));
    await file.save(snap("q1", 7, new Date(2026, 9, 26, 20, 0, 0)));
    expect(fs.win.showSaveFilePicker).toHaveBeenCalledTimes(1);
    expect(fs.win.showSaveFilePicker.mock.calls[0][0].suggestedName).toBe("poll-2026-10-26-18-32-10.tsv");
    expect(file.name).toBe("poll-2026-10-26-18-32-10.tsv");
    const rows = fs.files.get(file.name).trim().split("\n").map((l) => l.split("\t"));
    expect(rows.map((r) => [r[5], r[3]])).toEqual([["question_id", "count"], ["q1", "7"], ["q2", "2"]]);
    expect(rows[1][0]).toMatch(/^2026-10-26T20:00:00/);
  });

  it("updates an existing TSV, re-reading it on every save", async () => {
    const header = [...HEADER, "choice_id", "joined"].join("\t");
    const fs = fakeFS({ "existing.tsv": `${header}\nT\tOld\tA\t1\t1\tq0\tc0\t1\n` });
    const file = new ResultsFile({ win: fs.win });
    await file.pickFile();
    await file.save(snap("q1"));
    fs.files.set("existing.tsv", fs.files.get("existing.tsv") + "T\tAdded elsewhere\tB\t2\t2\tqx\tc9\t2\n");
    await file.save(snap("q1", 3));
    const text = fs.files.get("existing.tsv");
    expect(text).toContain("\tOld\t");
    expect(text).toContain("Added elsewhere");
    expect(text.match(/\tq1\t/g)).toHaveLength(1);
    expect(fs.win.showSaveFilePicker).not.toHaveBeenCalled();
  });

  it("saves under a renamed file but never overwrites an existing file picked in the save dialog", async () => {
    const header = [...HEADER, "choice_id", "joined"].join("\t");
    const original = `${header}\nT\tOld\tA\t1\t1\tq0\tc0\t1\n`;
    const fs = fakeFS({ "old.tsv": original, "notes.tsv": "name\tscore\n" });
    const renamed = new ResultsFile({ win: fs.win });
    fs.win.showSaveFilePicker.mockImplementationOnce(async () => fs.handle("my results.tsv"));
    await renamed.save(snap("q1"));
    expect(fs.files.get("my results.tsv")).toContain("\tq1\t");
    // Existing files (poll TSVs or not) are left untouched, and the next save asks again
    const file = new ResultsFile({ win: fs.win });
    for (const name of ["old.tsv", "notes.tsv"]) {
      fs.win.showSaveFilePicker.mockImplementationOnce(async () => fs.handle(name));
      await expect(file.save(snap("q1"))).rejects.toThrow(/already exists.*Open TSV/);
      expect(file.handle).toBeNull();
    }
    expect(fs.files.get("old.tsv")).toBe(original);
    expect(fs.files.get("notes.tsv")).toBe("name\tscore\n");
    expect(fs.writes).toEqual(["my results.tsv"]);
    // Opening it explicitly allows updating it
    fs.win.showOpenFilePicker.mockImplementationOnce(async () => [fs.handle("old.tsv")]);
    await file.pickFile();
    await file.save(snap("q1"));
    expect(fs.files.get("old.tsv")).toMatch(/\tOld\t[\s\S]*\tq1\t/);
    // An empty existing file is safe to use
    fs.files.set("empty.tsv", "");
    const empty = new ResultsFile({ win: fs.win });
    fs.win.showSaveFilePicker.mockImplementationOnce(async () => fs.handle("empty.tsv"));
    await empty.save(snap("q1"));
    expect(fs.files.get("empty.tsv")).toContain("\tq1\t");
  });

  it("rejects an existing file with the wrong header without modifying it", async () => {
    const fs = fakeFS({ "existing.tsv": "name\tscore\nA\t1\n" });
    const file = new ResultsFile({ win: fs.win });
    await expect(file.pickFile()).rejects.toThrow(/header/);
    expect(file.handle).toBeNull();
    expect(fs.files.get("existing.tsv")).toBe("name\tscore\nA\t1\n");
    // Even if the file changes after it was picked, a bad header blocks the write
    fs.files.set("existing.tsv", `${HEADER.join("\t")}\n`);
    await file.pickFile();
    fs.files.set("existing.tsv", "broken\n");
    await expect(file.save(snap("q1"))).rejects.toThrow(/header/);
    expect(fs.files.get("existing.tsv")).toBe("broken\n");
  });

  it("surfaces cancelled pickers and failed writes without losing the file", async () => {
    const fs = fakeFS();
    fs.win.showSaveFilePicker.mockRejectedValueOnce(abort());
    const file = new ResultsFile({ win: fs.win });
    await expect(file.save(snap("q1"))).rejects.toMatchObject({ name: "AbortError" });
    await file.save(snap("q1"));
    const before = fs.files.get(file.name);
    file.handle = fs.handle(file.name, { failWrite: true });
    await expect(file.save(snap("q1", 5))).rejects.toThrow("Disk full");
    expect(fs.files.get(file.name)).toBe(before);
  });

  it("falls back to cumulative downloads when the browser cannot write files", async () => {
    const downloads = [], saved = [];
    const file = new ResultsFile({ win: {}, download: (name, text) => downloads.push({ name, text }), onFallback: (s) => saved.push(s) });
    expect(file.supported).toBe(false);
    await file.save(snap("q1"));
    await file.save(snap("q2"));
    await file.save(snap("q1", 4));
    expect(downloads).toHaveLength(3);
    expect(new Set(downloads.map((d) => d.name))).toEqual(new Set(["poll-2026-10-26-18-32-10.tsv"]));
    const last = downloads.at(-1).text.trim().split("\n").map((l) => l.split("\t"));
    expect(last.map((r) => [r[5], r[3]])).toEqual([["question_id", "count"], ["q1", "4"], ["q2", "1"]]);
    // Restored after a reload, and an imported TSV becomes the base
    const restored = new ResultsFile({ win: {}, fallback: saved.at(-1), download: (name, text) => downloads.push({ name, text }) });
    await restored.save(snap("q3"));
    expect(downloads.at(-1).text.match(/\tq\d\t/g)).toHaveLength(3);
    const imported = new ResultsFile({ win: {}, download: (name, text) => downloads.push({ name, text }) });
    await expect(imported.importFile({ name: "bad.tsv", text: async () => "x\ty\n" })).rejects.toThrow(/header/);
    await imported.importFile({ name: "mine.tsv", text: async () => `${HEADER.join("\t")}\nT\tKept\tA\t1\t1\tq0\n` });
    await imported.save(snap("q1"));
    expect(downloads.at(-1)).toMatchObject({ name: "mine.tsv", text: expect.stringContaining("\tKept\t") });
  });
});

// ---------- Full page (happy-dom) ----------
describe("page", () => {
  let browser, bus, setup;
  const pages = [];
  beforeAll(() => {
    browser = new Browser({
      console,
      settings: {
        fetch: {
          virtualServers: [{ url: "https://test/", directory: path.dirname(import.meta.dirname) }],
          interceptor: {
            // Runs before script.js executes: inject the in-memory bus, the presenter key and browser APIs
            beforeAsyncRequest: async ({ request, window }) => {
              if (request.url.endsWith("/poll/script.js")) {
                window.pollTransport = (options) => bus.client(options);
                setup?.(window);
              }
            },
          },
        },
      },
    });
  });
  afterEach(async () => { for (const p of pages.splice(0)) await p.close(); setup = null; });
  afterAll(() => browser.close());

  async function open(url, init) {
    setup = init;
    const page = browser.newPage();
    pages.push(page);
    await page.goto(url);
    // Not waitUntilComplete(): the page's intervals keep it busy forever. Wait for the app to mount instead.
    await until(() => page.mainFrame.document.getElementById("app") && !page.mainFrame.document.getElementById("loading"), 15_000);
    return { page, window: page.mainFrame.window, document: page.mainFrame.document };
  }
  async function presenter(init = () => {}) {
    bus = new LocalBus();
    const key = await presenterKey();
    const downloads = [];
    const p = await open(`https://test/poll/?room=${key.room}&present`, (window) => {
      window.localStorage.setItem(`poll:key:${key.room}`, JSON.stringify(key.jwk));
      window.URL.createObjectURL = (blob) => { downloads.push(blob); return "blob:test"; };
      window.URL.revokeObjectURL = () => {};
      // happy-dom ignores the download attribute and would navigate away
      const click = window.HTMLAnchorElement.prototype.click;
      window.HTMLAnchorElement.prototype.click = function () { if (!this.download) click.call(this); };
      init(window);
    });
    const $ = (id) => p.document.getElementById(id);
    await until(() => $("question"));
    return { ...p, $, key, downloads };
  }
  const type = (window, el, value) => { el.value = value; el.dispatchEvent(new window.Event("input", { bubbles: true })); };
  const press = (window, target, key) => target.dispatchEvent(new window.KeyboardEvent("keydown", { key, bubbles: true }));

  it("keeps presenter controls and credentials away from participants", async () => {
    const host = await presenter();
    const link = host.$("join-link").href;
    expect(link).toBe(`https://test/poll/?room=${host.key.room}`);
    expect(link).not.toContain("present");
    await until(() => host.$("qr").querySelector("svg") || host.$("qr").querySelector(".alert"));
    const phone = await open(`https://test/poll/?room=${host.key.room}`);
    const $p = (id) => phone.document.getElementById(id);
    await until(() => $p("p-choices")?.children.length === 2);
    for (const id of ["new", "save", "question", "reveal", "pick-file"]) expect($p(id)).toBeNull();
    expect(phone.window.localStorage.getItem(`poll:key:${host.key.room}`)).toBeNull();
    // Opening the presenter URL without the key falls back to the landing page
    const stranger = await open(`https://test/poll/?room=${host.key.room}&present`);
    await until(() => stranger.document.getElementById("create"));
    expect(stranger.document.getElementById("new")).toBeNull();
  }, 20_000);

  it("mirrors typing and choice edits to phones, counts votes and reveals results with R", async () => {
    const host = await presenter();
    const { window, $ } = host;
    const phone = await open(`https://test/poll/?room=${host.key.room}`);
    const $p = (id) => phone.document.getElementById(id);
    // Plus 9 simulated participants on the same bus
    const verify = verifier(host.key.room), t = topics(host.key.room);
    const others = Array.from({ length: 9 }, (_, i) => {
      let inbox = Promise.resolve();
      const client = bus.client({ onMessage: (_t, e) => { inbox = inbox.then(() => verify(e)).then((d) => d && poll.receive(d)); }, onLive: () => poll.hello() });
      const poll = new PollParticipant({ id: pid(i), send: (d) => client.publish(t.up, d) });
      client.subscribe(t.all); client.subscribe(t.client(pid(i))); client.connect();
      return poll;
    });
    await until(() => $("tally").textContent === "0 / 10");
    type(window, $("question"), "Coffee or tea?");
    await until(() => $p("p-question").textContent === "Coffee or tea?");
    const inputs = () => [...$("choices").querySelectorAll("input")];
    type(window, inputs()[0], "Coffee");
    type(window, inputs()[1], "Tea");
    $("add-choice").click();
    type(window, inputs()[2], "Neither");
    await until(() => [...$p("p-choices").children].map((b) => b.textContent).join() === "Coffee,Tea,Neither");
    // Vote from the phone page and the simulated phones
    $p("p-choices").children[1].click();
    await until(() => $p("p-mine").textContent === "Your vote: Tea");
    others.forEach((p, i) => p.vote(p.question.choices[i < 6 ? 0 : 2].id));
    await until(() => $("tally").textContent === "10 / 10");
    await until(() => $p("p-tally").textContent === "10 / 10");
    // Results stay hidden until R is pressed outside editable fields
    const bars = () => [...$("choices").querySelectorAll(".progress")];
    expect(bars().every((b) => b.hidden)).toBe(true);
    press(window, $("question"), "r");
    expect(bars().every((b) => b.hidden)).toBe(true);
    press(window, phone.document.body, "r"); // a phone pressing R changes nothing
    press(window, window.document.body, "r");
    expect(bars().every((b) => !b.hidden)).toBe(true);
    expect(bars().map((b) => b.textContent)).toEqual(["6 · 60%", "1 · 10%", "3 · 30%"]);
    // Phones never see the breakdown
    expect(phone.document.body.textContent).not.toContain("60%");
    press(window, window.document.body, "R");
    expect(bars().every((b) => b.hidden)).toBe(true);
    press(window, window.document.body, "r");
    // Removing "Neither" asks its 3 voters to vote again
    inputs()[2].closest(".choice-row").querySelector(".remove-choice").click();
    await until(() => $("tally").textContent === "7 / 10");
    expect(bars().map((b) => b.textContent)).toEqual(["6 · 86%", "1 · 14%"]);
    await until(() => others.filter((p) => p.revote).length === 3);
    expect($p("p-revote").hidden).toBe(true);
    // New saves the old question via the download fallback; the new question starts blank with results hidden
    $("new").click();
    await until(() => $("question").value === "" && host.downloads.length === 1);
    expect(bars().every((b) => b.hidden)).toBe(true);
    expect($("tally").textContent).toBe("0 / 10");
    const tsv = await host.downloads[0].text();
    expect(tsv.trim().split("\n").map((l) => l.split("\t").slice(1, 5))).toEqual([
      ["question", "choice", "count", "total"], ["Coffee or tea?", "Coffee", "6", "7"], ["Coffee or tea?", "Tea", "1", "7"],
    ]);
    await until(() => $p("p-question").textContent === "…" && $p("p-mine").textContent === "Tap a choice to vote");
    // A blank question is not saved on New
    $("new").click();
    await settle();
    expect(host.downloads).toHaveLength(1);
    // A second question: the cumulative download contains both
    type(window, $("question"), "Second?");
    $("save").click();
    await until(() => host.downloads.length === 2);
    expect((await host.downloads[1].text()).trim().split("\n")).toHaveLength(5);
  }, 30_000);

  it("shows past questions only to the presenter, on request", async () => {
    const host = await presenter();
    const { window, $ } = host;
    const phone = await open(`https://test/poll/?room=${host.key.room}`);
    const $p = (id) => phone.document.getElementById(id);
    await until(() => $("tally").textContent === "0 / 1");
    expect($("history-toggle").hidden).toBe(true);
    type(window, $("question"), "Pizza?");
    await until(() => $p("p-question").textContent === "Pizza?");
    $p("p-choices").children[0].click();
    await until(() => $("tally").textContent === "1 / 1");
    $("new").click();
    await until(() => $("question").value === "" && host.downloads.length === 1);
    type(window, $("question"), "Pasta?");
    await until(() => $p("p-question").textContent === "Pasta?");
    // The list stays closed until clicked
    expect($("history-toggle").hidden).toBe(false);
    expect($("history-count").textContent).toBe("1");
    expect($("history").hidden).toBe(true);
    $("history-toggle").click();
    const items = [...$("history").children].map((b) => b.textContent);
    expect(items[0]).toMatch(/^Pasta\?current · 0 \/ 1$/);
    expect(items[1]).toMatch(/^Pizza\?.* · 1 \/ 1$/);
    $("history").children[1].click();
    expect($("history").hidden).toBe(true);
    // The projector shows the past question with its results; phones are unaffected
    expect($("viewing").hidden).toBe(false);
    expect($("question").value).toBe("Pizza?");
    expect($("question").readOnly).toBe(true);
    const bars = () => [...$("choices").querySelectorAll(".progress")];
    expect(bars().map((b) => [b.hidden, b.textContent])).toEqual([[false, "1 · 100%"], [false, "0 · 0%"]]);
    press(window, window.document.body, "r");
    expect(bars().every((b) => b.hidden)).toBe(true);
    press(window, window.document.body, "r");
    await settle();
    expect($p("p-question").textContent).toBe("Pasta?");
    expect(phone.document.getElementById("history")).toBeNull();
    // Save re-saves the past question; Back returns to the current one, still editable with results hidden
    $("save").click();
    await until(() => host.downloads.length === 2);
    expect((await host.downloads[1].text()).match(/\tPizza\?\t/g)).toHaveLength(2);
    $("back-current").click();
    expect([$("question").value, $("question").readOnly, $("viewing").hidden]).toEqual(["Pasta?", false, true]);
    expect(bars().every((b) => b.hidden)).toBe(true);
    // Showing it to participants saves the current question and brings back the phone's vote
    $("history-toggle").click();
    $("history").children[1].click();
    $("show-past").click();
    await until(() => $p("p-question").textContent === "Pizza?" && $p("p-mine").textContent === "Your vote: Yes");
    expect($("viewing").hidden).toBe(true);
    expect($("question").readOnly).toBe(false);
    expect($("tally").textContent).toBe("1 / 1");
    expect(bars().every((b) => b.hidden)).toBe(true);
    expect((await host.downloads.at(-1).text())).toContain("\tPasta?\t");
    $p("p-choices").children[1].click();
    await until(() => $p("p-mine").textContent === "Your vote: No");
    expect($("history-count").textContent).toBe("1");
  }, 30_000);

  it("lists questions from an opened TSV under Past", async () => {
    const header = [...HEADER, "choice_id", "joined"].join("\t");
    const fs = fakeFS({ "existing.tsv": `${header}\n2026-10-26T18:00:00+01:00\tLunch?\tYes\t3\t4\tqa\tc1\t5\n2026-10-26T18:00:00+01:00\tLunch?\tNo\t1\t4\tqa\tc2\t5\n` });
    const host = await presenter((window) => Object.assign(window, fs.win));
    const { $ } = host;
    expect($("history-toggle").hidden).toBe(true);
    $("pick-file").click();
    await until(() => !$("history-toggle").hidden);
    expect($("file-status").textContent).toBe("Saving to existing.tsv");
    expect($("history-count").textContent).toBe("1");
    $("history-toggle").click();
    $("history").children[1].click();
    expect($("question").value).toBe("Lunch?");
    expect($("viewing-source").textContent).toBe("Saved question from the TSV");
    expect($("show-past").hidden).toBe(true);
    expect($("tally").textContent).toBe("4 / 5");
    expect([...$("choices").querySelectorAll(".progress")].map((b) => b.textContent)).toEqual(["3 · 75%", "1 · 25%"]);
    $("back-current").click();
    expect($("question").readOnly).toBe(false);
  }, 20_000);

  it("keeps the question and votes when saving on New fails, then retries", async () => {
    const fs = fakeFS();
    fs.win.showSaveFilePicker.mockRejectedValueOnce(abort()).mockRejectedValueOnce(new Error("Permission denied"));
    const host = await presenter((window) => Object.assign(window, fs.win));
    const { window, $ } = host;
    const phone = await open(`https://test/poll/?room=${host.key.room}`);
    const $p = (id) => phone.document.getElementById(id);
    await until(() => $("tally").textContent === "0 / 1");
    type(window, $("question"), "Ship it?");
    await until(() => $p("p-question").textContent === "Ship it?");
    $p("p-choices").children[0].click();
    await until(() => $("tally").textContent === "1 / 1");
    const qid = JSON.parse(window.localStorage.getItem(`poll:host:${host.key.room}`) ?? "{}").question?.id;
    $("new").click();
    await until(() => $("new-retry"));
    expect($("new-failed").textContent).toContain("cancelled");
    expect($("question").value).toBe("Ship it?");
    expect($("tally").textContent).toBe("1 / 1");
    expect($("voting-state").textContent).toBe("");
    // Voting reopened: the phone can still change its vote
    await until(() => !$p("p-choices").children[1].disabled);
    $p("p-choices").children[1].click();
    await until(() => $p("p-mine").textContent === "Your vote: No");
    $("new-retry").click();
    await until(() => $("new-failed").textContent.includes("Permission denied"));
    expect($("question").value).toBe("Ship it?");
    $("new-cancel").click();
    expect($("new-failed").children).toHaveLength(0);
    $("new").click();
    await until(() => $("question").value === "");
    const [name] = fs.files.keys();
    expect(name).toMatch(/^poll-\d{4}-\d\d-\d\d-\d\d-\d\d-\d\d\.tsv$/);
    const rows = fs.files.get(name).trim().split("\n").map((l) => l.split("\t"));
    expect(rows.slice(1).map((r) => [r[1], r[2], r[3], r[4]])).toEqual([["Ship it?", "Yes", "0", "1"], ["Ship it?", "No", "1", "1"]]);
    if (qid) expect(rows[1][5]).toBe(qid);
    expect($("file-status").textContent).toBe(`Saving to ${name}`);
    // Save updates the same file without asking again. The spinner shows only while a save is running.
    expect($("saving").hidden).toBe(true);
    type(window, $("question"), "Next?");
    $("save").click();
    expect($("saving").hidden).toBe(false);
    await until(() => fs.files.get(name).trim().split("\n").length === 5);
    await until(() => $("saving").hidden);
    $("save").click();
    await until(() => fs.writes.length === 3);
    expect(fs.files.get(name).trim().split("\n")).toHaveLength(5);
    expect(fs.win.showSaveFilePicker).toHaveBeenCalledTimes(3);
  }, 30_000);
});
