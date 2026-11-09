// Ear training with minimal pairs (ship / sheep): rounds of words to tell apart, and your accuracy per sound pair.
// Pure functions; the random source is passed in so rounds are testable.

export const ROUND = 12;
const KEEP = 20; // the last answers per pair that make its score
const SURE = 4;  // fewer answers than this: not rated yet

/** { pct, n } from a record { n, last: "1101…" }, or null if never played. */
export function accuracy(rec) {
  if (!rec?.n || !rec.last) return null;
  const last = String(rec.last);
  return { pct: Math.round((100 * [...last].filter((x) => x === "1").length) / last.length), n: rec.n };
}
/** A record after one answer. */
export function record(rec, ok) {
  const r = rec || { n: 0, last: "" };
  return { n: r.n + 1, last: (r.last + (ok ? "1" : "0")).slice(-KEEP) };
}
/** "new", "weak" (under 70%), "fair" (under 90%) or "strong". */
export function levelOf(rec) {
  const a = accuracy(rec);
  if (!a || a.n < SURE) return "new";
  return a.pct < 70 ? "weak" : a.pct < 90 ? "fair" : "strong";
}

/** A round of n questions { contrast, pair: [a, b], answer: 0 | 1 }. With `only`, from that sound pair; otherwise
 *  mixed, your weakest pairs twice as often. Never the same word pair twice in a row. */
export function planRound(contrasts, progress = {}, { only = null, n = ROUND, rand = Math.random } = {}) {
  const pool = only ? contrasts.filter((c) => c.id === only) : contrasts;
  if (!pool.length) return [];
  const weight = (c) => (["weak", "new"].includes(levelOf(progress[c.id])) ? 2 : 1);
  const bag = pool.flatMap((c) => Array(weight(c)).fill(c));
  const out = [];
  let last = "";
  for (let i = 0, guard = 0; out.length < n && guard < n * 20; guard++) {
    const c = bag[Math.floor(rand() * bag.length)];
    const pair = c.pairs[Math.floor(rand() * c.pairs.length)];
    const key = pair.join("/");
    if (key === last && pool.flatMap((x) => x.pairs).length > 1) continue;
    out.push({ contrast: c.id, pair, answer: rand() < 0.5 ? 0 : 1 });
    last = key;
    i++;
  }
  return out;
}
