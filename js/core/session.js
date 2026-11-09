// Today's study session: the words that are due, then new words in course order, mixed so that each new word comes
// back once more as a recall test a few cards after you first see it. Pure functions.
import { isDue } from "./srs.js";

export const LEVELS = ["B1", "B2", "C1", "C2"];
export const LEVEL_NAMES = { B1: "Intermediate", B2: "Upper intermediate", C1: "Advanced", C2: "Near native" };
export const DAILY_CHOICES = [5, 10, 15, 20];
export const REVIEW_CAP = 120;
/** "Learn 5 more words" after today's plan is done. */
export const EXTRA = 5;
/** A new word returns for recall after this many other cards. */
export const RECALL_GAP = 3;

/** The course order: your starting level first, then the levels above it, then the ones below. */
export function courseOrder(words, start = "B1") {
  const i = Math.max(0, LEVELS.indexOf(start));
  const order = [...LEVELS.slice(i), ...LEVELS.slice(0, i)];
  return order.flatMap((lv) => words.filter((w) => w.level === lv));
}

/** How many new words are still allowed today. */
export function newLeft(state, today) {
  const done = state.log?.[today]?.new || 0;
  return Math.max(0, (state.profile?.daily ?? 10) - done);
}

/** The cards due today, most overdue first (then the shortest interval: the shakiest). */
export function dueCards(state, today) {
  return Object.entries(state.cards || {})
    .filter(([, c]) => isDue(c, today))
    .sort(([, a], [, b]) => a.due - b.due || a.ivl - b.ivl)
    .map(([id]) => id);
}

/** The next new words in course order (never studied before). */
export function nextNew(state, words, n) {
  const have = state.cards || {};
  const out = [];
  for (const w of courseOrder(words, state.profile?.level)) {
    if (out.length >= n) break;
    if (!have[w.id]) out.push(w.id);
  }
  return out;
}

/** The plan for today: { reviews, fresh, minutes }. About 8 seconds a review and 25 for a new word. */
export function plan(state, words, today) {
  const reviews = dueCards(state, today).slice(0, REVIEW_CAP);
  const fresh = nextNew(state, words, newLeft(state, today));
  const minutes = Math.max(1, Math.round((reviews.length * 8 + fresh.length * 25) / 60));
  return { reviews, fresh, minutes };
}

/** The queue of steps: { id, kind: "review" | "learn" | "recall" }. Each new word is "learn" (see it in full), then
 *  "recall" RECALL_GAP steps later. Reviews and new words are interleaved so a session never ends with a block of
 *  only new words. */
export function buildQueue({ reviews, fresh }) {
  const q = [];
  const pending = []; // [stepsLeft, id]
  const r = [...reviews], f = [...fresh];
  const ratio = f.length ? Math.max(1, Math.round(r.length / f.length)) : Infinity;
  let sinceNew = 0;
  const tick = () => {
    for (const p of pending) p[0] -= 1;
    while (pending.length && pending[0][0] <= 0) q.push({ id: pending.shift()[1], kind: "recall" });
  };
  while (r.length || f.length) {
    if (f.length && (sinceNew >= ratio || !r.length)) {
      const id = f.shift();
      q.push({ id, kind: "learn" });
      pending.push([RECALL_GAP + 1, id]);
      sinceNew = 0;
    } else {
      q.push({ id: r.shift(), kind: "review" });
      sinceNew += 1;
    }
    tick();
  }
  while (pending.length) q.push({ id: pending.shift()[1], kind: "recall" });
  return q;
}
