import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import vm from "node:vm";

const handlers={};
const writes=[];
const deleted=[];
const context={URL,Response,JSON,Promise,self:{location:{origin:"https://legit.test"},addEventListener:(type,handler)=>handlers[type]=handler,clients:{claim:async()=>{}},skipWaiting:async()=>{}},caches:{keys:async()=>["legit-data-v1","legit-shell-v51"],delete:async key=>deleted.push(key),open:async()=>({put:async request=>writes.push(request.url)}),match:async()=>undefined},fetch:async()=>new Response("{}",{headers:{"cache-control":"public, max-age=30"}})};
vm.runInNewContext(await readFile("dist/sw.js","utf8"),context);
await new Promise((resolve,reject)=>handlers.activate({waitUntil:p=>p.then(resolve,reject)}));
assert.ok(deleted.includes("legit-data-v1"));
for(const path of ["/api/profile/privacy","/api/profile/privacy/export","/api/moderation/queue","/api/moderation/metrics"]){
  let intercepted=false;
  handlers.fetch({request:new Request(`https://legit.test${path}`),respondWith:()=>{intercepted=true;}});
  assert.equal(intercepted,false,path);
}
let response;
const pending=[];
handlers.fetch({request:new Request("https://legit.test/api/happenings?time=today"),respondWith:p=>response=p,waitUntil:p=>pending.push(p)});
assert.equal((await response).status,200);
await Promise.all(pending);
assert.equal(writes.length,1);
context.fetch=async()=>{throw new Error("offline");};
handlers.fetch({request:new Request("https://legit.test/api/happenings"),respondWith:p=>response=p,waitUntil:p=>pending.push(p)});
assert.equal((await response).status,503);
const app=await readFile("dist/app.js","utf8");
assert.equal(app.includes('getElementById("locationPrivacy")'),false);
console.log("Offline privacy smoke passed: private API bypass, legacy cache purge, public-only caching, offline miss, removed-field regression.");
