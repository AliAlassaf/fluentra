// Sounds: the IPA chart of American English (tap a sound for how to make it and example words with the letters
// highlighted) and ear training with minimal pairs.
import { h, icon, sheet, plural } from "../ui.js";
import { load, save } from "../store.js";
import * as data from "../data.js";
import { planRound, record, accuracy, levelOf, ROUND } from "../core/ear.js";
import { addTime } from "../core/progress.js";
import { dayNumber } from "../core/srs.js";
import { say, stop } from "../speech.js";

const GROUPS = [
  ["v", "Vowels", "Sounds marked with a yellow dot are the ones learners find hardest. Start with those."],
  ["c", "Consonants", ""],
];

export async function render(root, [tab = "chart", only = ""]) {
  const s = load();
  const { sounds, contrasts } = await data.get("sounds");
  const speak = (t, alt = false) => say(t, { rate: 0.85, voice: s.settings.voice, alt });
  const ear = tab === "ear";
  root.append(h("div", { class: "page-head" },
    h("div", {}, h("h1", {}, "Sounds"),
      h("p", {}, ear ? "Hear a word and choose which one it was. Ten minutes a week trains your ear to catch sounds your first language doesn't have." : "The 45 sounds of American English. Tap one to hear it in words and learn how to make it.")),
    h("div", { class: "chips", role: "tablist" },
      h("a", { class: "chip", href: "#/sounds", role: "tab", "aria-pressed": String(!ear) }, "Sound chart"),
      h("a", { class: "chip", href: "#/sounds/ear", role: "tab", "aria-pressed": String(ear) }, "Ear training"))));
  if (ear) return only ? earRound(root, s, contrasts, only === "mix" ? null : only, speak) : earList(root, s, contrasts);
  chart(root, sounds, contrasts, speak);
}

function chart(root, sounds, contrasts, speak) {
  for (const [g, title, note] of GROUPS) {
    const list = sounds.filter((x) => (g === "v" ? x.group !== "c" : x.group === "c"));
    root.append(h("h2", { class: "group-title" }, title),
      note ? h("p", { class: "legend" }, h("i"), note) : null,
      h("div", { class: "ipa-grid", style: "margin-top:12px" }, list.map((x) => h("button", {
        class: `ipa${x.hard ? " hard" : ""}`, type: "button", "aria-label": `/${x.sym}/ as in ${x.examples[0].word}`,
        onclick: () => openSound(x, contrasts, speak),
      }, h("span", { class: "sym" }, x.sym), h("span", { class: "ex" }, x.examples[0].word)))));
  }
}

function lit(ex) {
  return [ex.word.slice(0, ex.i), h("mark", { class: "mark" }, ex.word.slice(ex.i, ex.j)), ex.word.slice(ex.j)];
}

function openSound(x, contrasts, speak) {
  const { body } = sheet(`Sound ${x.sym}`);
  const drills = (x.contrasts || []).map((id) => contrasts.find((c) => c.id === id)).filter(Boolean);
  body.append(
    h("p", { class: "meta" }, x.group === "c" ? "Consonant" : "Vowel", x.hard ? ", often hard for learners" : ""),
    h("h2", { class: "read", style: "font-size:var(--s5);font-weight:400" }, `/${x.sym}/`),
    h("p", { class: "def", style: "margin-top:10px" }, x.tip),
    h("section", {}, h("h3", {}, "Example words"),
      h("ul", { class: "ex-list" }, x.examples.map((ex) => h("li", {},
        h("button", { class: "btn quiet say", "aria-label": `Listen to ${ex.word}`, onclick: () => speak(ex.word) }, icon("play")),
        h("span", {}, lit(ex)), h("span", { class: "ph" }, `/${ex.sounds.join("")}/`))))),
    h("div", { class: "row", style: "margin-top:16px" },
      h("button", { class: "btn", onclick: () => (async () => { for (const ex of x.examples) { await speak(ex.word); await new Promise((r) => setTimeout(r, 350)); } })() }, "Play all")),
    drills.length ? h("section", {}, h("h3", {}, "Train your ear"),
      h("div", { class: "row" }, drills.map((c) => h("a", { class: "btn", href: `#/sounds/ear/${c.id}` }, c.title)))) : null);
}

