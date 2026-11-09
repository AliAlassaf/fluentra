// Your progress: the saved state, what changes after an answer, and the numbers on the Progress page.
// Pure functions on a plain state object; js/store.js saves it in the browser.
import { grade, isMature } from "./srs.js";

export const VERSION = 1;

export function emptyState() {
  return {
    version: VERSION,
    profile: null, // { level, daily, since }
    cards: {},     // wordId → srs card
    log: {},       // day → { reviews, right, new, minutes }
    ear: {},       // contrastId → { n, last }
    grammar: {},   // pointId → { best, of }
    speak: {},     // conversationId → { best, at }
    settings: { rate: 0.95, voice: "" },
  };
}

/** A state from saved or imported JSON: unknown keys are dropped and missing ones filled, so an old or hand-edited
 *  file can't break the app. Throws on something that isn't a Fluentra backup at all. */
export function normalize(raw) {
  const base = emptyState();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("This file isn't a Fluentra backup.");
  const obj = (x) => (x && typeof x === "object" && !Array.isArray(x) ? x : {});
  const out = { ...base };
  for (const k of ["cards", "log", "ear", "grammar", "speak"]) out[k] = obj(raw[k]);
  out.settings = { ...base.settings, ...obj(raw.settings) };
  const p = raw.profile;
  out.profile = p && typeof p === "object" && p.level ? { level: String(p.level), daily: Number(p.daily) || 10, since: Number(p.since) || 0 } : null;
  for (const [id, c] of Object.entries(out.cards)) {
    if (!c || typeof c.due !== "number" || typeof c.ivl !== "number") delete out.cards[id];
  }
  return out;
}

const dayLog = (state, day) => (state.log[day] ??= { reviews: 0, right: 0, new: 0, seconds: 0 });

/** The state after answering a word (`isNew` = first time you study it). */
export function answerWord(state, id, answer, today, { isNew = false, seconds = 0 } = {}) {
  const card = grade(state.cards[id] || {}, answer, today);
  const log = dayLog(state, today);
  log.reviews += 1;
  if (answer !== "again") log.right += 1;
  if (isNew) log.new += 1;
  log.seconds += Math.max(0, Math.min(120, Math.round(seconds)));
  state.cards[id] = card;
  return card;
}

/** Add study time to today (ear training, grammar, speaking). */
export function addTime(state, today, seconds) {
  dayLog(state, today).seconds += Math.max(0, Math.round(seconds));
}

const active = (log) => !!log && (log.reviews > 0 || log.seconds >= 60);

/** Days in a row with some study, counting back from today (or yesterday, if today hasn't started yet). */
export function streak(state, today) {
  let d = active(state.log[today]) ? today : today - 1, n = 0;
  while (active(state.log[d])) { n++; d--; }
  return n;
}

/** The numbers for the Progress page. */
export function summary(state, words, today) {
  const cards = Object.entries(state.cards);
  const byLevel = {};
  for (const w of words) {
    const b = (byLevel[w.level] ??= { total: 0, studied: 0, learned: 0 });
    b.total++;
    const c = state.cards[w.id];
    if (c) { b.studied++; if (isMature(c)) b.learned++; }
  }
  let reviews = 0, right = 0, seconds = 0;
  for (let d = today - 29; d <= today; d++) {
    const l = state.log[d];
    if (l) { reviews += l.reviews; right += l.right; seconds += l.seconds; }
  }
  return {
    studied: cards.length,
    learned: cards.filter(([, c]) => isMature(c)).length,
    streak: streak(state, today),
    accuracy30: reviews ? Math.round((100 * right) / reviews) : null,
    minutes30: Math.round(seconds / 60),
    byLevel,
  };
}

/** The last `weeks` weeks as columns of 7 days (Monday first), each { day, count } — for the activity grid. */
export function activity(state, today, weeks = 18) {
  const dow = (new Date(today * 86400000).getUTCDay() + 6) % 7; // Monday = 0
  const start = today - dow - (weeks - 1) * 7;
  return Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const day = start + w * 7 + d;
      const l = state.log[day];
      return { day, count: day > today ? null : l ? l.reviews + Math.round(l.seconds / 60) : 0 };
    }));
}
