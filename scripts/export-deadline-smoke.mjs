import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const app=await readFile('dist/app.js','utf8');
function deferred(){let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};}
const payload={storageModel:'sanitized-with-neighborhood-aggregation',happenings:[],claims:[],evidence:[],privacyRequests:[],reputationEvents:[],deskItems:[]};
const response=()=>new Response(JSON.stringify(payload));
const tick=()=>new Promise(r=>setImmediate(r));
function harness(){
 const timers=new Map(),calls=[],nodes=new Map(),created=[],revoked=[],downloads=[],toasts=[];let next=0,failClick=false;
 const context={AbortController,Blob,Set,Promise,setTimeout:(fn,ms)=>{assert.equal(ms,12000);timers.set(++next,fn);return next;},clearTimeout:id=>timers.delete(id),URL:{createObjectURL:blob=>{created.push(blob);return 'blob:synthetic';},revokeObjectURL:url=>revoked.push(url)},showToast:t=>toasts.push(t),document:{getElementById(id){if(!nodes.has(id))nodes.set(id,{disabled:false,textContent:''});return nodes.get(id);},createElement:()=>({click(){if(failClick)throw Error('download blocked');downloads.push(this.download);}})},fetch:(path,options)=>{assert.equal(path,'/api/profile/privacy/export');const d=deferred();calls.push({...d,options});return d.promise;}};
 vm.createContext(context);const run=code=>vm.runInContext(code,context);
 run('const deskState={generation:0,profileRequestId:1,profileEnabled:true};');
 run(app.slice(app.indexOf('async function boundedAccountRequest('),app.indexOf('function readLocalDesk(')));
 run(app.slice(app.indexOf('function setProfileControls('),app.indexOf('async function loadPrivacyProfile(')));
 run(app.slice(app.indexOf('async function exportMyData('),app.indexOf('async function deleteAllProfileData(')));
 return {run,calls,nodes,created,revoked,downloads,toasts,timers,fail(){failClick=true;},expire(){for(const [id,fn] of [...timers]){timers.delete(id);fn();}}};
}
for(const bodyStall of [false,true]){
 const h=harness(),request=h.run('exportMyData()');let body;
 await h.run('exportMyData()');assert.equal(h.calls.length,1);
 if(bodyStall){body=deferred();h.calls[0].resolve({ok:true,json:()=>body.promise});await tick();}
 h.expire();await request;assert.equal(h.calls[0].options.signal.aborted,true);assert.equal(h.nodes.get('exportMyData').disabled,false);assert.equal(h.run('deskState.exportPending'),false);assert.match(h.toasts.at(-1),/timed out/);
 if(body)body.resolve(payload);else h.calls[0].resolve(response());await tick();assert.equal(h.downloads.length,0);assert.equal(h.created.length,0);
 const retry=h.run('exportMyData()');h.calls[1].resolve(response());await retry;assert.deepEqual(h.downloads,['legit-data-export.json']);assert.equal(h.created[0].type,'application/json');assert.deepEqual(JSON.parse(await h.created[0].text()),payload);assert.equal(h.revoked.length,1);assert.equal(h.timers.size,0);
}
for(const change of ['deskState.generation++','deskState.profileRequestId++','setProfileControls(false)']){
 const h=harness(),request=h.run('exportMyData()');h.run(change);h.calls[0].resolve(response());await request;assert.equal(h.downloads.length,0);assert.equal(h.created.length,0);assert.equal(h.nodes.get('exportMyData').disabled,!h.run('deskState.profileEnabled'));
}
for(const invalid of [new Response('{}',{status:401}),new Response('{}'),new Response('invalid')]){
 const h=harness(),request=h.run('exportMyData()');h.calls[0].resolve(invalid);await request;assert.equal(h.created.length,0);assert.equal(h.nodes.get('exportMyData').disabled,false);assert.equal(h.timers.size,0);
}
const h=harness();h.fail();const request=h.run('exportMyData()');h.calls[0].resolve(response());await request;assert.equal(h.created.length,1);assert.equal(h.revoked.length,1);assert.equal(h.nodes.get('exportMyData').disabled,false);
console.log('Export deadline smoke passed: stalled headers/body, abort, late-response exclusion, duplicate guard, retry, invalidation, disabled-control preservation, malformed/auth rejection, exact JSON download and URL cleanup.');
