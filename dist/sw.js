const SHELL_CACHE = "legit-shell-v59";
const DATA_CACHE = "legit-public-data-v3";
const PUBLIC_DATA_MAX_AGE = 5 * 60 * 1000;
const SHELL = ["./", "./index.html", "./styles.css", "./app.js", "./sw.js"];
const SHELL_PATHS = new Set(SHELL.map(path => new URL(path, self.location.origin + "/").pathname));
const TIME_WINDOWS = new Set(["today", "yesterday", "week", "month", "year", "all"]);

self.addEventListener("install", event => {
  event.waitUntil(caches.open(SHELL_CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => ![SHELL_CACHE, DATA_CACHE].includes(key)).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

async function publicData(request, event){
  const url = new URL(request.url);
  const time = url.searchParams.get("time") || "today";
  // Bound storage to the six public time windows; bypass unknown query shapes.
  if(!TIME_WINDOWS.has(time) || [...url.searchParams.keys()].some(key => key !== "time") || url.searchParams.getAll("time").length > 1) return fetch(request);
  const cacheKey = new Request(`${url.origin}/api/happenings?time=${time}`);
  try{
    const response = await fetch(request);
    if(response.ok && !/no-store|private/i.test(response.headers.get("cache-control") || "")){
      const headers = new Headers(response.headers);
      // Preserve upstream age rather than treating an old HTTP-cache hit as new.
      const age = Math.max(0, Number(headers.get("age")) || 0) * 1000;
      const date = Date.parse(headers.get("date") || "");
      headers.set("x-legit-saved-at", String(Math.min(Date.now() - age, Number.isFinite(date) ? date : Date.now())));
      const cached = new Response(response.clone().body, {status:response.status, headers});
      event.waitUntil(caches.open(DATA_CACHE).then(cache => cache.put(cacheKey, cached)).catch(() => {}));
    }
    return response;
  }catch{
    const cache = await caches.open(DATA_CACHE);
    const cached = await cache.match(cacheKey);
    const savedAt = Number(cached?.headers.get("x-legit-saved-at"));
    const age = Date.now() - savedAt;
    if(cached && savedAt > 0 && age >= 0 && age <= PUBLIC_DATA_MAX_AGE){
      const headers = new Headers(cached.headers);
      headers.set("x-legit-offline", "1");
      return new Response(cached.body, {status:cached.status, headers});
    }
    if(cached) event.waitUntil(cache.delete(cacheKey).catch(() => {}));
    return new Response(JSON.stringify({error:"Recent public data unavailable offline. Reconnect to refresh."}), {status:503, headers:{"content-type":"application/json", "cache-control":"no-store"}});
  }
}

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  if(request.method !== "GET" || url.origin !== self.location.origin) return;
  if(url.pathname.startsWith("/api/")){
    // Never persist profile, export, authentication, or moderator responses.
    if(url.pathname !== "/api/happenings") return;
    event.respondWith(publicData(request, event));
    return;
  }
  // Only known public shell assets belong in offline storage.
  if(!SHELL_PATHS.has(url.pathname)) return;
  const cacheKey = new Request(url.origin + url.pathname);
  event.respondWith(fetch(request).then(response => {
    if(response.ok && !response.redirected && !/no-store|private/i.test(response.headers.get("cache-control") || "")){
      const copy = response.clone();
      event.waitUntil(caches.open(SHELL_CACHE).then(cache => cache.put(cacheKey, copy)).catch(() => {}));
    }
    return response;
  }).catch(async () => {
    const cache = await caches.open(SHELL_CACHE);
    return (await cache.match(cacheKey)) || new Response("Offline asset unavailable.", {status:503});
  }));
});
