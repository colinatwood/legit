const happenings = [
  {id:1,title:"Road closed near the bridge — anyone know why?",body:"Several people are reporting a full closure at the west side of the bridge. A photo shows cones, but the reason is still unclear.",location:"Casco Bay Bridge · West End",topic:"Public safety",status:"Needs checking",time:"12 min ago",ageMinutes:12,balance:"agnostic",score:42,impact:4,sourceCount:3,checkers:8,reports:12,publicLat:43.6505,publicLng:-70.2782,nearby:true},
  {id:2,title:"Community fridge restocked after the storm",body:"The fridge on Congress is open and stocked again. Neighbors are asking for shelf-stable food and batteries.",location:"Congress St · Parkside",topic:"Community",status:"Building consensus",time:"24 min ago",ageMinutes:24,balance:"agnostic",score:76,impact:3,sourceCount:7,checkers:19,reports:7,publicLat:43.6576,publicLng:-70.2676,nearby:true},
  {id:3,title:"City council packet includes a late zoning change",body:"A late addition appears in tonight’s meeting packet. Looking for someone who can compare it with the previous version.",location:"City Hall · Downtown",topic:"Local government",status:"Needs checking",time:"38 min ago",ageMinutes:38,balance:"left",score:35,impact:3,sourceCount:2,checkers:5,reports:4,publicLat:43.6592,publicLng:-70.2553,nearby:false},
  {id:4,title:"Power flickering across East Bayside",body:"Reports are coming in from multiple blocks. CMP outage map has not updated yet; add a street or source if you can confirm.",location:"East Bayside",topic:"Weather & transit",status:"Building consensus",time:"51 min ago",ageMinutes:51,balance:"agnostic",score:68,impact:5,sourceCount:9,checkers:24,reports:18,publicLat:43.6611,publicLng:-70.2454,nearby:true},
  {id:5,title:"Free rides offered for tonight’s school event",body:"A neighbor is coordinating rides for families who need a way home after the event. Details are in the source thread.",location:"East End Community School",topic:"Community",status:"Corroborated",time:"1 hr ago",ageMinutes:60,balance:"left",score:91,impact:4,sourceCount:11,checkers:31,reports:13,publicLat:43.6754,publicLng:-70.2414,nearby:false},
  {id:6,title:"Question: is the farmers market moving this weekend?",body:"A sign at the usual lot suggests a change, but no official notice has surfaced yet.",location:"Deering Oaks",topic:"Community",status:"Unverified",time:"1 hr ago",ageMinutes:60,balance:"right",score:18,impact:2,sourceCount:1,checkers:3,reports:3,publicLat:43.6750,publicLng:-70.2760,nearby:false}
];
const claimSeeds = {1:{text:"The west approach to the bridge was closed around 8:05 AM.",attribution:"Claim assembled from three local reports."},2:{text:"The Congress Street community fridge is open and restocked after the storm.",attribution:"Claim combines neighborhood observations and a community update."},3:{text:"Tonight’s city council packet contains a late zoning change.",attribution:"Claim awaits comparison with the prior public packet."},4:{text:"Power interruptions are affecting multiple blocks in East Bayside.",attribution:"Independent resident reports; utility confirmation is pending."},5:{text:"A free-ride network is operating for families leaving tonight’s school event.",attribution:"Supported by organizer, school notice, and participant accounts."},6:{text:"The farmers market may move from its usual location this weekend.",attribution:"Observed sign; organizer confirmation is missing."}};
const evidenceSeeds = {1:[{id:"e1",initials:"JM",title:"Jamie M. · firsthand",excerpt:"Saw the cones and a police detail at 8:05.",provenance:"Submitted 12 min ago"},{id:"e2",initials:"PD",title:"Portland traffic advisory",excerpt:"A city traffic-feed link was added; the reason is still pending.",provenance:"Public record"}],2:[{id:"e4",initials:"CF",title:"Community fridge coordinator",excerpt:"Restock list and opening hours posted to the neighborhood group.",provenance:"Community update"}],3:[{id:"e5",initials:"CH",title:"City council packet",excerpt:"The current packet contains a section missing from the earlier download.",provenance:"Public record"}],4:[{id:"e6",initials:"EB",title:"East Bayside residents",excerpt:"Several blocks describe repeated flickering and short outages.",provenance:"Independent reports"}],5:[{id:"e7",initials:"ER",title:"Event ride coordinator",excerpt:"Public signup list and pickup instructions are available.",provenance:"Organizer notice"}],6:[{id:"e8",initials:"DR",title:"Deering Oaks visitor",excerpt:"A photographed sign appears to suggest the market may be moving.",provenance:"Observed sign"}]};
const balanceProfiles = {1:"Mixed firsthand accounts; no consistent ideological framing.",2:"Practical, non-partisan community framing.",3:"The signal carries a left-leaning policy frame; that does not validate the claim.",4:"Independent resident reports without a consistent partisan frame.",5:"Organizer and participant accounts use a left-leaning service frame.",6:"A single observed sign is not enough to assign a stable perspective."};
happenings.forEach(item => { item.claim=claimSeeds[item.id]; item.evidence=evidenceSeeds[item.id] || []; item.balanceBasis=balanceProfiles[item.id]; item.saved=false; });

