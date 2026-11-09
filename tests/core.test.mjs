import { test } from "node:test";
import assert from "node:assert/strict";
import { similarity, findWord, checkAnswer, hintOf, words } from "../js/core/text.js";
import { grade, preview, newCard, isDue, inWords, dayNumber, MAX_IVL } from "../js/core/srs.js";
import { courseOrder, plan, buildQueue, newLeft, RECALL_GAP } from "../js/core/session.js";
import { planRound, record, levelOf, accuracy } from "../js/core/ear.js";
import { emptyState, normalize, answerWord, streak, summary, activity } from "../js/core/progress.js";

test("words opens contractions and drops punctuation", () => {
  assert.deepEqual(words("I don't know, it's fine!"), ["i", "do", "not", "know", "it", "is", "fine"]);
});

test("similarity is 1 for the same sentence and forgiving about small slips", () => {
  assert.equal(similarity("I'm really tired today.", "i am really tired today"), 1);
  assert.ok(similarity("I'm realy tired today", "I'm really tired today.") > 0.9);
  assert.ok(similarity("something else entirely", "I'm really tired today.") < 0.2);
  assert.equal(similarity("", "anything"), 0);
});

test("findWord marks the word in any regular form, and phrases split by other words", () => {
  const hit = (s, w) => findWord(s, w)?.filter((x) => x.hit).map((x) => x.t);
  assert.deepEqual(hit("She realized it was late.", "realize"), ["realized"]);
  assert.deepEqual(hit("He tried twice.", "try"), ["tried"]);
  assert.deepEqual(hit("We stopped early.", "stop"), ["stopped"]);
  assert.deepEqual(hit("I finally figured it out.", "figure out"), ["figured", "out"]);
  assert.equal(findWord("She ran home.", "run"), null); // irregular: not found
});

test("checkAnswer accepts the word, its form in the example, and flags typos as close", () => {
  assert.equal(checkAnswer("Realize", "realize", "She realized it."), "right");
  assert.equal(checkAnswer("realized", "realize", "She realized it."), "right");
  assert.equal(checkAnswer("realise", "realize"), "close");
  assert.equal(checkAnswer("notice", "realize"), "wrong");
  assert.equal(checkAnswer("", "realize"), "wrong");
  assert.equal(hintOf("figure out"), "f_____ o__");
});

test("grade: intervals grow with good answers and reset with again", () => {
  let c = newCard();
  c = grade(c, "good", 100); assert.equal(c.ivl, 2); assert.equal(c.due, 102);
  c = grade(c, "good", 102); assert.equal(c.ivl, 4);
  c = grade(c, "good", 106); assert.equal(c.ivl, 10); // 4 × 2.5
  const lapsed = grade(c, "again", 112);
  assert.equal(lapsed.ivl, 1); assert.equal(lapsed.lapses, 1); assert.ok(lapsed.ease < c.ease);
  assert.equal(grade(newCard(), "easy", 0).ivl, 4);
  assert.ok(preview(newCard(), 0).hard < preview(newCard(), 0).good); // a new word: hard and good differ
  assert.throws(() => grade(c, "maybe", 0));
});

test("grade: hard < good < easy, and intervals are capped", () => {
  const p = preview({ ...newCard(), reps: 4, ivl: 20, ease: 2.5, due: 0, last: 0 }, 0);
  assert.ok(p.again < p.hard && p.hard < p.good && p.good < p.easy);
  assert.equal(preview({ ...newCard(), reps: 4, ivl: 200, ease: 3.2, due: 0, last: 0 }, 0).easy, MAX_IVL);
});

test("isDue, inWords, dayNumber", () => {
  assert.equal(isDue(null, 5), false);
  assert.equal(isDue({ due: 5, last: 1 }, 5), true);
  assert.equal(isDue({ due: 6, last: 1 }, 5), false);
  assert.equal(inWords(1), "tomorrow");
  assert.equal(inWords(6), "in 6 days");
  assert.equal(inWords(65), "in 2 months");
  assert.equal(typeof dayNumber(new Date()), "number");
});

