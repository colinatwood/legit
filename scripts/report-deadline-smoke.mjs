import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const app=await readFile('dist/app.js','utf8');
function deferred(){let resolve,reject;const promise=new Promise((r,j)=>{resolve=r;reject=j;});return {promise,resolve,reject};}
const tick=()=>new Promise(r=>setImmediate(r));
const success=()=>new Response('{"ok":true,"report":{"reviewState":"pending"}}');
function harness(reason='evidence'){
 const timers=new Map(),calls=[],nodes=new Map(),toasts=[],closed=[];let next=0;
 const button={disabled:false,textContent:'Send for review'};
 const node=id=>{if(!nodes.has(id))nodes.set(id,{value:'',textContent:'',hidden:false});return nodes.get(id);};
 node('reportDetails').value='Synthetic observation';node('reportReason').value=reason;node('evidenceSource').value='https://example.invalid/public';
 const context={AbortController,Promise,setTimeout:(fn,ms)=>{assert.equal(ms,12000);timers.set(++next,fn);return next;},clearTimeout:id=>timers.delete(id),showToast:t=>toasts.push(t),closeModal:id=>closed.push(id),showModal:()=>{},closeActions:()=>{},miniCard:{hidden:false},selectReportReason:reason=>{node('reportReason').value=reason;},document:{getElementById:node},event:{preventDefault(){},currentTarget:{querySelector:()=>button}},fetch:(path,options)=>{assert.equal(path,'/api/reports');const d=deferred();calls.push({...d,options});return d.promise;}};
 vm.createContext(context);const run=code=>vm.runInContext(code,context);
 run('let selectedHappening={id:"signal-a",title:"Synthetic signal"};let reportDraftVersion=0;let reportSubmissionPending=false;');
 run(app.slice(app.indexOf('async function boundedAccountRequest('),app.indexOf('function readLocalDesk(')));
 run(app.slice(app.indexOf('function openReport('),app.indexOf('async function recordEvidenceAssessment(')));
 run(app.slice(app.indexOf('async function submitReport('),app.indexOf('function runAction(')));
 return {run,calls,nodes,toasts,closed,button,timers,expire(){for(const [id,fn] of [...timers]){timers.delete(id);fn();}}};
}
for(const reason of ['evidence','correction','verification','safety_privacy'])for(const bodyStall of [false,true]){
 const h=harness(reason),request=h.run('submitReport(event)');let body;
 await h.run('submitReport(event)');assert.equal(h.calls.length,1);assert.equal(h.button.disabled,true);
 const input=JSON.parse(h.calls[0].options.body);assert.deepEqual(input,{targetType:'happening',targetId:'signal-a',reason,details:'Synthetic observation',source:'https://example.invalid/public'});
 if(bodyStall){body=deferred();h.calls[0].resolve({ok:true,json:()=>body.promise});await tick();}
 h.expire();await request;assert.equal(h.calls[0].options.signal.aborted,true);assert.equal(h.button.disabled,false);assert.equal(h.run('reportSubmissionPending'),false);assert.match(h.toasts.at(-1),/outcome is unknown/);assert.equal(h.nodes.get('reportDetails').value,input.details);assert.equal(h.nodes.get('evidenceSource').value,input.source);assert.equal(h.closed.length,0);assert.equal(h.calls.length,1);
 if(body)body.resolve({ok:true,report:{reviewState:'pending'}});else h.calls[0].resolve(success());await tick();assert.equal(h.closed.length,0);assert.equal(h.timers.size,0);
 const retry=h.run('submitReport(event)');h.calls[1].resolve(success());await retry;assert.deepEqual(h.closed,['reportModal']);assert.equal(h.timers.size,0);
}
for(const change of ['details','source','reason','reopen']){
 const h=harness(),request=h.run('submitReport(event)');
 if(change==='reopen'){h.run('openReport({id:"signal-b",title:"Another signal"})');h.nodes.get('reportDetails').value='New report';}
 else h.nodes.get({details:'reportDetails',source:'evidenceSource',reason:'reportReason'}[change]).value='changed';
 h.calls[0].resolve(success());await request;assert.equal(h.closed.length,0);assert.match(h.toasts.at(-1),/current draft is kept/);assert.equal(h.button.disabled,false);
}
for(const failure of ['network','invalid-json','malformed','server','rejected']){
 const h=harness(),request=h.run('submitReport(event)');
 if(failure==='network')h.calls[0].reject(new Error('offline'));else h.calls[0].resolve(new Response(failure==='invalid-json'?'invalid':'{}',{status:failure==='server'?503:failure==='rejected'?400:200}));
 await request;assert.match(h.toasts.at(-1),failure==='rejected'?/rejected/:/outcome is unknown/);assert.equal(h.closed.length,0);assert.equal(h.button.disabled,false);assert.equal(h.nodes.get('reportDetails').value,'Synthetic observation');assert.equal(h.timers.size,0);
}
const empty=harness();empty.nodes.get('reportDetails').value=' ';await empty.run('submitReport(event)');assert.equal(empty.calls.length,0);empty.nodes.get('reportDetails').value='Synthetic';empty.run('selectedHappening=null');await empty.run('submitReport(event)');assert.equal(empty.calls.length,0);
console.log('Report deadline smoke passed: stalled headers/body, abort, duplicate guard, no auto retry, preserved drafts/links, explicit retries, late responses, changed/reopened forms, rejection, validation and timer cleanup. Synthetic data only.');
