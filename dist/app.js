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
let reportDraftVersion=0;
let reportSubmissionPending=false;
let mapMarkers = [];
let composerDraftVersion=0;
let signalSubmissionPending=false;
let publicLoadController = null;
let publicLoadTimer = null;
let publicEtag = null;
let publicSnapshotWindow = null;
let publicLoadWindow = null;
const publicLoadTimeout = 12000;
let publicDataSavedAt = 0;
const publicDataMaxAge = 5 * 60 * 1000;
let mapLoadStarted = false;
const refineFilters = {time:"today",legitimacy:"all",balance:"all",importance:"all"};
const userState = {points:128};
const accessibilityKey = "legit-accessibility";
const accessibilityState = {textSize:"default",highContrast:false,reducedMotion:false,mapLabels:false};
const deskStorageKey = "legit-desk";
const deskState = {server:false,keys:new Set(),generation:0,pending:0,deleting:false,available:false};
let lastFocusedElement = null;
let lastFocusedSignal = null;

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
function visibleHappenings(){ return happenings.filter(item => item.publicLat != null && item.publicLng != null && matchesFilters(item)); }
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
  return {id:item.id,serverId:item.id,createdAt:item.createdAt,title:item.title,body:item.body,location:item.location,topic:item.topic,status:publicStatus(item.legitimacyScore),time:relativeTime(item.createdAt),ageMinutes:Math.max(0,Math.round((Date.now()-new Date(item.createdAt).getTime())/60000)),balance:item.balance || "agnostic",score:item.legitimacyScore || 0,impact:item.impact || 1,reports:item.reports || 1,sourceCount:item.sourceCount || 0,usefulEvidence:item.usefulEvidence || 0,independentAssessors:item.independentAssessors || 0,coordinationReview:Boolean(item.coordinationReview),publicLat:item.publicLat,publicLng:item.publicLng,claim:{text:item.body,attribution:`Aggregated from ${item.reports || 1} approved local report${item.reports === 1 ? "" : "s"}.`},evidence:item.evidence || [],corrections:item.corrections || [],balanceBasis:"Perspective is calculated from the reported frames in the aggregated signal.",legitimacyBasis:item.legitimacyBasis || "Legitimacy reflects evidence alignment, not popularity.",saved:deskState.keys.has(item.id)};
}
function refreshPublicViews(renderMap=true){
  const visibleBefore=visibleHappenings().map(item => String(item.id)).join(",");
  happenings.forEach(item => {
    if(item.serverId && item.createdAt){
      item.time=relativeTime(item.createdAt);
      item.ageMinutes=Math.max(0,Math.round((Date.now()-new Date(item.createdAt).getTime())/60000));
    }
  });
  if(selectedHappening?.serverId){
    const current=happenings.find(item => item.serverId === selectedHappening.serverId);
    if(!current) clearPublicSelection();
    else{
      selectedHappening=current;
      if(!miniCard.hidden) fillMini(current);
      if(!actionMenu.hidden) document.getElementById("actionTitle").textContent=current.title;
      if(!document.getElementById("detailModal").hidden) populateDetail(current);
    }
  }
  if(renderMap || visibleBefore !== visibleHappenings().map(item => String(item.id)).join(",")) renderMarkers();
}
function clearPublicSelection(){
  if(!selectedHappening?.serverId) return;
  miniCard.hidden=true;
  closeActions();
  if(!document.getElementById("detailModal").hidden) closeModal("detailModal");
  selectedHappening=null;
}
function showStalePublicData(){
  if(publicSnapshotWindow !== refineFilters.time || !publicDataSavedAt || Date.now() - publicDataSavedAt > publicDataMaxAge){
    for(let index=happenings.length-1; index>=0; index -= 1){ if(happenings[index].serverId) happenings.splice(index,1); }
    publicEtag=null;
    publicSnapshotWindow=null;
    clearPublicSelection();
    renderMarkers();
    setDataStatus("Live data unavailable · demo signals", "stale");
  }else setDataStatus("Connection unavailable · last known data", "stale");
}
function cancelPublicLoad(){
  publicLoadController?.abort();
  publicLoadController=null;
  publicLoadWindow=null;
}
async function loadPublicHappenings(){
  const timeWindow=refineFilters.time;
  // Reconnect and visibility events share an in-flight request for this window.
  if(publicLoadController && !publicLoadController.signal.aborted && publicLoadWindow === timeWindow) return;
  cancelPublicLoad();
  const controller = new AbortController();
  publicLoadController = controller;
  publicLoadWindow = timeWindow;
  const isCurrent=() => publicLoadController === controller && refineFilters.time === timeWindow;
  setDataStatus("Refreshing live map…","loading");
  const timeout=window.setTimeout(() => {
    if(isCurrent()){
      controller.abort();
      showStalePublicData();
    }
  },publicLoadTimeout);
  try{
    const headers={accept:"application/json"};
    // A validator is useful only while its matching window's snapshot is held.
    if(publicEtag && publicSnapshotWindow === timeWindow) headers["if-none-match"]=publicEtag;
    const response=await fetch(`/api/happenings?time=${encodeURIComponent(timeWindow)}`,{headers,signal:controller.signal});
    if(!isCurrent() || controller.signal.aborted) return;
    if(response.status === 304){
      if(!headers["if-none-match"] || publicSnapshotWindow !== timeWindow) throw new Error("No matching snapshot to revalidate.");
      publicDataSavedAt=Date.now();
      refreshPublicViews(false);
      setDataStatus("Live · no changes", "live");
      return;
    }
    if(!response.ok){ showStalePublicData(); return; }
    const data=await response.json();
    // Abort can occur after headers arrive but before the response body finishes.
    if(!isCurrent() || controller.signal.aborted) return;
    if(!Array.isArray(data.happenings) || (data.window && data.window !== timeWindow)) throw new Error("Unexpected public snapshot.");
    const serverItems=data.happenings.map(mapServerHappening);
    const offline=response.headers.get("x-legit-offline") === "1";
    const savedAt=offline ? Number(response.headers.get("x-legit-saved-at")) : Date.now();
    if(!Number.isFinite(savedAt) || savedAt <= 0 || Date.now()-savedAt < 0 || Date.now()-savedAt > publicDataMaxAge) throw new Error("Expired public snapshot.");
    publicDataSavedAt=savedAt;
    publicSnapshotWindow=timeWindow;
    publicEtag=response.headers.get("etag") || null;
    for(let index=happenings.length-1; index>=0; index -= 1){ if(happenings[index].serverId) happenings.splice(index,1); }
    happenings.push(...serverItems);
    applyDeskState();
    refreshPublicViews();
    setDataStatus(offline ? "Offline · recent saved data (up to 5 min old)" : (serverItems.length ? "Live · updated just now" : "Live · demo signals"), offline ? "stale" : "live");
  }catch(error){ if(isCurrent() && !controller.signal.aborted) showStalePublicData(); }
  finally{
    window.clearTimeout(timeout);
    if(publicLoadController === controller){ publicLoadController=null; publicLoadWindow=null; }
  }
}
function markerElement(item){
  const el=document.createElement("div"); el.className="map-marker"; el.setAttribute("aria-hidden","true"); el.style.setProperty("--balance-color",balanceColor(item.balance)); el.style.setProperty("--impact",item.impact);
  el.innerHTML=`<span class="marker-dot"></span><span class="marker-count">${item.reports}</span><span class="marker-label">${balanceLabel(item.balance)} · ${item.score}% legit</span>`;
  return el;
}
function bindMarkerPress(marker,item,pressState){
  const node=marker.getElement();
  if(!node) return;
  node.dataset.signalId=String(item.id);
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
function captureSignalFocus(element=document.activeElement){
  const signal=element?.closest?.("[data-signal-id]");
  if(!signal) return null;
  for(const surface of ["map","signalList"]){
    if(document.getElementById(surface)?.contains?.(signal)) return {surface,id:signal.dataset.signalId};
  }
  return null;
}
function restoreSignalFocus(bookmark){
  if(!bookmark) return;
  const preferred=document.getElementById(bookmark.surface);
  const alternate=document.getElementById(bookmark.surface === "map" ? "signalList" : "map");
  const surface=preferred && !preferred.hidden ? preferred : alternate && !alternate.hidden ? alternate : null;
  const target=surface ? [...surface.querySelectorAll("[data-signal-id]")].find(node => node.dataset.signalId === bookmark.id && !node.disabled) : null;
  (target || document.getElementById("timeRange"))?.focus({preventScroll:true});
}
function renderMarkers(){
  const focusedSignal=captureSignalFocus();
  const visible=visibleHappenings();
  if(map){
    mapMarkers.forEach(marker => marker.remove());
    mapMarkers=visible.map(item => { const marker=L.marker([item.publicLat,item.publicLng],{icon:L.divIcon({className:"leaflet-marker-shell",html:markerElement(item).outerHTML,iconSize:[125,70],iconAnchor:[62,35]})}).addTo(map); const pressState={pointerId:null,held:false,suppressUntil:0}; bindMarkerPress(marker,item,pressState); marker.on("click",event => { if(pressState.suppressUntil>Date.now()){ pressState.suppressUntil=0; return; } L.DomEvent.stopPropagation(event); openMini(item); }); marker.on("contextmenu",event => { L.DomEvent.stopPropagation(event); event.originalEvent.preventDefault(); openActions(item,event.originalEvent.clientX,event.originalEvent.clientY); }); return marker; });
  }
  const signalList=document.getElementById("signalList");
  signalList.innerHTML=visible.map(item => `<button class="signal-list-item" data-signal-id="${escapeHtml(item.id)}"><span class="signal-list-dot" style="background:${balanceColor(item.balance)}"></span><span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.status)} · ${item.score}% legit · impact ${item.impact}/5</small></span></button>`).join("");
  signalList.querySelectorAll("[data-signal-id]").forEach(button => button.addEventListener("click",() => { const item=happenings.find(entry => String(entry.id) === button.dataset.signalId); if(item) openMini(item); }));
  document.getElementById("signalCount").textContent=`${visible.length} signals`;
  const active=Object.entries(refineFilters).filter(([key,value]) => key === "time" ? value !== "today" : value !== "all").length; document.getElementById("filterCount").textContent=active ? `(${active})` : "";
  restoreSignalFocus(focusedSignal);
}
function fillMini(item){
  document.getElementById("miniStatusDot").style.background=statusColor(item.status); document.getElementById("miniStatus").textContent=item.status; document.getElementById("miniTime").textContent=item.time; document.getElementById("miniTitle").textContent=item.title; document.getElementById("miniBody").textContent=item.body; document.getElementById("miniLocation").textContent=locationText(item); document.getElementById("miniScore").textContent=`${item.score}% legit`; document.getElementById("miniMeter").style.width=`${item.score}%`; document.getElementById("miniMeter").style.background=`linear-gradient(90deg,${legitColor(item.score)},#35c978)`;
}
function openMini(item){ selectedHappening=item; closeActions(); fillMini(item); miniCard.hidden=false; }
function openActions(item,x,y,focusMenu=false){ selectedHappening=item; miniCard.hidden=true; document.getElementById("actionTitle").textContent=item.title; actionMenu.style.left=`${Math.min(Math.max(8,x),window.innerWidth-240)}px`; actionMenu.style.top=`${Math.min(Math.max(74,y),window.innerHeight-250)}px`; actionMenu.hidden=false; if(focusMenu) actionMenu.querySelector("[data-action]")?.focus(); }
function closeActions(){ actionMenu.hidden=true; }
function showToast(message){ toast.textContent=message; toast.classList.add("show"); clearTimeout(showToast.timer); showToast.timer=setTimeout(() => toast.classList.remove("show"),2600); }
async function loadTransparencySummary(){
  const host=document.getElementById("transparencySummary"); if(!host || host.dataset.loaded === "true") return;
  host.textContent="Loading privacy-safe review counts…";
  try{
    const response=await fetch("/api/moderation/status",{headers:{accept:"application/json"}}); const data=await response.json().catch(() => ({})); if(!response.ok) throw new Error(data.error || "Review counts unavailable.");
    const summary=data.publicSummary || {}; host.innerHTML=`<strong>Public review snapshot</strong><span>${Number(summary.cleared || 0)} cleared · ${Number(summary.pending || 0)} pending · ${Number(summary.flagged || 0)} flagged</span><span>Last 30 days: ${Number(summary.reviewedLast30Days || 0)} reviewed · ${Number(summary.clearedLast30Days || 0)} cleared · ${Number(summary.flaggedLast30Days || 0)} flagged · ${Number(summary.heldLast30Days || 0)} held</span><small>${escapeHtml(data.disclosure || "Counts only; no identities or exact locations are shown.")}</small>`; host.dataset.loaded="true";
  }catch(error){ host.textContent="Privacy-safe review counts are temporarily unavailable."; }
}
function showModal(id){ const modal=document.getElementById(id); lastFocusedElement=document.activeElement; lastFocusedSignal=captureSignalFocus(lastFocusedElement); modal.hidden=false; const focusable=modal.querySelector("button,a[href],input,select,textarea,[tabindex]:not([tabindex='-1'])"); focusable?.focus(); }
function closeModal(id){ const modal=document.getElementById(id); modal.hidden=true; if(id === "accessibilityPanel") document.getElementById("openAccessibility").setAttribute("aria-expanded","false"); if(lastFocusedSignal) restoreSignalFocus(lastFocusedSignal); else if(lastFocusedElement && typeof lastFocusedElement.focus === "function") lastFocusedElement.focus(); }
function populateDetail(item){
  const sourceList=document.getElementById("sourceList");
  const focusedEvidence=sourceList.contains(document.activeElement) ? document.activeElement?.dataset.evidenceId : null;
  const evidenceButtons=new Map([...sourceList.querySelectorAll(".tiny-useful")].map(button => [button.dataset.evidenceId,button]));
  document.getElementById("detailStatusDot").style.background=statusColor(item.status); document.getElementById("detailStatus").textContent=item.status; document.getElementById("detailTime").textContent=item.time; document.getElementById("detailTitle").textContent=item.title; document.getElementById("detailBody").textContent=item.body; document.getElementById("detailLocation").textContent=locationText(item); document.getElementById("detailBalance").textContent=`${balanceLabel(item.balance)} · descriptive only`; document.getElementById("detailImportance").textContent=`${item.impact} / 5`; document.getElementById("detailScore").textContent=`${item.score}%`; document.getElementById("detailClaim").textContent=item.claim.text; document.getElementById("detailClaimAttribution").textContent=`${item.claim.attribution} ${item.balanceBasis}`; document.getElementById("detailBasis").textContent=item.legitimacyBasis || "Legitimacy reflects evidence alignment, not popularity."; document.getElementById("detailSources").textContent=`${item.evidence.length} trails`;
  document.getElementById("detailTrustSummary").innerHTML=`<strong>${item.score >= 80 ? "Corroborated by current evidence" : item.score >= 40 ? "Evidence is still building" : "Needs independent checking"}</strong><span>${item.independentAssessors || 0} independent assessor${item.independentAssessors === 1 ? "" : "s"} · ${item.sourceCount || item.evidence.length} source trail${(item.sourceCount || item.evidence.length) === 1 ? "" : "s"} · ${item.usefulEvidence || 0} useful-evidence signal${item.usefulEvidence === 1 ? "" : "s"}</span>${item.coordinationReview ? `<em>Assessment burst held for coordination review.</em>` : ""}`;
  document.getElementById("sourceList").innerHTML=item.evidence.map(evidence => `<div class="evidence-row"><div class="evidence-avatar">${escapeHtml(evidence.initials)}</div><div class="evidence-copy"><strong>${escapeHtml(evidence.title)}</strong><p>${escapeHtml(evidence.excerpt)}</p><small>${escapeHtml(evidence.provenance)} · <button class="tiny-useful" data-evidence-id="${escapeHtml(evidence.id)}">↑ useful</button></small></div></div>`).join("") || `<p class="privacy-line">No approved evidence trail yet. The signal remains unverified.</p>`;
  const historySection=document.getElementById("correctionHistorySection"); const history=item.corrections || []; historySection.hidden=!history.length; document.getElementById("correctionHistory").innerHTML=history.map(entry => `<div class="history-row"><strong>${escapeHtml(entry.type === "appeal" ? "Appeal resolved" : "Correction resolved")}</strong><p>${escapeHtml(entry.summary)}</p><small>${escapeHtml(relativeTime(entry.createdAt))}</small></div>`).join("");
  sourceList.querySelectorAll(".tiny-useful").forEach(button => {
    const existing=evidenceButtons.get(button.dataset.evidenceId);
    if(existing){ button.replaceWith(existing); return; }
    button.addEventListener("click",event => { event.stopPropagation(); recordEvidenceAssessment(item,button); });
  });
  if(focusedEvidence){
    const replacement=[...sourceList.querySelectorAll(".tiny-useful")].find(button => button.dataset.evidenceId === focusedEvidence && !button.disabled);
    (replacement || document.getElementById("detailModal").querySelector(".close-button"))?.focus({preventScroll:true});
  }
}
function openFull(item){ selectedHappening=item; closeActions(); miniCard.hidden=true; populateDetail(item); showModal("detailModal"); }
function selectReportReason(value){ const reason=document.getElementById("reportReason"); reason.value=value; reason.dispatchEvent(new Event("change")); }
function openReport(item){ reportDraftVersion++; selectedHappening=item; closeActions(); miniCard.hidden=true; document.getElementById("reportTitle").textContent=`Report or correct: ${item.title}`; document.getElementById("reportDetails").value=""; selectReportReason("correction"); if(document.getElementById("evidenceSource")) document.getElementById("evidenceSource").value=""; showModal("reportModal"); }
async function recordEvidenceAssessment(item,button){
  if(button.disabled) return; button.disabled=true;
  const evidenceId=button.dataset.evidenceId || item.evidence[0]?.id; if(!evidenceId){ showToast("No evidence trail to upvote yet"); button.disabled=false; return; }
  try{ const response=await fetch("/api/reputation/assessment",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({targetId:`${item.id}:${evidenceId}`,actionType:"evidence_useful"})}); const data=await response.json().catch(() => ({})); if(!response.ok) throw new Error(data.error || "Useful evidence could not be recorded."); const assessment=data.assessment || {}; if(assessment.accepted) userState.points += assessment.pointsAwarded || 0; const held=assessment.riskState === "coordination_review"; button.textContent=assessment.accepted ? (held ? "✓ held for review" : "✓ counted") : "already counted"; showToast(assessment.accepted ? (held ? "Useful evidence recorded; points are held for coordination review" : `Useful evidence added · +${assessment.pointsAwarded} point${assessment.pointsAwarded === 1 ? "" : "s"}`) : (assessment.reason || "This assessment was already counted")); }catch(error){ button.disabled=false; showToast(error.message || "Useful evidence could not be recorded."); }
}
function deskKey(item){ return item.serverId || `demo-${item.id}`; }
// Keep the deadline active through JSON parsing, not only response headers.
async function boundedAccountRequest(path,options,readBody=false){
  const controller=new AbortController();
  let timer;
  const deadline=new Promise((_,reject) => {
    timer=setTimeout(() => { const error=new Error(path === "/api/happenings" ? "Signal submission timed out; outcome unknown." : path === "/api/reports" ? "Review submission timed out; outcome unknown." : path === "/api/profile/privacy" && options.method === "POST" ? "Profile update timed out; outcome unknown." : path === "/api/desk" ? "Saved-story request timed out." : path === "/api/profile/privacy/export" ? "Data export timed out. Try again when your connection recovers." : "Profile read timed out. Reopen your profile to retry."); error.deskTimeout=true; reject(error); controller.abort(); },12000);
  });
  try{
    return await Promise.race([deadline,(async () => {
      const response=await fetch(path,{...options,signal:controller.signal});
      const data=readBody && response.ok ? await response.json() : null;
      return {response,data};
    })()]);
  }finally{ clearTimeout(timer); }
}
function readLocalDesk(){ try{ const saved=JSON.parse(localStorage.getItem(deskStorageKey)||"[]"); return new Set(Array.isArray(saved) ? saved.filter(value => typeof value === "string") : []); }catch{ return new Set(); } }
function saveLocalDesk(){ try{ localStorage.setItem(deskStorageKey,JSON.stringify([...deskState.keys])); }catch{} }
function applyDeskState(){ happenings.forEach(item => { item.saved=deskState.keys.has(deskKey(item)); }); }
async function loadDesk(){
  if(deskState.deleting) return;
  const requestId=deskState.requestId=(deskState.requestId || 0)+1;
  if(deskState.pending){ deskState.reload=true; deskState.available=false; return; }
  const localKeys=readLocalDesk(); const generation=deskState.generation;
  deskState.available=false;
  try{
    const {response,data}=await boundedAccountRequest("/api/desk",{headers:{accept:"application/json"}},true);
    if(generation !== deskState.generation || requestId !== deskState.requestId) return;
    if(response.status === 401){ deskState.server=false; deskState.available=true; deskState.keys=localKeys; applyDeskState(); return; }
    if(!response.ok) throw new Error("Desk is unavailable.");
    if(!Array.isArray(data.items) || data.items.some(item => !item || typeof item.happening_key !== "string")) throw new Error("Invalid desk response."); deskState.server=true; deskState.available=true; deskState.keys=new Set(data.items.map(item => item.happening_key)); applyDeskState(); renderMarkers();
  }catch{ if(generation !== deskState.generation || requestId !== deskState.requestId) return; deskState.available=false; deskState.keys.clear(); applyDeskState(); }
}
async function toggleDesk(item){
  if(deskState.pending){ showToast("Please wait for the saved-story update to finish"); return; }
  if(deskState.available === false){ showToast("Saved stories are unavailable. Reconnect or reopen your profile to retry."); return; }
  if(deskState.deleting){ showToast("Please wait for profile deletion to finish"); return; }
  deskState.requestId=(deskState.requestId || 0)+1;
  const generation=deskState.generation; const key=deskKey(item); const next=!item.saved; item.saved=next; if(next) deskState.keys.add(key); else deskState.keys.delete(key); if(!deskState.server) saveLocalDesk(); showToast(next ? "Added to your desk" : "Removed from your desk");
  if(!deskState.server) return;
  deskState.pending++;
  try{ const {response}=await boundedAccountRequest("/api/desk",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:next ? "save" : "remove",happeningKey:key})}); if(!response.ok) throw new Error("Desk could not be updated."); }
  catch(error){ if(generation !== deskState.generation) return; if(error.deskTimeout){ deskState.available=false; deskState.keys.clear(); applyDeskState(); showToast("Saved-story update timed out; its outcome is unknown. Reopen your profile to refresh before trying again."); return; } item.saved=!next; if(next) deskState.keys.delete(key); else deskState.keys.add(key); showToast("Desk could not be updated; try again"); }finally{ deskState.pending--; if(deskState.reload){ deskState.reload=false; loadDesk(); } }
}
async function submitReport(event){
  event.preventDefault();
  if(reportSubmissionPending) return;
  const details=document.getElementById("reportDetails").value.trim(); if(!details){ showToast("Add details for reviewers first"); return; }
  const targetId=selectedHappening?.id; if(targetId == null){ showToast("Open a signal before submitting a review request"); return; }
  const draftVersion=reportDraftVersion;
  const input={targetType:"happening",targetId,reason:document.getElementById("reportReason").value,details,source:document.getElementById("evidenceSource")?.value.trim() || ""};
  const unchanged=() => draftVersion === reportDraftVersion && selectedHappening?.id === targetId && document.getElementById("reportDetails").value.trim() === input.details && document.getElementById("reportReason").value === input.reason && (document.getElementById("evidenceSource")?.value.trim() || "") === input.source;
  const submit=event.currentTarget.querySelector('button[type="submit"]'); reportSubmissionPending=true; submit.disabled=true; submit.textContent="Sending…";
  try{
    const {response,data}=await boundedAccountRequest("/api/reports",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(input)},true);
    if(!response.ok){ const error=new Error("Review submission was rejected. Your draft is kept; check it before trying again."); error.rejected=response.status < 500; throw error; }
    if(data?.ok !== true || data.report?.reviewState !== "pending") throw new Error("Invalid review response.");
    if(unchanged()){ closeModal("reportModal"); showToast("Submitted for review. No identity or exact location is made public."); }
    else showToast("Earlier submission queued for review. Your current draft is kept.");
  }catch(error){ showToast(error.rejected ? error.message : "Review submission outcome is unknown. It may have reached reviewers. Your current draft is kept; check before submitting again. No automatic retry was sent."); }
  finally{ reportSubmissionPending=false; submit.disabled=false; submit.textContent="Send for review"; }
}
function runAction(action){
  if(!selectedHappening) return; const item=selectedHappening; closeActions();
  if(action === "add"){ toggleDesk(item); return; }
  if(action === "full"){ openFull(item); return; }
  if(action === "useful"){ const evidence=item.evidence[0]; if(!evidence){ showToast("No evidence trail to upvote yet"); return; } recordEvidenceAssessment(item,{disabled:false,dataset:{evidenceId:evidence.id},textContent:"↑ useful"}); return; }
  if(action === "evidence"){ openReport(item); selectReportReason("evidence"); return; }
  if(action === "verify"){ openReport(item); selectReportReason("verification"); return; }
  if(action === "report"){ openReport(item); }
}
function resetComposer(){ composerDraftVersion++; document.getElementById("composerForm").reset(); document.getElementById("identityField").hidden=true; document.getElementById("anonymousToggle").checked=true; document.getElementById("sensitiveToggle").checked=false; }
function composerDraft(){
  return {title:document.getElementById("postTitle").value.trim(),body:document.getElementById("postBody").value.trim(),location:document.getElementById("postLocation").value.trim(),topic:document.getElementById("postTopic").value,balance:document.getElementById("postBalance").value,anonymous:document.getElementById("anonymousToggle").checked,sensitive:document.getElementById("sensitiveToggle").checked,identity:document.getElementById("postIdentity").value.trim(),source:document.getElementById("postSource").value.trim()};
}
async function submitSignal(event){
  event.preventDefault(); if(signalSubmissionPending) return;
  const draft=composerDraft(); if(!draft.title || !draft.body || !draft.location) return;
  const version=composerDraftVersion; const fingerprint=JSON.stringify(draft);
  const submit=event.currentTarget.querySelector('button[type="submit"]'); signalSubmissionPending=true; submit.disabled=true; submit.textContent="Queueing…";
  // Preserve the existing area-level synthetic placement; never request device location.
  const lat=43.665+(Math.random()-.5)*.008; const lng=-70.26+(Math.random()-.5)*.012;
  const input={title:draft.title,body:draft.body,location:draft.location,topic:draft.topic,balance:draft.balance,lat,lng,sensitive:draft.sensitive,identityVisibility:draft.anonymous ? "anonymous" : "attributed",displayIdentity:draft.anonymous ? null : (draft.identity || "Contributor"),source:draft.source,attachments:[]};
  try{
    const {response,data}=await boundedAccountRequest("/api/happenings",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(input)},true);
    if(!response.ok){ const error=new Error("Signal submission was rejected. Your draft is kept; check it before trying again."); error.rejected=response.status < 500; throw error; }
    if(data?.ok !== true || typeof data.happening?.id !== "string" || !data.happening.id || data.happening.reviewState !== "pending") throw new Error("Invalid signal response.");
    // Only the approved public feed can add map markers; queued raw text stays off-map.
    if(version === composerDraftVersion && fingerprint === JSON.stringify(composerDraft())){
      closeModal("composerModal"); resetComposer(); showToast(draft.sensitive ? "Sensitive signal queued without a public map pin" : "Signal queued — public display waits for review");
    }else showToast("Earlier signal queued for review. Your current draft is kept.");
  }catch(error){ showToast(error.rejected ? error.message : "Signal submission outcome is unknown. It may have reached reviewers. Your current draft is kept; check before submitting again. No automatic retry was sent."); }
  finally{ signalSubmissionPending=false; submit.disabled=false; submit.textContent="Post signal"; }
}
function setProfileControls(enabled,profile){
  deskState.profileEnabled=enabled;
  const status=document.getElementById("profileAuthStatus"); const optOut=document.getElementById("profileOptOutSharing"); const limit=document.getElementById("profileLimitSensitive"); const correction=document.getElementById("correctionDetails"); const correctionButton=document.getElementById("requestCorrection"); const exportButton=document.getElementById("exportMyData"); const deleteButton=document.getElementById("deleteAllData");
  optOut.disabled=true;
  [limit,correction,correctionButton,exportButton,deleteButton].forEach(control => { control.disabled=!enabled; });
  exportButton.disabled=!enabled || Boolean(deskState.exportPending);
  applyProfileMutationBusy();
  status.textContent=enabled ? "Signed in" : "Sign in to manage";
  optOut.checked=true;
  if(profile){ limit.checked=profile.controls.limitSensitive; document.getElementById("profileDataSummary").textContent=`${profile.dataSummary.happenings} profile-linked happening${profile.dataSummary.happenings === 1 ? "" : "s"} · ${profile.dataSummary.deskItems || 0} desk item${profile.dataSummary.deskItems === 1 ? "" : "s"} · ${profile.dataSummary.pending} pending review`; document.getElementById("profileReputationSummary").textContent=`${profile.dataSummary.reputationPoints || 0} Legit point${(profile.dataSummary.reputationPoints || 0) === 1 ? "" : "s"} earned · ${profile.dataSummary.confirmedReputationPoints || 0} confirmed from useful-evidence assessments · ${profile.dataSummary.heldReputationEvents || 0} held for coordination review`; } else { limit.checked=true; document.getElementById("profileReputationSummary").textContent="Sign in to view your privacy-safe reputation ledger."; }
}
function applyProfileMutationBusy(){
  for(const id of ["profileLimitSensitive","correctionDetails","requestCorrection","deleteAllData"]){ document.getElementById(id).disabled=!deskState.profileEnabled || Boolean(deskState.profileWritePending); }
}
async function loadPrivacyProfile(){
  if(deskState.deleting) return;
  const generation=deskState.generation;
  const requestId=deskState.profileRequestId=(deskState.profileRequestId || 0)+1;
  setProfileControls(false);
  const summary=document.getElementById("profileDataSummary"); summary.textContent="Checking profile-linked data…";
  try{
    const {response,data}=await boundedAccountRequest("/api/profile/privacy",{headers:{accept:"application/json"}},true);
    if(generation !== deskState.generation || requestId !== deskState.profileRequestId) return;
    if(response.status === 401){ summary.textContent="Sign in to view or manage profile-linked data. Anonymous contributions remain aggregated."; return; }
    if(!response.ok) throw new Error("Privacy controls are unavailable.");
    if(!data?.controls || typeof data.controls.limitSensitive !== "boolean" || !data.dataSummary) throw new Error("Privacy controls are unavailable.");
    setProfileControls(true,data);
  }catch(error){
    if(generation !== deskState.generation || requestId !== deskState.profileRequestId) return;
    setProfileControls(false); summary.textContent=error.message || "Privacy controls are unavailable.";
  }
}
async function submitProfileUpdate(input){
  if(!deskState.profileEnabled || deskState.profileWritePending || deskState.deleting) return;
  const generation=deskState.generation; const profileRequestId=deskState.profileRequestId;
  const current=() => generation === deskState.generation && profileRequestId === deskState.profileRequestId && deskState.profileEnabled;
  const summary=document.getElementById("profileDataSummary");
  const correction=input.action === "correction_request";
  deskState.profileWritePending=true; applyProfileMutationBusy();
  summary.textContent=correction ? "Submitting correction request…" : "Saving privacy preferences…";
  try{
    const {response,data}=await boundedAccountRequest("/api/profile/privacy",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(input)},true);
    if(!current()) return;
    if(!response.ok){ const error=new Error("Profile update was rejected. Reopen your profile before trying again."); error.rejected=response.status < 500; throw error; }
    if(data?.ok !== true || (correction ? data.request?.status !== "pending" : typeof data.controls?.limitSensitive !== "boolean")) throw new Error("Invalid profile update response.");
    if(correction && document.getElementById("correctionDetails").value.trim() === input.details) document.getElementById("correctionDetails").value="";
    summary.textContent=correction ? "Correction request submitted for review." : "Privacy preferences saved. Aggregated storage remains always on.";
  }catch(error){
    if(current()) summary.textContent=error.rejected ? error.message : "Profile update outcome is unknown. It may have been saved. Reopen your profile or download your data to check before submitting again. No automatic retry was sent.";
  }finally{ deskState.profileWritePending=false; applyProfileMutationBusy(); }
}
async function savePrivacyPreferences(){
  await submitProfileUpdate({action:"save_preferences",optOutSharing:document.getElementById("profileOptOutSharing").checked,limitSensitive:document.getElementById("profileLimitSensitive").checked});
}
async function submitCorrectionRequest(){
  const details=document.getElementById("correctionDetails").value.trim(); if(!details){ showToast("Describe what should be corrected first"); return; }
  await submitProfileUpdate({action:"correction_request",details});
}
async function exportMyData(){
  const button=document.getElementById("exportMyData");
  if(button.disabled || deskState.exportPending) return;
  const generation=deskState.generation; const profileRequestId=deskState.profileRequestId;
  deskState.exportPending=true; button.disabled=true;
  try{
    const {response,data}=await boundedAccountRequest("/api/profile/privacy/export",{headers:{accept:"application/json"}},true);
    if(generation !== deskState.generation || profileRequestId !== deskState.profileRequestId || !deskState.profileEnabled) return;
    if(!response.ok) throw new Error("Data export is unavailable.");
    if(data?.storageModel !== "sanitized-with-neighborhood-aggregation" || !["happenings","claims","evidence","privacyRequests","reputationEvents","deskItems"].every(key => Array.isArray(data[key]))) throw new Error("Data export is unavailable.");
    const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"}); const url=URL.createObjectURL(blob);
    try{ const link=document.createElement("a"); link.href=url; link.download="legit-data-export.json"; link.click(); }
    finally{ URL.revokeObjectURL(url); }
    showToast("Your aggregated data export is ready");
  }catch(error){ if(generation === deskState.generation && profileRequestId === deskState.profileRequestId) showToast(error.message || "Data export is unavailable."); }
  finally{ deskState.exportPending=false; button.disabled=!deskState.profileEnabled; }
}
async function deleteAllProfileData(){
  if(deskState.pending || deskState.deleting || deskState.profileWritePending){ showToast("Please wait for the pending update to finish"); return; }
  if(deskState.profileEnabled === false) return;
  if(!window.confirm("Delete all data linked to this signed-in profile? This removes your profile-linked happenings, evidence, and privacy preferences. Anonymous aggregated reports are not linked to this profile.")) return;
  const previouslyEnabled=deskState.profileEnabled !== false;
  const summary=document.getElementById("profileDataSummary");
  deskState.deleting=true; deskState.generation++; setProfileControls(false); summary.textContent="Deleting profile-linked data…";
  try{
    const {response,data}=await boundedAccountRequest("/api/profile/privacy",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"delete_all"})},true);
    if(!response.ok){ const error=new Error("Deletion request was rejected. Reopen your profile to check before trying again."); error.rejected=response.status < 500; throw error; }
    if(data?.ok !== true || ![data.deletion?.deletedHappenings,data.deletion?.deletedReputationEvents].every(value => Number.isSafeInteger(value) && value >= 0)) throw new Error("Invalid deletion response.");
    deskState.server=true; deskState.available=true; deskState.keys.clear(); applyDeskState(); document.getElementById("correctionDetails").value="";
    setProfileControls(true,{controls:{optOutSharing:true,limitSensitive:true},dataSummary:{happenings:0,pending:0,reputationEvents:0}});
    summary.textContent=`Deleted ${data.deletion.deletedHappenings} profile-linked happening${data.deletion.deletedHappenings === 1 ? "" : "s"} and ${data.deletion.deletedReputationEvents} reputation event${data.deletion.deletedReputationEvents === 1 ? "" : "s"}.`;
    notifyProfileChange(); showToast("All profile-linked data was deleted");
  }catch(error){
    if(error.rejected){ setProfileControls(previouslyEnabled); summary.textContent=error.message; }
    else{
      deskState.generation++; deskState.available=false;
      if(deskState.server){ deskState.keys.clear(); applyDeskState(); }
      setProfileControls(false);
      summary.textContent="Deletion outcome is unknown. The server may have deleted your data. Reopen your profile to check before making another deletion request. No automatic retry was sent.";
    }
  }finally{ deskState.deleting=false; }
}

