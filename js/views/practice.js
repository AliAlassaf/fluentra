// Practice: drills that turn what you know into what you can say.
//   respond — a situation, and you produce the reply from memory (recall, not rereading)
//   shadow  — repeat at the speaker's speed, then use each idiom in your own sentence (beats the "fluency illusion")
//   tenses  — past, present and future shuffled together, so you choose the tense on the spot
//   drive   — hands-free recall of words that have had two days to get fuzzy (tactical forgetting)
//   gaps    — what you got stuck on when explaining it simply (Feynman), and your own sentences
import { h, icon, toast, plural, sheet } from "../ui.js";
import { load, save } from "../store.js";
import * as data from "../data.js";
import { dayNumber, preview, inWords, GRADES } from "../core/srs.js";
import { addTime } from "../core/progress.js";
import { similarity, bestScore } from "../core/text.js";
import { respondPrompts, respondPlan, respondGrade, respondAnswer, driveQueue, THINK_CHOICES, usesPhrase } from "../core/practice.js";
import { planRound as tenseRound, isRight, record as tenseRecord, accuracy as tenseAccuracy, TENSES } from "../core/tenses.js";
import { say, sayTimed, stop, listen, canListen } from "../speech.js";
import { openWord } from "./words.js";

const DRILLS = [
  { id: "respond", icon: "speak", title: "Respond", sub: "Hear a real situation and say your reply from memory, without reading it first.",
    why: "Pulling a sentence out of memory is what builds speaking. Rereading only feels like learning." },
  { id: "shadow", icon: "sounds", title: "Shadow", sub: "Repeat natural sentences at the speaker's speed, then use each idiom in a sentence of your own.",
    why: "Understanding a fast line isn't the same as being able to say it. This closes that gap." },
  { id: "tenses", icon: "grammar", title: "Tense mix", sub: "Past, present and future shuffled together. Pick the right tense, fast.",
    why: "In real talk you choose the tense in a split second. Mixing them trains that choice." },
  { id: "drive", icon: "play", title: "Hands-free", sub: "Eyes-free recall for driving or walking: hear the meaning, find the word, hear the answer.",
    why: "It uses words you saw at least two days ago, when they're on the tip of your tongue. Recalling them then makes them stick." },
];

export async function render(root, [drill]) {
  const s = load();
  const speak = (t, o = {}) => say(t, { rate: s.settings.rate, voice: s.settings.voice, ...o });
  if (drill === "respond") return respond(root, s, speak);
  if (drill === "shadow") return shadow(root, s, speak);
  if (drill === "tenses") return tenses(root, s);
  if (drill === "drive") return drive(root, s);
  return hub(root, s);
}

const back = () => h("a", { class: "btn quiet", href: "#/practice", style: "margin-left:-12px" }, icon("back"), "Practice");
const head = (title, sub) => h("div", { class: "page-head", style: "margin-top:14px" }, h("div", {}, h("h1", {}, title), sub ? h("p", {}, sub) : null));

