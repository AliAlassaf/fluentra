// Tense mix: fill in the verb in the right tense, with past, present and future shuffled together. Mixing them
// (interleaving) trains the real skill of speaking: choosing the tense on the spot, not applying one rule over and over.
// Pure functions.
import { accuracy, record, levelOf } from "./ear.js";

export const TENSES = {
  "past": "Past simple",
  "past-cont": "Past continuous",
  "present": "Present simple",
  "present-cont": "Present continuous",
  "perfect": "Present perfect",
  "future": "Future",
};

// [sentence with ___, base verb, accepted answers separated by "|", tense, why]
const RAW = [
  ["Yesterday I ___ to the gym after work.", "go", "went", "past", "\"Yesterday\" is a finished time, so use the past simple."],
  ["I usually ___ coffee in the morning.", "drink", "drink", "present", "\"Usually\" means a habit: present simple."],
  ["Look! It ___ outside.", "snow", "is snowing|'s snowing", "present-cont", "\"Look!\" means it's happening right now: present continuous."],
  ["I ___ you back in five minutes, I promise.", "call", "will call|'ll call", "future", "A promise about the future: will + verb."],
  ["She ___ in New York since 2019.", "live", "has lived|'s lived|has been living|'s been living", "perfect", "\"Since 2019\" connects the past to now: present perfect."],
  ["I ___ dinner when you called.", "cook", "was cooking", "past-cont", "An action in progress when something else happened: past continuous."],
  ["We ___ a new car last month.", "buy", "bought", "past", "\"Last month\" is finished: past simple."],
  ["He ___ to work by bus every day.", "go", "goes", "present", "A routine (\"every day\") with he/she/it: verb + s."],
  ["Don't call now, they ___ a meeting.", "have", "are having|'re having", "present-cont", "Happening at this moment: present continuous."],
  ["I think it ___ tomorrow.", "rain", "will rain|'ll rain|is going to rain|'s going to rain", "future", "A prediction about tomorrow: will or going to."],
  ["___ you ever ___ sushi?", "eat", "have eaten|have you ever eaten", "perfect", "\"Ever\" asks about your life experience: present perfect. Answer as have + eaten."],
  ["What ___ you ___ at 9 last night?", "do", "were doing|were you doing", "past-cont", "An action in progress at a past time: past continuous. Answer as were + doing."],
  ["I ___ my keys. I can't find them anywhere.", "lose", "have lost|'ve lost", "perfect", "A past action with a result now (no keys): present perfect."],
  ["She ___ the email this morning.", "send", "sent", "past", "\"This morning\" is over when you say it later in the day: past simple."],
  ["Water ___ at 100 degrees Celsius.", "boil", "boils", "present", "A general fact: present simple."],
  ["I can't talk right now, I ___.", "drive", "am driving|'m driving", "present-cont", "Right now: present continuous."],
  ["We ___ to Chicago next week. We already booked the tickets.", "fly", "are flying|'re flying|are going to fly|'re going to fly", "future", "A plan that's already arranged: present continuous or going to."],
  ["They ___ married for ten years.", "be", "have been|'ve been", "perfect", "From ten years ago until now: present perfect."],
  ["While I ___, my phone rang.", "shower", "was showering", "past-cont", "The longer action that was interrupted: past continuous."],
  ["He ___ his job two years ago.", "quit", "quit", "past", "\"Two years ago\" is a finished time: past simple. Quit stays quit."],
  ["My sister ___ three languages.", "speak", "speaks", "present", "A fact about someone now: present simple, with s."],
  ["Why ___ you ___? What happened?", "cry", "are crying|are you crying", "present-cont", "Happening now, as you see it: present continuous. Answer as are + crying."],
  ["Wait, I ___ you with that box.", "help", "will help|'ll help", "future", "Offering help at the moment you decide: will."],
  ["I ___ that movie three times.", "see", "have seen|'ve seen", "perfect", "How many times in your life up to now: present perfect."],
  ["It ___ when we left the restaurant.", "rain", "was raining", "past-cont", "The background situation in the past: past continuous."],
  ["I ___ my mom last night.", "call", "called", "past", "\"Last night\" is finished: past simple."],
  ["The store ___ at 9 a.m. on weekdays.", "open", "opens", "present", "A schedule: present simple."],
  ["Prices ___ every month this year.", "go up", "are going up|'re going up|have gone up|'ve gone up|have been going up|'ve been going up", "present-cont", "A trend still changing now: present continuous (or present perfect)."],
  ["Be careful, you ___!", "fall", "are going to fall|'re going to fall|will fall|'ll fall", "future", "You can see it's about to happen: going to."],
  ["She ___ the report yet.", "not finish", "hasn't finished|has not finished", "perfect", "\"Yet\" with a negative: present perfect, hasn't + finished."],
  ["I ___ TV when the power went out.", "watch", "was watching", "past-cont", "An action in progress when something interrupted it: past continuous."],
  ["We ___ dinner at a great place on Friday.", "have", "had", "past", "A finished event last Friday: past simple."],
  ["How often ___ you ___ out?", "work", "do work|do you work", "present", "\"How often\" asks about habits: present simple, do + work."],
  ["Shh, the baby ___.", "sleep", "is sleeping|'s sleeping", "present-cont", "Right now: present continuous."],
  ["Next year I ___ 30.", "turn", "will turn|'ll turn|am going to turn|'m going to turn|turn", "future", "A future fact: will (or going to)."],
  ["I ___ here before. This is my first time.", "never be", "have never been|'ve never been", "perfect", "Life experience up to now, with never: present perfect."],
  ["At midnight we ___ still ___.", "work", "were working|were still working", "past-cont", "In progress at a past moment: past continuous. Answer as were + working."],
  ["She ___ the job interview last Tuesday.", "pass", "passed", "past", "\"Last Tuesday\" is finished: past simple."],
  ["I ___ meat, I'm a vegetarian.", "not eat", "don't eat|do not eat", "present", "A permanent habit: present simple negative."],
  ["Hurry up! Everyone ___ for us.", "wait", "is waiting|'s waiting", "present-cont", "Happening now: present continuous. Everyone is singular."],
  ["Don't worry, I ___ anyone.", "not tell", "won't tell|will not tell", "future", "A promise about the future: won't + verb."],
  ["We ___ each other since high school.", "know", "have known|'ve known", "perfect", "From high school until now, with a state verb: present perfect."],
  ["When I got home, my kids ___ games.", "play", "were playing", "past-cont", "What was in progress when you arrived: past continuous."],
  ["I ___ my phone in a taxi last weekend.", "leave", "left", "past", "A finished event: past simple. Leave becomes left."],
  ["He always ___ late to meetings.", "come", "comes", "present", "A repeated habit with \"always\": present simple."],
  ["This week I ___ from home.", "work", "am working|'m working", "present-cont", "A temporary situation around now: present continuous."],
  ["I'm tired. I think I ___ to bed early tonight.", "go", "will go|'ll go|am going to go|'m going to go", "future", "A decision about later today: will or going to."],
  ["Have you finished? No, I ___ just ___.", "start", "have started|'ve started|have just started|'ve just started", "perfect", "\"Just\" for something that happened a moment ago: present perfect."],
];