// Cross-tab messages are invalidations only: never send identity or profile content.
let profileChannel=null;
let profileRefreshPending=false;
let profileRefreshAgain=false;
async function refreshProfileState(){
  if(deskState.deleting) return;
  if(profileRefreshPending){ deskState.generation++; profileRefreshAgain=true; return; }
  profileRefreshPending=true;
  deskState.generation++;
  if(deskState.server){ deskState.keys.clear(); applyDeskState(); }
  setProfileControls(false);
  try{ await Promise.all([loadDesk(),loadPrivacyProfile()]); }
  finally{ profileRefreshPending=false; if(profileRefreshAgain){ profileRefreshAgain=false; refreshProfileState(); } }
}
function notifyProfileChange(){ try{ profileChannel?.postMessage({type:"profile-changed"}); }catch{} }
function setupProfileRefresh(){
  try{
    profileChannel=new BroadcastChannel("legit-profile-refresh");
    profileChannel.onmessage=event => { if(event.data?.type === "profile-changed") refreshProfileState(); };
  }catch{}
  // Also recover missed messages and browsers without BroadcastChannel support.
  window.addEventListener("focus",() => refreshProfileState());
}
setupProfileRefresh();

document.getElementById("openMethodology").addEventListener("click",() => { closeActions(); showModal("methodologyModal"); loadTransparencySummary(); });
document.getElementById("dismissWelcome").addEventListener("click",() => { try{ localStorage.setItem("legit-welcome-seen","1"); }catch{} closeModal("welcomeModal"); });
document.getElementById("openFilters").addEventListener("click",() => { closeActions(); document.getElementById("filterPanel").hidden=!document.getElementById("filterPanel").hidden; });
document.getElementById("openComposer").addEventListener("click",() => { composerDraftVersion++; closeActions(); showModal("composerModal"); });
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
function setTimePreset(index){ const safeIndex=Math.max(0,Math.min(timeValues.length-1,index)); refineFilters.time=timeValues[safeIndex]; if(publicSnapshotWindow !== refineFilters.time){ cancelPublicLoad(); showStalePublicData(); } document.getElementById("timeValue").textContent=timePresets[safeIndex]; document.getElementById("timeRange").setAttribute("aria-valuetext",timePresets[safeIndex]); renderMarkers(); window.clearTimeout(publicLoadTimer); publicLoadTimer=window.setTimeout(loadPublicHappenings,180); }
document.getElementById("timeRange").addEventListener("input",event => setTimePreset(Number(event.target.value)));
document.querySelectorAll("[data-action]").forEach(button => button.addEventListener("click",() => runAction(button.dataset.action)));
document.getElementById("miniAdd").addEventListener("click",() => { if(selectedHappening) toggleDesk(selectedHappening); });
document.getElementById("miniUseful").addEventListener("click",() => { if(selectedHappening) runAction("useful"); });
document.getElementById("miniFull").addEventListener("click",() => { if(selectedHappening) openFull(selectedHappening); });
document.getElementById("detailAdd").addEventListener("click",() => { if(selectedHappening) toggleDesk(selectedHappening); });
document.getElementById("detailUseful").addEventListener("click",() => { if(selectedHappening) runAction("useful"); });
document.getElementById("detailReport").addEventListener("click",() => { if(selectedHappening) openReport(selectedHappening); });
const detailActions=document.querySelector(".detail-actions");
if(detailActions && !document.getElementById("detailVerify")){
  const evidenceButton=document.createElement("button"); evidenceButton.className="subtle-button"; evidenceButton.id="detailEvidence"; evidenceButton.textContent="＋ Add evidence"; detailActions.insertBefore(evidenceButton,document.getElementById("detailVerify"));
  evidenceButton.addEventListener("click",() => { if(selectedHappening) runAction("evidence"); });
  const verifyButton=document.createElement("button"); verifyButton.className="subtle-button"; verifyButton.id="detailVerify"; verifyButton.textContent="✓ Request verification"; detailActions.insertBefore(verifyButton,document.getElementById("detailReport"));
  verifyButton.addEventListener("click",() => { if(selectedHappening) runAction("verify"); });
}
const reportReason=document.getElementById("reportReason");
[["evidence","Add a source or relevant evidence"],["verification","Request independent verification"],["coordination","Flag possible coordinated manipulation"],["source_conflict","Disclose a source conflict of interest"],["safety_privacy","Escalate a safety or privacy risk"]].forEach(([value,label]) => { if(!reportReason.querySelector(`option[value="${value}"]`)){ const option=document.createElement("option"); option.value=value; option.textContent=label; reportReason.appendChild(option); } });
const evidenceSource=document.createElement("input"); evidenceSource.id="evidenceSource"; evidenceSource.type="url"; evidenceSource.maxLength=300; evidenceSource.placeholder="https://public-source.example/article"; evidenceSource.hidden=true; evidenceSource.setAttribute("aria-label","Public source URL"); const evidenceSourceLabel=document.createElement("label"); evidenceSourceLabel.id="evidenceSourceLabel"; evidenceSourceLabel.textContent="Public source URL (optional)"; evidenceSourceLabel.hidden=true; evidenceSourceLabel.appendChild(evidenceSource); reportReason.closest("label")?.after(evidenceSourceLabel);
reportReason.addEventListener("change",event => { const placeholders={evidence:"Describe what the source or observation adds. Do not include private personal information.",verification:"What evidence, source, or independent check should reviewers examine?",coordination:"Describe the pattern that may indicate coordinated manipulation.",source_conflict:"Describe the possible conflict without sharing private identity.",safety_privacy:"Describe the safety or privacy risk and what should be protected."}; document.getElementById("reportDetails").placeholder=placeholders[event.target.value] || "What should reviewers check?"; const isEvidence=event.target.value === "evidence"; evidenceSource.hidden=!isEvidence; evidenceSourceLabel.hidden=!isEvidence; if(!isEvidence) evidenceSource.value=""; });
const topicSelect=document.getElementById("postTopic");
if(topicSelect){ const hint=document.createElement("p"); hint.className="privacy-line"; hint.id="safetyHint"; hint.hidden=true; hint.textContent="For people, homes, medical situations, or immediate safety concerns, enable “Potentially sensitive” to keep the map pin private."; topicSelect.parentElement.appendChild(hint); topicSelect.addEventListener("change",event => { hint.hidden=event.target.value !== "Public safety"; }); }
const methodologyModal=document.getElementById("methodologyModal");
if(methodologyModal && !methodologyModal.querySelector(".emergency-note")){ const note=document.createElement("p"); note.className="privacy-line emergency-note"; note.textContent="Legit is not an emergency service. For immediate danger, contact local emergency services."; methodologyModal.querySelector(".modal-copy")?.after(note); }
document.getElementById("reportForm").addEventListener("submit",submitReport);
document.getElementById("anonymousToggle").addEventListener("change",event => { document.getElementById("identityField").hidden=event.target.checked; if(event.target.checked) document.getElementById("postIdentity").value=""; });
document.getElementById("composerForm").addEventListener("submit",submitSignal);
document.addEventListener("keydown",event => { const activeModal=document.querySelector(".modal-backdrop:not([hidden]), .access-panel:not([hidden])"); if(event.key === "Tab" && activeModal){ const focusables=[...activeModal.querySelectorAll("button,a[href],input,select,textarea,[tabindex]:not([tabindex='-1'])")].filter(element => !element.disabled); if(focusables.length){ const first=focusables[0]; const last=focusables[focusables.length-1]; if(event.shiftKey && document.activeElement === first){ event.preventDefault(); last.focus(); } else if(!event.shiftKey && document.activeElement === last){ event.preventDefault(); first.focus(); } } } if(event.key === "Escape"){ closeActions(); miniCard.hidden=true; document.getElementById("filterPanel").hidden=true; document.querySelectorAll(".modal-backdrop:not([hidden]), .access-panel:not([hidden])").forEach(modal => closeModal(modal.id)); document.getElementById("openAccessibility").setAttribute("aria-expanded","false"); } });

