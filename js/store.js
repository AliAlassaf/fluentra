// Saves your progress in this browser (localStorage), with export and import as a JSON file.
import { emptyState, normalize } from "./core/progress.js";

const KEY = "fluentra:v1";
let state = null;
let memoryOnly = false;

export function load() {
  if (state) return state;
  try {
    const raw = localStorage.getItem(KEY);
    state = raw ? normalize(JSON.parse(raw)) : emptyState();
  } catch {
    state = emptyState();
    memoryOnly = true;
  }
  return state;
}

export function save() {
  if (!state) return;
  try { localStorage.setItem(KEY, JSON.stringify(state)); memoryOnly = false; } catch { memoryOnly = true; }
}
export const isMemoryOnly = () => memoryOnly;

export function exportFile() {
  const blob = new Blob([JSON.stringify({ app: "fluentra", exported: new Date().toISOString(), ...state }, null, 1)], { type: "application/json" });
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `fluentra-progress-${new Date().toISOString().slice(0, 10)}.json` });
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

/** Replace your progress with a backup file. Throws with a readable message when the file isn't valid. */
export async function importFile(file) {
  let raw;
  try { raw = JSON.parse(await file.text()); } catch { throw new Error("This file isn't valid JSON."); }
  state = normalize(raw);
  save();
  return state;
}

export function reset() {
  state = emptyState();
  save();
  return state;
}