async function hub(root, s) {
  const today = dayNumber();
  const convs = await data.get("conversations");
  const rp = respondPlan(s, convs, today);
  const fuzzy = driveQueue(s, today).length;
  const count = { respond: rp.due.length ? `${rp.due.length} due` : `${rp.fresh.length} new`, drive: fuzzy ? `${fuzzy} words ready` : "Study a few days first", shadow: "5 min", tenses: "10 items" };
  root.append(head("Practice", "Drills that turn the words you know into English you can actually say."),
    h("nav", { class: "more", style: "margin-top:0", "aria-label": "Drills" }, DRILLS.map((d) => h("a", { href: `#/practice/${d.id}` },
      h("span", { class: "ico" }, icon(d.icon)),
      h("span", {}, h("span", { class: "more-title" }, d.title), h("br"), h("span", { class: "more-sub" }, d.sub)),
      h("span", { class: "go" }, count[d.id])))));

  const words = await data.words();
  const gaps = Object.keys(s.gaps);
  const grammar = await data.get("grammar");
  root.append(h("section", { class: "block" }, h("h2", {}, "Your gaps"),
    h("p", {}, "When you try to explain a word or a grammar point simply and get stuck, it lands here. Explain it again until it comes easily."),
    gaps.length ? h("ul", { class: "pair-list" }, gaps.map((key) => {
      const [kind, id] = key.split(":");
      const w = kind === "word" ? data.wordSync(id) : null, g = kind === "grammar" ? grammar.find((x) => x.id === id) : null;
      if (!w && !g) return null;
      return h("li", {}, kind === "word"
        ? h("button", { class: "pair-row", type: "button", onclick: () => openWord(w, s, (t) => say(t, { rate: s.settings.rate, voice: s.settings.voice })) },
            h("span", { class: "t" }, w.word), h("span", { class: "score weak" }, "Word"), h("span", { class: "meta" }, "›"))
        : h("a", { class: "pair-row", href: `#/grammar/${g.id}`, style: "text-decoration:none" },
            h("span", { class: "t" }, g.title), h("span", { class: "score weak" }, "Grammar"), h("span", { class: "meta" }, "›")));
    })) : h("p", { class: "meta" }, "No gaps yet. Open any word or grammar point and try \"Explain it simply\".")));

  const mine = Object.entries(s.mine).sort(([, a], [, b]) => b.at - a.at);
  root.append(h("section", { class: "block" }, h("h2", {}, "Your sentences"),
    h("p", {}, "Sentences about your own life, one for each word you made yours. They come back with the word in your reviews."),
    mine.length ? h("ul", { class: "ex-list" }, mine.slice(0, 50).map(([id, m]) => {
      const w = words.find((x) => x.id === id);
      return h("li", {}, h("button", { class: "btn quiet say", "aria-label": "Listen", onclick: () => say(m.text, { rate: s.settings.rate, voice: s.settings.voice }) }, icon("play")),
        h("span", {}, m.text), w ? h("span", { class: "ph" }, w.word) : null);
    })) : h("p", { class: "meta" }, "None yet. Open a word and use \"Make it yours\".")));
}

/** A mic button plus a text box; calls onAnswer(alternatives, ms). */
function answerBar(onAnswer, { placeholder = "Or type it" } = {}) {
  let rec = null;
  const input = h("input", { class: "input", type: "text", placeholder, "aria-label": placeholder, autocomplete: "off" });
  const status = h("p", { class: "meta", "aria-live": "polite" });
  const mic = canListen() ? h("button", { class: "mic", type: "button", "aria-label": "Speak" }, icon("speak")) : null;
  mic?.addEventListener("click", async () => {
    if (rec) { rec.stop(); return; }
    stop();
    mic.classList.add("on");
    status.textContent = "Listening…";
    try {
      rec = listen();
      const r = await rec;
      status.textContent = r.text ? "" : "Nothing heard. Tap the microphone and speak.";
      if (r.text) onAnswer(r.alternatives.length ? r.alternatives : [r.text], r.ms);
    } catch (e) { toast(e.message, 4000); status.textContent = ""; }
    finally { rec = null; mic.classList.remove("on"); }
  });
  const form = h("form", { style: "flex:1;display:flex;gap:8px;min-width:14rem", onsubmit: (e) => {
    e.preventDefault();
    if (input.value.trim()) { onAnswer([input.value.trim()], 0); input.value = ""; }
  } }, input, h("button", { class: "btn", type: "submit" }, "Check"));
  return { el: h("div", {}, h("div", { class: "row", style: "margin-top:22px;flex-wrap:nowrap" }, mic, form), status), input, stopRec: () => rec?.stop() };
}

