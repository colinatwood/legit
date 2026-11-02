import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const app=await readFile('dist/app.js','utf8');
function deferred(){let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};}
function harness(){
 const timers=new Map(),calls=[],toasts=[];let next=0;
 const context={AbortController,Set,Promise,setTimeout:(fn,ms)=>{assert.equal(ms,12000);timers.set(++next,fn);return next;},clearTimeout:id=>timers.delete(id),localStorage:{getItem:()=>null,setItem:()=>{throw Error('no local fallback');}},renderMarkers:()=>{},showToast:t=>toasts.push(t),fetch:(url,options)=>{const d=deferred();calls.push({...d,options});return d.promise;}};
 vm.createContext(context);const run=code=>vm.runInContext(code,context);
 run('const deskStorageKey="legit-desk";const deskState={server:true,keys:new Set(),generation:0,pending:0,deleting:false,available:true};const happenings=[{serverId:"story",saved:false}];');
 run(app.slice(app.indexOf('function deskKey('),app.indexOf('async function submitReport(')));
 return {run,calls,toasts,timers,expire(){for(const [id,fn] of [...timers]){timers.delete(id);fn();}}};
}
const tick=()=>new Promise(r=>setImmediate(r));
const response=()=>new Response('{"items":[{"happening_key":"story"}]}');
for(const bodyStall of [false,true]){
 const h=harness(),read=h.run('loadDesk()');let body;
 if(bodyStall){body=deferred();h.calls[0].resolve({ok:true,status:200,json:()=>body.promise});await tick();}
 h.expire();await read;assert.equal(h.calls[0].options.signal.aborted,true);assert.equal(h.run('deskState.available'),false);assert.equal(h.timers.size,0);
 // Ignore late completion even when a mock transport disregards abort.
 if(body)body.resolve({items:[{happening_key:'late'}]});else h.calls[0].resolve(response());await tick();
 assert.equal(h.run('deskState.keys.size'),0);
 const retry=h.run('loadDesk()');h.calls[1].resolve(response());await retry;assert.equal(h.run('deskState.available'),true);assert.equal(h.run('happenings[0].saved'),true);assert.equal(h.timers.size,0);
}
const h=harness(),save=h.run('toggleDesk(happenings[0])');h.expire();await save;
assert.equal(h.run('deskState.pending'),0);assert.equal(h.run('deskState.available'),false);assert.equal(h.calls.length,1,'no automatic POST replay');assert.match(h.toasts.at(-1),/outcome is unknown/);
await h.run('toggleDesk(happenings[0])');assert.equal(h.calls.length,1);
h.calls[0].resolve(new Response('{}'));await tick();assert.equal(h.run('happenings[0].saved'),false,'late write response cannot mark success');
const refresh=h.run('loadDesk()');h.calls[1].resolve(response());await refresh;assert.equal(h.run('happenings[0].saved'),true);assert.equal(h.timers.size,0);
// A read queued during a timed-out write is released exactly once.
const queued=harness(),write=queued.run('toggleDesk(happenings[0])');await queued.run('loadDesk()');queued.expire();await write;
assert.equal(queued.calls.length,2);queued.calls[1].resolve(response());await tick();assert.equal(queued.run('deskState.pending'),0);assert.equal(queued.timers.size,0);
console.log('Desk deadline smoke passed: stalled headers/body, transport abort, timer cleanup, late-response exclusion, read recovery, unknown write outcome, no POST replay, and queued refresh release.');
