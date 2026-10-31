import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const app=await readFile('dist/app.js','utf8');
const channels=[]; const messages=[];
class Channel {
  constructor(name){this.name=name;channels.push(this);}
  postMessage(data){messages.push(data);for(const peer of channels) if(peer!==this && peer.name===this.name) peer.onmessage?.({data});}
}
const profile={controls:{limitSensitive:true},dataSummary:{happenings:0,deskItems:0,pending:0}};
function tab(supported=true){
  const nodes=new Map(), listeners={};let calls=0;
  const context={Set,Promise,BroadcastChannel:supported?Channel:undefined,showToast:()=>{},renderMarkers:()=>{},localStorage:{getItem:()=>null},window:{confirm:()=>true,addEventListener:(type,fn)=>{listeners[type]=fn;}},document:{getElementById(id){if(!nodes.has(id))nodes.set(id,{hidden:false,textContent:'',value:'',disabled:false});return nodes.get(id);}}};
  context.fetch=async url=>{calls++;return new Response(JSON.stringify(url==='/api/desk'?{items:[]}:url==='/api/profile/privacy'?profile:{}));};
  vm.createContext(context);
  const run=code=>vm.runInContext(code,context);
  run('const deskStorageKey="legit-desk";const deskState={server:true,keys:new Set(["old"]),generation:0,pending:0,deleting:false};const happenings=[{serverId:"old",saved:true}];');
  run(app.slice(app.indexOf('function deskKey('),app.indexOf('async function submitReport(')));
  run(app.slice(app.indexOf('function setProfileControls('),app.indexOf('async function savePrivacyPreferences(')));
  run(app.slice(app.indexOf('async function deleteAllProfileData('),app.indexOf('document.getElementById("openMethodology")')));
  return {context,run,nodes,listeners,calls:()=>calls};
}
const a=tab(),b=tab();
let finish; b.context.fetch=()=>new Promise(resolve=>{finish=resolve;});
const stale=b.run('loadPrivacyProfile()');
b.context.fetch=async url=>new Response(JSON.stringify(url==='/api/desk'?{items:[]}:profile));
a.run('notifyProfileChange()'); await b.run('refreshProfileState()');
// Join the coalesced refresh rather than starting more work.
await new Promise(resolve=>setImmediate(resolve));
finish(new Response(JSON.stringify({...profile,dataSummary:{happenings:99,pending:2}})));await stale;
assert.equal(b.run('deskState.keys.size'),0);assert.equal(b.run('happenings[0].saved'),false);
assert.match(b.nodes.get('profileDataSummary').textContent,/0 profile-linked/,'old response cannot overwrite refreshed profile');
assert.deepEqual(JSON.parse(JSON.stringify(messages)),[{type:'profile-changed'}]);
const fallback=tab(false);await fallback.listeners.focus();
assert.equal(fallback.calls(),2,'focus fallback revalidates both authenticated endpoints');
assert.equal(fallback.run('deskState.keys.size'),0);
const count=fallback.calls();fallback.run('deskState.deleting=true');await fallback.listeners.focus();assert.equal(fallback.calls(),count);
// Failed deletion must not notify other tabs.
a.context.fetch=async()=>new Response('{"error":"denied"}',{status:403});await a.run('deleteAllProfileData()');assert.equal(messages.length,1);
a.context.fetch=async()=>new Response(JSON.stringify({deletion:{deletedHappenings:1}}));await a.run('deleteAllProfileData()');assert.equal(messages.length,2,'successful deletion notifies peer tabs');
console.log('Profile tabs smoke passed: identity-free invalidation, stale profile fencing, authoritative desk refresh, focus fallback, deletion guard, and no failure notification.');
