// Grammar: 42 points from basics to advanced, each with why it matters, the pattern, how Americans really say it,
// common mistakes, examples you can listen to, and a short quiz.
import { h, icon } from "../ui.js";
import { load, save } from "../store.js";
import * as data from "../data.js";
import { addTime } from "../core/progress.js";
import { dayNumber } from "../core/srs.js";
import { say } from "../speech.js";

const LEVELS = { A2: "Basics", B1: "Everyday English", B2: "Accuracy and natural style", C1: "Advanced" };

export async function render(root, [id]) {
  const s = load();
  const points = await data.get("grammar");
  const point = id && points.find((p) => p.id === id);
  return point ? detail(root, s, point, points) : list(root, s, points);
}

function list(root, s, points) {
  root.append(h("div", { class: "page-head" }, h("div", {}, h("h1", {}, "Grammar"),
    h("p", {}, "The grammar you need to speak naturally, one point at a time. Each one ends with a short quiz."))));
  for (const [lv, name] of Object.entries(LEVELS)) {
    const these = points.filter((p) => p.level === lv);
    if (!these.length) continue;
    root.append(h("section", { class: "g-section" }, h("h3", {}, h("span", { class: "lv" }, lv), " ", name),
      h("ul", { class: "g-list" }, these.map((p) => {
        const r = s.grammar[p.id];
        return h("li", {}, h("a", { class: "g-row", href: `#/grammar/${p.id}`, style: "text-decoration:none" },
          h("span", { class: "t" }, p.title),
          h("span", { class: `score${r ? (r.best === r.of ? " strong" : " fair") : ""}` }, r ? `${r.best}/${r.of}` : "New"),
          h("span", { class: "m" }, p.meaning || p.pattern || "")));
      }))));
  }
}

function detail(root, s, p, points) {
  const speak = (t) => say(t, { rate: s.settings.rate, voice: s.settings.voice });
  const started = Date.now();
  const at = points.indexOf(p), next = points[at + 1];
  let answered = 0, right = 0;
  root.append(
    h("a", { class: "btn quiet", href: "#/grammar", style: "margin-left:-12px" }, icon("back"), "All grammar"),
    h("p", { class: "meta", style: "margin-top:18px" }, h("span", { class: "lv" }, p.level), " ", LEVELS[p.level]),
    h("h1", { style: "margin-top:8px" }, p.title),
    p.meaning ? h("p", { class: "def", style: "margin-top:12px;color:var(--ink-2)" }, p.meaning) : null,
    p.pattern ? h("section", { class: "g-section" }, h("h3", {}, "The pattern"), h("p", { class: "pattern" }, p.pattern)) : null,
    h("section", { class: "g-section" }, h("h3", {}, "Why it matters"), h("p", { class: "def" }, p.why)),
    p.form.length ? h("section", { class: "g-section" }, h("h3", {}, "How it's formed"), h("ul", { class: "bullets read" }, p.form.map((f) => h("li", {}, f)))) : null,
    p.us ? h("section", { class: "g-section" }, h("h3", {}, "How Americans say it"), h("p", { class: "read" }, p.us)) : null,
    h("section", { class: "g-section" }, h("h3", {}, "Examples"),
      h("ul", { class: "ex-list" }, p.examples.map((e) => h("li", {}, h("button", { class: "btn quiet say", "aria-label": `Listen: ${e}`, onclick: () => speak(e) }, icon("play")), e)))),
    p.mistakes.length ? h("section", { class: "g-section" }, h("h3", {}, "Watch out for"), h("ul", { class: "bullets read" }, p.mistakes.map((m) => h("li", {}, m)))) : null,
  );
  if (p.quiz.length) {
    const score = h("p", { class: "meta", "aria-live": "polite" });
    root.append(h("section", { class: "g-section" }, h("h2", {}, "Quick check"), score,
      p.quiz.map((q, n) => {
        const fb = h("p", { class: "why" });
        const opts = h("div", { class: "options" }, q.options.map((o, k) => h("button", { class: "option", type: "button", onclick: (e) => {
          for (const b of opts.children) b.disabled = true;
          const ok = k === q.answer;
          e.currentTarget.classList.add(ok ? "right" : "wrong");
          if (!ok) opts.children[q.answer].classList.add("right");
          fb.textContent = `${ok ? "Correct." : "Not quite."} ${q.why}`;
          answered++; if (ok) right++;
          if (answered === p.quiz.length) {
            const prev = s.grammar[p.id];
            s.grammar[p.id] = { best: Math.max(right, prev?.best || 0), of: p.quiz.length };
            addTime(s, dayNumber(), (Date.now() - started) / 1000);
            save();
            score.textContent = `You got ${right} of ${p.quiz.length}.`;
          }
        } }, o)));
        return h("div", { class: "quiz-q" }, h("p", {}, `${n + 1}. ${q.q}`), opts, fb);
      })));
  }
  if (next) root.append(h("div", { class: "row", style: "margin-top:40px" }, h("a", { class: "btn", href: `#/grammar/${next.id}` }, `Next: ${next.title}`)));
}
