import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const app=await readFile('dist/app.js','utf8');
function deferred(){let resolve,reject;const promise=new Promise((r,j)=>{resolve=r;reject=j;});return {promise,resolve,reject};}
const tick=()=>new Promise(r=>setImmediate(r));
const response=assessment=>new Response(JSON.stringify({ok:true,assessment}));
const confirmed={accepted:true,pointsAwarded:2,riskState:'normal'};
const button=()=>({disabled:false,textContent:'↑ useful',dataset:{evidenceId:'e1'}});
function harness(){
 const timers=new Map(),calls=[],toasts=[];let next=0;
 const context={AbortController,Promise,Set,setTimeout:(fn,ms)=>{assert.equal(ms,12000);timers.set(++next,fn);return next;},clearTimeout:id=>timers.delete(id),showToast:t=>toasts.push(t),fetch:(path,options)=>{assert.equal(path,'/api/reputation/assessment');const d=deferred();calls.push({...d,options});return d.promise;}};
 vm.createContext(context);const run=code=>vm.runInContext(code,context);
 run('const deskState={generation:0};const userState={points:10};const assessmentRequests=new Set();const item={id:"story",evidence:[{id:"e1"}]};');
 run(app.slice(app.indexOf('async function boundedAccountRequest('),app.indexOf('function readLocalDesk(')));
 run(app.slice(app.indexOf('async function recordEvidenceAssessment('),app.indexOf('function deskKey(')));
 const b=button();context.button=b;context.other=button();
 return {run,calls,toasts,timers,b,context,expire(){for(const [id,fn] of [...timers]){timers.delete(id);fn();}}};
}
for(const bodyStall of [false,true]){
 const h=harness(),request=h.run('recordEvidenceAssessment(item,button)');let body;
 await h.run('recordEvidenceAssessment(item,button)');await h.run('recordEvidenceAssessment(item,other)');assert.equal(h.calls.length,1,'one request across detail/menu buttons');
 assert.deepEqual(JSON.parse(h.calls[0].options.body),{targetId:'story:e1',actionType:'evidence_useful'});
 if(bodyStall){body=deferred();h.calls[0].resolve({ok:true,json:()=>body.promise});await tick();}
 h.expire();await request;assert.equal(h.calls[0].options.signal.aborted,true);assert.equal(h.b.disabled,false);assert.equal(h.b.textContent,'status unknown');assert.equal(h.run('userState.points'),10);assert.match(h.toasts.at(-1),/outcome is unknown/);assert.equal(h.run('assessmentRequests.size'),0);assert.equal(h.calls.length,1);
 if(body)body.resolve({ok:true,assessment:confirmed});else h.calls[0].resolve(response(confirmed));await tick();assert.equal(h.run('userState.points'),10);assert.equal(h.b.textContent,'status unknown');assert.equal(h.timers.size,0);
 const retry=h.run('recordEvidenceAssessment(item,button)');h.calls[1].resolve(response({accepted:false,pointsAwarded:0,reason:'Already counted'}));await retry;assert.equal(h.b.textContent,'already counted');assert.equal(h.run('userState.points'),10);assert.equal(h.timers.size,0);
}
for(const assessment of [confirmed,{accepted:true,pointsAwarded:0,riskState:'coordination_review'},{accepted:false,pointsAwarded:0,reason:'Daily assessment limit reached'}]){
 const h=harness(),request=h.run('recordEvidenceAssessment(item,button)');h.calls[0].resolve(response(assessment));await request;assert.equal(h.run('userState.points'),assessment===confirmed?12:10);assert.equal(h.b.disabled,true);assert.equal(h.b.textContent,assessment===confirmed?'✓ counted':assessment.accepted?'✓ held for review':'not counted');assert.equal(h.timers.size,0);
}
for(const invalid of [{}, {accepted:true,pointsAwarded:-1,riskState:'normal'}, {accepted:true,pointsAwarded:2,riskState:'coordination_review'}, {accepted:false,pointsAwarded:2}, {accepted:true,pointsAwarded:2,riskState:'unknown'}, {accepted:true,pointsAwarded:'2',riskState:'normal'}]){
 const h=harness(),request=h.run('recordEvidenceAssessment(item,button)');h.calls[0].resolve(response(invalid));await request;assert.equal(h.run('userState.points'),10);assert.equal(h.b.textContent,'status unknown');assert.equal(h.b.disabled,false);
}
for(const failure of ['network','malformed','server','rejected']){
 const h=harness(),request=h.run('recordEvidenceAssessment(item,button)');if(failure==='network')h.calls[0].reject(new Error('offline'));else h.calls[0].resolve(new Response(failure==='malformed'?'invalid':'{}',{status:failure==='server'?503:failure==='rejected'?403:200}));await request;assert.equal(h.run('userState.points'),10);assert.equal(h.b.disabled,false);assert.match(h.toasts.at(-1),failure==='rejected'?/rejected/:/outcome is unknown/);assert.equal(h.run('assessmentRequests.size'),0);
}
const stale=harness(),request=stale.run('recordEvidenceAssessment(item,button)');stale.run('deskState.generation++');stale.calls[0].resolve(response(confirmed));await request;assert.equal(stale.run('userState.points'),10);assert.match(stale.toasts.at(-1),/current points/);assert.equal(stale.timers.size,0);
const missing=harness();missing.context.button.dataset={};missing.run('item.evidence=[]');await missing.run('recordEvidenceAssessment(item,button)');assert.equal(missing.calls.length,0);assert.equal(missing.b.disabled,false);
const independent=harness();independent.context.other.dataset.evidenceId='e2';const one=independent.run('recordEvidenceAssessment(item,button)'),two=independent.run('recordEvidenceAssessment(item,other)');assert.equal(independent.calls.length,2,'different evidence can proceed independently');independent.calls[0].resolve(response(confirmed));independent.calls[1].resolve(response({accepted:false,pointsAwarded:0,reason:'Already counted for this story'}));await Promise.all([one,two]);assert.equal(independent.run('userState.points'),12);assert.equal(independent.run('assessmentRequests.size'),0);
const replaced=harness(),old=replaced.run('recordEvidenceAssessment(item,button)');replaced.b.dataset.evidenceId='new-evidence';replaced.b.disabled=false;replaced.b.textContent='new control';replaced.calls[0].resolve(response(confirmed));await old;assert.equal(replaced.b.textContent,'new control');assert.equal(replaced.b.disabled,false);
console.log('Assessment deadline smoke passed: stalled headers/body, per-target guard, no automatic retry, no unconfirmed/held/duplicate points, strict response validation, stale-profile fencing, explicit duplicate recovery and timer cleanup. Synthetic only.');
