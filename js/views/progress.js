// Progress: the headline numbers, an activity grid, words by level, sound pairs, and your data (voice, export, import).
import { h, fmt, plural, toast } from "../ui.js";
import { load, save, exportFile, importFile, reset } from "../store.js";
import * as data from "../data.js";
import { summary, activity } from "../core/progress.js";
import { dayNumber, dayKey } from "../core/srs.js";
import { LEVELS, LEVEL_NAMES, DAILY_CHOICES } from "../core/session.js";
import { accuracy, levelOf } from "../core/ear.js";
import { englishVoices, say } from "../speech.js";

export async function render(root) {
  const s = load(), today = dayNumber();
  const words = await data.words();
  const sum = summary(s, words, today);
  root.append(h("div", { class: "page-head" }, h("div", {}, h("h1", {}, "Progress"),
    h("p", {}, "A word counts as learned once you remember it after three weeks or more."))));

  root.append(h("div", { class: "stats" },
    stat(fmt(sum.learned), "words learned"), stat(fmt(sum.studied), "words studied"),
    stat(plural(sum.streak, "day"), "streak"), stat(sum.accuracy30 === null ? "–" : `${sum.accuracy30}%`, "recall, last 30 days")));

  const grid = activity(s, today, 20);
  const max = Math.max(1, ...grid.flat().map((d) => d.count || 0));
  const lvl = (n) => (n === null ? null : n === 0 ? 0 : Math.min(4, Math.ceil((4 * n) / max)));
  root.append(h("section", { class: "block" }, h("h2", {}, "Activity"),
    h("p", {}, `${fmt(sum.minutes30)} minutes of study in the last 30 days. Each square is a day; darker means more cards and practice.`),
    h("div", { class: "heat", role: "img", "aria-label": "Study activity over the last 20 weeks" }, grid.map((col) => h("div", { class: "col" },
      col.map((d) => h("span", { class: `c${d.count === null ? " future" : ""}`, "data-l": lvl(d.count) ?? "", title: d.count === null ? "" : `${dayKey(d.day)}: ${d.count}` }))))),
    h("div", { class: "heat-legend" }, "Less", [0, 1, 2, 3, 4].map((l) => h("span", { class: "c", "data-l": l, style: `background:var(--heat-${l})` })), "More")));

  root.append(h("section", { class: "block" }, h("h2", {}, "Words by level"),
    h("div", { class: "levels" }, LEVELS.map((lv) => {
      const b = sum.byLevel[lv] || { total: 0, studied: 0, learned: 0 };
      const pct = (n) => (b.total ? (100 * n) / b.total : 0);
      return h("div", { class: "lvrow" }, h("span", { class: "name" }, lv, h("small", {}, LEVEL_NAMES[lv])),
        h("div", { class: "stack", role: "img", "aria-label": `${lv}: ${b.learned} learned, ${b.studied} studied of ${b.total}` },
          h("i", { class: "learned", style: `width:${pct(b.learned)}%` }), h("i", { class: "studied", style: `width:${pct(b.studied - b.learned)}%` })),
        h("span", { class: "num" }, `${fmt(b.studied)} / ${fmt(b.total)}`));
    })),
    h("div", { class: "key" }, h("span", { class: "k-learned" }, "Learned"), h("span", { class: "k-studied" }, "Studying"))));

  const { contrasts } = await data.get("sounds");
  const tried = contrasts.filter((c) => s.ear[c.id]);
  root.append(h("section", { class: "block" }, h("h2", {}, "Sounds"),
    tried.length
      ? h("ul", { class: "pair-list" }, tried.map((c) => h("li", {}, h("a", { class: "pair-row", href: `#/sounds/ear/${c.id}`, style: "text-decoration:none" },
          h("span", { class: "t" }, c.title), h("span", { class: `score ${levelOf(s.ear[c.id])}` }, `${accuracy(s.ear[c.id]).pct}%`), h("span", { class: "meta" }, "›")))))
      : h("p", {}, "No ear training yet. ", h("a", { href: "#/sounds/ear" }, "Try a round"), " to see which sounds you mix up.")));

  // settings
  const daily = h("div", { class: "chips" }, DAILY_CHOICES.map((n) => h("button", { class: "chip", type: "button", "aria-pressed": String(s.profile?.daily === n), onclick: (e) => {
    s.profile.daily = n; save(); for (const b of daily.children) b.setAttribute("aria-pressed", String(b === e.currentTarget)); toast(`${n} new words a day.`);
  } }, `${n} a day`)));
  const level = h("select", { class: "input", "aria-label": "Starting level", style: "max-width:22rem" },
    LEVELS.map((lv) => h("option", { value: lv, selected: s.profile?.level === lv }, `${lv} ${LEVEL_NAMES[lv]}`)));
  level.addEventListener("change", () => { s.profile.level = level.value; save(); toast(`New words now start at ${level.value}.`); });
  const voices = englishVoices();
  const voice = h("select", { class: "input", "aria-label": "Voice", style: "max-width:22rem" }, h("option", { value: "" }, "Automatic (best US voice)"),
    voices.map((v) => h("option", { value: v.name, selected: s.settings.voice === v.name }, `${v.name} (${v.lang})`)));
  voice.addEventListener("change", () => { s.settings.voice = voice.value; save(); say("This is how I sound.", { voice: voice.value, rate: s.settings.rate }); });
  const rate = h("input", { type: "range", min: "0.7", max: "1.2", step: "0.05", value: s.settings.rate, "aria-label": "Speaking speed" });
  rate.addEventListener("change", () => { s.settings.rate = Number(rate.value); save(); say("This is the new speed.", { voice: s.settings.voice, rate: s.settings.rate }); });
  const file = h("input", { type: "file", accept: "application/json,.json", hidden: true });
  file.addEventListener("change", async () => {
    const f = file.files[0];
    if (!f) return;
    try { await importFile(f); toast("Progress imported."); window.dispatchEvent(new HashChangeEvent("hashchange")); }
    catch (e) { toast(e.message, 4000); }
  });
  root.append(h("section", { class: "block" }, h("h2", {}, "Settings"),
    h("div", { style: "display:grid;gap:20px" },
      h("div", { class: "field" }, h("label", {}, "New words a day"), daily),
      h("div", { class: "field" }, h("label", {}, "Start new words at"), level),
      h("div", { class: "field" }, h("label", {}, "Voice"), voice),
      h("div", { class: "field" }, h("label", {}, "Speaking speed"), rate))));
  root.append(h("section", { class: "block" }, h("h2", {}, "Your data"),
    h("p", {}, "Your progress is saved only in this browser. Export it to keep a backup or move it to another device."),
    h("div", { class: "row" },
      h("button", { class: "btn", onclick: exportFile }, "Export progress"),
      h("button", { class: "btn", onclick: () => file.click() }, "Import progress"), file,
      h("button", { class: "btn quiet", onclick: () => {
        if (!confirm("Erase all your progress in this browser? This can't be undone unless you exported a backup.")) return;
        reset(); location.hash = "#/welcome";
      } }, "Erase progress"))));
}

const stat = (num, label) => h("div", { class: "stat" }, h("b", {}, num), h("span", {}, label));