const toast = document.getElementById("toast");
const miniCard = document.getElementById("miniCard");
const actionMenu = document.getElementById("actionMenu");
let map;
let selectedHappening = null;
let mapMarkers = [];
let postCounter = 0;
let publicLoadController = null;
let publicLoadTimer = null;
const refineFilters = {time:"today",legitimacy:"all",balance:"all",importance:"all"};
const userState = {points:128};
const accessibilityKey = "legit-accessibility";
const accessibilityState = {textSize:"default",highContrast:false,reducedMotion:false,mapLabels:false};
const deskStorageKey = "legit-desk";
const deskState = {server:false,keys:new Set()};
let lastFocusedElement = null;

function saveAccessibility(){ try{ localStorage.setItem(accessibilityKey,JSON.stringify(accessibilityState)); }catch{} }
function loadAccessibility(){ try{ const saved=JSON.parse(localStorage.getItem(accessibilityKey)||"{}"); if(["default","large","largest"].includes(saved.textSize)) accessibilityState.textSize=saved.textSize; ["highContrast","reducedMotion","mapLabels"].forEach(key => { if(typeof saved[key] === "boolean") accessibilityState[key]=saved[key]; }); }catch{} }
function applyAccessibility(){ const app=document.getElementById("app"); app.dataset.textSize=accessibilityState.textSize; app.dataset.highContrast=String(accessibilityState.highContrast); app.dataset.reducedMotion=String(accessibilityState.reducedMotion); app.dataset.showMapLabels=String(accessibilityState.mapLabels); document.getElementById("accessTextSize").value=accessibilityState.textSize; document.getElementById("accessHighContrast").checked=accessibilityState.highContrast; document.getElementById("accessReducedMotion").checked=accessibilityState.reducedMotion; document.getElementById("accessMapLabels").checked=accessibilityState.mapLabels; }

