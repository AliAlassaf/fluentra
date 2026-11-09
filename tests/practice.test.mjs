import { test } from "node:test";
import assert from "node:assert/strict";
import { ITEMS, TENSES, isRight, planRound } from "../js/core/tenses.js";
import {
  respondPrompts, respondPlan, respondGrade, respondAnswer, driveQueue, checkExplanation, usesWord, usesPhrase, keyWords,
} from "../js/core/practice.js";
import { emptyState, normalize } from "../js/core/progress.js";
import { newCard } from "../js/core/srs.js";

let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

test("tense items: every tense is covered, ids are unique, every item has a gap and an explanation", () => {
  assert.equal(new Set(ITEMS.map((i) => i.id)).size, ITEMS.length);
  for (const t of Object.keys(TENSES)) assert.ok(ITEMS.filter((i) => i.tense === t).length >= 5, t);
  for (const i of ITEMS) { assert.ok(i.s.includes("___"), i.s); assert.ok(i.why && i.answers.length, i.s); }
});

test("tense answers accept contractions, full forms and a subject in front", () => {
  const call = ITEMS.find((i) => i.s.startsWith("I ___ you back"));
  for (const a of ["will call", "'ll call", "I'll call", "I will call", "  Will Call "]) assert.ok(isRight(call, a), a);
  assert.ok(!isRight(call, "called"));
  const tell = ITEMS.find((i) => i.s.startsWith("Don't worry"));
  assert.ok(isRight(tell, "won't tell") && isRight(tell, "will not tell"));
  const sushi = ITEMS.find((i) => i.s.includes("sushi"));
  assert.ok(isRight(sushi, "have eaten") && isRight(sushi, "Have you ever eaten"));
  assert.ok(!isRight(sushi, ""));
});

test("a tense round mixes tenses: never the same one twice in a row, no repeats", () => {
  for (let r = 0; r < 20; r++) {
    const round = planRound({}, { rand });
    assert.equal(round.length, 10);
    assert.equal(new Set(round.map((i) => i.id)).size, 10);
    for (let k = 1; k < round.length; k++) assert.notEqual(round[k].tense, round[k - 1].tense);
  }
});

const CONVS = [
  { id: "a", title: "A", lines: [{ they: "Hi", you: "Hello", pattern: "p" }, { they: "How are you?", you: "Good, thanks.", pattern: "q" }] },
  { id: "b", title: "B", lines: [{ they: "Yes?", you: "Can I help?", pattern: "r" }] },
];

test("respond: prompts from every line; new ones spread across conversations; due ones first", () => {
  assert.equal(respondPrompts(CONVS).length, 3);
  const s = emptyState();
  assert.deepEqual(respondPlan(s, CONVS, 10, { fresh: 2 }).fresh, ["a:0", "b:0"]);
  respondAnswer(s, "a:0", "good", 5); // due on day 7
  const p = respondPlan(s, CONVS, 10, { fresh: 5 });
  assert.deepEqual(p.due, ["a:0"]);
  assert.deepEqual(p.fresh, ["b:0", "a:1"]);
  assert.equal(respondGrade(0.95, false), "good");
  assert.equal(respondGrade(0.95, true), "hard");
  assert.equal(respondGrade(0.6, false), "hard");
  assert.equal(respondGrade(0.2, false), "again");
});

test("drive: due words first, then fuzzy ones seen 2+ days ago, never words seen today", () => {
  const s = emptyState();
  s.cards.today = { ...newCard(), reps: 1, ivl: 2, due: 12, last: 10 };
  s.cards.yesterday = { ...newCard(), reps: 1, ivl: 2, due: 11, last: 9 };
  s.cards.due = { ...newCard(), reps: 2, ivl: 4, due: 8, last: 4 };
  s.cards.fuzzy = { ...newCard(), reps: 1, ivl: 4, due: 13, last: 7 };
  s.cards.old = { ...newCard(), reps: 6, ivl: 90, due: 80, last: 2 };
  assert.deepEqual(driveQueue(s, 10), ["due"].concat(["fuzzy"]));
});

test("explain: flags using the word itself, long words and too-short explanations", () => {
  const circ = checkExplanation("Eventually means it happens eventually after some time passes", "eventually");
  assert.ok(circ.circular && !circ.ok);
  const good = checkExplanation("It means something happens in the end, after you wait a long time for it", "eventually");
  assert.ok(good.ok, JSON.stringify(good));
  const long = checkExplanation("A considerable organizational transformation that is unbelievably complicated for everybody", "change");
  assert.ok(long.long.length >= 2 && !long.ok);
  assert.ok(checkExplanation("in the end", "eventually").tooShort);
});

test("use it: your sentence uses the word or the phrase", () => {
  assert.ok(usesWord("I finally realized my mistake at work.", "realize"));
  assert.ok(usesWord("She ran to the store before it closed.", "run"));
  assert.ok(!usesWord("I like coffee.", "realize"));
  assert.deepEqual(keyWords("be + used to + -ing"), ["used", "to"]);
  assert.ok(usesPhrase("I'm used to waking up early.", "be + used to + -ing"));
  assert.ok(usesPhrase("Honestly, it's not rocket science.", "It's not rocket science"));
  assert.ok(!usesPhrase("It's easy.", "It's not rocket science"));
});

test("new progress fields survive a backup round trip and bad entries are dropped", () => {
  const s = normalize({ respond: { "a:0": { due: 3, ivl: 1 }, bad: {} }, mine: { w: { text: "Hi there" }, x: 5 }, gaps: { "word:w": { at: 1 } } });
  assert.deepEqual(Object.keys(s.respond), ["a:0"]);
  assert.deepEqual(Object.keys(s.mine), ["w"]);
  assert.ok(s.gaps["word:w"]);
});