function progressTop(root, total, exit = "#/practice") {
  const bar = h("i", { style: "width:0%" });
  const count = h("span", { class: "meta" });
  root.append(h("div", { class: "study-top" }, h("a", { class: "btn quiet say", href: exit, "aria-label": "End" }, icon("close")),
    h("div", { class: "bar", role: "progressbar", "aria-label": "Progress" }, bar), count));
  return (i, n = total) => { bar.style.width = `${Math.round((100 * i) / n)}%`; count.textContent = `${i} / ${n}`; };
}

// ───── respond ─────
async function respond(root, s, speak) {
  const today = dayNumber(), started = Date.now();
  const convs = await data.get("conversations");
  const byId = new Map(respondPrompts(convs).map((p) => [p.id, p]));
  const plan = respondPlan(s, convs, today);
  const queue = [...plan.due, ...plan.fresh];
  const slot = h("div");
  const setBar = progressTop(root, queue.length);
  root.className = "page study";
  root.append(slot);
  let i = 0, bar = null;

  function next() {
    setBar(i, queue.length);
    if (i >= queue.length) return done();
    const p = byId.get(queue[i]);
    let hinted = false;
    const hint = h("p", { class: "tip", hidden: true }, h("b", {}, "Useful pattern: "), p.pattern);
    bar = answerBar((alts) => reveal(bestScore(alts, p.you), alts[0]));
    const ask = h("div", {},
      h("p", { class: "def", style: "margin-top:18px" }, "What do you say? Answer out loud, from memory."),
      bar.el,
      h("div", { class: "row", style: "margin-top:12px" },
        h("button", { class: "btn quiet", type: "button", onclick: (e) => { hinted = true; hint.hidden = false; e.currentTarget.remove(); } }, "Hint"),
        h("button", { class: "btn quiet", type: "button", onclick: () => reveal(0, "") }, "Show a good reply")),
      hint);
    const card = h("article", { class: "card" },
      h("p", { class: "card-kind" }, p.title),
      h("p", { class: "meta" }, "They say"),
      h("div", { class: "row", style: "flex-wrap:nowrap;align-items:flex-start" }, h("p", { class: "sentence", style: "margin-top:4px" }, p.they),
        h("button", { class: "btn quiet say", "aria-label": "Listen again", onclick: () => speak(p.they, { alt: true }) }, icon("play"))),
      ask);
    slot.replaceChildren(card);
    speak(p.they, { alt: true });

    function reveal(score, said) {
      bar.stopRec();
      const suggest = said ? respondGrade(score, hinted) : "again";
      const days = preview(s.respond[p.id] || {}, today);
      ask.replaceChildren(...[
        said ? h("p", { class: "said", style: "margin-top:16px" }, h("b", {}, `${Math.round(score * 100)}% like this reply. `), `You said: "${said}"`) : null,
        h("p", { class: "meta", style: "margin-top:16px" }, "A natural reply"),
        h("div", { class: "row", style: "flex-wrap:nowrap;align-items:flex-start" }, h("p", { class: "sentence", style: "margin-top:4px;border-left:3px solid var(--marker);padding-left:14px" }, p.you),
          h("button", { class: "btn quiet say", "aria-label": "Listen", onclick: () => speak(p.you) }, icon("play"))),
        h("p", { class: "meta", style: "margin-top:14px" }, "Other good replies are fine too. How did you do?"),
        h("div", { class: "grades" }, GRADES.map((g) => h("button", { class: `grade ${g}`, type: "button", "data-g": g, onclick: () => {
          respondAnswer(s, p.id, g, today); save(); i++; next();
        } }, g[0].toUpperCase() + g.slice(1), h("small", {}, g === "again" ? "soon" : inWords(days[g])))))].filter(Boolean));
      card.querySelector(`[data-g="${suggest}"]`).focus();
      speak(p.you);
    }
  }
  function done() {
    addTime(s, today, (Date.now() - started) / 1000); save();
    slot.replaceChildren(h("article", { class: "card done-card" }, h("p", { class: "card-kind" }, "Done"),
      h("p", { class: "def" }, queue.length ? `You answered ${plural(queue.length, "situation")} from memory. They'll come back when they start to fade.` : "Nothing due right now. New situations unlock tomorrow."),
      h("div", { class: "row", style: "margin-top:22px" }, h("a", { class: "btn primary", href: "#/practice" }, "Back to Practice"))));
  }
  next();
  return () => { stop(); bar?.stopRec(); };
}