const W = [
  { id: "a", level: "B1" }, { id: "b", level: "B2" }, { id: "c", level: "C1" }, { id: "d", level: "B1" }, { id: "e", level: "C2" },
];

test("courseOrder starts at your level, then goes up, then wraps to the lower levels", () => {
  assert.deepEqual(courseOrder(W, "B2").map((w) => w.id), ["b", "c", "e", "a", "d"]);
  assert.deepEqual(courseOrder(W, "B1").map((w) => w.id), ["a", "d", "b", "c", "e"]);
});

test("plan: due reviews plus new words up to today's limit", () => {
  const s = emptyState();
  s.profile = { level: "B1", daily: 2 };
  s.cards.a = { ...newCard(), reps: 1, ivl: 1, due: 10, last: 9 };
  const p = plan(s, W, 10);
  assert.deepEqual(p.reviews, ["a"]);
  assert.deepEqual(p.fresh, ["d", "b"]);
  s.log[10] = { new: 2 };
  assert.equal(newLeft(s, 10), 0);
});

test("buildQueue: every new word is learned, then recalled a few cards later", () => {
  const q = buildQueue({ reviews: ["r1", "r2", "r3", "r4", "r5", "r6"], fresh: ["n1", "n2"] });
  assert.equal(q.length, 10);
  for (const id of ["n1", "n2"]) {
    const learn = q.findIndex((s) => s.id === id && s.kind === "learn");
    const recall = q.findIndex((s) => s.id === id && s.kind === "recall");
    assert.ok(learn >= 0 && recall > learn);
    assert.ok(recall - learn >= RECALL_GAP || recall === q.length - 1);
  }
  assert.deepEqual(buildQueue({ reviews: [], fresh: ["x"] }).map((s) => s.kind), ["learn", "recall"]);
});

test("ear training: rounds, records and levels", () => {
  const contrasts = [{ id: "i-ee", pairs: [["ship", "sheep"], ["sit", "seat"]] }, { id: "p-b", pairs: [["pin", "bin"]] }];
  let seed = 1;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const round = planRound(contrasts, {}, { n: 12, rand });
  assert.equal(round.length, 12);
  for (let i = 1; i < round.length; i++) assert.notEqual(round[i].pair.join(), round[i - 1].pair.join());
  assert.ok(planRound(contrasts, {}, { only: "p-b", n: 3, rand }).every((q) => q.contrast === "p-b"));
  let r = null;
  for (const ok of [1, 1, 0, 1]) r = record(r, ok);
  assert.deepEqual(accuracy(r), { pct: 75, n: 4 });
  assert.equal(levelOf(r), "fair");
  assert.equal(levelOf(record(null, 1)), "new");
});

test("progress: answers fill the log, streak counts days in a row", () => {
  const s = emptyState();
  answerWord(s, "a", "good", 50, { isNew: true, seconds: 20 });
  answerWord(s, "a", "again", 51);
  answerWord(s, "b", "good", 52);
  assert.equal(s.log[50].new, 1);
  assert.equal(s.log[51].right, 0);
  assert.equal(streak(s, 52), 3);
  assert.equal(streak(s, 53), 3); // today not started yet
  assert.equal(streak(s, 54), 0);
  const sum = summary(s, [{ id: "a", level: "B1" }, { id: "b", level: "B1" }, { id: "c", level: "B2" }], 52);
  assert.equal(sum.studied, 2);
  assert.equal(sum.byLevel.B1.studied, 2);
  assert.equal(sum.accuracy30, 67);
  const grid = activity(s, 52, 4);
  assert.equal(grid.length, 4);
  assert.ok(grid.every((col) => col.length === 7));
});

test("normalize repairs a backup and rejects anything else", () => {
  const s = normalize({ cards: { ok: { due: 3, ivl: 1 }, bad: { due: "x" } }, profile: { level: "B2", daily: "15" }, junk: 1 });
  assert.deepEqual(Object.keys(s.cards), ["ok"]);
  assert.equal(s.profile.daily, 15);
  assert.equal(s.junk, undefined);
  assert.throws(() => normalize([1, 2]));
  assert.throws(() => normalize(null));
});
