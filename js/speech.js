// The browser's own voices (Web Speech API): reading English aloud and listening to you speak.
// Everything runs on the device; nothing is sent to a Fluentra server.

const synth = typeof window !== "undefined" ? window.speechSynthesis : null;
const Recognition = typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;
let voices = [];

// Natural-sounding US voices first, by the names browsers and phones use.
const PREFERRED = [/Ava|Samantha|Allison|Aria|Jenny|Natural/i, /Google US English/i, /en-US/i];

function loadVoices() {
  voices = synth ? synth.getVoices().filter((v) => /^en[-_]/i.test(v.lang)) : [];
  return voices;
}
if (synth) { loadVoices(); synth.addEventListener?.("voiceschanged", loadVoices); }

export const canSpeak = () => !!synth;
export const canListen = () => !!Recognition;
export function englishVoices() { return loadVoices().filter((v) => /en[-_]US/i.test(v.lang)).concat(voices.filter((v) => !/en[-_]US/i.test(v.lang))); }

function pick(name) {
  const list = voices.length ? voices : loadVoices();
  if (name) { const v = list.find((x) => x.name === name); if (v) return v; }
  const us = list.filter((v) => /en[-_]US/i.test(v.lang));
  for (const re of PREFERRED) { const v = us.find((x) => re.test(x.name)) || list.find((x) => re.test(x.name)); if (v) return v; }
  return us[0] || list[0] || null;
}
/** A second, different voice (for the other person in a conversation). */
function other(first) {
  const us = (voices.length ? voices : loadVoices()).filter((v) => /en[-_]US/i.test(v.lang) && v.name !== first?.name);
  return us.find((v) => PREFERRED[0].test(v.name)) || us[0] || first;
}

/** Say English text. Resolves when it has finished (or was stopped). opts: { rate, voice, alt } */
export function say(text, { rate = 0.95, voice = "", alt = false } = {}) {
  return new Promise((resolve) => {
    if (!synth || !text) return resolve(false);
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const v = alt ? other(pick(voice)) : pick(voice);
    if (v) u.voice = v;
    u.lang = v?.lang || "en-US";
    u.rate = rate;
    u.onend = () => resolve(true);
    u.onerror = () => resolve(false);
    synth.speak(u);
  });
}
export const stop = () => synth?.cancel();

/** Listen for one English sentence. Resolves { text, alternatives } or rejects with a readable message.
 *  The returned promise has .stop() to finish early. */
export function listen({ maxMs = 12000 } = {}) {
  let rec = null;
  const p = new Promise((resolve, reject) => {
    if (!Recognition) return reject(new Error("Speech input isn't available in this browser. Try Chrome or Safari, or type your answer."));
    rec = new Recognition();
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.maxAlternatives = 3;
    rec.continuous = false;
    let best = null;
    const timer = setTimeout(() => rec.stop(), maxMs);
    rec.onresult = (e) => {
      const r = e.results[e.results.length - 1];
      best = { text: r[0].transcript, alternatives: [...r].map((a) => a.transcript) };
    };
    rec.onerror = (e) => {
      clearTimeout(timer);
      if (e.error === "no-speech") return resolve({ text: "", alternatives: [] });
      reject(new Error(e.error === "not-allowed" ? "Microphone access is blocked. Allow it in your browser settings, then try again." : `Speech input stopped (${e.error}).`));
    };
    rec.onend = () => { clearTimeout(timer); resolve(best || { text: "", alternatives: [] }); };
    try { rec.start(); } catch (err) { reject(err); }
  });
  p.stop = () => rec?.stop();
  return p;
}