// ───── shadow ─────
async function shadow(root, s, speak) {
  const today = dayNumber(), started = Date.now();
  const phrases = await data.get("phrases");
  // natural sentences: fast-speech versions first, then idioms and everyday lines, shuffled
  const pool = phrases.flatMap((p) => [...p.fast.map((t) => ({ t, p })), ...(p.use === "idiom" ? [{ t: p.examples[0], p }] : [])]);
  const items = pool.sort(() => Math.random() - 0.5).slice(0, 8);
  root.className = "page study";
  const setBar = progressTop(root, items.length);
  const slot = h("div");
  root.append(slot);
  let i = 0, bar = null, total = 0;

  async function next() {
    setBar(i, items.length);
    if (i >= items.length) return done();
    const { t, p } = items[i];
    let voiceMs = 0;
    const result = h("div", { "aria-live": "polite" });
    const playBtn = h("button", { class: "btn primary", type: "button", onclick: async () => { voiceMs = await sayTimed(t, { rate: 1, voice: s.settings.voice }); } }, icon("play"), "Play at full speed");
    bar = answerBar((alts, ms) => check(alts, ms), { placeholder: "Or type what you heard" });
    const text = h("p", { class: "sentence hidden-text", style: "margin-top:16px" }, t);
    const card = h("article", { class: "card" },
      h("p", { class: "card-kind" }, p.use === "idiom" ? "Idiom" : "Natural speech"),
      h("p", { class: "def" }, "Listen, then say it right away, at the same speed and with the same melody."),
      h("div", { class: "row", style: "margin-top:16px" }, playBtn,
        h("button", { class: "btn quiet", type: "button", onclick: () => say(t, { rate: 0.75, voice: s.settings.voice }) }, icon("slow"), "Slower"),
        h("button", { class: "btn quiet", type: "button", onclick: (e) => { text.classList.remove("hidden-text"); e.currentTarget.remove(); } }, "Show text")),
      text, bar.el, result);
    slot.replaceChildren(card);
    voiceMs = await sayTimed(t, { rate: 1, voice: s.settings.voice });

    function check(alts, ms) {
      const score = bestScore(alts, t);
      total += score;
      text.classList.remove("hidden-text");
      const speed = ms && voiceMs ? ms / voiceMs : 0;
      const pace = !speed ? "" : speed > 1.35 ? " You were slower than the speaker. Try again a little faster, linking the words." : speed < 0.75 ? " That was very fast. Make sure every word is there." : " Your speed matched the speaker.";
      result.replaceChildren(h("p", { class: "said", style: "margin-top:14px" }, h("b", {}, `${Math.round(score * 100)}%. `), `You said: "${alts[0]}"${pace}`));
      if (score < 0.75) { result.append(h("div", { class: "row", style: "margin-top:10px" }, h("button", { class: "btn primary", onclick: () => { i++; next(); } }, "Next"))); return; }
      if (p.use === "idiom") return useIt();
      result.append(h("div", { class: "row", style: "margin-top:10px" }, h("button", { class: "btn primary", onclick: () => { i++; next(); } }, "Next")));
    }
    function useIt() {
      bar.el.remove();
      const own = answerBar((alts) => {
        const ok = alts.some((a) => usesPhrase(a, p.pattern));
        result.append(h("p", { class: `verdict ${ok ? "right" : "close"}` }, ok ? `Great, that's yours now: "${alts[0]}"` : `Try to include "${p.pattern}" in your sentence.`));
        if (ok) result.append(h("div", { class: "row", style: "margin-top:10px" }, h("button", { class: "btn primary", onclick: () => { i++; next(); } }, "Next")));
      }, { placeholder: "Your own sentence with this idiom" });
      bar = own;
      result.append(h("div", { class: "tip", style: "margin-top:16px" }, h("b", {}, "Now make it yours. "), `Use "${p.pattern}" in a sentence about your own life.`), own.el);
    }
  }
  function done() {
    addTime(s, today, (Date.now() - started) / 1000); save();
    slot.replaceChildren(h("article", { class: "card done-card" }, h("p", { class: "card-kind" }, "Round complete"),
      h("p", { class: "big-num" }, `${Math.round((100 * total) / Math.max(1, items.length))}%`),
      h("p", { class: "def" }, "Do this with clips from shows you like, too: pause after a line, and say it the same way."),
      h("div", { class: "row", style: "margin-top:22px" }, h("button", { class: "btn primary", onclick: () => window.dispatchEvent(new HashChangeEvent("hashchange")) }, "Another round"),
        h("a", { class: "btn", href: "#/practice" }, "Back to Practice"))));
  }
  next();
  return () => { stop(); bar?.stopRec(); };
}

