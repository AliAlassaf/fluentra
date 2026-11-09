// Offline support: the app shell and course data are cached on first visit; the network is used first so updates
// arrive as soon as you're online, and the cache answers when you're not.
const CACHE = "fluentra-v1";
const SHELL = [
  "./", "index.html", "css/app.css", "manifest.webmanifest", "icons/icon.svg",
  "js/app.js", "js/ui.js", "js/store.js", "js/speech.js", "js/data.js", "js/clips.js",
  "js/core/text.js", "js/core/srs.js", "js/core/session.js", "js/core/ear.js", "js/core/progress.js",
  "js/views/today.js", "js/views/study.js", "js/views/words.js", "js/views/sounds.js", "js/views/grammar.js",
  "js/views/speak.js", "js/views/progress.js", "js/views/about.js", "js/views/welcome.js",
  "data/words.json", "data/phrases.json", "data/grammar.json", "data/conversations.json", "data/sounds.json",
];
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  const sameOrigin = url.origin === self.location.origin;
  const fonts = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (!sameOrigin && !fonts) return;
  e.respondWith(fetch(e.request).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
    return res;
  }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
