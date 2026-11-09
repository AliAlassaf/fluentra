// Words and phrases: search and filter the whole course, open a word for its meaning, example, similar words and
// real video clips of people saying it (YouGlish).
import { h, icon, markedSentence, sheet, fmt, plural } from "../ui.js";
import { load } from "../store.js";
import * as data from "../data.js";
import { LEVELS, LEVEL_NAMES } from "../core/session.js";
import { isMature, dayNumber, inWords } from "../core/srs.js";
import { say } from "../speech.js";
import { clipBox } from "../clips.js";
import { explainBox, mineBox } from "../explain.js";

const PAGE = 60;
const USES = {
  opinion: "Giving opinions", feeling: "Feelings", link: "Connecting ideas", idiom: "Idioms", story: "Telling stories",
  advice: "Advice", question: "Questions", request: "Requests", describe: "Describing", social: "Social", plan: "Plans",
  everyday: "Everyday", problem: "Problems", grammar: "Grammar", habit: "Habits",
};

export async function render(root, [tab = "words"]) {
  const s = load();
  const speak = (t) => say(t, { rate: s.settings.rate, voice: s.settings.voice });
  const isPhrases = tab === "phrases";
  root.append(h("div", { class: "page-head" },
    h("div", {}, h("h1", {}, isPhrases ? "Phrases" : "Words"),
      h("p", {}, isPhrases ? "Ready-made sentence patterns for everyday situations, each with real examples." : "Every word in the course, with its meaning and an example sentence.")),
    h("div", { class: "chips", role: "tablist" },
      h("a", { class: "chip", href: "#/words", role: "tab", "aria-pressed": String(!isPhrases) }, "Words"),
      h("a", { class: "chip", href: "#/words/phrases", role: "tab", "aria-pressed": String(isPhrases) }, "Phrases"))));
  return isPhrases ? phrases(root, speak) : wordsList(root, s, speak);
}

async function wordsList(root, s, speak) {
  const all = await data.words();
  const f = { q: "", level: "all", topic: "all", status: "all", shown: PAGE };
  const q = h("input", { class: "input", type: "search", placeholder: `Search ${fmt(all.length)} words`, "aria-label": "Search words" });
  const level = h("select", { class: "input", "aria-label": "Level" }, h("option", { value: "all" }, "All levels"),
    LEVELS.map((lv) => h("option", { value: lv }, `${lv} ${LEVEL_NAMES[lv]}`)));
  const topic = h("select", { class: "input", "aria-label": "Topic" }, h("option", { value: "all" }, "All topics"),
    Object.entries(data.TOPICS).map(([id, name]) => h("option", { value: id }, name)));
  const status = h("select", { class: "input", "aria-label": "Status" },
    [["all", "Any status"], ["new", "Not studied yet"], ["studied", "Studying"], ["learned", "Learned"]].map(([v, t]) => h("option", { value: v }, t)));
  const list = h("ul", { class: "word-list" });
  const foot = h("div", { class: "list-foot" });
  root.append(h("div", { class: "filters" }, q, h("div", { style: "display:grid;grid-template-columns:repeat(auto-fit,minmax(10rem,1fr));gap:10px" }, level, topic, status)), list, foot);

  const stateOf = (w) => { const c = s.cards[w.id]; return !c ? "new" : isMature(c) ? "learned" : "studied"; };
  const draw = () => {
    const needle = f.q.trim().toLowerCase();
    const hits = all.filter((w) => (f.level === "all" || w.level === f.level) && (f.topic === "all" || w.topic === f.topic)
      && (f.status === "all" || stateOf(w) === f.status)
      && (!needle || w.word.toLowerCase().includes(needle) || w.def.toLowerCase().includes(needle)));
    if (needle) hits.sort((a, b) => (b.word.toLowerCase().startsWith(needle) - a.word.toLowerCase().startsWith(needle)));
    list.replaceChildren(...hits.slice(0, f.shown).map((w) => {
      const st = stateOf(w);
      return h("li", {}, h("button", { class: "word-row", type: "button", onclick: () => openWord(w, s, speak) },
        h("span", { class: "w" }, w.word), h("span", { class: "d" }, w.def),
        h("span", { class: `st ${st}`, title: { new: "Not studied yet", studied: "Studying", learned: "Learned" }[st] })));
    }));
    foot.replaceChildren(h("span", {}, hits.length ? `Showing ${fmt(Math.min(f.shown, hits.length))} of ${fmt(hits.length)}` : ""),
      ...(hits.length > f.shown ? [h("button", { class: "btn", onclick: () => { f.shown += PAGE; draw(); } }, "Show more")] : []));
    if (!hits.length) list.replaceChildren(h("li", { class: "empty" }, h("h3", {}, "No words match."), h("p", {}, "Try a shorter search or clear a filter.")));
  };
  let t = 0;
  q.addEventListener("input", () => { clearTimeout(t); t = setTimeout(() => { f.q = q.value; f.shown = PAGE; draw(); }, 120); });
  for (const [el, k] of [[level, "level"], [topic, "topic"], [status, "status"]]) el.addEventListener("change", () => { f[k] = el.value; f.shown = PAGE; draw(); });
  draw();
}