function escapeHtml(value){ return String(value ?? "").replace(/[&<>"']/g,char => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[char])); }
function balanceColor(balance){ return balance === "left" ? "#4388f4" : balance === "right" ? "#e4565a" : "#9b76d5"; }
function balanceLabel(balance){ return balance === "left" ? "Left angle" : balance === "right" ? "Right angle" : "Agnostic / mixed"; }
function statusColor(status){ return status === "Corroborated" ? "#35c978" : status === "Building consensus" ? "#f6b74b" : status === "Needs checking" ? "#ef7c69" : "#9b76d5"; }
function legitColor(score){ const t=Math.max(0,Math.min(100,score))/100; return `rgb(${Math.round(67-12*t)},${Math.round(136+65*t)},${Math.round(244-124*t)})`; }
function locationText(item){ return `${item.location} · aggregated`; }
function matchesFilters(item){
  const age=item.ageMinutes;
  if(refineFilters.time === "today" && age > 1440) return false;
  if(refineFilters.time === "yesterday" && (age <= 1440 || age > 2880)) return false;
  if(refineFilters.time === "week" && age > 10080) return false;
  if(refineFilters.time === "month" && age > 43200) return false;
  if(refineFilters.time === "year" && age > 525600) return false;
  if(refineFilters.legitimacy === "early" && item.score >= 40) return false;
  if(refineFilters.legitimacy === "building" && (item.score < 40 || item.score >= 80)) return false;
  if(refineFilters.legitimacy === "legit" && item.score < 80) return false;
  if(refineFilters.balance !== "all" && item.balance !== refineFilters.balance) return false;
  if(refineFilters.importance === "low" && item.impact > 2) return false;
  if(refineFilters.importance === "medium" && (item.impact < 3 || item.impact > 4)) return false;
  if(refineFilters.importance === "high" && item.impact < 5) return false;
  return true;
}
function visibleHappenings(){ return happenings.filter(matchesFilters); }
function publicStatus(score){ return score >= 80 ? "Corroborated" : score >= 40 ? "Building consensus" : "Needs checking"; }
function setDataStatus(message,state="live"){ const status=document.getElementById("dataStatus"); if(status){ status.textContent=message; status.dataset.state=state; } }
function relativeTime(iso){
  const age=Math.max(0,Math.round((Date.now()-new Date(iso).getTime())/60000));
  if(age < 1) return "just now";
  if(age < 60) return `${age} min ago`;
  const hours=Math.round(age/60);
  if(hours < 24) return `${hours} hr${hours === 1 ? "" : "s"} ago`;
  const days=Math.round(hours/24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}
function mapServerHappening(item){
  return {id:item.id,serverId:item.id,title:item.title,body:item.body,location:item.location,topic:item.topic,status:publicStatus(item.legitimacyScore),time:relativeTime(item.createdAt),ageMinutes:Math.max(0,Math.round((Date.now()-new Date(item.createdAt).getTime())/60000)),balance:item.balance || "agnostic",score:item.legitimacyScore || 0,impact:item.impact || 1,reports:item.reports || 1,publicLat:item.publicLat,publicLng:item.publicLng,claim:{text:item.body,attribution:`Aggregated from ${item.reports || 1} approved local report${item.reports === 1 ? "" : "s"}.`},evidence:item.evidence || [],corrections:item.corrections || [],balanceBasis:"Perspective is calculated from the reported frames in the aggregated signal.",legitimacyBasis:item.legitimacyBasis || "Legitimacy reflects evidence alignment, not popularity.",saved:deskState.keys.has(item.id)};
}
async function loadPublicHappenings(){
  setDataStatus("Refreshing live map…","loading");
  publicLoadController?.abort();
  const controller = new AbortController();
  publicLoadController = controller;
  try{
    const response=await fetch(`/api/happenings?time=${encodeURIComponent(refineFilters.time)}`,{headers:{accept:"application/json"},signal:controller.signal});
    if(!response.ok){ setDataStatus("Using last known map data","stale"); return; }
    const data=await response.json();
    const serverItems=(data.happenings || []).map(mapServerHappening);
    const serverIds=new Set(serverItems.map(item => item.serverId));
    for(let index=happenings.length-1; index>=0; index -= 1){ if(happenings[index].serverId && serverIds.has(happenings[index].serverId)) happenings.splice(index,1); }
    happenings.push(...serverItems);
    applyDeskState();
    renderMarkers();
    setDataStatus(serverItems.length ? "Live · updated just now" : "Live · demo signals", "live");
  }catch(error){ if(error.name !== "AbortError") setDataStatus("Using last known map data","stale"); }
  finally{ if(publicLoadController === controller) publicLoadController = null; }
}
function markerElement(item){
  const el=document.createElement("div"); el.className="map-marker"; el.setAttribute("aria-hidden","true"); el.style.setProperty("--balance-color",balanceColor(item.balance)); el.style.setProperty("--impact",item.impact);
  el.innerHTML=`<span class="marker-dot"></span><span class="marker-count">${item.reports}</span><span class="marker-label">${balanceLabel(item.balance)} · ${item.score}% legit</span>`;
  return el;
}
function bindMarkerPress(marker,item,pressState){
  const node=marker.getElement();
  if(!node) return;
  node.setAttribute("role","button");
  node.setAttribute("tabindex","0");
  node.setAttribute("aria-label",`${item.title}; ${balanceLabel(item.balance)}; ${item.score}% legitimacy; importance ${item.impact} of 5; press Enter for details or Shift+F10 for actions`);
  let timer=null;
  let startX=0;
  let startY=0;
  const cancel=() => { if(timer){ window.clearTimeout(timer); timer=null; } node.classList.remove("pressing"); };
  const finish=event => {
    cancel();
    if(pressState.held){
      event.preventDefault();
      event.stopPropagation();
      pressState.suppressUntil=Date.now()+1200;
      pressState.held=false;
    }
  };
  node.addEventListener("pointerdown",event => {
    if(event.button !== 0 || pressState.pointerId != null) return;
    pressState.pointerId=event.pointerId;
    startX=event.clientX;
    startY=event.clientY;
    cancel();
    node.classList.add("pressing");
    timer=window.setTimeout(() => {
      timer=null;
      node.classList.remove("pressing");
      pressState.held=true;
      openActions(item,startX,startY);
    },450);
  });
  node.addEventListener("pointermove",event => {
    if(event.pointerId !== pressState.pointerId) return;
    if(Math.hypot(event.clientX-startX,event.clientY-startY)>10) cancel();
  });
  node.addEventListener("pointerup",event => {
    if(event.pointerId !== pressState.pointerId) return;
    finish(event);
    pressState.pointerId=null;
  });
  node.addEventListener("pointercancel",event => {
    if(event.pointerId !== pressState.pointerId) return;
    cancel();
    pressState.pointerId=null;
    pressState.held=false;
  });
  node.addEventListener("contextmenu",event => {
    event.preventDefault();
    event.stopPropagation();
    cancel();
    pressState.pointerId=null;
    pressState.held=false;
    pressState.suppressUntil=Date.now()+1200;
    openActions(item,event.clientX,event.clientY);
  });
  node.addEventListener("keydown",event => {
    if(event.key === "Enter" || event.key === " "){
      event.preventDefault();
      openMini(item);
    }else if(event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")){
      event.preventDefault();
      const rect=node.getBoundingClientRect();
      openActions(item,rect.left,rect.bottom,true);
    }
  });
}
function renderMarkers(){
  if(!map) return;
  mapMarkers.forEach(marker => marker.remove());
  mapMarkers=visibleHappenings().map(item => { const marker=L.marker([item.publicLat,item.publicLng],{icon:L.divIcon({className:"leaflet-marker-shell",html:markerElement(item).outerHTML,iconSize:[125,70],iconAnchor:[62,35]})}).addTo(map); const pressState={pointerId:null,held:false,suppressUntil:0}; bindMarkerPress(marker,item,pressState); marker.on("click",event => { if(pressState.suppressUntil>Date.now()){ pressState.suppressUntil=0; return; } L.DomEvent.stopPropagation(event); openMini(item); }); marker.on("contextmenu",event => { L.DomEvent.stopPropagation(event); event.originalEvent.preventDefault(); openActions(item,event.originalEvent.clientX,event.originalEvent.clientY); }); return marker; });
  document.getElementById("signalCount").textContent=`${visibleHappenings().length} signals`;
  const active=Object.entries(refineFilters).filter(([key,value]) => key === "time" ? value !== "today" : value !== "all").length; document.getElementById("filterCount").textContent=active ? `(${active})` : "";
}
function fillMini(item){
  document.getElementById("miniStatusDot").style.background=statusColor(item.status); document.getElementById("miniStatus").textContent=item.status; document.getElementById("miniTime").textContent=item.time; document.getElementById("miniTitle").textContent=item.title; document.getElementById("miniBody").textContent=item.body; document.getElementById("miniLocation").textContent=locationText(item); document.getElementById("miniScore").textContent=`${item.score}% legit`; document.getElementById("miniMeter").style.width=`${item.score}%`; document.getElementById("miniMeter").style.background=`linear-gradient(90deg,${legitColor(item.score)},#35c978)`;
}
function openMini(item){ selectedHappening=item; closeActions(); fillMini(item); miniCard.hidden=false; }
function openActions(item,x,y,focusMenu=false){ selectedHappening=item; miniCard.hidden=true; document.getElementById("actionTitle").textContent=item.title; actionMenu.style.left=`${Math.min(Math.max(8,x),window.innerWidth-240)}px`; actionMenu.style.top=`${Math.min(Math.max(74,y),window.innerHeight-250)}px`; actionMenu.hidden=false; if(focusMenu) actionMenu.querySelector("[data-action]")?.focus(); }
function closeActions(){ actionMenu.hidden=true; }
function showToast(message){ toast.textContent=message; toast.classList.add("show"); clearTimeout(showToast.timer); showToast.timer=setTimeout(() => toast.classList.remove("show"),2600); }
function showModal(id){ const modal=document.getElementById(id); lastFocusedElement=document.activeElement; modal.hidden=false; const focusable=modal.querySelector("button,a[href],input,select,textarea,[tabindex]:not([tabindex='-1'])"); focusable?.focus(); }
function closeModal(id){ const modal=document.getElementById(id); modal.hidden=true; if(id === "accessibilityPanel") document.getElementById("openAccessibility").setAttribute("aria-expanded","false"); if(lastFocusedElement && typeof lastFocusedElement.focus === "function") lastFocusedElement.focus(); }
function populateDetail(item){
  document.getElementById("detailStatusDot").style.background=statusColor(item.status); document.getElementById("detailStatus").textContent=item.status; document.getElementById("detailTime").textContent=item.time; document.getElementById("detailTitle").textContent=item.title; document.getElementById("detailBody").textContent=item.body; document.getElementById("detailLocation").textContent=locationText(item); document.getElementById("detailBalance").textContent=`${balanceLabel(item.balance)} · medium confidence`; document.getElementById("detailImportance").textContent=`${item.impact} / 5`; document.getElementById("detailScore").textContent=`${item.score}%`; document.getElementById("detailClaim").textContent=item.claim.text; document.getElementById("detailClaimAttribution").textContent=`${item.claim.attribution} ${item.balanceBasis}`; document.getElementById("detailBasis").textContent=item.legitimacyBasis || "Legitimacy reflects evidence alignment, not popularity."; document.getElementById("detailSources").textContent=`${item.evidence.length} trails`;
  document.getElementById("sourceList").innerHTML=item.evidence.map(evidence => `<div class="evidence-row"><div class="evidence-avatar">${escapeHtml(evidence.initials)}</div><div class="evidence-copy"><strong>${escapeHtml(evidence.title)}</strong><p>${escapeHtml(evidence.excerpt)}</p><small>${escapeHtml(evidence.provenance)} · <button class="tiny-useful" data-evidence-id="${escapeHtml(evidence.id)}">↑ useful</button></small></div></div>`).join("") || `<p class="privacy-line">No approved evidence trail yet. The signal remains unverified.</p>`;
  const historySection=document.getElementById("correctionHistorySection"); const history=item.corrections || []; historySection.hidden=!history.length; document.getElementById("correctionHistory").innerHTML=history.map(entry => `<div class="history-row"><strong>${escapeHtml(entry.type === "appeal" ? "Appeal resolved" : "Correction resolved")}</strong><p>${escapeHtml(entry.summary)}</p><small>${escapeHtml(relativeTime(entry.createdAt))}</small></div>`).join("");
  document.querySelectorAll(".tiny-useful").forEach(button => button.addEventListener("click",event => { event.stopPropagation(); recordEvidenceAssessment(item,button); }));
}
function openFull(item){ selectedHappening=item; closeActions(); miniCard.hidden=true; populateDetail(item); showModal("detailModal"); }
function openReport(item){ selectedHappening=item; closeActions(); miniCard.hidden=true; document.getElementById("reportTitle").textContent=`Report or correct: ${item.title}`; document.getElementById("reportDetails").value=""; showModal("reportModal"); }
async function recordEvidenceAssessment(item,button){
  if(button.disabled) return; button.disabled=true;
  const evidenceId=button.dataset.evidenceId || item.evidence[0]?.id; if(!evidenceId){ showToast("No evidence trail to upvote yet"); button.disabled=false; return; }
  try{ const response=await fetch("/api/reputation/assessment",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({targetId:`${item.id}:${evidenceId}`,actionType:"evidence_useful"})}); const data=await response.json().catch(() => ({})); if(!response.ok) throw new Error(data.error || "Useful evidence could not be recorded."); const assessment=data.assessment || {}; if(assessment.accepted) userState.points += assessment.pointsAwarded || 0; const held=assessment.riskState === "coordination_review"; button.textContent=assessment.accepted ? (held ? "✓ held for review" : "✓ counted") : "already counted"; showToast(assessment.accepted ? (held ? "Useful evidence recorded; points are held for coordination review" : `Useful evidence added · +${assessment.pointsAwarded} point${assessment.pointsAwarded === 1 ? "" : "s"}`) : (assessment.reason || "This assessment was already counted")); }catch(error){ button.disabled=false; showToast(error.message || "Useful evidence could not be recorded."); }
}
function deskKey(item){ return item.serverId || `demo-${item.id}`; }
function readLocalDesk(){ try{ const saved=JSON.parse(localStorage.getItem(deskStorageKey)||"[]"); return new Set(Array.isArray(saved) ? saved.filter(value => typeof value === "string") : []); }catch{ return new Set(); } }
function saveLocalDesk(){ try{ localStorage.setItem(deskStorageKey,JSON.stringify([...deskState.keys])); }catch{} }
function applyDeskState(){ happenings.forEach(item => { item.saved=deskState.keys.has(deskKey(item)); }); }
async function loadDesk(){
  const localKeys=readLocalDesk();
  try{
    const response=await fetch("/api/desk",{headers:{accept:"application/json"}});
    if(response.status === 401){ deskState.server=false; deskState.keys=localKeys; applyDeskState(); return; }
    if(!response.ok) throw new Error("Desk is unavailable.");
    const data=await response.json(); deskState.server=true; deskState.keys=new Set((data.items || []).map(item => item.happening_key)); applyDeskState(); renderMarkers();
  }catch{ deskState.server=false; deskState.keys=localKeys; applyDeskState(); }
}
async function toggleDesk(item){
  const key=deskKey(item); const next=!item.saved; item.saved=next; if(next) deskState.keys.add(key); else deskState.keys.delete(key); if(!deskState.server) saveLocalDesk(); showToast(next ? "Added to your desk" : "Removed from your desk");
  if(!deskState.server) return;
  try{ const response=await fetch("/api/desk",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:next ? "save" : "remove",happeningKey:key})}); if(!response.ok) throw new Error("Desk could not be updated."); }
  catch{ item.saved=!next; if(next) deskState.keys.delete(key); else deskState.keys.add(key); showToast("Desk could not be updated; try again"); }
}
async function submitReport(event){
  event.preventDefault();
  const details=document.getElementById("reportDetails").value.trim(); if(!details){ showToast("Add details for reviewers first"); return; }
  const submit=event.currentTarget.querySelector('button[type="submit"]'); submit.disabled=true; submit.textContent="Sending…";
  try{ const response=await fetch("/api/reports",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({targetType:"happening",targetId:selectedHappening?.id,reason:document.getElementById("reportReason").value,details})}); const data=await response.json().catch(() => ({})); if(!response.ok) throw new Error(data.error || "Report could not be submitted."); closeModal("reportModal"); showToast(data.report?.message || "Submitted for review"); }
  catch(error){ showToast(error.message || "Report could not be submitted."); }
  finally{ submit.disabled=false; submit.textContent="Send for review"; }
}
function runAction(action){
  if(!selectedHappening) return; const item=selectedHappening; closeActions();
  if(action === "add"){ toggleDesk(item); return; }
  if(action === "full"){ openFull(item); return; }
  if(action === "useful"){ const evidence=item.evidence[0]; if(!evidence){ showToast("No evidence trail to upvote yet"); return; } recordEvidenceAssessment(item,{disabled:false,dataset:{evidenceId:evidence.id},textContent:"↑ useful"}); return; }
  if(action === "report"){ openReport(item); }
}
function resetComposer(){ document.getElementById("composerForm").reset(); document.getElementById("identityField").hidden=true; document.getElementById("anonymousToggle").checked=true; document.getElementById("locationPrivacy").value="aggregate"; }
function setProfileControls(enabled,profile){
  const status=document.getElementById("profileAuthStatus"); const optOut=document.getElementById("profileOptOutSharing"); const limit=document.getElementById("profileLimitSensitive"); const correction=document.getElementById("correctionDetails"); const correctionButton=document.getElementById("requestCorrection"); const exportButton=document.getElementById("exportMyData"); const deleteButton=document.getElementById("deleteAllData");
  optOut.disabled=true;
  [limit,correction,correctionButton,exportButton,deleteButton].forEach(control => { control.disabled=!enabled; });
  status.textContent=enabled ? "Signed in" : "Sign in to manage";
  optOut.checked=true;
  if(profile){ limit.checked=profile.controls.limitSensitive; document.getElementById("profileDataSummary").textContent=`${profile.dataSummary.happenings} profile-linked happening${profile.dataSummary.happenings === 1 ? "" : "s"} · ${profile.dataSummary.deskItems || 0} desk item${profile.dataSummary.deskItems === 1 ? "" : "s"} · ${profile.dataSummary.pending} pending review · ${profile.dataSummary.reputationEvents || 0} signed-in reputation event${profile.dataSummary.reputationEvents === 1 ? "" : "s"}`; } else { limit.checked=true; }
}
async function loadPrivacyProfile(){
  const summary=document.getElementById("profileDataSummary"); summary.textContent="Checking profile-linked data…";
  try{ const response=await fetch("/api/profile/privacy",{headers:{accept:"application/json"}}); const data=await response.json().catch(() => ({})); if(response.status === 401){ setProfileControls(false); summary.textContent="Sign in to view or manage profile-linked data. Anonymous contributions remain aggregated."; return; } if(!response.ok) throw new Error(data.error || "Privacy controls are unavailable."); setProfileControls(true,data); }catch(error){ setProfileControls(false); summary.textContent=error.message || "Privacy controls are unavailable."; }
}
async function savePrivacyPreferences(){
  const summary=document.getElementById("profileDataSummary"); summary.textContent="Saving privacy preferences…";
  try{ const response=await fetch("/api/profile/privacy",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"save_preferences",optOutSharing:document.getElementById("profileOptOutSharing").checked,limitSensitive:document.getElementById("profileLimitSensitive").checked})}); const data=await response.json().catch(() => ({})); if(!response.ok) throw new Error(data.error || "Privacy preferences could not be saved."); summary.textContent="Privacy preferences saved. Aggregated storage remains always on."; }catch(error){ summary.textContent=error.message || "Privacy preferences could not be saved."; }
}
async function submitCorrectionRequest(){
  const details=document.getElementById("correctionDetails").value.trim(); if(!details){ showToast("Describe what should be corrected first"); return; }
  const button=document.getElementById("requestCorrection"); const summary=document.getElementById("profileDataSummary"); button.disabled=true; summary.textContent="Submitting correction request…";
  try{ const response=await fetch("/api/profile/privacy",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"correction_request",details})}); const data=await response.json().catch(() => ({})); if(!response.ok) throw new Error(data.error || "Correction request could not be submitted."); document.getElementById("correctionDetails").value=""; summary.textContent="Correction request submitted for review."; }catch(error){ summary.textContent=error.message || "Correction request could not be submitted."; }finally{ button.disabled=false; }
}
async function exportMyData(){
  const button=document.getElementById("exportMyData"); button.disabled=true;
  try{ const response=await fetch("/api/profile/privacy/export",{headers:{accept:"application/json"}}); const data=await response.json().catch(() => ({})); if(!response.ok) throw new Error(data.error || "Data export is unavailable."); const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"}); const url=URL.createObjectURL(blob); const link=document.createElement("a"); link.href=url; link.download="legit-data-export.json"; link.click(); URL.revokeObjectURL(url); showToast("Your aggregated data export is ready"); }catch(error){ showToast(error.message || "Data export is unavailable."); }finally{ button.disabled=false; }
}
async function deleteAllProfileData(){
  if(!window.confirm("Delete all data linked to this signed-in profile? This removes your profile-linked happenings, evidence, and privacy preferences. Anonymous aggregated reports are not linked to this profile.")) return;
  const button=document.getElementById("deleteAllData"); const summary=document.getElementById("profileDataSummary"); button.disabled=true; summary.textContent="Deleting profile-linked data…";
  try{ const response=await fetch("/api/profile/privacy",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"delete_all"})}); const data=await response.json().catch(() => ({})); if(!response.ok) throw new Error(data.error || "Profile data could not be deleted."); localStorage.removeItem(accessibilityKey); setProfileControls(true,{controls:{optOutSharing:true,limitSensitive:true},dataSummary:{happenings:0,pending:0,reputationEvents:0}}); summary.textContent=`Deleted ${data.deletion?.deletedHappenings || 0} profile-linked happening${data.deletion?.deletedHappenings === 1 ? "" : "s"} and ${data.deletion?.deletedReputationEvents || 0} reputation event${data.deletion?.deletedReputationEvents === 1 ? "" : "s"}.`; showToast("All profile-linked data was deleted"); }catch(error){ summary.textContent=error.message || "Profile data could not be deleted."; button.disabled=false; }
}

