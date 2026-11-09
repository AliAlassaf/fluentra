// Today: the next word you'll learn, today's plan in one sentence, the week, and other things to practice.
import { h, icon, markedSentence, plural } from "../ui.js";
import { load } from "../store.js";
import * as data from "../data.js";
import { plan, nextNew } from "../core/session.js";
import { dayNumber } from "../core/srs.js";
import { streak } from "../core/progress.js";
import { levelOf } from "../core/ear.js";

const DAYS = ["M", "T", "W", "T", "F", "S", "S"];

export async function render(root) {
  const s = load(), today = dayNumber();
  const words = await data.words();
  const p = plan(s, words, today);
  const nextId = p.fresh[0] || nextNew(s, words, 1)[0];
  const next = nextId ? data.wordSync(nextId) : null;
  const total = p.reviews.length + p.fresh.length;

  const hero = next
    ? h("section", { class: "hero-word", "aria-label": "Your next new word" },
        h("p", { class: "hero-label" }, p.fresh.length ? "Your next new word" : "Coming up next"),
        h("p", { class: "word-big", lang: "en" }, next.word),
        markedSentence(next.ex, next.word, { swipe: true }),
        h("p", { class: "def" }, next.def))
    : null;

  const line = total
    ? h("p", { class: "plan-line" },
        [p.reviews.length ? plural(p.reviews.length, "word") + " to review" : null, p.fresh.length ? plural(p.fresh.length, "new word") : null].filter(Boolean).join(" and ") + ".",
        h("small", {}, `About ${plural(p.minutes, "minute")}.`))
    : h("p", { class: "plan-line" }, "You're done for today.", h("small", {}, "Your next reviews are scheduled. Keep going with a few extra words, or practice sounds and speaking below."));

  const start = total
    ? h("a", { class: "btn primary big start", href: "#/study" }, p.reviews.length && !p.fresh.length ? "Start reviews" : "Start today's session")
    : h("div", { class: "row start" }, h("a", { class: "btn primary big", href: "#/study/extra" }, "Learn 5 more words"),
        h("a", { class: "btn big", href: "#/words" }, "Browse words"));

  const st = streak(s, today);
  const dow = (new Date(today * 86400000).getUTCDay() + 6) % 7;
  const week = h("div", { class: "week", "aria-label": `This week. Streak: ${plural(st, "day")}.` },
    DAYS.map((d, i) => {
      const day = today - dow + i, l = s.log[day];
      const on = !!l && (l.reviews > 0 || l.seconds >= 60);
      return h("div", { class: "d" }, h("span", { class: `dot${on ? " on" : ""}${day === today ? " today" : ""}`, "aria-hidden": "true" }, on ? "✓" : ""), d);
    }));

  const ear = await data.get("sounds");
  const weak = ear.contrasts.filter((c) => levelOf(s.ear[c.id]) === "weak").length;
  const conv = await data.get("conversations");
  const grammar = await data.get("grammar");
  const nextGrammar = grammar.find((g) => !s.grammar[g.id]) || grammar[0];
  const more = h("nav", { class: "more", "aria-label": "More practice" },
    moreLink("#/practice/respond", "practice", "Say it from memory", "Real situations: you produce the reply, no reading first", "5 min"),
    moreLink("#/sounds/ear", "sounds", "Train your ear", weak ? `${plural(weak, "sound pair")} to work on` : "Tell similar sounds apart: ship or sheep?", "2 min"),
    moreLink(`#/speak`, "speak", "Practice a conversation", `${conv.length} everyday situations, line by line`, "5 min"),
    moreLink(`#/grammar/${nextGrammar.id}`, "grammar", `Grammar: ${nextGrammar.title}`, nextGrammar.meaning || "One point, with a short quiz", "4 min"));

  root.append(
    h("h1", { class: "sr-only" }, "Today"),
    hero, line, start, week,
    h("p", { class: "meta", style: "margin-top:10px" }, st ? `${plural(st, "day")} in a row.` : "Study today to start a streak."),
    more,
  );
}

function moreLink(href, ico, title, sub, time) {
  return h("a", { href }, h("span", { class: "ico" }, icon(ico)),
    h("span", {}, h("span", { class: "more-title" }, title), h("br"), h("span", { class: "more-sub" }, sub)),
    h("span", { class: "go" }, time));
}
