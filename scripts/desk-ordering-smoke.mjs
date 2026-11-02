import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const app=await readFile('dist/app.js','utf8');
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
function harness(){
 const calls=[],storage=[];
 const context={AbortController,setTimeout,clearTimeout,Set,localStorage:{getItem:()=> '["local"]',setItem:(...args)=>storage.push(args)},renderMarkers:()=>{},showToast:()=>{},fetch:(url,options)=>{const task=deferred();calls.push({url,options,...task});return task.promise;}};
 vm.createContext(context);
 const run=code=>vm.runInContext(code,context);
 run('const deskStorageKey="legit-desk";const deskState={server:true,keys:new Set(),generation:0,pending:0,deleting:false,available:true};const happenings=[{serverId:"story",saved:false}];');
 run(app.slice(app.indexOf('function deskKey('),app.indexOf('async function submitReport(')));
 return {run,calls,storage};
}
const response=keys=>new Response(JSON.stringify({items:keys.map(happening_key=>({happening_key}))}));
// Older headers, anonymous responses, errors and delayed JSON cannot replace a newer read.
for(const outcome of ['success','anonymous','failure','body']){
 const h=harness();const a=h.run('loadDesk()');let body;
 if(outcome==='body'){body=deferred();h.calls[0].resolve({ok:true,status:200,json:()=>body.promise});await new Promise(r=>setImmediate(r));}
 const b=h.run('loadDesk()');h.calls[1].resolve(response(['story']));await b;
 if(outcome==='body')body.resolve({items:[{happening_key:'obsolete'}]});
 else if(outcome==='failure')h.calls[0].reject(new Error('offline'));
 else h.calls[0].resolve(outcome==='anonymous'?new Response('{}',{status:401}):response(['obsolete']));
 await a;assert.equal(h.run('deskState.keys.has("story")'),true,outcome);assert.equal(h.run('deskState.server && deskState.available'),true);assert.equal(h.storage.length,0);
}
// One write at a time; queued reads execute only after it settles, on success or failure.
for(const ok of [true,false]){
 const h=harness();const save=h.run('toggleDesk(happenings[0])');assert.equal(h.calls.length,1);
 await h.run('toggleDesk(happenings[0])');assert.equal(h.calls.length,1,'rapid toggles must not race');
 await h.run('loadDesk()');await h.run('loadDesk()');assert.equal(h.calls.length,1,'reads wait for the write');
 h.calls[0].resolve(new Response('{}',{status:ok?200:503}));await save;assert.equal(h.calls.length,2,'deferred reads coalesce');
 h.calls[1].resolve(response(ok?['story']:[]));await new Promise(r=>setImmediate(r));
 assert.equal(h.run('deskState.pending'),0);assert.equal(h.run('deskState.available'),true);assert.equal(h.run('happenings[0].saved'),ok);assert.equal(h.storage.length,0);
}
console.log('Desk ordering smoke passed: newest response wins across headers/body/errors/401; serialized writes, deferred coalesced reads, success/failure recovery, and no local-storage fallback.');
