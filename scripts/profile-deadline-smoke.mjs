import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const app=await readFile('dist/app.js','utf8');
function deferred(){let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};}
function harness(){
 const timers=new Map(),calls=[],nodes=new Map();let next=0;
 const context={AbortController,Set,Promise,setTimeout:(fn,ms)=>{assert.equal(ms,12000);timers.set(++next,fn);return next;},clearTimeout:id=>timers.delete(id),localStorage:{getItem:()=>null},renderMarkers:()=>{},showToast:()=>{},window:{addEventListener:()=>{}},document:{getElementById(id){if(!nodes.has(id))nodes.set(id,{textContent:'',disabled:false,value:''});return nodes.get(id);}},fetch:(path,options)=>{if(path==='/api/desk') return Promise.resolve(new Response('{"items":[]}'));const d=deferred();calls.push({...d,options});return d.promise;}};
 vm.createContext(context);const run=code=>vm.runInContext(code,context);
 run('const deskStorageKey="legit-desk";const deskState={server:true,keys:new Set(),generation:0,pending:0,deleting:false,available:true};const happenings=[];');
 run(app.slice(app.indexOf('function deskKey('),app.indexOf('async function submitReport(')));
 run(app.slice(app.indexOf('function setProfileControls('),app.indexOf('async function savePrivacyPreferences(')));
 run(app.slice(app.indexOf('// Cross-tab messages are invalidations'),app.indexOf('document.getElementById("openMethodology")')));
 return {run,calls,nodes,timers,expire(){for(const [id,fn] of [...timers]){timers.delete(id);fn();}}};
}
const profile=count=>({controls:{limitSensitive:true},dataSummary:{happenings:count,pending:0}});
const response=count=>new Response(JSON.stringify(profile(count)));
const tick=()=>new Promise(r=>setImmediate(r));
for(const bodyStall of [false,true]){
 const h=harness(),refresh=h.run('refreshProfileState()');let body;
 if(bodyStall){body=deferred();h.calls[0].resolve({ok:true,status:200,json:()=>body.promise});}
 await tick();h.expire();await refresh;
 assert.equal(h.calls[0].options.signal.aborted,true);assert.equal(h.run('profileRefreshPending'),false);
 assert.equal(h.nodes.get('deleteAllData').disabled,true);assert.match(h.nodes.get('profileDataSummary').textContent,/timed out/);assert.equal(h.timers.size,0);
 if(body)body.resolve(profile(99));else h.calls[0].resolve(response(99));await tick();assert.match(h.nodes.get('profileDataSummary').textContent,/timed out/);
 const recovery=h.run('refreshProfileState()');h.calls[1].resolve(response(2));await recovery;
 assert.equal(h.nodes.get('deleteAllData').disabled,false);assert.match(h.nodes.get('profileDataSummary').textContent,/2 profile-linked/);assert.equal(h.timers.size,0);
}
// Newest read wins even within the same profile generation.
const h=harness(),a=h.run('loadPrivacyProfile()'),b=h.run('loadPrivacyProfile()');h.calls[1].resolve(response(3));await b;h.calls[0].resolve(response(99));await a;assert.match(h.nodes.get('profileDataSummary').textContent,/3 profile-linked/);
// Anonymous and malformed reads remain disabled, with cleaned timers.
for(const payload of [new Response('{}',{status:401}),new Response('{}')]){
 const read=h.run('loadPrivacyProfile()');h.calls.at(-1).resolve(payload);await read;assert.equal(h.nodes.get('deleteAllData').disabled,true);assert.equal(h.timers.size,0);
}
// Invalidation received during a stalled read queues a fresh cycle after the deadline.
const q=harness(),first=q.run('refreshProfileState()');await tick();await q.run('refreshProfileState()');q.expire();await first;await tick();assert.equal(q.calls.length,2);q.calls[1].resolve(response(4));await tick();assert.equal(q.run('profileRefreshPending'),false);assert.match(q.nodes.get('profileDataSummary').textContent,/4 profile-linked/);assert.equal(q.timers.size,0);
console.log('Profile deadline smoke passed: stalled headers/body, abort and timer cleanup, refresh-lock release, recovery, stale-read exclusion, disabled controls, anonymous/malformed responses and queued invalidation.');
