// Spaced repetition: an SM-2 style scheduler with four answers. Each word you study has a card
// { reps, lapses, ease, ivl, due, last } where ivl is the interval in days and due/last are day numbers.
// Pure functions: the caller passes "today" so the logic is easy to test.

export const GRADES = ["again", "hard", "good", "easy"];
export const START_EASE = 2.5;
export const MIN_EASE = 1.3;
export const MAX_EASE = 3.2;
export const MAX_IVL = 365;
/** A word counts as "learned" once it has come back after at least this many days. */
export const MATURE = 21;

/** Local calendar day as a whole number (days since 1970-01-01 in the user's time zone). */
export function dayNumber(date = new Date()) {
  return Math.floor((date.getTime() - date.getTimezoneOffset() * 60000) / 86400000);
}
/** "2026-11-09" for a day number. */
export function dayKey(day) {
  return new Date(day * 86400000).toISOString().slice(0, 10);
}

export const newCard = () => ({ reps: 0, lapses: 0, ease: START_EASE, ivl: 0, due: 0, last: null });
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

/** The card after an answer on `today`. "again" sends it back for tomorrow (and the session shows it once more). */
export function grade(card, answer, today) {
  if (!GRADES.includes(answer)) throw new Error(`unknown answer: ${answer}`);
  const c = { ...newCard(), ...card };
  let { ease, ivl, reps, lapses } = c;
  if (answer === "again") {
    lapses += reps > 0 ? 1 : 0;
    ease = clamp(ease - 0.2, MIN_EASE, MAX_EASE);
    ivl = 1;
    reps = 0;
  } else {
    if (answer === "hard") { ease -= 0.15; ivl = reps === 0 ? 1 : Math.max(ivl + 1, Math.round(ivl * 1.2)); }
    if (answer === "good") ivl = reps === 0 ? 2 : reps === 1 ? 4 : Math.max(ivl + 1, Math.round(ivl * ease));
    if (answer === "easy") { ease += 0.15; ivl = reps === 0 ? 4 : Math.max(ivl + 2, Math.round(ivl * ease * 1.3)); }
    ease = clamp(ease, MIN_EASE, MAX_EASE);
    ivl = clamp(ivl, 1, MAX_IVL);
    reps += 1;
  }
  return { reps, lapses, ease: Math.round(ease * 100) / 100, ivl, due: today + ivl, last: today };
}

/** When each answer would bring the card back, for the buttons: { again: 1, hard: 2, good: 6, easy: 12 } (days). */
export function preview(card, today) {
  return Object.fromEntries(GRADES.map((g) => [g, grade(card, g, today).ivl]));
}
export const isDue = (card, today) => !!card && card.last !== null && card.due <= today;
export const isMature = (card) => !!card && card.ivl >= MATURE;
/** "tomorrow", "in 6 days", "in 3 months". */
export function inWords(days) {
  if (days <= 1) return "tomorrow";
  if (days < 30) return `in ${days} days`;
  const m = Math.round(days / 30);
  return m < 12 ? `in ${m} month${m > 1 ? "s" : ""}` : "in a year";
}