// ───── tense mix ─────
function tenses(root, s) {
  const today = dayNumber(), started = Date.now();
  const round = tenseRound(s.tenses);
  root.className = "page study";
  const setBar = progressTop(root, round.length);
  const slot = h("div");
  root.append(slot);
  let i = 0, right = 0;
  function next() {
    setBar(i);
    if (i >= round.length) return done();
    const it = round[i];
    const input = h("input", { class: "input", type: "text", autocomplete: "off", autocapitalize: "off", spellcheck: "false", "aria-label": `The verb ${it.verb} in the right tense` });
    const out = h("div", { "aria-live": "polite" });
    const [a, ...rest] = it.s.split("___");
    const card = h("article", { class: "card" },
      h("p", { class: "card-kind" }, "Which tense?"),
      h("p", { class: "sentence" }, a, h("span", { class: "gap" }, "verb"), rest.join("___")),
      h("p", { class: "meta", style: "margin-top:6px" }, `Verb: ${it.verb}`),
      h("form", { class: "answer", onsubmit: (e) => { e.preventDefault(); check(); } }, input, h("button", { class: "btn primary", type: "submit" }, "Check")),
      out);
    slot.replaceChildren(card);
    input.focus();
    function check() {
      if (!input.value.trim() || input.disabled) return;
      const ok = isRight(it, input.value);
      input.disabled = true;
      if (ok) right++;
      s.tenses[it.tense] = tenseRecord(s.tenses[it.tense], ok);
      save();
      out.replaceChildren(
        h("p", { class: `verdict ${ok ? "right" : "wrong"}` }, ok ? "Right." : `Answer: ${it.answers[0]}`),
        h("p", { class: "tip" }, h("b", {}, `${TENSES[it.tense]}. `), it.why),
        h("div", { class: "row", style: "margin-top:14px" }, h("button", { class: "btn primary", id: "nx", onclick: () => { i++; next(); } }, "Next")));
      out.querySelector("#nx").focus();
    }
  }
  function done() {
    addTime(s, today, (Date.now() - started) / 1000); save();
    slot.replaceChildren(h("article", { class: "card done-card" }, h("p", { class: "card-kind" }, "Round complete"),
      h("p", { class: "big-num" }, `${right}/${round.length}`),
      h("ul", { class: "pair-list", style: "margin-top:16px" }, Object.entries(TENSES).map(([t, name]) => {
        const acc = tenseAccuracy(s.tenses[t]);
        return acc ? h("li", { class: "pair-row", style: "cursor:default" }, h("span", { class: "t", style: "font-family:var(--ui);font-size:var(--s0)" }, name), h("span", { class: "score" }, `${acc.pct}%`), h("span")) : null;
      })),
      h("div", { class: "row", style: "margin-top:22px" }, h("button", { class: "btn primary", onclick: () => window.dispatchEvent(new HashChangeEvent("hashchange")) }, "Another round"),
        h("a", { class: "btn", href: "#/practice" }, "Back to Practice"))));
  }
  next();
}

