// Practice that turns knowing into using. Pure functions for:
//   respond   — produce a reply from memory to a real situation (recall, not rereading), on its own review schedule
//   drive     — hands-free recall of words that have had time to get fuzzy ("tactical forgetting")
//   explain   — the Feynman check: explain simply; using the word itself or long words shows a gap
//   use       — does your own sentence (or idiom line) really use the word or phrase
import { isDue, grade } from "./srs.js";
import { findWord, words as wordsOf } from "./text.js";

// ───── respond ─────
export const RESPOND_NEW = 5;
export const respondId = (convId, n) => `${convId}:${n}`;

/** Every reply in the conversations as a prompt: { id, title, they, you, pattern }. */
export function respondPrompts(convs) {
  return convs.flatMap((c) => c.lines.map((l, n) => ({ id: respondId(c.id, n), title: c.title, they: l.they, you: l.you, pattern: l.pattern })));
}
/** Today's prompts: the ones due (oldest first), then up to `fresh` new ones, taken one per conversation in turn so
 *  you meet many situations rather than one conversation line by line. */
export function respondPlan(state, convs, today, { fresh = RESPOND_NEW } = {}) {
  const have = state.respond || {};
  const due = Object.entries(have).filter(([, c]) => isDue(c, today)).sort(([, a], [, b]) => a.due - b.due).map(([id]) => id);
  const fresh_ = [];
  for (let n = 0; fresh_.length < fresh && n < 20; n++) {
    for (const c of convs) {
      if (fresh_.length >= fresh) break;
      const id = respondId(c.id, n);
      if (n < c.lines.length && !have[id]) fresh_.push(id);
    }
  }
  return { due, fresh: fresh_ };
}
/** Your answer, from how close it was (0..1) and whether you looked at the hint, as an SRS answer. */
export function respondGrade(score, hinted) {
  if (score >= 0.85) return hinted ? "hard" : "good";
  if (score >= 0.55) return "hard";
  return "again";
}
export function respondAnswer(state, id, answer, today) {
  state.respond ??= {};
  state.respond[id] = grade(state.respond[id] || {}, answer, today);
  return state.respond[id];
}

// ───── drive (tactical forgetting) ─────
export const FUZZY_AFTER = 2; // days since you last saw a word before it's worth pulling back
/** Words for a hands-free round: the ones due first, then the "fuzzy" ones (seen at least FUZZY_AFTER days ago, still
 *  young), the oldest first. Never a word you saw today: it's still fresh, so recalling it trains nothing. */
export function driveQueue(state, today, n = 20) {
  const cards = Object.entries(state.cards || {}).filter(([, c]) => c.last !== null && c.last <= today - 1);
  const due = cards.filter(([, c]) => isDue(c, today)).sort(([, a], [, b]) => a.due - b.due);
  const fuzzy = cards.filter(([, c]) => !isDue(c, today) && c.last <= today - FUZZY_AFTER && c.ivl <= 30)
    .sort(([, a], [, b]) => a.last - b.last);
  return [...due, ...fuzzy].slice(0, n).map(([id]) => id);
}
export const THINK_CHOICES = [4, 7, 10]; // seconds of silence to search your memory

// ───── explain (Feynman) ─────
const syllables = (w) => (w.toLowerCase().replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "").replace(/^y/, "").match(/[aeiouy]{1,2}/g) || []).length;
const SIMPLE_LONG = new Set(["everything", "everyone", "everybody", "anything", "anybody", "something", "somebody", "usually", "actually", "really", "another", "every", "understand", "important", "different", "family", "together", "remember"]);
/** Feedback on a simple explanation of `target`: { count, circular, long: [words], tooShort, ok }. */
export function checkExplanation(text, target) {
  const ws = wordsOf(text);
  const circular = !!findWord(text, target);
  const long = [...new Set(ws.filter((w) => w.length > 7 && syllables(w) >= 4 && !SIMPLE_LONG.has(w)))];
  const tooShort = ws.length < 8;
  return { count: ws.length, circular, long, tooShort, ok: !circular && !tooShort && long.length <= 1 };
}

// ───── use it ─────
/** Does your sentence use the word, in any of its forms (realized, tried, ran)? */
export const usesWord = (sentence, word) => !!findWord(sentence, word);
/** The fixed words of a phrase pattern: "be + used to + -ing" → ["used", "to"]; idioms are taken whole. */
export function keyWords(pattern) {
  const SKIP = new Set(["sb", "sth", "someone", "something", "noun", "verb", "ing", "be", "is", "adj", "adjective", "place", "time", "name", "person", "x", "y", "field", "thing", "it"]);
  return wordsOf(String(pattern).replace(/\(.*?\)/g, " ").replace(/\+/g, " ")).filter((w) => !SKIP.has(w));
}
/** Does your line use a phrase: at least 70% of its fixed words, in any order? */
export function usesPhrase(sentence, pattern) {
  const keys = keyWords(pattern);
  if (!keys.length) return true;
  const said = new Set(wordsOf(sentence));
  return keys.filter((k) => said.has(k)).length / keys.length >= 0.7;
}
