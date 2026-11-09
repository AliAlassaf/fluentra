// Fluentra: the router and the navigation. Each page is a module in js/views with render(root, params).
import { h, icon, tolerant } from "./ui.js";
import { load } from "./store.js";
import { plan } from "./core/session.js";
import { dayNumber } from "./core/srs.js";
import * as data from "./data.js";

const PAGES = [
  { id: "today", label: "Today", tab: true },
  { id: "words", label: "Words", tab: true },
  { id: "sounds", label: "Sounds", tab: true },
  { id: "grammar", label: "Grammar", tab: true },
  { id: "speak", label: "Speak", tab: true },
  { id: "progress", label: "Progress", tab: false },
];
const VIEWS = {
  today: () => import("./views/today.js"),
  study: () => import("./views/study.js"),
  words: () => import("./views/words.js"),
  sounds: () => import("./views/sounds.js"),
  grammar: () => import("./views/grammar.js"),
  speak: () => import("./views/speak.js"),
  progress: () => import("./views/progress.js"),
  about: () => import("./views/about.js"),
  welcome: () => import("./views/welcome.js"),
};

const root = document.getElementById("view");
let cleanup = null;

function drawNav(current) {
  const nav = document.getElementById("nav"), tabbar = document.getElementById("tabbar");
  nav.replaceChildren(...PAGES.map((p) => h("a", { href: `#/${p.id}`, "aria-current": p.id === current ? "page" : null },
    icon(p.id), p.label, p.id === "today" ? h("span", { class: "badge", id: "due-badge" }) : null)));
  tabbar.replaceChildren(...PAGES.filter((p) => p.tab).map((p) => h("a", { href: `#/${p.id}`, "aria-current": p.id === current ? "page" : null },
    icon(p.id), p.label)));
  const top = document.getElementById("top-progress");
  if (!top.firstChild) top.append(icon("progress"));
}

/** The number of reviews due, next to "Today" in the side navigation. */
export async function refreshBadge() {
  const b = document.getElementById("due-badge");
  if (!b) return;
  const s = load();
  if (!s.profile) { b.textContent = ""; return; }
  const p = plan(s, await data.words(), dayNumber());
  const n = p.reviews.length + p.fresh.length;
  b.textContent = n ? String(n) : "";
  b.setAttribute("aria-label", n ? `${n} cards today` : "");
}

async function route() {
  const [, name = "today", ...rest] = (location.hash || "#/today").split("/");
  let view = VIEWS[name] ? name : "today";
  if (!load().profile && !["about", "welcome"].includes(view)) view = "welcome";
  drawNav(view === "study" || view === "welcome" ? "today" : view);
  cleanup?.();
  cleanup = null;
  document.querySelectorAll(".sheet-back").forEach((el) => el.remove()); // a sheet never outlives its page
  root.replaceChildren(h("div", { class: "page", "aria-busy": "true" }));
  try {
    const mod = await VIEWS[view]();
    const page = tolerant(h("div", { class: "page" }));
    root.replaceChildren(page);
    cleanup = (await mod.render(page, rest.map(decodeURIComponent))) || null;
    document.title = view === "today" ? "Fluentra" : `${(PAGES.find((p) => p.id === view)?.label || view[0].toUpperCase() + view.slice(1))} · Fluentra`;
  } catch (e) {
    console.error(e);
    root.replaceChildren(h("div", { class: "page empty" }, h("h3", {}, "This page didn't load."), h("p", {}, `${e.message} Check your connection and reload.`)));
  }
  root.focus({ preventScroll: true });
  window.scrollTo(0, 0);
  refreshBadge();
}

function theme() {
  const btn = document.getElementById("theme");
  const saved = (() => { try { return localStorage.getItem("fluentra:theme"); } catch { return null; } })();
  if (saved) document.documentElement.dataset.theme = saved;
  const dark = () => document.documentElement.dataset.theme === "dark" ||
    (!document.documentElement.dataset.theme && matchMedia("(prefers-color-scheme: dark)").matches);
  const label = () => { btn.textContent = dark() ? "Light mode" : "Dark mode"; };
  btn.addEventListener("click", () => {
    const next = dark() ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("fluentra:theme", next); } catch { /* private mode */ }
    label();
  });
  label();
}

window.addEventListener("hashchange", route);
theme();
route();
if ("serviceWorker" in navigator && location.protocol !== "file:") navigator.serviceWorker.register("sw.js").catch(() => {});
