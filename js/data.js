// Loads the course content (JSON files in /data) once and keeps it in memory.
const cache = new Map();

export async function get(name) {
  if (!cache.has(name)) {
    cache.set(name, fetch(`data/${name}.json`).then((r) => {
      if (!r.ok) throw new Error(`Couldn't load ${name} (${r.status}).`);
      return r.json();
    }).catch((e) => { cache.delete(name); throw e; }));
  }
  return cache.get(name);
}

let wordIndex = null;
export async function words() {
  const list = await get("words");
  wordIndex ??= new Map(list.map((w) => [w.id, w]));
  return list;
}
export async function word(id) {
  await words();
  return wordIndex.get(id) || null;
}
export const wordSync = (id) => wordIndex?.get(id) || null;

export const TOPICS = {
  home: "Home and family", food: "Food", shopping: "Shopping and money", travel: "Travel", health: "Health",
  work: "Work", study: "Study", tech: "Technology", people: "People", feelings: "Feelings", fun: "Free time",
  services: "Services", nature: "Nature and weather", mind: "Thinking and talking", describe: "Describing",
  time: "Time", link: "Linking words", news: "News and society", general: "General",
};
export const CATEGORIES = {
  social: "Meeting people", food: "Food and drink", shopping: "Shopping", travel: "Travel", health: "Health",
  work: "Work", home: "Home", phone: "On the phone", services: "Services", problems: "Problems",
  feelings: "Feelings", friends: "Friends", tech: "Tech support", study: "Study", fun: "Free time",
};
