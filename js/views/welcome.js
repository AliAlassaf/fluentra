// First visit: pick a starting level and how many new words a day.
import { h } from "../ui.js";
import { load, save } from "../store.js";
import { LEVELS, LEVEL_NAMES, DAILY_CHOICES } from "../core/session.js";
import { dayNumber } from "../core/srs.js";

const LEVEL_HINT = {
  B1: "You can handle everyday conversations and want more words.",
  B2: "You talk about most topics, but still reach for words.",
  C1: "You're comfortable; you want precise, natural English.",
  C2: "You want the words native speakers use without thinking.",
};

export function render(root) {
  let level = "B1", daily = 10;
  const pick = (group, value, set) => (e) => {
    set(value);
    for (const b of group.querySelectorAll("[aria-pressed]")) b.setAttribute("aria-pressed", String(b === e.currentTarget));
  };
  const levels = h("div", { class: "choice-grid", role: "group", "aria-label": "Starting level" });
  levels.append(...LEVELS.map((lv) => h("button", { class: "choice", type: "button", "aria-pressed": String(lv === level), onclick: pick(levels, lv, (v) => { level = v; }) },
    h("b", {}, lv), h("span", {}, LEVEL_NAMES[lv]), h("small", {}, LEVEL_HINT[lv]))));
  const dailyRow = h("div", { class: "chips", role: "group", "aria-label": "New words a day" });
  dailyRow.append(...DAILY_CHOICES.map((n) => h("button", { class: "chip", type: "button", "aria-pressed": String(n === daily), onclick: pick(dailyRow, n, (v) => { daily = v; }) }, `${n} a day`)));

  root.className = "page welcome";
  root.append(
    h("h1", {}, "English that sticks."),
    h("p", { class: "lede" }, "Learn 3,600 useful American English words inside real sentences, hear how they sound, and say them out loud. Fluentra brings each word back right before you'd forget it."),
    h("h2", { class: "step-title" }, "Where do you want to start?"),
    levels,
    h("h2", { class: "step-title" }, "New words each day"),
    h("p", { class: "meta", style: "margin:4px 0 12px" }, "Ten takes about ten minutes, with reviews. You can change this later."),
    dailyRow,
    h("div", { class: "row", style: "margin-top:36px" },
      h("button", { class: "btn primary big", type: "button", onclick: () => {
        const s = load();
        s.profile = { level, daily, since: dayNumber() };
        save();
        location.hash = "#/today";
      } }, "Start learning")),
    h("p", { class: "meta", style: "margin-top:16px" }, "No account needed. Your progress stays in this browser, and you can export it any time."),
  );
}
