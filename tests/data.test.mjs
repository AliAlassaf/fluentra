// Content checks: every file in /data is well-formed, English-only and consistent, and the offline list is complete.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { findWord } from "../js/core/text.js";

const load = (name) => JSON.parse(readFileSync(new URL(`../data/${name}.json`, import.meta.url), "utf8"));
const words = load("words"), phrases = load("phrases"), grammar = load("grammar"), convs = load("conversations"), sounds = load("sounds");
const ARABIC = /[؀-ۿ]/;
const LEVELS = new Set(["B1", "B2", "C1", "C2"]);

test("the course has its full content", () => {
  assert.ok(words.length >= 3500, `words: ${words.length}`);
  assert.ok(phrases.length >= 500);
  assert.equal(grammar.length, 42);
  assert.ok(convs.length >= 100);
  assert.equal(sounds.sounds.length, 45);
});

test("no Arabic or other non-English text is left in any file", () => {
  for (const [name, d] of Object.entries({ words, phrases, grammar, convs, sounds })) {
    assert.ok(!ARABIC.test(JSON.stringify(d)), `${name} contains Arabic`);
  }
});

test("words: unique ids and words, a level, a meaning, and an example that uses the word", () => {
  const ids = new Set(), seen = new Set();
  let missing = 0;
  for (const w of words) {
    assert.ok(!ids.has(w.id), `duplicate id ${w.id}`); ids.add(w.id);
    assert.ok(!seen.has(w.word.toLowerCase()), `duplicate word ${w.word}`); seen.add(w.word.toLowerCase());
    assert.ok(LEVELS.has(w.level), w.word);
    assert.ok(w.def && w.ex && Array.isArray(w.syn), w.word);
    assert.ok(!w.syn.some((x) => x.toLowerCase() === w.word.toLowerCase()), `${w.word} lists itself as a synonym`);
    if (!findWord(w.ex, w.word)) missing++;
  }
  // irregular forms (ran, went, mice) aren't matched; they must stay rare
  assert.ok(missing / words.length < 0.05, `${missing} examples don't show their word`);
});

test("grammar quizzes have valid answers and an explanation", () => {
  for (const g of grammar) {
    assert.ok(g.title && g.why && g.examples.length, g.id);
    for (const q of g.quiz) {
      assert.ok(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length, `${g.id}: ${q.q}`);
      assert.ok(q.why, `${g.id}: ${q.q}`);
    }
  }
});

test("sound examples point at real letters, and every sound pair is defined", () => {
  const ids = new Set(sounds.contrasts.map((c) => c.id));
  for (const s of sounds.sounds) {
    for (const ex of s.examples) assert.ok(ex.i >= 0 && ex.j > ex.i && ex.j <= ex.word.length, `${s.sym} ${ex.word}`);
    for (const c of s.contrasts) assert.ok(ids.has(c), `${s.sym} → ${c}`);
  }
  for (const c of sounds.contrasts) assert.ok(c.pairs.length >= 4 && c.pairs.every((p) => p.length === 2), c.id);
});

test("conversations have at least four exchanges", () => {
  for (const c of convs) {
    assert.ok(c.lines.length >= 4, c.id);
    for (const l of c.lines) assert.ok(l.they && l.you, c.id);
  }
});

test("the offline cache lists only files that exist, including every page", () => {
  const sw = readFileSync(new URL("../sw.js", import.meta.url), "utf8");
  const list = [...sw.matchAll(/"([^"]+\.(?:js|css|json|html|svg|webmanifest))"/g)].map((m) => m[1]);
  for (const f of list) assert.ok(existsSync(new URL(`../${f}`, import.meta.url)), `missing ${f}`);
  for (const view of ["today", "study", "words", "sounds", "grammar", "speak", "progress", "about", "welcome"]) {
    assert.ok(list.includes(`js/views/${view}.js`), `sw.js doesn't cache ${view}`);
  }
});
