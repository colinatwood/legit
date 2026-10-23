import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import vm from "node:vm";

const app=await readFile("dist/app.js","utf8");
function harness(){
  let now=1_800_000_000_000;
  let timerId=0;
  const timers=new Map();
  const nodes=new Map();
  const listeners={window:{},document:{}};
  class Clock extends Date { static now(){return now;} }
  const context={Date:Clock,AbortController,Set,window:{
    setTimeout(fn,delay){const id=++timerId;timers.set(id,{fn,at:now+delay});return id;},
    clearTimeout(id){timers.delete(id);},
    addEventListener(type,fn){listeners.window[type]=fn;}
  },navigator:{onLine:true},document:{visibilityState:"visible",getElementById(id){
    if(!nodes.has(id)) nodes.set(id,{dataset:{},hidden:true,setAttribute(){}});
    return nodes.get(id);
  },addEventListener(type,fn){listeners.document[type]=fn;}},fetch:async()=>{throw new Error("No mock fetch");}};
  vm.createContext(context);
  vm.runInContext(app.slice(0,app.indexOf("function markerElement"))+`\nfunction renderMarkers(){}; function applyDeskState(){}; function closeActions(){}; function closeModal(){};`,context);
  vm.runInContext(app.slice(app.indexOf("let refreshTimer=null;"),app.indexOf('if("serviceWorker" in navigator)')),context);
  vm.runInContext(app.slice(app.indexOf('const timePresets='),app.indexOf('document.getElementById("timeRange").addEventListener')),context);
  const run=code=>vm.runInContext(code,context);
  return {context,run,nodes,listeners,timers,load:()=>run("loadPublicHappenings()"),ids:()=>JSON.parse(run("JSON.stringify(happenings.filter(item=>item.serverId).map(item=>item.id))")),status:()=>nodes.get("dataStatus"),advance(ms){now+=ms; for(const [id,timer] of [...timers]) if(timer.at<=now){timers.delete(id);timer.fn();}}};
}
function snapshot(id,window="today",etag='"v1"'){
  return new Response(JSON.stringify({window,happenings:[{id,title:"Synthetic report",createdAt:"2027-01-15T08:00:00.000Z"}]}),{headers:{etag}});
}
function deferred(){let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};}

