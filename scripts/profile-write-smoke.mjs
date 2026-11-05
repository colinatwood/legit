import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const app=await readFile('dist/app.js','utf8');
function deferred(){let resolve,reject;const promise=new Promise((r,j)=>{resolve=r;reject=j;});return {promise,resolve,reject};}
const tick=()=>new Promise(r=>setImmediate(r));
function harness(){
 const timers=new Map(),calls=[],nodes=new Map();let next=0;
 const context={AbortController,Set,Promise,setTimeout:(fn,ms)=>{assert.equal(ms,12000);timers.set(++next,fn);return next;},clearTimeout:id=>timers.delete(id),showToast:()=>{},document:{getElementById(id){if(!nodes.has(id))nodes.set(id,{disabled:false,textContent:'',value:'synthetic correction',checked:true});return nodes.get(id);}},fetch:(path,options)=>{assert.equal(path,'/api/profile/privacy');assert.equal(options.method,'POST');const d=deferred();calls.push({...d,options});return d.promise;}};
 vm.createContext(context);const run=code=>vm.runInContext(code,context);
 run('const deskState={generation:0,profileRequestId:1,profileEnabled:true};');
 run(app.slice(app.indexOf('async function boundedAccountRequest('),app.indexOf('function readLocalDesk(')));
 run(app.slice(app.indexOf('function setProfileControls('),app.indexOf('async function loadPrivacyProfile(')));
 run(app.slice(app.indexOf('async function submitProfileUpdate('),app.indexOf('async function exportMyData(')));
 return {run,calls,nodes,timers,expire(){for(const [id,fn] of [...timers]){timers.delete(id);fn();}}};
}
const result=action=>({ok:true,...action==='correction_request'?{request:{status:'pending'}}:{controls:{limitSensitive:true}}});
for(const action of ['correction_request','save_preferences']){
 const invoke=action==='correction_request'?'submitCorrectionRequest()':'savePrivacyPreferences()';
 for(const bodyStall of [false,true]){
  const h=harness(),write=h.run(invoke);let body;
  await h.run(invoke);assert.equal(h.calls.length,1,'duplicate write blocked');assert.equal(h.nodes.get('deleteAllData').disabled,true);
  if(bodyStall){body=deferred();h.calls[0].resolve({ok:true,json:()=>body.promise});await tick();}
  h.expire();await write;assert.equal(h.calls[0].options.signal.aborted,true);assert.equal(h.run('deskState.profileWritePending'),false);assert.equal(h.nodes.get('requestCorrection').disabled,false);
  assert.match(h.nodes.get('profileDataSummary').textContent,/outcome is unknown/);assert.equal(h.nodes.get('correctionDetails').value,'synthetic correction');assert.equal(h.calls.length,1);
  if(body)body.resolve(result(action));else h.calls[0].resolve(new Response(JSON.stringify(result(action))));await tick();assert.match(h.nodes.get('profileDataSummary').textContent,/outcome is unknown/);assert.equal(h.timers.size,0);
 }
 const success=harness(),write=success.run(invoke);success.calls[0].resolve(new Response(JSON.stringify(result(action))));await write;assert.match(success.nodes.get('profileDataSummary').textContent,/saved|submitted/);assert.equal(success.timers.size,0);
 if(action==='correction_request')assert.equal(success.nodes.get('correctionDetails').value,'');
}
for(const outcome of ['network','malformed','server','rejected']){
 const h=harness(),write=h.run('submitCorrectionRequest()');
 if(outcome==='network')h.calls[0].reject(new Error('offline'));
 else h.calls[0].resolve(new Response(outcome==='malformed'?'invalid':'{}',{status:outcome==='server'?503:outcome==='rejected'?403:200}));
 await write;assert.equal(h.nodes.get('correctionDetails').value,'synthetic correction');assert.match(h.nodes.get('profileDataSummary').textContent,outcome==='rejected'?/rejected/:/outcome is unknown/);assert.equal(h.timers.size,0);
}
for(const change of ['deskState.generation++','deskState.profileRequestId++','setProfileControls(false)']){
 const h=harness(),write=h.run('submitCorrectionRequest()');h.run(change);h.nodes.get('profileDataSummary').textContent='new profile state';h.calls[0].resolve(new Response(JSON.stringify(result('correction_request'))));await write;assert.equal(h.nodes.get('profileDataSummary').textContent,'new profile state');assert.equal(h.nodes.get('correctionDetails').value,'synthetic correction');assert.equal(h.nodes.get('requestCorrection').disabled,!h.run('deskState.profileEnabled'));
}
const h=harness(),write=h.run('submitCorrectionRequest()');h.nodes.get('correctionDetails').value='newer draft';h.calls[0].resolve(new Response(JSON.stringify(result('correction_request'))));await write;assert.equal(h.nodes.get('correctionDetails').value,'newer draft');
const busy=harness(),pending=busy.run('submitCorrectionRequest()');
await busy.run('savePrivacyPreferences()');assert.equal(busy.calls.length,1,'profile write types share a guard');
busy.run(app.slice(app.indexOf('async function deleteAllProfileData('),app.indexOf('// Cross-tab messages are invalidations')));
await busy.run('deleteAllProfileData()');assert.equal(busy.calls.length,1,'deletion cannot race a pending profile update');
busy.calls[0].resolve(new Response(JSON.stringify(result('correction_request'))));await pending;
console.log('Profile write smoke passed: deadlines through JSON, duplicate guard, no automatic retry, unknown outcomes, draft preservation, success, rejection, stale responses, and current disabled-control state.');
