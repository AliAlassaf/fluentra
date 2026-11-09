// Real video clips of a word or phrase, from YouGlish's public embed widget. Loaded only when you ask for it,
// so no third-party script runs until then.
import { h } from "./ui.js";

const SCRIPT = "https://youglish.com/public/emb/widget.js";
let ready = null;
let n = 0;

function loadWidget() {
  if (ready) return ready;
  ready = new Promise((resolve, reject) => {
    if (window.YG?.Widget) return resolve(window.YG);
    window.onYouglishAPIReady = () => resolve(window.YG);
    const s = document.createElement("script");
    s.src = SCRIPT;
    s.async = true;
    s.onerror = () => { ready = null; reject(new Error("The video service didn't load.")); };
    document.head.append(s);
    setTimeout(() => { if (!window.YG?.Widget) { ready = null; reject(new Error("The video service is taking too long.")); } }, 10000);
  });
  return ready;
}

/** A button that, when pressed, shows clips of real people saying `query` in American English. */
export function clipBox(query) {
  const box = h("div", { class: "clip" });
  const btn = h("button", { class: "btn", type: "button" }, "Show clips");
  box.append(h("p", { class: "clip-note" }, `Watch real YouTube clips of Americans saying "${query}".`, h("br"), btn));
  btn.addEventListener("click", async () => {
    btn.disabled = true;
    btn.textContent = "Loading…";
    try {
      const YG = await loadWidget();
      const id = `yg-${++n}`;
      const holder = h("div", { id });
      box.replaceChildren(holder);
      const widget = new YG.Widget(id, {
        width: Math.min(640, box.clientWidth || 480), components: 9, autoStart: 1,
        events: { onFetchDone: (e) => { if (!e.totalResult) box.replaceChildren(h("p", { class: "clip-note" }, `No clips found for "${query}" yet.`)); } },
      });
      widget.fetch(query, "english", "us");
    } catch (e) {
      box.replaceChildren(h("p", { class: "clip-note" }, `${e.message} `, h("a", { href: `https://youglish.com/pronounce/${encodeURIComponent(query)}/english/us`, target: "_blank", rel: "noopener" }, "Open YouGlish in a new tab")));
    }
  });
  return box;
}
