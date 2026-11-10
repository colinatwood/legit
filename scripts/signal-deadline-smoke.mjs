import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const app=await readFile('dist/app.js','utf8');
function deferred(){let resolve,reject;const promise=new Promise((r,j)=>{resolve=r;reject=j;});return {promise,resolve,reject};}
const tick=()=>new Promise(r=>setImmediate(r));
const success=()=>new Response('{"ok":true,"happening":{"id":"synthetic-id","reviewState":"pending","publicLat":43.665,"publicLng":-70.26}}');
function harness(){
 const timers=new Map(),calls=[],nodes=new Map(),closed=[],toasts=[];let next=0,resets=0;
 const button={disabled:false,textContent:'Post signal'};
 const node=id=>{if(!nodes.has(id))nodes.set(id,{value:'',checked:false,hidden:false});return nodes.get(id);};
 for(const [id,value] of Object.entries({postTitle:'Synthetic title',postBody:'Synthetic body',postLocation:'Fixture neighborhood',postTopic:'Community',postBalance:'agnostic',postIdentity:'Hidden identity',postSource:'https://example.invalid/source'}))node(id).value=value;
 node('anonymousToggle').checked=true;node('sensitiveToggle').checked=false;
 node('composerForm').reset=()=>{resets++;for(const id of ['postTitle','postBody','postLocation','postIdentity','postSource'])node(id).value='';};
 const context={AbortController,Promise,Math,setTimeout:(fn,ms)=>{assert.equal(ms,12000);timers.set(++next,fn);return next;},clearTimeout:id=>timers.delete(id),showToast:t=>toasts.push(t),closeModal:id=>closed.push(id),document:{getElementById:node},event:{preventDefault(){},currentTarget:{querySelector:()=>button}},fetch:(path,options)=>{assert.equal(path,'/api/happenings');const d=deferred();calls.push({...d,options});return d.promise;},renderMarkers:()=>{throw Error('must not create an unreviewed map marker');},openMini:()=>{throw Error('must not display unreviewed raw submission');}};
 vm.createContext(context);const run=code=>vm.runInContext(code,context);
 run('let composerDraftVersion=0;let signalSubmissionPending=false;const happenings=[];');
 run(app.slice(app.indexOf('async function boundedAccountRequest('),app.indexOf('function readLocalDesk(')));
 run(app.slice(app.indexOf('function resetComposer('),app.indexOf('function setProfileControls(')));
 return {run,calls,nodes,closed,toasts,button,timers,resets:()=>resets,expire(){for(const [id,fn] of [...timers]){timers.delete(id);fn();}}};
}
for(const sensitive of [false,true])for(const bodyStall of [false,true]){
 const h=harness();h.nodes.get('sensitiveToggle').checked=sensitive;
 const draft=JSON.parse(h.run('JSON.stringify(composerDraft())')),request=h.run('submitSignal(event)');let body;
 await h.run('submitSignal(event)');assert.equal(h.calls.length,1);
 const input=JSON.parse(h.calls[0].options.body);assert.equal(input.identityVisibility,'anonymous');assert.equal(input.displayIdentity,null);assert.deepEqual(input.attachments,[]);assert.equal(input.sensitive,sensitive);assert.ok(input.lat>=43.661&&input.lat<=43.669);assert.ok(input.lng>=-70.266&&input.lng<=-70.254);
 if(bodyStall){body=deferred();h.calls[0].resolve({ok:true,json:()=>body.promise});await tick();}
 h.expire();await request;assert.equal(h.calls[0].options.signal.aborted,true);assert.equal(h.button.disabled,false);assert.match(h.toasts.at(-1),/outcome is unknown/);assert.deepEqual(JSON.parse(h.run('JSON.stringify(composerDraft())')),draft);assert.equal(h.closed.length,0);assert.equal(h.resets(),0);
 if(body)body.resolve({ok:true,happening:{id:'late',reviewState:'pending'}});else h.calls[0].resolve(success());await tick();assert.equal(h.closed.length,0);assert.equal(h.calls.length,1);assert.equal(h.timers.size,0);
 const retry=h.run('submitSignal(event)');h.calls[1].resolve(success());await retry;assert.deepEqual(h.closed,['composerModal']);assert.equal(h.resets(),1);assert.equal(h.run('happenings.length'),0);assert.equal(h.nodes.get('anonymousToggle').checked,true);assert.equal(h.timers.size,0);
}
for(const field of ['postTitle','postBody','postLocation','postTopic','postBalance','postSource','postIdentity','anonymousToggle','sensitiveToggle','reopen']){
 const h=harness(),request=h.run('submitSignal(event)');
 if(field==='reopen')h.run('composerDraftVersion++');else if(field.endsWith('Toggle'))h.nodes.get(field).checked=!h.nodes.get(field).checked;else h.nodes.get(field).value='new draft value';
 h.calls[0].resolve(success());await request;assert.equal(h.resets(),0,field);assert.equal(h.closed.length,0,field);assert.match(h.toasts.at(-1),/current draft is kept/);
}
for(const outcome of ['network','invalid-json','malformed','server','rejected']){
 const h=harness(),request=h.run('submitSignal(event)');if(outcome==='network')h.calls[0].reject(new Error('offline'));else h.calls[0].resolve(new Response(outcome==='invalid-json'?'invalid':'{}',{status:outcome==='server'?503:outcome==='rejected'?400:200}));await request;assert.equal(h.resets(),0);assert.equal(h.closed.length,0);assert.equal(h.button.disabled,false);assert.match(h.toasts.at(-1),outcome==='rejected'?/rejected/:/outcome is unknown/);assert.equal(h.timers.size,0);
}
const invalid=harness();invalid.nodes.get('postTitle').value=' ';await invalid.run('submitSignal(event)');assert.equal(invalid.calls.length,0);
const attributed=harness();attributed.nodes.get('anonymousToggle').checked=false;const request=attributed.run('submitSignal(event)');const sent=JSON.parse(attributed.calls[0].options.body);assert.equal(sent.identityVisibility,'attributed');assert.equal(sent.displayIdentity,'Hidden identity');attributed.calls[0].resolve(success());await request;
console.log('Signal deadline smoke passed: stalled headers/body, abort, duplicate guard, draft/privacy-option preservation, explicit retry, late responses, malformed/rejected responses, anonymous defaults, metadata-only payload and no unreviewed map markers. Synthetic only.');