document.getElementById("openFilters").addEventListener("click",() => { closeActions(); document.getElementById("filterPanel").hidden=!document.getElementById("filterPanel").hidden; });
document.getElementById("openComposer").addEventListener("click",() => { closeActions(); showModal("composerModal"); });
document.getElementById("openAccount").addEventListener("click",() => { closeActions(); showModal("accountModal"); loadPrivacyProfile(); loadDesk(); });
document.getElementById("openAccessibility").addEventListener("click",() => { const panel=document.getElementById("accessibilityPanel"); if(!panel.hidden){ closeModal("accessibilityPanel"); return; } closeActions(); document.getElementById("filterPanel").hidden=true; showModal("accessibilityPanel"); document.getElementById("openAccessibility").setAttribute("aria-expanded","true"); });
document.getElementById("accessTextSize").addEventListener("change",event => { accessibilityState.textSize=event.target.value; saveAccessibility(); applyAccessibility(); showToast(`Text size set to ${event.target.options[event.target.selectedIndex].text}.`); });
[["accessHighContrast","highContrast","High contrast"],["accessReducedMotion","reducedMotion","Reduced motion"],["accessMapLabels","mapLabels","Map labels"]].forEach(([id,key,label]) => document.getElementById(id).addEventListener("change",event => { accessibilityState[key]=event.target.checked; saveAccessibility(); applyAccessibility(); showToast(`${label} ${event.target.checked ? "on" : "off"}.`); }));
document.getElementById("profileOptOutSharing").addEventListener("change",savePrivacyPreferences);
document.getElementById("profileLimitSensitive").addEventListener("change",savePrivacyPreferences);
document.getElementById("requestCorrection").addEventListener("click",submitCorrectionRequest);
document.getElementById("exportMyData").addEventListener("click",exportMyData);
document.getElementById("deleteAllData").addEventListener("click",deleteAllProfileData);
document.querySelectorAll("[data-close]").forEach(button => button.addEventListener("click",() => { const target=button.dataset.close; if(target === "miniCard") miniCard.hidden=true; else closeModal(target); }));
document.querySelectorAll(".modal-backdrop").forEach(backdrop => backdrop.addEventListener("click",event => { if(event.target === backdrop) closeModal(backdrop.id); }));
document.querySelectorAll("#filterPanel select").forEach(select => select.addEventListener("change",event => { refineFilters[event.target.id.replace("Filter","")]=event.target.value; renderMarkers(); }));
const timePresets=["Today","Yesterday","Last week","Last month","Last year","All time"];
const timeValues=["today","yesterday","week","month","year","all"];
function setTimePreset(index){ const safeIndex=Math.max(0,Math.min(timeValues.length-1,index)); refineFilters.time=timeValues[safeIndex]; document.getElementById("timeValue").textContent=timePresets[safeIndex]; document.getElementById("timeRange").setAttribute("aria-valuetext",timePresets[safeIndex]); renderMarkers(); window.clearTimeout(publicLoadTimer); publicLoadTimer=window.setTimeout(loadPublicHappenings,180); }
document.getElementById("timeRange").addEventListener("input",event => setTimePreset(Number(event.target.value)));
document.querySelectorAll("[data-action]").forEach(button => button.addEventListener("click",() => runAction(button.dataset.action)));
document.getElementById("miniAdd").addEventListener("click",() => { if(selectedHappening) toggleDesk(selectedHappening); });
document.getElementById("miniUseful").addEventListener("click",() => { if(selectedHappening) runAction("useful"); });
document.getElementById("miniFull").addEventListener("click",() => { if(selectedHappening) openFull(selectedHappening); });
document.getElementById("detailAdd").addEventListener("click",() => { if(selectedHappening) toggleDesk(selectedHappening); });
document.getElementById("detailUseful").addEventListener("click",() => { if(selectedHappening) runAction("useful"); });
document.getElementById("detailReport").addEventListener("click",() => { if(selectedHappening) openReport(selectedHappening); });
document.getElementById("reportForm").addEventListener("submit",submitReport);
document.getElementById("anonymousToggle").addEventListener("change",event => { document.getElementById("identityField").hidden=event.target.checked; if(event.target.checked) document.getElementById("postIdentity").value=""; });
document.getElementById("locationPrivacy").addEventListener("change",event => { event.target.value="aggregate"; });
document.getElementById("composerForm").addEventListener("submit",async event => { event.preventDefault(); const form=event.currentTarget; const title=document.getElementById("postTitle").value.trim(); const body=document.getElementById("postBody").value.trim(); const location=document.getElementById("postLocation").value.trim(); if(!title || !body || !location) return; const submit=form.querySelector('button[type="submit"]'); submit.disabled=true; submit.textContent="Queueing…"; const anonymous=document.getElementById("anonymousToggle").checked; const identity=anonymous ? "Anonymous" : (document.getElementById("postIdentity").value.trim() || "Contributor"); const baseLat=43.665+(Math.random()-.5)*.008; const baseLng=-70.26+(Math.random()-.5)*.012; try{ const response=await fetch("/api/happenings",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({title,body,location,topic:document.getElementById("postTopic").value,lat:baseLat,lng:baseLng,identityVisibility:anonymous ? "anonymous" : "attributed",displayIdentity:anonymous ? null : identity,source:document.getElementById("postSource").value.trim(),attachments:[]})}); const data=await response.json().catch(() => ({})); if(!response.ok) throw new Error(data.error || "The privacy gate could not queue this signal."); const item={id:100+postCounter++,serverId:data.happening?.id,title,body,location,topic:document.getElementById("postTopic").value,status:"Unverified",time:"just now",ageMinutes:0,balance:"agnostic",score:0,impact:1,reports:1,publicLat:data.happening?.publicLat ?? Math.round(baseLat*1000)/1000,publicLng:data.happening?.publicLng ?? Math.round(baseLng*1000)/1000,claim:{text:body,attribution:"Queued through the privacy and moderation gate."},evidence:[],balanceBasis:"No independent perspective comparison yet.",saved:false}; happenings.unshift(item); renderMarkers(); closeModal("composerModal"); resetComposer(); openMini(item); showToast("Signal queued — public display waits for review"); }catch(error){ showToast(error.message || "Signal could not be queued"); }finally{ submit.disabled=false; submit.textContent="Post signal"; } });
document.addEventListener("keydown",event => { const activeModal=document.querySelector(".modal-backdrop:not([hidden]), .access-panel:not([hidden])"); if(event.key === "Tab" && activeModal){ const focusables=[...activeModal.querySelectorAll("button,a[href],input,select,textarea,[tabindex]:not([tabindex='-1'])")].filter(element => !element.disabled); if(focusables.length){ const first=focusables[0]; const last=focusables[focusables.length-1]; if(event.shiftKey && document.activeElement === first){ event.preventDefault(); last.focus(); } else if(!event.shiftKey && document.activeElement === last){ event.preventDefault(); first.focus(); } } } if(event.key === "Escape"){ closeActions(); miniCard.hidden=true; document.getElementById("filterPanel").hidden=true; document.querySelectorAll(".modal-backdrop:not([hidden]), .access-panel:not([hidden])").forEach(modal => closeModal(modal.id)); document.getElementById("openAccessibility").setAttribute("aria-expanded","false"); } });

