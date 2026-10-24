import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import vm from "node:vm";

const handlers={};
const stores=new Map();
const deleted=[];
let now=1_800_000_000_000;
let writes=0;
class Clock extends Date { static now(){ return now; } }
const cacheFor=name=>{
  if(!stores.has(name)) stores.set(name,new Map());
  const entries=stores.get(name);
  return {addAll:async()=>{},put:async(request,response)=>{writes++;entries.set(request.url,response.clone());},match:async request=>entries.get(request.url)?.clone(),delete:async request=>entries.delete(request.url)};
};
const context={URL,Request,Response,Headers,JSON,Promise,Set,Date:Clock,self:{location:{origin:"https://legit.test"},addEventListener:(type,handler)=>handlers[type]=handler,clients:{claim:async()=>{}},skipWaiting:async()=>{}},caches:{keys:async()=>["legit-data-v1","legit-public-data-v2","legit-shell-v56"],delete:async key=>deleted.push(key),open:async name=>cacheFor(name)},fetch:async()=>new Response('{"happenings":[]}',{headers:{"cache-control":"public, max-age=30"}})};
vm.runInNewContext(await readFile("dist/sw.js","utf8"),context);
const pending=[];
await new Promise((resolve,reject)=>handlers.activate({waitUntil:p=>p.then(resolve,reject)}));
assert.ok(deleted.includes("legit-data-v1"));
assert.ok(deleted.includes("legit-public-data-v2"));
async function dispatch(path,options={}){
  let result;
  handlers.fetch({request:new Request(`https://legit.test${path}`,options),respondWith:p=>result=p,waitUntil:p=>pending.push(p)});
  const response=await result;
  await Promise.all(pending.splice(0));
  return response;
}
for(const path of ["/api/profile/privacy","/api/profile/privacy/export","/api/desk","/api/moderation/queue","/api/moderation/metrics","/login","/cdn-cgi/access/authorized"]){
  assert.equal(await dispatch(path),undefined,path);
}
assert.equal(await dispatch("/api/happenings",{method:"POST"}),undefined);
assert.equal((await dispatch("/api/happenings?time=today")).status,200);
assert.equal(writes,1);
assert.equal((await dispatch("/api/happenings?time=today")).headers.get("x-legit-offline"),null);
context.fetch=async()=>{throw new Error("offline");};
let response=await dispatch("/api/happenings");
assert.equal(response.status,200);
assert.equal(response.headers.get("x-legit-offline"),"1");
assert.equal((await response.json()).happenings.length,0);
now+=5*60*1000+1;
assert.equal((await dispatch("/api/happenings")).status,503,"expired data must not be replayed");
assert.equal(stores.get("legit-public-data-v3").size,0);
context.fetch=async()=>new Response("{}",{headers:{"cache-control":"private, no-store"}});
const before=writes;
await dispatch("/api/happenings?time=week");
await dispatch("/app.js");
assert.equal(writes,before,"private/no-store data and assets must not be cached");
context.fetch=async()=>new Response("{}",{headers:{"cache-control":"public",age:"301"}});
await dispatch("/api/happenings?time=week");
context.fetch=async()=>{throw new Error("offline");};
assert.equal((await dispatch("/api/happenings?time=week")).status,503,"upstream age counts toward expiry");
context.fetch=async()=>new Response("{}",{headers:{"cache-control":"public"}});
await dispatch("/api/happenings?time=invalid");
await dispatch("/api/happenings?time=today&extra=unique");
await dispatch("/api/happenings?time=today&time=all");
assert.equal(stores.get("legit-public-data-v3").size,0,"arbitrary queries cannot grow cache storage");
await dispatch("/app.js?v=59");
assert.ok(stores.get("legit-shell-v59").has("https://legit.test/app.js"));
context.fetch=async()=>{throw new Error("offline");};
assert.equal((await dispatch("/app.js")).status,200);
assert.equal((await dispatch("/styles.css")).status,503,"missing asset must not return HTML");

const app=await readFile("dist/app.js","utf8");
assert.equal(app.includes('getElementById("locationPrivacy")'),false);
const status={dataset:{},hidden:true};
const appContext={Date:Clock,AbortController,Set,window:{setTimeout,clearTimeout},document:{getElementById:()=>status},fetch:async()=>new Response(JSON.stringify({happenings:[{id:"approved-1",title:"Synthetic report",createdAt:new Date(now).toISOString()}]}))};
vm.createContext(appContext);
vm.runInContext(app.slice(0,app.indexOf("function markerElement"))+`\nfunction renderMarkers(){}; function applyDeskState(){}; function closeActions(){}; function closeModal(){};`,appContext);
await vm.runInContext("loadPublicHappenings()",appContext);
assert.equal(vm.runInContext('happenings.filter(item=>item.serverId).length',appContext),1);
vm.runInContext('selectedHappening=happenings.find(item=>item.serverId); miniCard.hidden=false;',appContext);
appContext.fetch=async()=>new Response('{"happenings":[]}');
await vm.runInContext("loadPublicHappenings()",appContext);
assert.equal(vm.runInContext('happenings.filter(item=>item.serverId).length',appContext),0,"withdrawn reports leave the current snapshot");
assert.equal(vm.runInContext("selectedHappening",appContext),null);
appContext.fetch=async()=>new Response('{"happenings":[]}',{headers:{"x-legit-offline":"1","x-legit-saved-at":String(now)}});
await vm.runInContext("loadPublicHappenings()",appContext);
assert.match(status.textContent,/Offline/);
assert.equal(status.dataset.state,"stale");
vm.runInContext('happenings.push({serverId:"old-report"})',appContext);
now+=5*60*1000+1;
appContext.fetch=async()=>{throw new Error("offline");};
await vm.runInContext("loadPublicHappenings()",appContext);
assert.equal(vm.runInContext('happenings.filter(item=>item.serverId).length',appContext),0);
assert.match(status.textContent,/unavailable/);
console.log("Offline privacy smoke passed: private-route bypass, legacy cache purge, five-minute expiry, upstream age, bounded query storage, shell allowlist, offline labeling, withdrawn-report removal, and in-memory expiry.");
