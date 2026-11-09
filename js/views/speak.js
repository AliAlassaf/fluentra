// Speak: everyday conversations, line by line. You hear the other person, then say your line out loud; the browser's
// speech recognition checks how close you were. "Hide my lines" turns it into a memory exercise.
import { h, icon, toast } from "../ui.js";
import { load, save } from "../store.js";
import * as data from "../data.js";
import { addTime } from "../core/progress.js";
import { dayNumber } from "../core/srs.js";
import { bestScore } from "../core/text.js";
import { say, stop, listen, canListen } from "../speech.js";

const PASS = 0.75;

export async function render(root, [id]) {
  const s = load();
  const convs = await data.get("conversations");
  const conv = id && convs.find((c) => c.id === id);
  return conv ? practice(root, s, conv, convs) : list(root, s, convs);
}

function list(root, s, convs) {
  root.append(h("div", { class: "page-head" }, h("div", {}, h("h1", {}, "Speak"),
    h("p", {}, "Practice real conversations out loud. Listen to the other person, then say your line. Speaking from the first day is how words become yours."))));
  if (!canListen()) root.append(h("p", { class: "tip", style: "margin-bottom:24px" }, "Speech input isn't available in this browser, so you'll type your lines instead. For speaking, use Chrome or Safari."));
  const cats = [...new Set(convs.map((c) => c.category))];
  for (const cat of cats) {
    root.append(h("section", { class: "g-section" }, h("h3", {}, data.CATEGORIES[cat] || cat),
      h("ul", { class: "conv-list" }, convs.filter((c) => c.category === cat).map((c) => {
        const r = s.speak[c.id];
        return h("li", {}, h("a", { class: "conv-row", href: `#/speak/${c.id}`, style: "text-decoration:none" },
          h("span", {}, c.title), h("span", { class: `score${r ? (r.best >= 85 ? " strong" : " fair") : ""}` }, r ? `${r.best}%` : `${c.lines.length} lines`)));
      }))));
  }
}

function practice(root, s, conv, convs) {
  const started = Date.now();
  const scores = [];
  let at = 0, hide = false, busy = false, rec = null;
  const lines = h("div", { class: "lines" });
  const mic = h("button", { class: "mic", type: "button", "aria-label": "Say your line" }, icon("speak"));
  const typed = h("input", { class: "input", type: "text", placeholder: "Or type your line", "aria-label": "Type your line" });
  const status = h("p", { class: "meta", "aria-live": "polite" });
  const hideBtn = h("button", { class: "chip", type: "button", "aria-pressed": "false", onclick: () => {
    hide = !hide; hideBtn.setAttribute("aria-pressed", String(hide)); draw();
  } }, "Hide my lines");
  const speak = (t, alt) => say(t, { rate: s.settings.rate, voice: s.settings.voice, alt });

  root.append(
    h("a", { class: "btn quiet", href: "#/speak", style: "margin-left:-12px" }, icon("back"), "All conversations"),
    h("div", { class: "page-head", style: "margin-top:14px;margin-bottom:8px" }, h("div", {}, h("h1", {}, conv.title),
      h("p", {}, "Listen to them, then say your line out loud."))),
    h("div", { class: "row" }, hideBtn), lines,
    h("div", { class: "speak-bar" }, canListen() ? mic : null,
      h("form", { style: "flex:1;display:flex;gap:8px", onsubmit: (e) => { e.preventDefault(); if (typed.value.trim()) check([typed.value]); } }, typed,
        h("button", { class: "btn", type: "submit" }, "Check")),
      status));

  function draw() {
    lines.replaceChildren(...conv.lines.slice(0, at + 1).flatMap((ln, k) => {
      const done = k < at, sc = scores[k];
      return [
        h("div", { class: "line them" }, h("span", { class: "who" }, "Them"),
          h("div", { class: "row", style: "flex-wrap:nowrap;align-items:flex-start" }, h("p", { class: "bubble" }, ln.they),
            h("button", { class: "btn quiet say", "aria-label": "Listen again", onclick: () => speak(ln.they, true) }, icon("play")))),
        h("div", { class: `line you${done ? "" : " now"}` }, h("span", { class: "who" }, "You"),
          h("div", {}, h("div", { class: "row", style: "flex-wrap:nowrap;align-items:flex-start" },
            h("p", { class: `bubble${hide && !done ? " hidden-text" : ""}` }, ln.you),
            h("button", { class: "btn quiet say", "aria-label": "Hear your line", onclick: () => speak(ln.you) }, icon("play"))),
            sc ? h("p", { class: "said" }, h("b", {}, `${Math.round(sc.score * 100)}%`), sc.text ? ` You said: "${sc.text}"` : "") : null)),
      ];
    }));
    lines.lastElementChild?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  async function turn() {
    draw();
    status.textContent = "";
    await speak(conv.lines[at].they, true);
  }

  function check(alternatives) {
    const ln = conv.lines[at];
    const score = bestScore(alternatives, ln.you);
    scores[at] = { score, text: alternatives[0] };
    typed.value = "";
    if (score >= PASS) {
      status.textContent = "Nice.";
      at++;
      if (at >= conv.lines.length) return finish();
      turn();
    } else {
      draw();
      status.textContent = score >= 0.4 ? "Close. Listen to your line and try again." : "Not quite. Listen to your line, then say it.";
      speak(ln.you);
    }
  }

  mic.addEventListener("click", async () => {
    if (busy) { rec?.stop(); return; }
    busy = true;
    stop();
    mic.classList.add("on");
    status.textContent = "Listening…";
    try {
      rec = listen();
      const r = await rec;
      if (!r.text) status.textContent = "I didn't hear anything. Tap the microphone and speak.";
      else check(r.alternatives.length ? r.alternatives : [r.text]);
    } catch (e) {
      toast(e.message, 4000);
      status.textContent = "";
    } finally { busy = false; mic.classList.remove("on"); }
  });

  function finish() {
    const avg = Math.round((100 * scores.reduce((a, b) => a + b.score, 0)) / scores.length);
    s.speak[conv.id] = { best: Math.max(avg, s.speak[conv.id]?.best || 0), at: dayNumber() };
    addTime(s, dayNumber(), (Date.now() - started) / 1000);
    save();
    draw();
    const nextConv = convs[(convs.indexOf(conv) + 1) % convs.length];
    root.querySelector(".speak-bar").replaceChildren(h("div", {},
      h("p", { class: "plan-line" }, `Conversation complete: ${avg}%.`, h("small", {}, hide ? "From memory, too." : "Next time, try it with your lines hidden.")),
      h("div", { class: "row", style: "margin-top:14px" },
        h("button", { class: "btn primary", onclick: () => window.dispatchEvent(new HashChangeEvent("hashchange")) }, "Practice again"),
        h("a", { class: "btn", href: `#/speak/${nextConv.id}` }, `Next: ${nextConv.title}`))));
  }

  turn();
  return () => { stop(); rec?.stop(); };
}
