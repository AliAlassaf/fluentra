// Small DOM helpers shared by the pages: element builder, icons, the highlighted sentence, sheets and toasts.
import { findWord } from "./core/text.js";

/** h("button", { class: "btn", onclick }, "Text", child…) — attributes starting with "on" become listeners. */
export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else if (k === "class") el.className = v;
    else if (k === "html") el.innerHTML = v;
    else if (v === true) el.setAttribute(k, "");
    else el.setAttribute(k, v);
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid === null || kid === undefined || kid === false) continue;
    el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

const PATHS = {
  today: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  words: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 21V5M8 7h7M8 11h5"/>',
  sounds: '<path d="M3 12h2M7 8v8M11 4v16M15 7v10M19 10v4M21 12h0"/>',
  grammar: '<path d="M8 4H5v16h3M16 4h3v16h-3"/><path d="M9.5 15l2.5-7 2.5 7M10.3 13h3.4"/>',
  speak: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  progress: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  play: '<path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  slow: '<path d="M3 17c2-6 6-9 11-9a5 5 0 0 1 5 5v4H3z"/><path d="M19 13h2M7 17v2M14 17v2"/>',
};
export function icon(name) {
  const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  s.setAttribute("viewBox", "0 0 24 24");
  s.setAttribute("fill", "none");
  s.setAttribute("stroke", "currentColor");
  s.setAttribute("stroke-width", "1.8");
  s.setAttribute("stroke-linecap", "round");
  s.setAttribute("stroke-linejoin", "round");
  s.setAttribute("aria-hidden", "true");
  s.innerHTML = PATHS[name] || "";
  return s;
}

/** The example sentence with the word highlighted (or hidden as a gap). */
export function markedSentence(sentence, word, { gap = false, swipe = false, tag = "p", cls = "sentence" } = {}) {
  const parts = findWord(sentence, word);
  if (!parts) return h(tag, { class: cls }, gap ? sentence.replace(new RegExp(word, "ig"), "_____") : sentence);
  return h(tag, { class: cls }, parts.map((p) => (p.hit
    ? (gap ? h("span", { class: "gap", "aria-label": "missing word" }, p.t) : h("mark", { class: `mark${swipe ? " swipe" : ""}` }, p.t))
    : p.t)));
}

/** Make el.append() skip null/false (optional parts of a page) and flatten arrays, like h() does. */
export function tolerant(el) {
  const native = Element.prototype.append;
  el.append = (...kids) => native.apply(el, kids.flat(Infinity).filter((k) => k !== null && k !== undefined && k !== false));
  return el;
}

let toastTimer = 0;
export function toast(text, ms = 2600) {
  document.querySelector(".toast")?.remove();
  const t = h("div", { class: "toast", role: "status" }, text);
  document.body.append(t);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.remove(), ms);
}

/** A side sheet (bottom sheet on phones). Returns { body, close }. Escape and the backdrop close it. */
export function sheet(label) {
  const prev = document.activeElement;
  const body = tolerant(h("div", { class: "sheet", role: "dialog", "aria-modal": "true", "aria-label": label, tabindex: "-1" }));
  const back = h("div", { class: "sheet-back" }, body);
  const close = () => { back.remove(); document.removeEventListener("keydown", onKey); prev?.focus?.(); };
  const onKey = (e) => { if (e.key === "Escape") close(); };
  back.addEventListener("click", (e) => { if (e.target === back) close(); });
  document.addEventListener("keydown", onKey);
  body.append(h("button", { class: "btn quiet say sheet-close", "aria-label": "Close", onclick: close }, icon("close")));
  document.body.append(back);
  requestAnimationFrame(() => body.focus());
  return { body, close };
}

export const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
export const fmt = (n) => Number(n).toLocaleString("en-US");
