const SHELL_CACHE = "legit-shell-v56";
const DATA_CACHE = "legit-public-data-v2";
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
    // Never persist profile, export, authentication, or moderator responses.
    if(url.pathname !== "/api/happenings") return;
    event.respondWith(fetch(request).then(response => {
      if(response.ok && !/no-store|private/i.test(response.headers.get("cache-control") || "")){
        const copy=response.clone();
        event.waitUntil(caches.open(DATA_CACHE).then(cache => cache.put(request,copy)));
      }
      return response;
    }).catch(async () => (await caches.match(request)) || new Response(JSON.stringify({error:"Public data unavailable offline."}),{status:503,headers:{"content-type":"application/json"}})));
    return;
  }
  event.respondWith(fetch(request).then(response => {
    if(response.ok) caches.open(SHELL_CACHE).then(cache => cache.put(request,response.clone()));
    return response;
  }).catch(() => caches.match(request).then(cached => cached || caches.match("./index.html"))));
});