// ───── hands-free ─────
function drive(root, s) {
  const today = dayNumber();
  const ids = driveQueue(s, today);
  let think = Number(localStorage.getItem("fluentra:think")) || 7;
  let run = 0, paused = true, i = 0, lock = null;
  root.append(back(), head("Hands-free", "For driving or walking. You hear a meaning, say the word out loud in the pause, then hear the answer and an example. Eyes on the road."));
  if (!ids.length) {
    root.append(h("div", { class: "empty" }, h("h3", {}, "Nothing to recall yet."),
      h("p", {}, "This drill uses words you studied at least a day ago, so your memory has to work for them. Study today, and come back in a day or two.")));
    return;
  }
  const status = h("p", { class: "plan-line", "aria-live": "polite" }, `${plural(ids.length, "word")} ready.`);
  const word = h("p", { class: "word-big", style: "font-size:clamp(2.4rem,8vw,4rem);font-weight:800;letter-spacing:-.04em;margin-top:18px;min-height:1.2em" });
  const playBtn = h("button", { class: "btn primary big", type: "button" }, "Start");
  const thinkRow = h("div", { class: "chips", role: "group", "aria-label": "Thinking time" }, THINK_CHOICES.map((n) => h("button", { class: "chip", type: "button", "aria-pressed": String(n === think), onclick: (e) => {
    think = n; try { localStorage.setItem("fluentra:think", String(n)); } catch { /* private */ }
    for (const b of thinkRow.children) b.setAttribute("aria-pressed", String(b === e.currentTarget));
  } }, `${n} s to think`)));
  root.append(status, word, h("div", { class: "row", style: "margin-top:20px" }, playBtn,
    h("button", { class: "btn big", type: "button", onclick: () => { stop(); i++; if (!paused) loop(); } }, "Skip")),
    h("h3", { style: "margin-top:32px;margin-bottom:10px" }, "Pause to think"), thinkRow);

  const wait = (ms, my) => new Promise((r) => setTimeout(() => r(my === run), ms));
  async function loop() {
    const my = ++run;
    const t0 = Date.now();
    while (!paused && my === run && i < ids.length) {
      const w = data.wordSync(ids[i]);
      word.textContent = "?";
      status.textContent = `Word ${i + 1} of ${ids.length}. What's the word?`;
      await say(`What's the word for: ${w.def}?`, { rate: 0.95, voice: s.settings.voice });
      if (!(await wait(think * 1000, my)) || paused) break;
      word.textContent = w.word;
      await say(w.word, { rate: 0.9, voice: s.settings.voice });
      if (!(await wait(500, my)) || paused) break;
      await say(s.mine[w.id]?.text || w.ex, { rate: s.settings.rate, voice: s.settings.voice });
      if (!(await wait(1600, my)) || paused) break;
      i++;
    }
    addTime(s, today, (Date.now() - t0) / 1000); save();
    if (i >= ids.length) { paused = true; playBtn.textContent = "Start again"; i = 0; status.textContent = "All done. Nice work."; word.textContent = ""; lock?.release?.(); }
  }
  playBtn.addEventListener("click", async () => {
    paused = !paused;
    playBtn.textContent = paused ? "Continue" : "Pause";
    if (paused) { stop(); run++; lock?.release?.(); return; }
    try { lock = await navigator.wakeLock?.request("screen"); } catch { /* not allowed: fine */ }
    loop();
  });
  if ("mediaSession" in navigator) {
    navigator.mediaSession.setActionHandler("play", () => paused && playBtn.click());
    navigator.mediaSession.setActionHandler("pause", () => !paused && playBtn.click());
    navigator.mediaSession.setActionHandler("nexttrack", () => { stop(); i++; if (!paused) loop(); });
  }
  return () => { paused = true; run++; stop(); lock?.release?.(); };
}