loadAccessibility(); applyAccessibility(); loadDesk();
try{ if(!localStorage.getItem("legit-welcome-seen")) window.setTimeout(() => showModal("welcomeModal"),250); }catch{}

function showMapFallback(){ document.getElementById("map").hidden=true; document.getElementById("signalList").hidden=false; setDataStatus("Text map · low bandwidth mode","stale"); renderMarkers(); }
function loadLeaflet(){
  if(mapLoadStarted) return;
  mapLoadStarted=true;
  const stylesheet=document.createElement("link"); stylesheet.rel="stylesheet"; stylesheet.href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"; stylesheet.integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="; stylesheet.crossOrigin="anonymous"; document.head.appendChild(stylesheet);
  const script=document.createElement("script"); script.src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"; script.integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="; script.crossOrigin="anonymous";
  const timeout=window.setTimeout(showMapFallback,7000);
  script.onload=() => { window.clearTimeout(timeout); map=L.map("map",{zoomControl:false,attributionControl:true}).setView([43.665,-70.26],12.6); L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:"© OpenStreetMap contributors"}).addTo(map); L.control.zoom({position:"bottomright"}).addTo(map); map.on("click",() => { closeActions(); miniCard.hidden=true; }); map.on("contextmenu",event => { event.originalEvent.preventDefault(); closeActions(); miniCard.hidden=true; showToast("Right-click a marker to see event actions"); }); renderMarkers(); };
  script.onerror=showMapFallback;
  document.head.appendChild(script);
}
loadLeaflet();
loadPublicHappenings();
let refreshTimer=null;
function refreshInterval(){ const connection=navigator.connection || navigator.mozConnection || navigator.webkitConnection; if(connection?.saveData || /slow-2g|2g/.test(connection?.effectiveType || "")) return 90000; if(connection?.effectiveType === "3g") return 60000; return 30000; }
function scheduleLiveRefresh(){ window.clearTimeout(refreshTimer); refreshTimer=window.setTimeout(() => { if(document.visibilityState === "visible" && navigator.onLine !== false) loadPublicHappenings(); else if(document.visibilityState === "visible") showStalePublicData(); scheduleLiveRefresh(); },refreshInterval()); }
document.addEventListener("visibilitychange",() => { if(document.visibilityState === "visible") loadPublicHappenings(); else cancelPublicLoad(); });
window.addEventListener("online",() => { if(document.visibilityState === "visible") loadPublicHappenings(); });
window.addEventListener("offline",() => { cancelPublicLoad(); showStalePublicData(); });
if("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js",{scope:"./"}).catch(() => {});
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