export function openWord(w, s, speak) {
  const { body } = sheet(w.word);
  const c = s.cards[w.id];
  body.append(
    h("p", { class: "meta" }, h("span", { class: "lv" }, w.level), " ", data.TOPICS[w.topic] || ""),
    h("div", { class: "row", style: "margin-top:8px" }, h("h2", {}, w.word),
      h("button", { class: "btn say", "aria-label": `Listen to ${w.word}`, onclick: () => speak(w.word) }, icon("play"))),
    h("p", { class: "def", style: "margin-top:10px" }, w.def),
    h("section", {}, h("h3", {}, "In a sentence"),
      h("div", { class: "row", style: "align-items:flex-start;flex-wrap:nowrap" }, markedSentence(w.ex, w.word, { swipe: true }),
        h("button", { class: "btn quiet say", "aria-label": "Listen to the sentence", onclick: () => speak(w.ex) }, icon("play")))),
    w.syn?.length ? h("section", {}, h("h3", {}, "Similar words"), h("p", { class: "read" }, w.syn.join(", "))) : null,
    w.casual ? h("section", {}, h("h3", {}, "Said casually"), h("p", { class: "read" }, w.casual)) : null,
    h("section", {}, h("h3", {}, "Make it yours"), mineBox(s, w)),
    h("section", {}, h("h3", {}, "Hear it in real videos"), clipBox(w.word)),
    h("section", {}, h("h3", {}, "Explain it simply"), explainBox(s, { target: w.word, model: w.def, gapKey: `word:${w.id}`, what: `"${w.word}"` })),
    h("section", {}, h("h3", {}, "Your progress"),
      h("p", { class: "read" }, !c ? "Not studied yet. It will come up in your daily sessions." : isMature(c) ? "Learned. It comes back now and then so you keep it." : `Studying: answered ${plural(c.reps + c.lapses, "time")}, next review ${c.due <= dayNumber() ? "today" : inWords(c.due - dayNumber())}.`)));
}

async function phrases(root, speak) {
  const all = await data.get("phrases");
  const f = { use: "all", level: "all", q: "", shown: 40 };
  const q = h("input", { class: "input", type: "search", placeholder: `Search ${fmt(all.length)} phrases`, "aria-label": "Search phrases" });
  const use = h("select", { class: "input", "aria-label": "Used for" }, h("option", { value: "all" }, "Any use"),
    Object.entries(USES).map(([id, n]) => h("option", { value: id }, n)));
  const level = h("select", { class: "input", "aria-label": "Level" }, h("option", { value: "all" }, "All levels"), LEVELS.map((lv) => h("option", { value: lv }, lv)));
  const list = h("ul", { class: "g-list" });
  const foot = h("div", { class: "list-foot" });
  root.append(h("div", { class: "filters" }, q, h("div", { style: "display:grid;grid-template-columns:1fr 1fr;gap:10px" }, use, level)), list, foot);
  const draw = () => {
    const n = f.q.trim().toLowerCase();
    const hits = all.filter((p) => (f.use === "all" || p.use === f.use) && (f.level === "all" || p.level === f.level)
      && (!n || p.pattern.toLowerCase().includes(n) || p.examples.some((e) => e.toLowerCase().includes(n))));
    list.replaceChildren(...hits.slice(0, f.shown).map((p) => h("li", {}, h("button", { class: "g-row", type: "button", onclick: () => openPhrase(p, speak) },
      h("span", { class: "t" }, p.pattern), h("span", { class: "lv" }, p.level), h("span", { class: "m" }, p.examples[0])))));
    foot.replaceChildren(h("span", {}, `Showing ${fmt(Math.min(f.shown, hits.length))} of ${fmt(hits.length)}`),
      ...(hits.length > f.shown ? [h("button", { class: "btn", onclick: () => { f.shown += 40; draw(); } }, "Show more")] : []));
  };
  let t = 0;
  q.addEventListener("input", () => { clearTimeout(t); t = setTimeout(() => { f.q = q.value; f.shown = 40; draw(); }, 120); });
  use.addEventListener("change", () => { f.use = use.value; draw(); });
  level.addEventListener("change", () => { f.level = level.value; draw(); });
  draw();
}

function openPhrase(p, speak) {
  const { body } = sheet(p.pattern);
  body.append(
    h("p", { class: "meta" }, h("span", { class: "lv" }, p.level), " ", USES[p.use] || ""),
    h("h2", { style: "font-size:var(--s3);margin-top:8px" }, p.pattern),
    h("section", {}, h("h3", {}, "Examples"),
      h("ul", { class: "ex-list" }, p.examples.map((e) => h("li", {}, h("button", { class: "btn quiet say", "aria-label": `Listen: ${e}`, onclick: () => speak(e) }, icon("play")), e)))),
    p.fast.length ? h("section", {}, h("h3", {}, "How it sounds in fast speech"),
      h("ul", { class: "ex-list" }, p.fast.map((e) => h("li", {}, h("button", { class: "btn quiet say", "aria-label": `Listen: ${e}`, onclick: () => speak(e) }, icon("play")), e)))) : null,
    h("section", {}, h("h3", {}, "Hear it in real videos"), clipBox(p.examples[0].split(/[,.!?]/)[0].split(" ").slice(0, 6).join(" "))));
}
