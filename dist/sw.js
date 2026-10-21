const SHELL_CACHE = "legit-shell-v51";
const DATA_CACHE = "legit-data-v1";
const SHELL = ["./", "./index.html", "./styles.css", "./app.js", "./sw.js"];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(SHELL_CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => ![SHELL_CACHE, DATA_CACHE].includes(key)).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  if(request.method !== "GET" || url.origin !== self.location.origin) return;
  if(url.pathname.startsWith("/api/")){
    event.respondWith(fetch(request).then(response => {
      if(response.ok) caches.open(DATA_CACHE).then(cache => cache.put(request,response.clone()));
      return response;
    }).catch(() => caches.match(request)));
    return;
  }
  event.respondWith(fetch(request).then(response => {
    if(response.ok) caches.open(SHELL_CACHE).then(cache => cache.put(request,response.clone()));
    return response;
  }).catch(() => caches.match(request).then(cached => cached || caches.match("./index.html"))));
});
