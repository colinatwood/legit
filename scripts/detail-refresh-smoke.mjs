import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import vm from "node:vm";
const app=await readFile("dist/app.js","utf8");
let now=1_800_000_000_000;
class Clock extends Date {static now(){return now;}}
const nodes=new Map();let focusCalls=0;
const document={activeElement:null,getElementById(id){
  if(!nodes.has(id)) nodes.set(id,new Node(id));
  return nodes.get(id);
}};
class Node {
  constructor(id){this.id=id;this.hidden=true;this.dataset={};this.style={};this.buttons=[];this.listeners=[];this.textContent="";}
  focus(){document.activeElement=this;focusCalls++;}
  contains(node){return node===this || this.buttons.includes(node);}
  querySelectorAll(){return this.buttons;}
  querySelector(){return document.getElementById("detailClose");}
  addEventListener(type,fn){this.listeners.push(fn);}
  set innerHTML(value){
    this.html=value;
    this.buttons=[...value.matchAll(/data-evidence-id="([^"]+)"/g)].map(match=>{
      const button=new Node();button.dataset.evidenceId=match[1];button.textContent="↑ useful";
      button.replaceWith=replacement=>{const index=this.buttons.indexOf(button);this.buttons[index]=replacement;};
      return button;
    });
  }
  get innerHTML(){return this.html || "";}
}
const context={document,Date:Clock,AbortController,Set,Map,window:{setTimeout,clearTimeout}};
vm.createContext(context);
vm.runInContext(app.slice(0,app.indexOf("function markerElement")),context);
for(const [start,end] of [["function fillMini(","function openMini("],["function populateDetail(","function openFull("]]) vm.runInContext(app.slice(app.indexOf(start),app.indexOf(end)),context);
vm.runInContext(`let renders=0; function renderMarkers(){renders++;} function applyDeskState(){}; function closeActions(){actionMenu.hidden=true;} function closeModal(id){document.getElementById(id).hidden=true;}`,context);
const run=code=>vm.runInContext(code,context);
function response(title,extra={}){
  return new Response(JSON.stringify({window:"today",happenings:[{id:"h1",title,body:"Updated body",createdAt:new Date(now-60000).toISOString(),publicLat:43.65,publicLng:-70.26,evidence:[{id:"e1",title:"Public record",excerpt:"Evidence",provenance:"public"}],...extra}]}),{headers:{etag:'"v1"'}});
}
context.fetch=async()=>response("Original");await run("loadPublicHappenings()");
run('selectedHappening=happenings.find(item=>item.serverId); miniCard.hidden=false;');
context.fetch=async()=>response("Corrected",{corrections:[{summary:"Correction <script>bad</script>",createdAt:new Date(now).toISOString()}]});
await run("loadPublicHappenings()");
assert.equal(nodes.get("miniTitle").textContent,"Corrected");
assert.equal(run("selectedHappening.title"),"Corrected");
assert.equal(focusCalls,0,"mini refresh must not take focus");
// Open detail data is refreshed in place; unchanged evidence buttons retain identity.
run('miniCard.hidden=true; document.getElementById("detailModal").hidden=false; populateDetail(selectedHappening);');
let button=nodes.get("sourceList").buttons[0];button.focus();const oldListeners=button.listeners.length;
context.fetch=async()=>response("Latest correction",{corrections:[{summary:"Correction <script>bad</script>",createdAt:new Date(now).toISOString()}]});
await run("loadPublicHappenings()");
assert.equal(nodes.get("detailTitle").textContent,"Latest correction");
assert.match(nodes.get("correctionHistory").innerHTML,/&lt;script&gt;/);
assert.equal(nodes.get("correctionHistorySection").hidden,false);
assert.equal(nodes.get("sourceList").buttons[0],button);
assert.equal(document.activeElement,button);
assert.equal(button.listeners.length,oldListeners,"refresh must not duplicate assessment handlers");
// An in-flight assessment keeps its original button so its response updates visible state.
button.disabled=true;button.textContent="Pending";document.activeElement=nodes.get("detailTitle");
await run("loadPublicHappenings()");assert.equal(nodes.get("sourceList").buttons[0],button);
button.textContent="✓ counted";assert.equal(nodes.get("sourceList").buttons[0].textContent,"✓ counted");
// Unrelated dialog controls keep focus during a refresh.
const fixed=nodes.get("detailTitle");document.activeElement=fixed;const focusBefore=focusCalls;
await run("loadPublicHappenings()");assert.equal(document.activeElement,fixed);assert.equal(focusCalls,focusBefore);
// 304 updates clock-derived labels without downloading report content.
const rendersBefore=run("renders");
context.fetch=async()=>new Response(null,{status:304});now+=600000;
await run("loadPublicHappenings()");assert.equal(nodes.get("detailTime").textContent,"11 min ago");
assert.equal(run('happenings.find(item=>item.serverId).ageMinutes'),11);
assert.equal(run("renders"),rendersBefore,"unchanged visible membership must not rebuild map markers on 304");
// Removed evidence moves focus to the dialog close control; withdrawn reports close the view.
button.disabled=false;button.focus();context.fetch=async()=>response("No evidence",{evidence:[]});
await run("loadPublicHappenings()");assert.equal(document.activeElement,nodes.get("detailClose"));
context.fetch=async()=>new Response('{"window":"today","happenings":[]}');await run("loadPublicHappenings()");
assert.equal(run("selectedHappening"),null);assert.equal(nodes.get("detailModal").hidden,true);
console.log("Detail refresh smoke passed: corrected mini/detail text, escaped correction history, live selection rebinding, 304 age labels, stable evidence buttons, assessment continuity, and dialog keyboard focus.");
