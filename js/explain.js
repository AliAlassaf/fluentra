// Two small boxes used on word and grammar pages:
//   explainBox — the Feynman check: explain it simply, out loud or typed; what made it hard becomes a "gap" to work on
//   mineBox    — make it yours: one sentence about your own life with the word
import { h, icon, toast, tolerant } from "./ui.js";
import { save } from "./store.js";
import { checkExplanation, usesWord } from "./core/practice.js";
import { listen, canListen, stop } from "./speech.js";
import { dayNumber } from "./core/srs.js";

/** A text box with an optional microphone that appends what you say. */
export function speakOrType({ placeholder, rows = 3 }) {
  const area = h("textarea", { class: "input", rows, placeholder, "aria-label": placeholder, style: "resize:vertical" });
  let rec = null;
  const mic = canListen() ? h("button", { class: "btn quiet", type: "button", onclick: async () => {
    if (rec) { rec.stop(); return; }
    stop();
    mic.classList.add("on");
    mic.lastChild.textContent = "Listening… tap to stop";
    try {
      rec = listen({ maxMs: 60000, long: true });
      const r = await rec;
      if (r.text) area.value = `${area.value.trim()} ${r.text}`.trim();
    } catch (e) { toast(e.message, 4000); }
    finally { rec = null; mic.classList.remove("on"); mic.lastChild.textContent = "Say it"; }
  } }, icon("speak"), h("span", {}, "Say it")) : null;
  return { area, mic };
}

/** Explain `target` simply. `model` is shown afterwards to compare; `gapKey` ("word:x" / "grammar:y") tracks gaps. */
export function explainBox(state, { target, model, gapKey, what = "this word" }) {
  const box = tolerant(h("div", { class: "explain" }));
  const { area, mic } = speakOrType({ placeholder: `Explain ${what} as if to a 10-year-old, in your own simple words` });
  const out = h("div", { "aria-live": "polite" });
  const check = h("button", { class: "btn primary", type: "button" }, "Check my explanation");
  const hadGap = !!state.gaps[gapKey];
  box.append(
    h("p", { class: "read", style: "color:var(--ink-2);margin-bottom:10px" },
      "If you can't explain it simply, you don't own it yet. Where you get stuck is exactly what to work on."),
    hadGap ? h("p", { class: "meta", style: "margin-bottom:8px" }, "This is on your gaps list. Explain it clearly to take it off.") : null,
    area, h("div", { class: "row", style: "margin-top:10px" }, check, mic), out);
  check.addEventListener("click", () => {
    const text = area.value.trim();
    if (!text) { area.focus(); return; }
    const r = checkExplanation(text, target);
    const notes = [];
    if (r.circular) notes.push(`You used "${target}" to explain itself. Try again without it.`);
    if (r.tooShort) notes.push("Say a bit more: what it means, and when you'd use it.");
    if (r.long.length > 1) notes.push(`Simpler words would help: ${r.long.join(", ")}.`);
    const done = (gap) => {
      if (gap) state.gaps[gapKey] = { at: dayNumber() }; else delete state.gaps[gapKey];
      save();
      toast(gap ? "Added to your gaps. Review it in Practice." : "Nice. You own this one.");
      buttons.remove();
    };
    const buttons = h("div", { class: "row", style: "margin-top:12px" },
      h("button", { class: "btn", type: "button", onclick: () => done(false) }, "It came easily"),
      h("button", { class: "btn", type: "button", onclick: () => done(true) }, "I got stuck"));
    out.replaceChildren(
      h("div", { class: "tip" }, r.ok ? h("p", {}, h("b", {}, "Clear and simple. "), `${r.count} words, no hard ones.`) : notes.map((n) => h("p", {}, n))),
      h("p", { class: "meta", style: "margin-top:12px" }, "Compare with:"),
      h("p", { class: "read" }, model),
      buttons);
  });
  return box;
}

/** Your own sentence with the word, saved in state.mine. */
export function mineBox(state, word, { onSave } = {}) {
  const box = h("div");
  const draw = () => {
    const m = state.mine[word.id];
    if (m) {
      box.replaceChildren(h("p", { class: "sentence", style: "font-size:var(--s0)" }, m.text),
        h("div", { class: "row", style: "margin-top:8px" }, h("button", { class: "btn quiet", type: "button", onclick: () => edit(m.text) }, "Edit")));
    } else edit("");
  };
  const edit = (text) => {
    const { area, mic } = speakOrType({ placeholder: `A sentence about your own life with "${word.word}"`, rows: 2 });
    area.value = text;
    const msg = h("p", { class: "meta", "aria-live": "polite" });
    const saveBtn = h("button", { class: "btn", type: "button", onclick: () => {
      const t = area.value.trim();
      if (!t) return;
      if (!usesWord(t, word.word)) { msg.textContent = `Use "${word.word}" (or a form of it) in your sentence.`; return; }
      state.mine[word.id] = { text: t, at: dayNumber() };
      save();
      onSave?.(t);
      draw();
    } }, "Save my sentence");
    box.replaceChildren(h("p", { class: "read", style: "color:var(--ink-2);margin-bottom:10px" },
      "Connect it to your life: your work, your family, your city. Your own sentence is far easier to remember than ours."),
      area, h("div", { class: "row", style: "margin-top:10px" }, saveBtn, mic), msg);
  };
  draw();
  return box;
}