loadAccessibility(); applyAccessibility(); loadDesk();

function initMap(){
  if(!window.L) return; map=L.map("map",{zoomControl:false,attributionControl:true}).setView([43.665,-70.26],12.6); L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:"© OpenStreetMap contributors"}).addTo(map); L.control.zoom({position:"bottomright"}).addTo(map); map.on("click",() => { closeActions(); miniCard.hidden=true; }); map.on("contextmenu",event => { event.originalEvent.preventDefault(); closeActions(); miniCard.hidden=true; showToast("Right-click a marker to see event actions"); }); renderMarkers();
}
initMap();
loadPublicHappenings();
let refreshTimer=null;
function scheduleLiveRefresh(){ window.clearTimeout(refreshTimer); refreshTimer=window.setTimeout(() => { if(document.visibilityState === "visible") loadPublicHappenings(); scheduleLiveRefresh(); },30000); }
document.addEventListener("visibilitychange",() => { if(document.visibilityState === "visible") loadPublicHappenings(); });
scheduleLiveRefresh();
document.addEventListener("keydown",event => {
  if(actionMenu.hidden) return;
  const actions=[...actionMenu.querySelectorAll("[data-action]")];
  const index=actions.indexOf(document.activeElement);
  if(event.key === "ArrowDown" || event.key === "ArrowUp"){
    event.preventDefault();
    actions[(index + (event.key === "ArrowDown" ? 1 : actions.length - 1)) % actions.length]?.focus();
  }
});
