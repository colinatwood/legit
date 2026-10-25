import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import vm from "node:vm";
const app=await readFile("dist/app.js","utf8");
const nodes=new Map();let focusCalls=0;
const document={activeElement:null,getElementById(id){if(!nodes.has(id))nodes.set(id,new Node(id));return nodes.get(id);},createElement(){return new Node();}};
class Node {
  constructor(id){this.id=id;this.dataset={};this.hidden=true;this.children=[];this.attrs={};this.style={setProperty(){}};this.classList={add(){},remove(){}};}
  contains(node){return node===this || this.children.some(child=>child.contains(node));}
  closest(){return this.dataset.signalId!==undefined ? this : this.parent?.closest();}
  setAttribute(key,value){this.attrs[key]=value;}
  addEventListener(){}
  querySelectorAll(){return this.children.filter(node=>node.dataset.signalId!==undefined);}
  querySelector(){return document.getElementById("dialogClose");}
  focus(options){this.focusOptions=options;document.activeElement=this;focusCalls++;}
  get outerHTML(){return "<div></div>";}
  set innerHTML(value){
    if(this.contains(document.activeElement))document.activeElement=document.body;
    this.children=[...value.matchAll(/data-signal-id="([^"]+)"/g)].map(match=>{const node=new Node();node.dataset.signalId=match[1];node.parent=this;return node;});
  }
}
document.body=new Node("body");document.activeElement=document.body;
const root=document.getElementById("map");root.hidden=false;
const list=document.getElementById("signalList");list.hidden=true;
const L={divIcon:options=>options,marker(){const node=new Node();node.parent=root;return {addTo(){root.children.push(node);return this;},getElement(){return node;},on(){return this;},remove(){if(node.contains(document.activeElement))document.activeElement=document.body;root.children=root.children.filter(child=>child!==node);}};}};
const context={document,L,Date,Set,Map,AbortController,window:{setTimeout,clearTimeout}};
vm.createContext(context);
vm.runInContext(app.slice(0,app.indexOf("function fillMini(")),context);
vm.runInContext(app.slice(app.indexOf("function showModal("),app.indexOf("function populateDetail(")),context);
const run=code=>vm.runInContext(code,context);
run("map={}; function applyDeskState(){}");
function response(ids){return new Response(JSON.stringify({window:"today",happenings:ids.map(id=>({id,title:"Synthetic report "+id,body:"Public report",publicLat:43.65,publicLng:-70.26,createdAt:new Date().toISOString()}))}),{headers:{etag:'"test"'}});}
async function refresh(ids){context.fetch=async()=>response(ids);await run("loadPublicHappenings()");}
const find=(surface,id)=>surface.children.find(node=>node.dataset.signalId===id);
await refresh(["story:1","story:2"]);
let original=find(root,"story:1");original.focus();await refresh(["story:2","story:1"]);
assert.equal(document.activeElement,find(root,"story:1"));assert.notEqual(document.activeElement,original);
assert.equal(document.activeElement.focusOptions.preventScroll,true);
assert.equal(document.activeElement.attrs.role,"button");assert.equal(document.activeElement.attrs.tabindex,"0");
assert.match(document.activeElement.attrs["aria-label"],/Shift\+F10/);
await refresh(["story:2"]);assert.equal(document.activeElement,document.getElementById("timeRange"));
// Text fallback has the same stable-report behavior.
root.hidden=true;list.hidden=false;find(list,"story:2").focus();await refresh(["story:1","story:2"]);
assert.equal(document.activeElement,find(list,"story:2"));
run('refineFilters.importance="high"; renderMarkers()');assert.equal(document.activeElement,document.getElementById("timeRange"));
run('refineFilters.importance="all"; renderMarkers()');
// A map-to-text fallback restores the same report on the available surface.
root.hidden=false;list.hidden=true;find(root,"story:1").focus();root.hidden=true;list.hidden=false;run("renderMarkers()");
assert.equal(document.activeElement,find(list,"story:1"));
// Toolbar and dialog focus must remain untouched during background refreshes.
const toolbar=document.getElementById("openAccount");toolbar.focus();let before=focusCalls;await refresh(["story:1","story:2"]);
assert.equal(document.activeElement,toolbar);assert.equal(focusCalls,before);
const close=document.getElementById("dialogClose");close.focus();before=focusCalls;await refresh(["story:1"]);
assert.equal(document.activeElement,close);assert.equal(focusCalls,before);
// Dialog return must resolve a current node, not a detached opener.
find(list,"story:1").focus();run('showModal("detailModal")');await refresh(["story:1"]);
assert.equal(document.activeElement,close);run('closeModal("detailModal")');assert.equal(document.activeElement,find(list,"story:1"));
find(list,"story:1").focus();run('showModal("detailModal")');await refresh([]);run('closeModal("detailModal")');
assert.equal(document.activeElement,document.getElementById("timeRange"));
// Expired snapshots and filter changes use the same safe recovery path.
await refresh(["story:1"]);find(list,"story:1").focus();run('publicDataSavedAt=0; showStalePublicData()');
assert.equal(document.activeElement,document.getElementById("timeRange"));
console.log("Map focus smoke passed: changed/reordered map and list snapshots, withdrawn/filtered/expired reports, text fallback, no unrelated focus theft, current dialog return targets, marker keyboard semantics, and prevent-scroll restoration.");