// Validators must refer to the snapshot actually held for the selected window.
{
  const h=harness();const requests=[];
  h.context.fetch=async(url,options)=>{requests.push({url,headers:options.headers});return snapshot("today");};
  await h.load();await h.load();
  assert.equal(requests[0].headers["if-none-match"],undefined);
  assert.equal(requests[1].headers["if-none-match"],'"v1"');
  h.run('refineFilters.time="week"');
  h.context.fetch=async(url,options)=>{requests.push({url,headers:options.headers});return snapshot("week","week",'"w1"');};
  await h.load();
  assert.equal(requests.at(-1).headers["if-none-match"],undefined);
  assert.deepEqual(h.ids(),["week"]);
  h.context.fetch=async()=>new Response(null,{status:304});
  await h.load();assert.match(h.status().textContent,/no changes/);
}
// An unsolicited 304 must not mark an absent snapshot live.
{
  const h=harness();h.context.fetch=async()=>new Response(null,{status:304});
  await h.load();assert.equal(h.status().dataset.state,"stale");assert.equal(h.run("publicSnapshotWindow"),null);
}
// Ignore late headers, even if a transport completes an aborted request.
{
  const h=harness();const old=deferred();
  h.context.fetch=()=>old.promise;const first=h.load();
  h.run('refineFilters.time="week"');h.context.fetch=async()=>snapshot("current","week");await h.load();
  old.resolve(snapshot("superseded"));await first;
  assert.deepEqual(h.ids(),["current"]);
}
// Also ignore a late body; a stale request must not clear the current controller.
{
  const h=harness();const body=deferred();const newer=deferred();
  h.context.fetch=async()=>({ok:true,status:200,headers:new Headers(),json:()=>body.promise});
  const first=h.load();await Promise.resolve();await Promise.resolve();
  h.run('refineFilters.time="all"');h.context.fetch=()=>newer.promise;const second=h.load();
  body.resolve({happenings:[{id:"late-body"}]});await first;
  assert.equal(h.run("publicLoadWindow"),"all");
  newer.resolve(snapshot("all-current","all"));await second;assert.deepEqual(h.ids(),["all-current"]);
}
// Deadline cancels network work, reports stale state, and permits recovery.
{
  const h=harness();let signal;
  h.context.fetch=(_url,options)=>{signal=options.signal;return new Promise((_resolve,reject)=>signal.addEventListener("abort",()=>reject(new DOMException("Aborted","AbortError"))));};
  const pending=h.load();h.advance(12000);await pending;
  assert.equal(signal.aborted,true);assert.equal(h.status().dataset.state,"stale");
  assert.equal(h.run("publicLoadController"),null);assert.equal(h.timers.size,0);
  h.context.fetch=async()=>snapshot("recovered");await h.load();assert.deepEqual(h.ids(),["recovered"]);
}
// Duplicate reconnect/visibility triggers coalesce; hidden tabs avoid network work.
{
  const h=harness();const pending=deferred();let calls=0;
  h.context.fetch=()=>{calls++;return pending.promise;};const first=h.load();
  h.listeners.window.online();h.listeners.document.visibilitychange();assert.equal(calls,1);
  pending.resolve(snapshot("connected"));await first;
  h.context.document.visibilityState="hidden";h.listeners.window.online();assert.equal(calls,1);
  h.context.document.visibilityState="visible";h.context.fetch=async()=>{calls++;return snapshot("reconnected");};
  h.listeners.window.online();await Promise.resolve();await Promise.resolve();
  // Wait for the actual response body rather than relying on a fixed number of microtasks.
  for(let i=0;i<20 && h.run("publicLoadController")!==null;i++) await new Promise(resolve=>setImmediate(resolve));
  assert.equal(calls,2);assert.deepEqual(h.ids(),["reconnected"]);
}
// Offline and hidden events cancel requests; stale errors cannot overwrite a new status.
{
  const h=harness();const pending=deferred();let signal;
  h.context.fetch=(_url,options)=>{signal=options.signal;return pending.promise;};const first=h.load();
  h.listeners.window.offline();assert.equal(signal.aborted,true);assert.equal(h.status().dataset.state,"stale");
  h.context.fetch=async()=>snapshot("new");await h.load();pending.resolve(snapshot("old"));await first;
  assert.deepEqual(h.ids(),["new"]);assert.equal(h.status().dataset.state,"live");
  h.context.fetch=(_url,options)=>{signal=options.signal;return Promise.resolve(snapshot("hidden"));};const next=h.load();
  h.context.document.visibilityState="hidden";h.listeners.document.visibilitychange();await next;assert.equal(signal.aborted,true);
}
// Failed parsing must not replace either the held data or its validator.
{
  const h=harness();h.context.fetch=async()=>snapshot("good");await h.load();
  h.context.fetch=async()=>new Response("broken",{headers:{etag:'"poison"'}});await h.load();
  assert.deepEqual(h.ids(),["good"]);assert.equal(h.run("publicEtag"),'"v1"');assert.equal(h.status().dataset.state,"stale");
  h.run('refineFilters.time="year"');h.context.fetch=async()=>new Response('{}');await h.load();
  assert.deepEqual(h.ids(),[]);assert.equal(h.run("publicEtag"),null);
}
// Slider changes clear the previous window immediately and debounce rapid input.
{
  const h=harness();h.context.fetch=async()=>snapshot("today");await h.load();
  const requests=[];
  h.context.fetch=async(url,options)=>{requests.push({url,headers:options.headers});return snapshot("month","month");};
  h.run("setTimePreset(2); setTimePreset(3)");assert.deepEqual(h.ids(),[]);
  h.advance(179);assert.equal(requests.length,0);h.advance(1);
  for(let i=0;i<20 && h.run("publicLoadController")!==null;i++) await new Promise(resolve=>setImmediate(resolve));
  assert.equal(requests.length,1);assert.match(requests[0].url,/time=month$/);
  assert.equal(requests[0].headers["if-none-match"],undefined);assert.deepEqual(h.ids(),["month"]);
}
// A slow response body is subject to the same deadline as its headers.
{
  const h=harness();const body=deferred();
  h.context.fetch=async()=>({ok:true,status:200,headers:new Headers(),json:()=>body.promise});
  const first=h.load();await Promise.resolve();await Promise.resolve();h.advance(12000);
  assert.equal(h.status().dataset.state,"stale");
  h.context.fetch=async()=>snapshot("after-timeout");await h.load();
  body.resolve({happenings:[{id:"timed-out-body"}]});await first;
  assert.deepEqual(h.ids(),["after-timeout"]);assert.equal(h.status().dataset.state,"live");
}
console.log("Refresh reliability smoke passed: window-scoped validators, valid/invalid 304, stale header/body races, deadline and recovery, reconnect coalescing, hidden/offline cancellation, malformed-response safety, slider debouncing, and response-body deadline.");