function earList(root, s, contrasts) {
  root.append(
    h("div", { class: "row", style: "margin-bottom:24px" }, h("a", { class: "btn primary big", href: "#/sounds/ear/mix" }, "Start a mixed round"),
      h("span", { class: "meta" }, `${ROUND} words, your weakest pairs more often`)),
    h("ul", { class: "pair-list" }, contrasts.map((c) => {
      const a = accuracy(s.ear[c.id]), lv = levelOf(s.ear[c.id]);
      return h("li", {}, h("a", { class: "pair-row", href: `#/sounds/ear/${c.id}`, style: "text-decoration:none" },
        h("span", {}, h("span", { class: "t" }, c.title), h("br"), h("span", { class: "eg" }, c.pairs.slice(0, 3).map((p) => p.join(" or ")).join(", "))),
        h("span", { class: `score ${lv}` }, a && lv !== "new" ? `${a.pct}%` : "Not tried"),
        h("span", { class: "meta", "aria-hidden": "true" }, "›")));
    })));
}

function earRound(root, s, contrasts, only, speak) {
  const round = planRound(contrasts, s.ear, { only });
  const c0 = only ? contrasts.find((c) => c.id === only) : null;
  let i = 0, right = 0;
  const started = Date.now();
  const slot = h("div");
  const bar = h("i", { style: "width:0%" });
  root.append(h("div", { class: "study-top" },
    h("a", { class: "btn quiet say", href: "#/sounds/ear", "aria-label": "End round" }, icon("close")),
    h("div", { class: "bar", role: "progressbar", "aria-label": "Round progress" }, bar)), slot);

  function ask() {
    bar.style.width = `${Math.round((100 * i) / round.length)}%`;
    if (i >= round.length) return done();
    const q = round[i];
    const word = q.pair[q.answer];
    const c = contrasts.find((x) => x.id === q.contrast);
    const play = () => speak(word, i % 2 === 1);
    const choices = h("div", { class: "ear-choices" }, q.pair.map((w, k) => h("button", { class: "ear-choice", type: "button", onclick: (e) => choose(k, e.currentTarget) }, w)));
    const card = h("article", { class: "card" },
      h("p", { class: "card-kind" }, c0 ? c0.title : c.title),
      h("div", { class: "row" }, h("button", { class: "btn primary big", onclick: play }, icon("play"), "Play the word"),
        h("button", { class: "btn quiet", onclick: () => say(word, { rate: 0.6 }) }, icon("slow"), "Slower")),
      choices, h("div", { class: "fb", "aria-live": "polite" }));
    slot.replaceChildren(card);
    setTimeout(play, 250);

    function choose(k, btn) {
      const ok = k === q.answer;
      if (ok) right++;
      s.ear[q.contrast] = record(s.ear[q.contrast], ok);
      save();
      for (const b of choices.children) b.disabled = true;
      btn.classList.add(ok ? "right" : "wrong");
      if (!ok) choices.children[q.answer].classList.add("right");
      const fb = card.querySelector(".fb");
      if (ok) { setTimeout(() => { i++; ask(); }, 650); return; }
      fb.append(h("p", { class: "tip" }, h("b", {}, `It was "${word}". `), c.tip),
        h("div", { class: "row", style: "margin-top:14px" },
          h("button", { class: "btn", onclick: async () => { await speak(q.pair[0]); await new Promise((r) => setTimeout(r, 300)); await speak(q.pair[1]); } }, `Hear both`),
          h("button", { class: "btn primary", onclick: () => { i++; ask(); } }, "Next")));
    }
  }
  function done() {
    addTime(s, dayNumber(), (Date.now() - started) / 1000);
    save();
    slot.replaceChildren(h("article", { class: "card done-card" },
      h("p", { class: "card-kind" }, "Round complete"),
      h("p", { class: "big-num" }, `${right}/${round.length}`),
      h("p", { class: "def" }, right === round.length ? "Every one right. Your ear is getting sharper." : `${plural(round.length - right, "word")} to listen for again. A few short rounds a week work better than one long one.`),
      h("div", { class: "row", style: "margin-top:24px" },
        h("button", { class: "btn primary", onclick: () => window.dispatchEvent(new HashChangeEvent("hashchange")) }, "Another round"),
        h("a", { class: "btn", href: "#/sounds/ear" }, "All sound pairs"))));
  }
  ask();
  return () => stop();
}