export const ITEMS = RAW.map(([s, verb, a, tense, why], i) => ({ id: `t${i + 1}`, s, verb, answers: a.split("|"), tense, why }));
export const ROUND = 10;

const norm = (x) => String(x || "").toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z' ]+/g, " ").replace(/\s+/g, " ").trim();
/** Expand contractions so "I'll call", "will call" and "I will call" all match. */
const open = (x) => norm(x).replace(/\b(?:i|you|he|she|it|we|they|everyone)'(ll|re|s|ve|m)\b/g, (_, c) => ({ ll: "will", re: "are", s: "is", ve: "have", m: "am" }[c]))
  .replace(/'ll\b/g, " will").replace(/'re\b/g, " are").replace(/'ve\b/g, " have").replace(/'m\b/g, " am").replace(/'s\b/g, " is")
  .replace(/n't\b/g, " not").replace(/\bwo not\b/g, "will not").replace(/\bca not\b/g, "can not").replace(/\s+/g, " ").trim();
const PRONOUN = /^(?:i|you|he|she|it|we|they|everyone)\s+/;

/** Is a typed verb right? Accepts contractions or not, and a subject typed in front ("I'll call"). */
export function isRight(item, typed) {
  const t = open(typed).replace(PRONOUN, "");
  if (!t) return false;
  return item.answers.some((a) => open(a).replace(PRONOUN, "") === t);
}

/** A round of n items with the tenses shuffled together; the same tense never twice in a row when avoidable.
 *  Your weakest tenses come up more often. */
export function planRound(progress = {}, { n = ROUND, rand = Math.random } = {}) {
  const weight = (it) => (["weak", "new"].includes(levelOf(progress[it.tense])) ? 2 : 1);
  const bag = [...ITEMS].sort(() => rand() - 0.5);
  const out = [];
  const used = new Set();
  for (let guard = 0; out.length < n && guard < 500; guard++) {
    const pool = bag.filter((it) => !used.has(it.id) && it.tense !== out.at(-1)?.tense);
    const list = pool.length ? pool : bag.filter((it) => !used.has(it.id));
    if (!list.length) break;
    const weighted = list.flatMap((it) => Array(weight(it)).fill(it));
    const it = weighted[Math.floor(rand() * weighted.length)];
    out.push(it);
    used.add(it.id);
  }
  return out;
}

export { accuracy, record, levelOf };
