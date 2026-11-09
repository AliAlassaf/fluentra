// Text helpers for English answers: word lists, a forgiving similarity score, finding a word inside its example
// sentence (in any of its forms) and checking a typed answer. Pure functions, no DOM.

const CONTRACT = [
  [/n't\b/g, " not"], [/\bi'm\b/g, "i am"], [/'re\b/g, " are"], [/'ve\b/g, " have"], [/'ll\b/g, " will"],
  [/\bit's\b/g, "it is"], [/\bthat's\b/g, "that is"], [/\bthere's\b/g, "there is"], [/\bwhat's\b/g, "what is"],
  [/\blet's\b/g, "let us"], [/\bgonna\b/g, "going to"], [/\bwanna\b/g, "want to"], [/\bgotta\b/g, "got to"],
  [/'d\b/g, " would"], [/'s\b/g, ""],
];

/** The words of an English text: lower case, no punctuation, contractions opened ("don't" → "do not"). */
export function words(text) {
  let s = String(text ?? "").toLowerCase().replace(/[’‘`´]/g, "'");
  for (const [re, to] of CONTRACT) s = s.replace(re, to);
  return s.replace(/[^a-z0-9\s]+/g, " ").split(/\s+/).filter(Boolean);
}

function lev(a, b) {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}
const wordSim = (a, b) => (a === b ? 1 : 1 - lev(a, b) / Math.max(a.length, b.length));

/** 0..1: how close something said is to the target sentence. Forgiving about case, punctuation, contractions and
 *  word order; a nearly-right word (a speech-recognizer slip) still counts for most of its value. */
export function similarity(said, target) {
  const a = words(said), b = words(target);
  if (!a.length || !b.length) return 0;
  const left = [...a];
  let got = 0;
  for (const w of b) {
    let bi = -1, bs = 0;
    left.forEach((x, i) => { const s = wordSim(x, w); if (s > bs) { bs = s; bi = i; } });
    if (bi >= 0 && bs >= 0.75) { got += bs; left.splice(bi, 1); }
  }
  const p = got / a.length, r = got / b.length;
  return p + r ? Math.round(((2 * p * r) / (p + r)) * 100) / 100 : 0;
}
/** The best score among a recognizer's alternatives. */
export const bestScore = (guesses, target) => Math.max(0, ...[].concat(guesses || []).map((g) => similarity(g, target)));

const PLACEHOLDER = new Set(["sb", "sth", "someone", "something", "somebody", "one's", "oneself", "+"]);
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** The forms a word takes in a sentence: realize → realizes, realized; try → tried; stop → stopped. */
function forms(t) {
  const e = esc(t), alts = [`${e}(?:s|es|ed|d|ing|er|ers|est|ly|'s|’s)?`];
  if (t.length > 2 && t.endsWith("e")) alts.push(`${esc(t.slice(0, -1))}(?:ing|ed|er|ers|est|es)`);
  if (/[^aeiou]y$/.test(t)) alts.push(`${esc(t.slice(0, -1))}i(?:es|ed|er|ers|est|ly|ness)`);
  if (/[^aeiou][aeiou][bdgklmnprt]$/.test(t)) alts.push(`${e}${t.at(-1)}(?:ed|ing|er|ers|est)`);
  return alts.join("|");
}

/** The sentence as pieces [{ t, hit }], with the word (any of its forms; a phrase's words up to 4 words apart, as in
 *  "figured it out") marked — or null when the word isn't in the sentence as written (an irregular form). */
export function findWord(sentence, word) {
  const s = String(sentence || "");
  const tokens = String(word || "").toLowerCase().split(/[\s\-/]+/)
    .map((t) => t.replace(/[^a-z'’]/g, "")).filter((t) => t && !PLACEHOLDER.has(t));
  if (!s || !tokens.length) return null;
  const res = tokens.map((t) => new RegExp(`^(?:${forms(t)})$`, "i"));
  const parts = s.split(/([A-Za-z][A-Za-z'’]*)/);
  const at = parts.map((_, i) => i).filter((i) => i % 2 === 1);
  for (let a = 0; a < at.length; a++) {
    if (!res[0].test(parts[at[a]])) continue;
    const hit = [at[a]];
    let k = a;
    for (let r = 1; r < res.length && hit.length === r; r++) {
      for (let j = k + 1; j <= k + 4 && j < at.length; j++) if (res[r].test(parts[at[j]])) { hit.push(at[j]); k = j; break; }
    }
    if (hit.length === res.length) return parts.map((t, i) => ({ t, hit: hit.includes(i) })).filter((x) => x.t);
  }
  return null;
}

const norm = (s) => String(s || "").toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z' -]+/g, "").replace(/[\s-]+/g, " ").trim();
/** How a typed answer compares to the word: "right" (the word, or the form used in the example), "close" (one or two
 *  letters off: a typo), or "wrong". */
export function checkAnswer(typed, word, sentence = "") {
  const t = norm(typed), w = norm(word);
  if (!t) return "wrong";
  const used = (findWord(sentence, word) || []).filter((x) => x.hit).map((x) => x.t).join(" ");
  const targets = [w, norm(used)].filter(Boolean);
  if (targets.includes(t)) return "right";
  const near = targets.some((x) => lev(t, x) <= (x.length > 6 ? 2 : 1));
  return near ? "close" : "wrong";
}

/** A first-letter hint for a word: "c_____" (spaces kept for phrases). */
export const hintOf = (word) => String(word).split(" ").map((w) => w[0] + "_".repeat(Math.max(0, w.length - 1))).join(" ");
