import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const app=await readFile('dist/app.js','utf8');
function deferred(){let resolve,reject;const promise=new Promise((r,j)=>{resolve=r;reject=j;});return {promise,resolve,reject};}
const tick=()=>new Promise(r=>setImmediate(r));
const success=()=>new Response(JSON.stringify({ok:true,deletion:{deletedHappenings:1,deletedReputationEvents:2}}));
function harness(){
 const timers=new Map(),calls=[],nodes=new Map(),toasts=[];let next=0,confirmed=true,confirmations=0,notifications=0;
 const context={AbortController,Set,Promise,setTimeout:(fn,ms)=>{assert.equal(ms,12000);timers.set(++next,fn);return next;},clearTimeout:id=>timers.delete(id),window:{confirm:()=>{confirmations++;return confirmed;}},showToast:t=>toasts.push(t),notifyProfileChange:()=>{notifications++;},localStorage:{getItem:()=>null},renderMarkers:()=>{},document:{getElementById(id){if(!nodes.has(id))nodes.set(id,{disabled:false,textContent:'',value:id==='correctionDetails'?'synthetic draft':'',checked:true});return nodes.get(id);}},fetch:(path,options)=>{const d=deferred();calls.push({...d,path,options});return d.promise;}};
 vm.createContext(context);const run=code=>vm.runInContext(code,context);
 run('const deskStorageKey="legit-desk";const deskState={generation:0,profileEnabled:true,server:true,keys:new Set(["old"]),pending:0,deleting:false};const happenings=[{serverId:"old",saved:true}];');
 run(app.slice(app.indexOf('function deskKey('),app.indexOf('async function submitReport(')));
 run(app.slice(app.indexOf('function setProfileControls('),app.indexOf('async function submitProfileUpdate(')));
 run(app.slice(app.indexOf('async function deleteAllProfileData('),app.indexOf('// Cross-tab messages are invalidations')));
 return {run,calls,nodes,timers,toasts,cancel(){confirmed=false;},notifications:()=>notifications,confirmations:()=>confirmations,expire(){for(const [id,fn] of [...timers]){timers.delete(id);fn();}}};
}
for(const bodyStall of [false,true]){
 const h=harness(),deletion=h.run('deleteAllProfileData()');let body;
 assert.equal(h.nodes.get('deleteAllData').disabled,true);await h.run('deleteAllProfileData()');await h.run('loadPrivacyProfile()');await h.run('loadDesk()');assert.equal(h.calls.length,1);
 if(bodyStall){body=deferred();h.calls[0].resolve({ok:true,json:()=>body.promise});await tick();}
 h.expire();await deletion;
 assert.equal(h.calls[0].options.signal.aborted,true);assert.equal(h.run('deskState.deleting'),false);assert.equal(h.nodes.get('deleteAllData').disabled,true);assert.equal(h.run('deskState.profileEnabled'),false);assert.match(h.nodes.get('profileDataSummary').textContent,/outcome is unknown/);assert.equal(h.nodes.get('correctionDetails').value,'synthetic draft');assert.equal(h.notifications(),0);assert.equal(h.timers.size,0);
 await h.run('deleteAllProfileData()');assert.equal(h.calls.length,1);assert.equal(h.confirmations(),1,'no automatic or unvalidated deletion replay');
 if(body)body.resolve({ok:true,deletion:{deletedHappenings:1,deletedReputationEvents:2}});else h.calls[0].resolve(success());await tick();assert.equal(h.notifications(),0);assert.match(h.nodes.get('profileDataSummary').textContent,/outcome is unknown/);
 const read=h.run('loadPrivacyProfile()');h.calls[1].resolve(new Response(JSON.stringify({controls:{limitSensitive:true},dataSummary:{happenings:0,pending:0}})));await read;assert.equal(h.nodes.get('deleteAllData').disabled,false);assert.equal(h.calls.filter(c=>c.options.method==='POST').length,1,'recovery is read-only');
 const retry=h.run('deleteAllProfileData()');assert.equal(h.confirmations(),2);h.calls[2].resolve(success());await retry;assert.equal(h.notifications(),1);assert.match(h.nodes.get('profileDataSummary').textContent,/Deleted 1 profile-linked/);assert.equal(h.nodes.get('correctionDetails').value,'');assert.equal(h.timers.size,0);
}
for(const outcome of ['network','malformed','server','rejected']){
 const h=harness(),deletion=h.run('deleteAllProfileData()');
 if(outcome==='network')h.calls[0].reject(new Error('offline'));else h.calls[0].resolve(new Response('{}',{status:outcome==='server'?503:outcome==='rejected'?403:200}));
 await deletion;assert.equal(h.run('deskState.deleting'),false);assert.equal(h.notifications(),0);assert.equal(h.nodes.get('correctionDetails').value,'synthetic draft');assert.equal(h.timers.size,0);
 assert.match(h.nodes.get('profileDataSummary').textContent,outcome==='rejected'?/rejected/:/outcome is unknown/);assert.equal(h.nodes.get('deleteAllData').disabled,outcome!=='rejected');
}
const cancelled=harness();cancelled.cancel();await cancelled.run('deleteAllProfileData()');assert.equal(cancelled.calls.length,0);assert.equal(cancelled.run('happenings[0].saved'),true);
console.log('Deletion deadline smoke passed: confirmed requests only, stalled headers/body, bounded recovery, no automatic deletion replay, late-response exclusion, unknown/rejected outcomes, preserved drafts, read-only revalidation and fresh confirmation. Synthetic data only; no hosted deletion.');
