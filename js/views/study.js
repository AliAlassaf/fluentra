// The study session. A new word is shown in full first ("learn"), then tested a few cards later ("recall").
// Reviews and recalls are recall-first: you see the meaning and the sentence with a gap, try to type or say the word,
// then grade how well you knew it. Keys: Enter = check/next, 1–4 = grades, Space = listen.
import { h, icon, markedSentence, plural, toast, tolerant } from "../ui.js";
import { load, save } from "../store.js";
import * as data from "../data.js";
import { plan, buildQueue, nextNew, EXTRA } from "../core/session.js";
import { dayNumber, preview, inWords, GRADES } from "../core/srs.js";
import { answerWord } from "../core/progress.js";
import { checkAnswer, hintOf } from "../core/text.js";
import { say, stop } from "../speech.js";
import { refreshBadge } from "../app.js";
import { mineBox } from "../explain.js";

const LABEL = { again: "Again", hard: "Hard", good: "Good", easy: "Easy" };

export async function render(root, [mode]) {
  const s = load(), today = dayNumber();
  const all = await data.words();
  const p = plan(s, all, today);
  if (mode === "extra") p.fresh = nextNew(s, all, EXTRA); // past today's limit, on request
  const queue = buildQueue(p);
  if (!queue.length) { location.hash = "#/today"; return; }

  let i = 0, started = Date.now(), right = 0, again = 0, learned = 0;
  const bar = h("i", { style: "width:0%" });
  const count = h("span", { class: "meta" });
  const slot = h("div");
  root.className = "page study";
  root.append(h("div", { class: "study-top" },
    h("a", { class: "btn quiet say", href: "#/today", "aria-label": "End session" }, icon("close")),
    h("div", { class: "bar", role: "progressbar", "aria-label": "Session progress" }, bar), count), slot);

  let keyHandler = null;
  const onKey = (e) => keyHandler?.(e);
  document.addEventListener("keydown", onKey);
  const speak = (t) => say(t, { rate: s.settings.rate, voice: s.settings.voice });

  function next() {
    bar.style.width = `${Math.round((100 * i) / queue.length)}%`;
    count.textContent = `${i} / ${queue.length}`;
    if (i >= queue.length) return finish();
    const step = queue[i];
    const w = data.wordSync(step.id);
    if (!w) { i++; return next(); }
    started = Date.now();
    if (step.kind === "learn") learnCard(w); else recallCard(w, step.kind);
  }

  function learnCard(w) {
    const card = h("article", { class: "card", "aria-live": "polite" },
      h("p", { class: "card-kind" }, "New word"),
      h("div", { class: "row", style: "justify-content:space-between;align-items:flex-start" },
        h("h1", { class: "word-big" }, w.word),
        h("button", { class: "btn say", "aria-label": `Listen to ${w.word}`, onclick: () => speak(w.word) }, icon("play"))),
      h("p", { class: "def" }, w.def),
      h("div", { class: "row", style: "align-items:flex-start;gap:12px" }, markedSentence(w.ex, w.word, { swipe: true }),
        h("button", { class: "btn quiet say", "aria-label": "Listen to the sentence", onclick: () => speak(w.ex) }, icon("play"))),
      synLine(w),
      h("details", { class: "mine-d", style: "margin-top:20px" }, h("summary", { class: "btn quiet", style: "margin-left:-12px" }, "Make it yours: a sentence from your life"),
        h("div", { style: "margin-top:12px" }, mineBox(s, w))),
      h("div", { class: "row", style: "margin-top:28px" },
        h("button", { class: "btn primary big", id: "go", onclick: () => { i++; next(); } }, "Got it")),
      h("p", { class: "keys" }, "It comes back in a few cards to check you remember. Press Enter to continue."));
    slot.replaceChildren(card);
    speak(w.word);
    card.querySelector("#go").focus();
    keyHandler = (e) => {
      if (/^(TEXTAREA|INPUT)$/.test(e.target.tagName)) return; // typing your own sentence
      if (e.key === "Enter") { e.preventDefault(); i++; next(); }
      if (e.key === " " && e.target.tagName !== "BUTTON") { e.preventDefault(); speak(w.ex); }
    };
  }

  function recallCard(w, kind) {
    const isNew = kind === "recall";
    const input = h("input", { class: "input", type: "text", autocomplete: "off", autocapitalize: "off", spellcheck: "false",
      "aria-label": "Type the word", placeholder: "Type the word" });
    const hint = h("button", { class: "btn quiet", type: "button", onclick: () => { input.placeholder = hintOf(w.word); input.focus(); } }, "Hint");
    const check = h("button", { class: "btn primary", type: "button", onclick: () => reveal(input.value) }, "Check");
    const showBtn = h("button", { class: "btn quiet", type: "button", onclick: () => reveal("") }, "Show answer");
    const card = tolerant(h("article", { class: "card", "aria-live": "polite" },
      h("p", { class: "card-kind" }, isNew ? "Do you remember?" : "Review"),
      h("p", { class: "def" }, w.def),
      markedSentence(w.ex, w.word, { gap: true }),
      h("form", { class: "answer", onsubmit: (e) => { e.preventDefault(); reveal(input.value); } }, input, check),
      h("div", { class: "row", style: "margin-top:10px" }, hint, showBtn)));
    slot.replaceChildren(card);
    input.focus();
    keyHandler = null;

    function reveal(typed) {
      const verdict = typed.trim() ? checkAnswer(typed, w.word, w.ex) : "skipped";
      const v = { right: ["right", "Right."], close: ["close", `Almost: check the spelling.`], wrong: ["wrong", `You wrote "${typed.trim()}".`], skipped: ["", ""] }[verdict];
      const days = preview(s.cards[w.id] || {}, today);
      const suggest = verdict === "right" ? "good" : verdict === "close" ? "hard" : "again";
      const grades = h("div", { class: "grades", role: "group", "aria-label": "How well did you know it?" },
        GRADES.map((g, n) => h("button", { class: `grade ${g}`, type: "button", onclick: () => answer(g), "data-g": g },
          LABEL[g], h("small", {}, g === "again" ? "show again" : inWords(days[g])), h("span", { class: "sr-only" }, ` (key ${n + 1})`))));
      card.replaceChildren();
      card.append(
        h("p", { class: "card-kind" }, isNew ? "Do you remember?" : "Review"),
        h("div", { class: "row", style: "justify-content:space-between;align-items:flex-start" },
          h("h1", { class: "word-big" }, w.word),
          h("button", { class: "btn say", "aria-label": `Listen to ${w.word}`, onclick: () => speak(w.word) }, icon("play"))),
        v[1] ? h("p", { class: `verdict ${v[0]}` }, v[1]) : null,
        h("p", { class: "def" }, w.def),
        markedSentence(w.ex, w.word, { swipe: true }),
        s.mine[w.id] ? h("p", { class: "syn" }, h("b", {}, "Your sentence: "), s.mine[w.id].text) : null,
        synLine(w),
        grades,
        h("p", { class: "keys" }, "Keys 1 to 4 choose an answer. Space plays the sentence."));
      speak(w.ex);
      grades.querySelector(`[data-g="${suggest}"]`).focus();
      keyHandler = (e) => {
        if (/^[1-4]$/.test(e.key)) { e.preventDefault(); answer(GRADES[Number(e.key) - 1]); }
        if (e.key === " " && e.target.tagName !== "BUTTON") { e.preventDefault(); speak(w.ex); }
      };
    }

    function answer(g) {
      keyHandler = null;
      stop();
      // a retry (after "again") only decides whether it comes back once more; the schedule was set the first time
      if (kind !== "retry") answerWord(s, w.id, g, today, { isNew: isNew && !s.cards[w.id], seconds: (Date.now() - started) / 1000 });
      save();
      if (g === "again") {
        if (kind !== "retry") again++;
        queue.splice(Math.min(queue.length, i + 4), 0, { id: w.id, kind: "retry" });
      } else if (kind !== "retry") { right++; if (isNew) learned++; }
      i++;
      next();
    }
  }

  function finish() {
    keyHandler = null;
    const pct = right + again ? Math.round((100 * right) / (right + again)) : 100;
    slot.replaceChildren(h("article", { class: "card done-card" },
      h("p", { class: "card-kind" }, "Session complete"),
      h("p", { class: "big-num" }, `${pct}%`),
      h("p", { class: "def" }, `You answered ${plural(right, "card")} correctly${learned ? ` and learned ${plural(learned, "new word")}` : ""}. Fluentra will bring each one back right before you'd forget it.`),
      h("div", { class: "row", style: "margin-top:26px" },
        h("a", { class: "btn primary", href: "#/today" }, "Back to Today"),
        h("a", { class: "btn", href: "#/speak" }, "Practice speaking"))));
    refreshBadge();
    toast("Progress saved.");
  }

  next();
  return () => { document.removeEventListener("keydown", onKey); stop(); };
}

function synLine(w) {
  if (!w.syn?.length && !w.casual) return null;
  return h("p", { class: "syn" },
    w.syn?.length ? [h("b", {}, "Similar: "), w.syn.join(", ")] : null,
    w.casual ? [w.syn?.length ? h("br") : null, h("b", {}, "Casually: "), w.casual] : null);
}
