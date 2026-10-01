const MAX_BODY_BYTES = 32 * 1024;
const ASSET_BUNDLE = __ASSET_BUNDLE__;
const rateBuckets = new Map();
const MAX_RATE_BUCKETS = 5000;
let cleanupInFlight = null;
let cleanupLastStarted = 0;

const securityHeaders = {
  "x-content-type-options":"nosniff",
  "x-frame-options":"DENY",
  "referrer-policy":"strict-origin-when-cross-origin",
  "permissions-policy":"camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  "cross-origin-opener-policy":"same-origin",
  "cross-origin-resource-policy":"same-origin",
  "x-permitted-cross-domain-policies":"none",
  "strict-transport-security":"max-age=31536000; includeSubDomains",
  "content-security-policy":"default-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' https://unpkg.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com; style-src-attr 'unsafe-inline'; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https://unpkg.com https://*.tile.openstreetmap.org https://*.openstreetmap.org; connect-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com https://unpkg.com; upgrade-insecure-requests"
};
const jsonHeaders = {...securityHeaders,"content-type":"application/json; charset=utf-8","cache-control":"no-store"};
const policy = {
  version:"privacy-moderation-v2",
  identity:"anonymous by default; attributed display is opt-in",
  location:"all stored locations are rounded to neighborhood precision; exact pins are never stored",
  media:"uploads are never public at low legitimacy; the server receives metadata only until media review is complete",
  review:"new happenings enter a private moderation queue before public display",
  retention:"unverified submissions receive a bounded retention window and an append-only moderation history",
  storage:"raw request bodies are discarded; identifying text is filtered before storage, and signed-in ownership is represented only by an opaque hash",
  sharing:"Legit does not sell or share personal information for cross-context behavioral advertising"
};
const reputationRules = {
  evidenceUseful:{base:2,decay:1.5},
  dailyCap:10,
  sameStoryCap:1,
  coordinationWindowMinutes:15,
  coordinationMinAssessments:4,
  coordinationMinActors:3,
  duplicateRule:"one assessment per actor fingerprint, action, target, and story",
  excluded:"raw post volume, popularity, and agreement with a claim"
};
const durableWriteLimits = {
  "/api/happenings":4,
  "/api/reports":6,
  "/api/reputation/assessment":20,
  "/api/profile/privacy":10,
  "/api/desk":20,
  "/api/moderation/actions":20,
  "/api/moderation/verify":8,
  "/api/moderation/tasks":30,
  "/api/moderation/quality":15
};

function jsonResponse(body,status=200,extraHeaders={}){ return new Response(JSON.stringify(body),{status,headers:{...jsonHeaders,...extraHeaders}}); }
function textResponse(body,type){ return new Response(body,{headers:{...securityHeaders,"content-type":type,"cache-control":"no-cache"}}); }
function sanitizeText(value,max=1000){
  return (typeof value === "string" ? value : "")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,"[email removed]")
    .replace(/\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?){2}\d{4}\b/g,"[phone removed]")
    .replace(/\b\d{1,5}\s+[A-Za-z0-9.'-]+\s+(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd|Court|Ct|Way)\b/gi,"[address removed]")
    .trim().slice(0,max);
}
function roundCoordinate(value){ return Math.round(value * 1000) / 1000; }
function finiteCoordinate(value,min,max){ const number = Number(value); return Number.isFinite(number) && number >= min && number <= max ? number : null; }
function publicCoordinate(value){ return roundCoordinate(value); }
function retentionDate(){ return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); }
function aggregateArea(value){ return sanitizeText(value,140).replace(/\b\d{1,5}\b/g,"").replace(/\s+/g," ").trim().slice(0,140); }
function aggregateSource(value){
  const text = sanitizeText(value,500);
  if(!text) return "";
  try { const url = new URL(text); return `${url.origin}${url.pathname}`.slice(0,300); }
  catch { return text.replace(/\s+/g," ").slice(0,300); }
}
async function ownerKey(request){
  const userId = String(request.headers.get("oai-authenticated-user-id") || "").trim();
  if(!userId) throw accessError("Sign in to manage profile data.",401);
  const digest = await crypto.subtle.digest("SHA-256",new TextEncoder().encode(`legit-owner-v1|${userId}`));
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2,"0")).join("").slice(0,48);
}
async function ensurePrivacySchema(env){
  if(!env.DB) throw accessError("Durable privacy storage is unavailable.",503);
}
async function purgeExpiredRecords(env){
  if(!env.DB) return {deletedHappenings:0,deletedReputationEvents:0};
  const now = new Date().toISOString();
  const abuseCutoff = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  await env.DB.prepare("DELETE FROM abuse_buckets WHERE bucket_start < ?").bind(abuseCutoff).run();
  await env.DB.prepare("DELETE FROM moderator_verification_events WHERE expires_at < ?").bind(now).run();
  const expiredWhere = "review_state IN ('pending', 'flagged') AND retention_until IS NOT NULL AND retention_until < ?";
  const count = await env.DB.prepare(`SELECT COUNT(*) AS total FROM happenings WHERE ${expiredWhere}`).bind(now).first();
  const deletedHappenings = Number(count?.total || 0);
  if(!deletedHappenings) return {deletedHappenings:0,deletedReputationEvents:0};
  await env.DB.batch([
    env.DB.prepare(`DELETE FROM moderation_reports WHERE target_id IN (SELECT id FROM happenings WHERE ${expiredWhere}) OR target_id IN (SELECT id FROM claims WHERE happening_id IN (SELECT id FROM happenings WHERE ${expiredWhere})) OR target_id IN (SELECT id FROM evidence WHERE claim_id IN (SELECT id FROM claims WHERE happening_id IN (SELECT id FROM happenings WHERE ${expiredWhere})))`).bind(now,now,now),
    env.DB.prepare(`DELETE FROM evidence WHERE claim_id IN (SELECT id FROM claims WHERE happening_id IN (SELECT id FROM happenings WHERE ${expiredWhere}))`).bind(now),
    env.DB.prepare(`DELETE FROM moderation_decisions WHERE happening_id IN (SELECT id FROM happenings WHERE ${expiredWhere})`).bind(now),
    env.DB.prepare(`DELETE FROM claims WHERE happening_id IN (SELECT id FROM happenings WHERE ${expiredWhere})`).bind(now),
    env.DB.prepare(`DELETE FROM happenings WHERE ${expiredWhere}`).bind(now),
    env.DB.prepare("INSERT INTO privacy_deletion_audit (id,scope,deleted_happenings,deleted_reputation_events,created_at) VALUES (?,?,?,?,?)").bind(crypto.randomUUID(),"retention",deletedHappenings,0,now)
  ]);
  return {deletedHappenings,deletedReputationEvents:0};
}
function scheduleRetentionCleanup(env,ctx){
  if(!env.DB || cleanupInFlight || Date.now() - cleanupLastStarted < 60000) return;
  cleanupLastStarted = Date.now();
  cleanupInFlight = purgeExpiredRecords(env).catch(() => null).finally(() => { cleanupInFlight = null; });
  if(ctx?.waitUntil) ctx.waitUntil(cleanupInFlight);
}
async function readJson(request){
  const length = Number(request.headers.get("content-length") || 0);
  if(length > MAX_BODY_BYTES) throw new Error("Submission is too large for the privacy gate.");
  const contentType = request.headers.get("content-type") || "";
  if(!/^application\/json(?:\s*;|$)/i.test(contentType)) throw accessError("JSON content is required.",415);
  const raw = await request.text();
  if(new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) throw new Error("Submission is too large for the privacy gate.");
  try { return JSON.parse(raw || "{}"); } catch { throw new Error("Submission must be valid JSON."); }
}
async function allowRequest(request,scope="write"){
  const rawKey = request.headers.get("CF-Connecting-IP") || "shared-anonymous-client";
  const digest = await crypto.subtle.digest("SHA-256",new TextEncoder().encode(rawKey));
  const key = `${scope}:${[...new Uint8Array(digest)].map(value => value.toString(16).padStart(2,"0")).join("")}`;
  const bucket = Math.floor(Date.now() / 60000);
  for(const [storedKey,value] of rateBuckets){ if(value.bucket < bucket - 1) rateBuckets.delete(storedKey); }
  if(!rateBuckets.has(key) && rateBuckets.size >= MAX_RATE_BUCKETS){ const oldestKey=rateBuckets.keys().next().value; if(oldestKey) rateBuckets.delete(oldestKey); }
  const current = rateBuckets.get(key);
  if(!current || current.bucket !== bucket){ rateBuckets.set(key,{bucket,count:1}); return true; }
  current.count += 1;
  return current.count <= 8;
}
async function allowDurableRequest(env,request,scope){
  if(!env.DB) return true;
  const limit = durableWriteLimits[scope] || 20;
  const fingerprint = scope.startsWith("/api/moderation") ? await moderatorRateFingerprint(request) : await actorFingerprint(request);
  const bucketStart = new Date(Math.floor(Date.now() / 60000) * 60000).toISOString();
  const current = await env.DB.prepare("SELECT request_count FROM abuse_buckets WHERE actor_fingerprint=? AND scope=? AND bucket_start=? LIMIT 1").bind(fingerprint,scope,bucketStart).first();
  const count = Number(current?.request_count || 0);
  if(count >= limit) return false;
  const nextCount = count + 1;
  if(current){
    await env.DB.prepare("UPDATE abuse_buckets SET request_count=?,updated_at=? WHERE actor_fingerprint=? AND scope=? AND bucket_start=?").bind(nextCount,new Date().toISOString(),fingerprint,scope,bucketStart).run();
  }else{
    await env.DB.prepare("INSERT INTO abuse_buckets (actor_fingerprint,scope,bucket_start,request_count,updated_at) VALUES (?,?,?,?,?)").bind(fingerprint,scope,bucketStart,nextCount,new Date().toISOString()).run();
  }
  return true;
}
async function moderatorRateFingerprint(request){
  const raw = request.headers.get("authorization") || "missing-moderator-credential";
  const digest = await crypto.subtle.digest("SHA-256",new TextEncoder().encode(`legit-moderator-rate-v1|${raw}`));
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2,"0")).join("").slice(0,32);
}
function requireText(value,label,max){ const text = sanitizeText(value,max); if(!text) throw new Error(`${label} is required.`); return text; }
function normalizeHappening(input){
  const title = requireText(input.title,"A short description",90);
  const body = requireText(input.body,"What happened",420);
  const location = requireText(aggregateArea(input.location),"A public area",140);
  const shareIdentity = input.identityVisibility === "attributed" && Boolean(sanitizeText(input.displayIdentity,40));
  const lat = finiteCoordinate(input.lat,-90,90);
  const lng = finiteCoordinate(input.lng,-180,180);
  const publicLat = lat == null ? null : publicCoordinate(lat);
  const publicLng = lng == null ? null : publicCoordinate(lng);
  const attachmentCount = Array.isArray(input.attachments) ? Math.min(input.attachments.length,10) : 0;
  return {
    id: crypto.randomUUID(),
    title,body,location,
    topic: requireText(input.topic || "Other","Topic",40),
    publicLat,publicLng,
    locationPrecision:"aggregate",
    identityVisibility: shareIdentity ? "attributed" : "anonymous",
    identityDisplay: shareIdentity ? sanitizeText(input.displayIdentity,40) : null,
    attachmentCount,
    attachmentState: attachmentCount ? "private_review" : "none",
    reviewState:"pending",
    createdAt:new Date().toISOString(),
    retentionUntil:retentionDate(),
    source:aggregateSource(input.source)
  };
}
async function persistHappening(env,item,request){
  if(!env.DB) throw new Error("Durable moderation storage is unavailable.");
  await ensurePrivacySchema(env);
  const owner = request.headers.get("oai-authenticated-user-id") ? await ownerKey(request) : null;
  const claimId = `claim-${item.id}`;
  const statements = [
    env.DB.prepare(`INSERT INTO happenings (id,title,body,topic,public_location,public_lat,public_lng,location_precision,identity_visibility,identity_display,impact,balance,legitimacy_score,review_state,attachment_state,attachment_count,created_at,retention_until,owner_key) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(item.id,item.title,item.body,item.topic,item.location,item.publicLat,item.publicLng,item.locationPrecision,item.identityVisibility,item.identityDisplay,1,"agnostic",0,item.reviewState,item.attachmentState,item.attachmentCount,item.createdAt,item.retentionUntil,owner),
    env.DB.prepare(`INSERT INTO claims (id,happening_id,text,status,attribution,created_at) VALUES (?,?,?,?,?,?)`).bind(claimId,item.id,item.body,"unverified","Queued through the server-side privacy and moderation gate.",item.createdAt)
  ];
  if(item.source){
    statements.push(env.DB.prepare(`INSERT INTO evidence (id,claim_id,evidence_type,relationship,provenance,review_state,submitted_at) VALUES (?,?,?,?,?,?,?)`).bind(`evidence-${item.id}`,claimId,"Submitted source","supports",item.source,"pending",item.createdAt));
  }
  await env.DB.batch(statements);
}
async function persistReport(env,input,request){
  if(!env.DB) throw new Error("Durable moderation storage is unavailable.");
  const targetId = requireText(input.targetId,"A target",160);
  const reason = requireText(input.reason,"A reason",40).toLowerCase();
  const details = sanitizeText(input.details,500);
  const targetType = input.targetType || "happening";
  if(!["happening","claim","evidence"].includes(targetType)) throw new Error("This report target is not supported.");
  const createdAt = new Date().toISOString();
  const owner = request?.headers.get("oai-authenticated-user-id") ? await ownerKey(request) : null;
  await env.DB.prepare(`INSERT INTO moderation_reports (id,target_type,target_id,reason,details,review_state,reporter_owner_key,created_at) VALUES (?,?,?,?,?,?,?,?)`).bind(crypto.randomUUID(),targetType,targetId,reason,details,"pending",owner,createdAt).run();
  return {reviewState:"pending",message:"Submitted for review. No identity or exact location is made public."};
}
async function actorFingerprint(request){
  const raw = `${request.headers.get("CF-Connecting-IP") || "shared-anonymous-client"}|${request.headers.get("user-agent") || "unknown"}`;
  const digest = await crypto.subtle.digest("SHA-256",new TextEncoder().encode(raw));
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2,"0")).join("").slice(0,32);
}
function assessmentStoryId(targetId){
  const separator = targetId.indexOf(":");
  return separator > 0 ? targetId.slice(0,separator) : null;
}
async function persistAssessment(env,request,input){
  if(!env.DB) throw new Error("Durable reputation storage is unavailable.");
  const actionType = requireText(input.actionType,"An assessment type",40);
  if(actionType !== "evidence_useful") throw new Error("This assessment type is not enabled.");
  const targetId = requireText(input.targetId,"A target",160);
  const fingerprint = await actorFingerprint(request);
  const owner = request.headers.get("oai-authenticated-user-id") ? await ownerKey(request) : null;
  const actionDay = new Date().toISOString().slice(0,10);
  const existing = await env.DB.prepare(`SELECT id FROM reputation_events WHERE actor_fingerprint=? AND action_type=? AND target_id=? LIMIT 1`).bind(fingerprint,actionType,targetId).first();
  if(existing) return {accepted:false,pointsAwarded:0,reason:"Already counted"};
  const storyId = assessmentStoryId(targetId);
  if(storyId){
    const storyExisting = await env.DB.prepare(`SELECT id FROM reputation_events WHERE actor_fingerprint=? AND action_type=? AND target_id LIKE ? LIMIT 1`).bind(fingerprint,actionType,`${storyId}:%`).first();
    if(storyExisting) return {accepted:false,pointsAwarded:0,reason:"Already counted for this story"};
  }
  const countRow = await env.DB.prepare(`SELECT COUNT(*) AS total FROM reputation_events WHERE actor_fingerprint=? AND action_type=? AND action_day=?`).bind(fingerprint,actionType,actionDay).first();
  const count = Number(countRow?.total || 0);
  if(count >= reputationRules.dailyCap) return {accepted:false,pointsAwarded:0,reason:"Daily assessment limit reached"};
  const createdAt = new Date().toISOString();
  const coordinationSince = new Date(Date.now() - reputationRules.coordinationWindowMinutes * 60 * 1000).toISOString();
  const recent = storyId && storyId.startsWith("public-")
    ? await env.DB.prepare(`SELECT COUNT(*) AS events, COUNT(DISTINCT actor_fingerprint) AS actors FROM reputation_events WHERE action_type=? AND target_id LIKE ? AND created_at >= ?`).bind(actionType,`${storyId}:%`,coordinationSince).first()
    : null;
  const coordinationReview = Boolean(recent && Number(recent.events || 0) + 1 >= reputationRules.coordinationMinAssessments && Number(recent.actors || 0) + 1 >= reputationRules.coordinationMinActors);
  const pointsAwarded = coordinationReview ? 0 : Math.max(1,Math.floor(reputationRules.evidenceUseful.base / Math.pow(reputationRules.evidenceUseful.decay,count)));
  const basis = coordinationReview
    ? "Useful evidence recorded; points held for coordination review."
    : "Useful evidence assessment; duplicate, story, daily-cap, and coordination checks passed.";
  await env.DB.prepare(`INSERT INTO reputation_events (id,actor_fingerprint,action_type,target_id,action_day,points_awarded,basis,risk_state,created_at,owner_key) VALUES (?,?,?,?,?,?,?,?,?,?)`).bind(crypto.randomUUID(),fingerprint,actionType,targetId,actionDay,pointsAwarded,basis,coordinationReview ? "coordination_review" : "normal",createdAt,owner).run();
  return {accepted:true,pointsAwarded,riskState:coordinationReview ? "coordination_review" : "normal",basis:"Evidence usefulness, not claim agreement"};
}
async function moderationStatus(env){
  if(!env.DB) throw new Error("Durable moderation storage is unavailable.");
  const states = await env.DB.prepare(`SELECT review_state, COUNT(*) AS total FROM happenings GROUP BY review_state`).all();
  const media = await env.DB.prepare(`SELECT COUNT(*) AS total FROM happenings WHERE attachment_state='private_review'`).first();
  const evidence = await env.DB.prepare(`SELECT COUNT(*) AS total FROM evidence WHERE review_state='pending'`).first();
  const reports = await env.DB.prepare(`SELECT COUNT(*) AS total FROM moderation_reports WHERE review_state='pending'`).first();
  const privacyRequests = await env.DB.prepare(`SELECT COUNT(*) AS total FROM privacy_requests WHERE status='pending'`).first();
  const corrections = await env.DB.prepare(`SELECT COUNT(*) AS total FROM moderation_reports WHERE review_state='pending' AND reason IN ('correction','appeal')`).first();
  const coordination = await env.DB.prepare(`SELECT COUNT(DISTINCT target_id) AS total FROM reputation_events WHERE risk_state='coordination_review'`).first();
  const summary = {pending:0,cleared:0,flagged:0,privateMedia:Number(media?.total || 0),pendingEvidence:Number(evidence?.total || 0),pendingReports:Number(reports?.total || 0),pendingCorrections:Number(corrections?.total || 0),pendingPrivacyRequests:Number(privacyRequests?.total || 0),coordinationReviews:Number(coordination?.total || 0)};
  for(const row of states.results || []){
    const count = Number(row.total || 0);
    if(row.review_state === "pending") summary.pending += count;
    else if(row.review_state === "cleared" || row.review_state === "approved") summary.cleared += count;
    else summary.flagged += count;
  }
  return {policyVersion:policy.version,publicSummary:summary,disclosure:"Counts only; identities, exact locations, private media, and report text stay out of this public endpoint."};
}
function publicWindow(windowName){
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  if(windowName === "yesterday") return {from:new Date(now - 2 * day).toISOString(),to:new Date(now - day).toISOString()};
  if(windowName === "week") return {from:new Date(now - 7 * day).toISOString()};
  if(windowName === "month") return {from:new Date(now - 30 * day).toISOString()};
  if(windowName === "year") return {from:new Date(now - 365 * day).toISOString()};
  if(windowName === "all") return {};
  return {from:new Date(now - day).toISOString()};
}
function publicGroupLabel(value){
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g," ").trim().slice(0,180);
}
function publicGroupTitle(value){
  return publicGroupLabel(value).replace(/\b(?:question|update|report|reports|anyone know|is)\b/g," ").replace(/\s+/g," ").trim().slice(0,180);
}
async function publicGroupKey(row){
  const input = `legit-public-group-v2|${publicGroupLabel(row.public_location)}|${publicGroupLabel(row.topic)}|${publicGroupTitle(row.title)}`;
  const digest = await crypto.subtle.digest("SHA-256",new TextEncoder().encode(input));
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2,"0")).join("").slice(0,24);
}
async function publicHappenings(env,url){
  if(!env.DB) throw accessError("Durable public reporting storage is unavailable.",503);
  const range = publicWindow(url.searchParams.get("time") || "today");
  const bindings = [];
  let where = "h.review_state IN ('cleared', 'approved') AND h.public_lat IS NOT NULL AND h.public_lng IS NOT NULL";
  if(range.from){ where += " AND h.created_at >= ?"; bindings.push(range.from); }
  if(range.to){ where += " AND h.created_at < ?"; bindings.push(range.to); }
  const result = await env.DB.prepare(`SELECT h.id,h.title,h.body,h.topic,h.public_location,h.public_lat,h.public_lng,h.balance,h.impact,h.legitimacy_score,h.review_state,h.created_at
    FROM happenings h WHERE ${where} ORDER BY h.created_at DESC LIMIT 500`).bind(...bindings).all();
  const evidenceResult = await env.DB.prepare(`SELECT c.happening_id,e.id,e.evidence_type,e.relationship,e.provenance,e.submitted_at
    FROM evidence e JOIN claims c ON c.id=e.claim_id JOIN happenings h ON h.id=c.happening_id
    WHERE ${where} AND e.review_state IN ('cleared','approved') AND e.provenance IS NOT NULL ORDER BY e.submitted_at DESC LIMIT 1000`).bind(...bindings).all();
  const correctionResult = await env.DB.prepare(`SELECT public_story_id,history_type,summary,created_at
    FROM correction_history WHERE review_state='approved' ORDER BY created_at DESC LIMIT 500`).all();
  const reputationRows = await env.DB.prepare(`SELECT substr(target_id,1,instr(target_id,':')-1) AS group_id,
    SUM(CASE WHEN risk_state='normal' AND points_awarded > 0 THEN 1 ELSE 0 END) AS useful_evidence,
    COUNT(DISTINCT CASE WHEN risk_state='normal' AND points_awarded > 0 THEN actor_fingerprint END) AS independent_assessors,
    SUM(CASE WHEN risk_state='coordination_review' THEN 1 ELSE 0 END) AS coordination_reviews
    FROM reputation_events WHERE action_type='evidence_useful' AND target_id LIKE 'public-%:%' GROUP BY group_id`).all();
  const reputationByGroup = new Map((reputationRows.results || []).map(row => [row.group_id,{usefulEvidence:Number(row.useful_evidence || 0),independentAssessors:Number(row.independent_assessors || 0),coordinationReviews:Number(row.coordination_reviews || 0)}]));
  const grouped = new Map();
  const happeningGroupKeys = new Map();
  for(const row of result.results || []){
    const key = await publicGroupKey(row);
    happeningGroupKeys.set(row.id,key);
    const existing = grouped.get(key);
    if(!existing){
      grouped.set(key,{id:`public-${key}`,title:row.title,body:row.body,topic:row.topic,location:row.public_location,publicLat:Number(row.public_lat),publicLng:Number(row.public_lng),balance:row.balance || "agnostic",impact:Number(row.impact || 1),legitimacyScore:Number(row.legitimacy_score || 0),reports:1,sourceCount:0,createdAt:row.created_at,reviewState:row.review_state,_latTotal:Number(row.public_lat),_lngTotal:Number(row.public_lng),_coordinateCount:1,_sourceKeys:new Set(),_evidenceById:new Map(),corrections:[]});
      continue;
    }
    existing.reports += 1;
    existing._latTotal += Number(row.public_lat || existing.publicLat);
    existing._lngTotal += Number(row.public_lng || existing.publicLng);
    existing._coordinateCount += 1;
    existing.impact = Math.max(existing.impact,Number(row.impact || 1));
    existing.legitimacyScore = Math.round((existing.legitimacyScore * (existing.reports - 1) + Number(row.legitimacy_score || 0)) / existing.reports);
    if(existing.balance !== row.balance) existing.balance = "agnostic";
    if(String(row.created_at) > String(existing.createdAt)) existing.createdAt = row.created_at;
  }
  for(const row of evidenceResult.results || []){
    const item = grouped.get(happeningGroupKeys.get(row.happening_id));
    if(!item) continue;
    const provenance = aggregateSource(row.provenance);
    if(provenance) item._sourceKeys.add(provenance);
    if(item._evidenceById.has(row.id)) continue;
    const relationship = String(row.relationship || "relates");
    item._evidenceById.set(row.id,{id:String(row.id),initials:"EV",title:sanitizeText(row.evidence_type || "Source trail",90),excerpt:`${relationship.charAt(0).toUpperCase()}${relationship.slice(1)} the primary claim.`,provenance:provenance || "Sanitized source trail",submittedAt:row.submitted_at});
  }
  for(const row of correctionResult.results || []){
    const item = [...grouped.values()].find(candidate => candidate.id === row.public_story_id);
    if(item) item.corrections.push({type:row.history_type,summary:sanitizeText(row.summary,500),createdAt:row.created_at});
  }
  for(const [key,item] of grouped){
    const reputation = reputationByGroup.get(item.id) || {usefulEvidence:0,independentAssessors:0,coordinationReviews:0};
    item.publicLat = publicCoordinate(item._latTotal / Math.max(1,item._coordinateCount));
    item.publicLng = publicCoordinate(item._lngTotal / Math.max(1,item._coordinateCount));
    item.sourceCount = item._sourceKeys.size;
    item.evidence = [...item._evidenceById.values()].slice(0,20);
    const sourceBonus = Math.min(20,reputation.independentAssessors * 4 + Math.min(8,item.sourceCount * 3));
    const evidenceBonus = Math.min(10,reputation.usefulEvidence * 2);
    const coordinationPenalty = reputation.coordinationReviews ? 10 : 0;
    item.usefulEvidence = reputation.usefulEvidence;
    item.independentAssessors = reputation.independentAssessors;
    item.coordinationReview = Boolean(reputation.coordinationReviews);
    item.legitimacyScore = Math.max(0,Math.min(100,item.legitimacyScore + sourceBonus + evidenceBonus - coordinationPenalty));
    item.legitimacyBasis = reputation.coordinationReviews
      ? "Distinct approved sources and useful evidence contribute; a coordinated assessment burst is held for review. Report volume alone does not raise legitimacy."
      : "Distinct approved sources and useful evidence contribute; report volume alone does not raise legitimacy.";
    delete item._latTotal;
    delete item._lngTotal;
    delete item._coordinateCount;
    delete item._sourceKeys;
    delete item._evidenceById;
  }
  return {happenings:[...grouped.values()],window:url.searchParams.get("time") || "today",aggregation:"privacy-safe grouping by normalized title, topic, and neighborhood bucket with aggregate coordinates",disclosure:"Only approved, sanitized, neighborhood-level records are public. Identities, exact locations, private media, raw account identifiers, and abuse-control fingerprints are excluded."};
}
function accessError(message,status){ const error = new Error(message); error.status = status; return error; }
function constantTimeEqual(left,right){
  if(left.length !== right.length) return false;
  let difference = 0;
  for(let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}
async function requireModerator(request,env,options={}){
  const configured = String(env.MODERATOR_TOKEN || "");
  if(!configured) throw accessError("Moderator access is not configured on this deployment.",503);
  const header = request.headers.get("authorization") || "";
  const provided = /^Bearer\s+/i.test(header) ? header.replace(/^Bearer\s+/i,"") : "";
  if(!provided || !constantTimeEqual(provided,configured)) throw accessError("Moderator authorization is required.",401);
  const digest = await crypto.subtle.digest("SHA-256",new TextEncoder().encode(provided));
  const fingerprint = [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2,"0")).join("").slice(0,24);
  const allowlist = String(env.MODERATOR_FINGERPRINT_ALLOWLIST || "").split(",").map(value => value.trim()).filter(Boolean);
  if(allowlist.length && !allowlist.includes(fingerprint)) throw accessError("Moderator verification is not active for this credential.",403);
  const verificationSecret = String(env.MODERATOR_VERIFICATION_SECRET || "");
  const providedVerification = request.headers.get("x-moderator-verification") || "";
  if(verificationSecret && (!providedVerification || !constantTimeEqual(providedVerification,verificationSecret))) throw accessError("Additional moderator verification is required.",401);
  const verificationLevel = verificationSecret ? "token_and_secret" : "token";
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  if(options.record !== false && env.DB){
    await env.DB.prepare("INSERT INTO moderator_verification_events (id,moderator_fingerprint,verification_level,created_at,expires_at) VALUES (?,?,?,?,?)").bind(crypto.randomUUID(),fingerprint,verificationLevel,new Date().toISOString(),expiresAt).run();
  }
  return {fingerprint,verificationLevel,expiresAt};
}
async function completeModeratorTask(env,taskType,targetId,moderatorFingerprint,decision,completedAt){
  if(!env.DB) return null;
  const current = await env.DB.prepare("SELECT id,claimed_at FROM moderator_tasks WHERE task_type=? AND target_id=? AND moderator_fingerprint=? AND status='claimed' ORDER BY claimed_at DESC LIMIT 1").bind(taskType,targetId,moderatorFingerprint).first();
  const claimedAt = current?.claimed_at || completedAt;
  const responseSeconds = Math.max(0,Math.round((Date.parse(completedAt) - Date.parse(claimedAt)) / 1000));
  if(current){
    await env.DB.prepare("UPDATE moderator_tasks SET status='completed',completed_at=?,response_seconds=?,completed_decision=? WHERE id=?").bind(completedAt,responseSeconds,decision,current.id).run();
    return {taskId:current.id,responseSeconds};
  }
  const taskId = crypto.randomUUID();
  await env.DB.prepare("INSERT INTO moderator_tasks (id,task_type,target_id,moderator_fingerprint,status,claimed_at,completed_at,response_seconds,completed_decision) VALUES (?,?,?,?,?,?,?,?,?)").bind(taskId,taskType,targetId,moderatorFingerprint,"completed",completedAt,completedAt,0,decision).run();
  return {taskId,responseSeconds:0};
}
async function moderationTask(env,request,input){
  const moderator = await requireModerator(request,env);
  if(!env.DB) throw accessError("Durable moderation storage is unavailable.",503);
  const taskType = requireText(input.taskType,"A task type",30);
  if(!["happening","report","privacy_request","coordination"].includes(taskType)) throw new Error("This moderation task type is not supported.");
  const targetId = requireText(input.targetId,"A task target",160);
  const action = requireText(input.action || "claim","A task action",20);
  if(!["claim","release"].includes(action)) throw new Error("Task action must be claim or release.");
  const active = await env.DB.prepare("SELECT id,moderator_fingerprint,claimed_at FROM moderator_tasks WHERE task_type=? AND target_id=? AND status='claimed' ORDER BY claimed_at DESC LIMIT 1").bind(taskType,targetId).first();
  if(action === "claim"){
    if(active && active.moderator_fingerprint !== moderator.fingerprint) throw accessError("This task is already claimed by another moderator.",409);
    if(active) return {taskId:active.id,status:"claimed",claimedAt:active.claimed_at,verificationLevel:moderator.verificationLevel};
    const claimedAt = new Date().toISOString();
    const taskId = crypto.randomUUID();
    await env.DB.prepare("INSERT INTO moderator_tasks (id,task_type,target_id,moderator_fingerprint,status,claimed_at) VALUES (?,?,?,?,?,?)").bind(taskId,taskType,targetId,moderator.fingerprint,"claimed",claimedAt).run();
    return {taskId,status:"claimed",claimedAt,verificationLevel:moderator.verificationLevel};
  }
  if(!active || active.moderator_fingerprint !== moderator.fingerprint) throw accessError("This task is not claimed by this moderator.",409);
  await env.DB.prepare("UPDATE moderator_tasks SET status='released',completed_at=? WHERE id=?").bind(new Date().toISOString(),active.id).run();
  return {taskId:active.id,status:"released"};
}
async function moderatorQuality(env,request,input){
  const moderator = await requireModerator(request,env);
  if(!env.DB) throw accessError("Durable moderation storage is unavailable.",503);
  const decisionId = requireText(input.decisionId,"A moderation decision",120);
  const outcome = requireText(input.outcome,"A quality outcome",20);
  if(!["upheld","reversed","inconclusive"].includes(outcome)) throw new Error("Quality outcome must be upheld, reversed, or inconclusive.");
  const basis = requireText(input.basis,"A quality basis",1000);
  const decision = await env.DB.prepare("SELECT id,decision,moderator_fingerprint FROM moderation_decisions WHERE id=? LIMIT 1").bind(decisionId).first();
  if(!decision) throw new Error("Moderation decision was not found.");
  if(decision.moderator_fingerprint === moderator.fingerprint) throw accessError("A moderator cannot quality-review their own decision.",403);
  const existing = await env.DB.prepare("SELECT id FROM moderator_quality_events WHERE decision_id=? LIMIT 1").bind(decisionId).first();
  if(existing) return {accepted:false,reason:"This decision already has a quality review."};
  await env.DB.prepare("INSERT INTO moderator_quality_events (id,decision_id,outcome,basis,reviewer_fingerprint,created_at) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(),decisionId,outcome,basis,moderator.fingerprint,new Date().toISOString()).run();
  return {accepted:true,outcome,illegitimateBounce:outcome === "reversed" && ["hold","flag"].includes(decision.decision)};
}
async function moderatorMetrics(env,request,url){
  const moderator = await requireModerator(request,env,{record:false});
  if(!env.DB) throw accessError("Durable moderation storage is unavailable.",503);
  const requestedDays = Number(url.searchParams.get("days") || 30);
  const days = Number.isFinite(requestedDays) ? Math.min(90,Math.max(1,Math.floor(requestedDays))) : 30;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const [assigned,completed,avgResponse,decisions,bounces,team,daily] = await Promise.all([
    env.DB.prepare("SELECT COUNT(*) AS total FROM moderator_tasks WHERE moderator_fingerprint=? AND claimed_at>=?").bind(moderator.fingerprint,since).first(),
    env.DB.prepare("SELECT COUNT(*) AS total FROM moderator_tasks WHERE moderator_fingerprint=? AND status='completed' AND completed_at>=?").bind(moderator.fingerprint,since).first(),
    env.DB.prepare("SELECT AVG(response_seconds) AS average FROM moderator_tasks WHERE moderator_fingerprint=? AND status='completed' AND completed_at>=?").bind(moderator.fingerprint,since).first(),
    env.DB.prepare("SELECT COUNT(*) AS total FROM moderation_decisions WHERE moderator_fingerprint=? AND created_at>=?").bind(moderator.fingerprint,since).first(),
    env.DB.prepare("SELECT COUNT(*) AS total FROM moderator_quality_events q JOIN moderation_decisions d ON d.id=q.decision_id WHERE d.moderator_fingerprint=? AND q.outcome='reversed' AND d.decision IN ('hold','flag') AND q.created_at>=?").bind(moderator.fingerprint,since).first(),
    env.DB.prepare("SELECT COUNT(DISTINCT moderator_fingerprint) AS moderators, COUNT(*) AS decisions FROM moderation_decisions WHERE created_at>=?").bind(since).first(),
    env.DB.prepare("SELECT substr(d.created_at,1,10) AS day, COUNT(*) AS decisions, SUM(CASE WHEN q.outcome='reversed' AND d.decision IN ('hold','flag') THEN 1 ELSE 0 END) AS illegitimate_bounces FROM moderation_decisions d LEFT JOIN moderator_quality_events q ON q.decision_id=d.id WHERE d.created_at>=? GROUP BY substr(d.created_at,1,10) ORDER BY day ASC").bind(since).all()
  ]);
  return {
    window:{days,since},
    verification:{level:moderator.verificationLevel,expiresAt:moderator.expiresAt},
    yourMetrics:{tasksAssigned:Number(assigned?.total || 0),tasksCompleted:Number(completed?.total || 0),decisions:Number(decisions?.total || 0),averageResponseMinutes:Math.round((Number(avgResponse?.average || 0) / 60) * 10) / 10,illegitimateBounces:Number(bounces?.total || 0)},
    teamMetrics:{activeModerators:Number(team?.moderators || 0),decisions:Number(team?.decisions || 0)},
    daily:(daily?.results || []).map(row=>({day:row.day,decisions:Number(row.decisions || 0),illegitimateBounces:Number(row.illegitimate_bounces || 0)})),
    anonymity:{publicModeratorIdentity:"never disclosed",stablePublicAlias:"none",storedIdentity:"one-way credential fingerprint only",operatorNote:"The public API never returns moderator identifiers. Hosting and security logs remain controlled by the service operator."}
  };
}
async function moderationQueue(env,request){
  await requireModerator(request,env);
  if(!env.DB) throw accessError("Durable moderation storage is unavailable.",503);
  const result = await env.DB.prepare(`SELECT id,title,body,topic,public_location,public_lat,public_lng,location_precision,identity_visibility,identity_display,impact,balance,legitimacy_score,review_state,attachment_state,attachment_count,created_at,retention_until FROM happenings WHERE review_state='pending' ORDER BY created_at ASC LIMIT 50`).all();
  const privacyRequests = await env.DB.prepare(`SELECT id,request_type,details,status,resolution,resolved_at,created_at FROM privacy_requests WHERE status='pending' ORDER BY created_at ASC LIMIT 50`).all();
  const reports = await env.DB.prepare(`SELECT id,target_type,target_id,reason,details,review_state,created_at FROM moderation_reports WHERE review_state='pending' ORDER BY created_at ASC LIMIT 50`).all();
  const coordination = await env.DB.prepare(`SELECT target_id,COUNT(*) AS total FROM reputation_events WHERE risk_state='coordination_review' GROUP BY target_id ORDER BY total DESC LIMIT 50`).all();
  return {queue:result.results || [],privacyRequests:privacyRequests.results || [],reports:reports.results || [],coordinationReviews:coordination.results || [],limit:50,disclosure:"Moderator-only queue. Do not copy private identity or exact-location fields into public notes."};
}
async function recordPrivacyRequestAction(env,request,input){
  const moderator = await requireModerator(request,env);
  const moderatorFingerprint = moderator.fingerprint;
  if(!env.DB) throw accessError("Durable privacy storage is unavailable.",503);
  await ensurePrivacySchema(env);
  const requestId = requireText(input.requestId,"A privacy request",120);
  const status = requireText(input.status || "resolved","A privacy request status",20);
  if(!["pending","resolved"].includes(status)) throw new Error("Privacy request status must be pending or resolved.");
  const resolution = status === "resolved" ? requireText(input.resolution,"A resolution",1000) : sanitizeText(input.resolution,1000);
  const current = await env.DB.prepare("SELECT id FROM privacy_requests WHERE id=? LIMIT 1").bind(requestId).first();
  if(!current) throw new Error("Privacy request was not found.");
  const resolvedAt = status === "resolved" ? new Date().toISOString() : null;
  await env.DB.prepare("UPDATE privacy_requests SET status=?,resolution=?,resolved_at=?,resolved_by_fingerprint=? WHERE id=?").bind(status,resolution || null,resolvedAt,status === "resolved" ? moderatorFingerprint : null,requestId).run();
  await completeModeratorTask(env,"privacy_request",requestId,moderatorFingerprint,status,resolvedAt || new Date().toISOString());
  return {requestId,status,resolvedAt};
}
async function recordModerationAction(env,request,input){
  const moderator = await requireModerator(request,env);
  const moderatorFingerprint = moderator.fingerprint;
  if(!env.DB) throw accessError("Durable moderation storage is unavailable.",503);
  const happeningId = requireText(input.happeningId,"A happening",120);
  const decision = requireText(input.decision,"A moderation decision",20);
  if(!["approve","hold","flag"].includes(decision)) throw new Error("Decision must be approve, hold, or flag.");
  const reason = requireText(input.reason,"A moderation reason",500);
  const current = await env.DB.prepare(`SELECT id FROM happenings WHERE id=? LIMIT 1`).bind(happeningId).first();
  if(!current) throw new Error("Happening was not found.");
  const reviewState = decision === "approve" ? "cleared" : decision === "flag" ? "flagged" : "pending";
  const createdAt = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare(`UPDATE happenings SET review_state=? WHERE id=?`).bind(reviewState,happeningId),
    env.DB.prepare(`INSERT INTO moderation_decisions (id,happening_id,decision,reason,moderator_fingerprint,created_at) VALUES (?,?,?,?,?,?)`).bind(crypto.randomUUID(),happeningId,decision,reason,moderatorFingerprint,createdAt)
  ]);
  await completeModeratorTask(env,"happening",happeningId,moderatorFingerprint,decision,createdAt);
  return {happeningId,decision,reviewState,createdAt};
}
async function recordReportAction(env,request,input){
  const moderator = await requireModerator(request,env);
  const moderatorFingerprint = moderator.fingerprint;
  if(!env.DB) throw accessError("Durable moderation storage is unavailable.",503);
  const reportId = requireText(input.reportId,"A moderation report",120);
  const status = requireText(input.status || "resolved","A report status",20);
  if(!["pending","resolved","rejected"].includes(status)) throw new Error("Report status must be pending, resolved, or rejected.");
  const resolution = status === "pending" ? sanitizeText(input.resolution,1000) : requireText(input.resolution,"A resolution",1000);
  const current = await env.DB.prepare(`SELECT id,target_type,target_id,reason,details FROM moderation_reports WHERE id=? LIMIT 1`).bind(reportId).first();
  if(!current) throw new Error("Moderation report was not found.");
  const reviewState = status === "resolved" ? "cleared" : status === "rejected" ? "flagged" : "pending";
  const resolvedAt = status === "pending" ? null : new Date().toISOString();
  await env.DB.prepare("UPDATE moderation_reports SET review_state=?,resolution=?,resolved_at=?,resolved_by_fingerprint=? WHERE id=?").bind(reviewState,resolution || null,resolvedAt,status === "pending" ? null : moderatorFingerprint,reportId).run();
  if(status === "resolved" && (current.reason === "correction" || current.reason === "appeal") && String(current.target_id).startsWith("public-")){
    await env.DB.prepare("INSERT INTO correction_history (id,history_type,public_story_id,summary,review_state,created_at,resolved_at,resolved_by_fingerprint) VALUES (?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),current.reason,current.target_id,resolution,"approved",new Date().toISOString(),resolvedAt,moderatorFingerprint).run();
  }
  await completeModeratorTask(env,"report",reportId,moderatorFingerprint,status,resolvedAt || new Date().toISOString());
  return {reportId,status,reviewState,resolvedAt};
}
async function deskItems(env,request){
  const key = await ownerKey(request);
  if(!env.DB) throw accessError("Durable desk storage is unavailable.",503);
  const rows = await env.DB.prepare("SELECT happening_key,created_at FROM desk_items WHERE owner_key=? ORDER BY created_at DESC LIMIT 500").bind(key).all();
  return {authenticated:true,items:rows.results || []};
}
async function saveDeskItem(env,request,input){
  const key = await ownerKey(request);
  if(!env.DB) throw accessError("Durable desk storage is unavailable.",503);
  const happeningKey = requireText(input.happeningKey,"A desk item",180);
  const action = input.action === "remove" ? "remove" : "save";
  if(action === "remove"){
    await env.DB.prepare("DELETE FROM desk_items WHERE owner_key=? AND happening_key=?").bind(key,happeningKey).run();
    return {saved:false,happeningKey};
  }
  await env.DB.prepare("INSERT OR IGNORE INTO desk_items (id,owner_key,happening_key,created_at) VALUES (?,?,?,?)").bind(crypto.randomUUID(),key,happeningKey,new Date().toISOString()).run();
  return {saved:true,happeningKey};
}
async function privacyProfile(env,request){
  const key = await ownerKey(request);
  await ensurePrivacySchema(env);
  const preference = await env.DB.prepare("SELECT opt_out_sharing,limit_sensitive,updated_at FROM privacy_preferences WHERE owner_key=? LIMIT 1").bind(key).first();
  const summary = await env.DB.prepare("SELECT COUNT(*) AS total, SUM(CASE WHEN review_state='pending' THEN 1 ELSE 0 END) AS pending FROM happenings WHERE owner_key=?").bind(key).first();
  const reputation = await env.DB.prepare("SELECT COUNT(*) AS total FROM reputation_events WHERE owner_key=?").bind(key).first();
  const desk = await env.DB.prepare("SELECT COUNT(*) AS total FROM desk_items WHERE owner_key=?").bind(key).first();
  return {authenticated:true,controls:{aggregateOnly:true,optOutSharing:true,limitSensitive:preference ? Boolean(preference.limit_sensitive) : true,updatedAt:preference?.updated_at || null},dataSummary:{happenings:Number(summary?.total || 0),pending:Number(summary?.pending || 0),reputationEvents:Number(reputation?.total || 0),deskItems:Number(desk?.total || 0)},disclosure:"Only sanitized, neighborhood-level records linked to this signed-in profile are included. Legit never sells or shares personal information. Anonymous contributions and anonymous abuse-prevention fingerprints are not linked to a profile."};
}
async function exportPrivacyData(env,request){
  const key = await ownerKey(request);
  await ensurePrivacySchema(env);
  const preferences = await env.DB.prepare("SELECT opt_out_sharing,limit_sensitive,updated_at FROM privacy_preferences WHERE owner_key=? LIMIT 1").bind(key).first();
  const happenings = await env.DB.prepare("SELECT id,title,body,topic,public_location,public_lat,public_lng,location_precision,identity_visibility,impact,balance,legitimacy_score,review_state,attachment_state,attachment_count,created_at,retention_until FROM happenings WHERE owner_key=? ORDER BY created_at ASC").bind(key).all();
  const claims = await env.DB.prepare("SELECT c.id,c.happening_id,c.text,c.status,c.attribution,c.created_at FROM claims c JOIN happenings h ON h.id=c.happening_id WHERE h.owner_key=? ORDER BY c.created_at ASC").bind(key).all();
  const evidence = await env.DB.prepare("SELECT e.id,e.claim_id,e.evidence_type,e.relationship,e.provenance,e.review_state,e.submitted_at FROM evidence e JOIN claims c ON c.id=e.claim_id JOIN happenings h ON h.id=c.happening_id WHERE h.owner_key=? ORDER BY e.submitted_at ASC").bind(key).all();
  const requests = await env.DB.prepare("SELECT id,request_type,details,status,resolution,resolved_at,created_at FROM privacy_requests WHERE owner_key=? ORDER BY created_at ASC").bind(key).all();
  const reputation = await env.DB.prepare("SELECT id,action_type,target_id,action_day,points_awarded,basis,created_at FROM reputation_events WHERE owner_key=? ORDER BY created_at ASC").bind(key).all();
  const desk = await env.DB.prepare("SELECT happening_key,created_at FROM desk_items WHERE owner_key=? ORDER BY created_at ASC").bind(key).all();
  return {exportedAt:new Date().toISOString(),storageModel:"sanitized-with-neighborhood-aggregation",preferences:preferences || {opt_out_sharing:1,limit_sensitive:1},happenings:happenings.results || [],claims:claims.results || [],evidence:evidence.results || [],privacyRequests:requests.results || [],reputationEvents:reputation.results || [],deskItems:desk.results || []};
}
async function savePrivacyPreferences(env,request,input){
  const key = await ownerKey(request);
  await ensurePrivacySchema(env);
  const updatedAt = new Date().toISOString();
  const optOutSharing = input.optOutSharing === false ? 0 : 1;
  const limitSensitive = input.limitSensitive === false ? 0 : 1;
  await env.DB.batch([env.DB.prepare("DELETE FROM privacy_preferences WHERE owner_key=?").bind(key),env.DB.prepare("INSERT INTO privacy_preferences (owner_key,opt_out_sharing,limit_sensitive,updated_at) VALUES (?,?,?,?)").bind(key,optOutSharing,limitSensitive,updatedAt)]);
  return {optOutSharing:Boolean(optOutSharing),limitSensitive:Boolean(limitSensitive),updatedAt};
}
async function saveCorrectionRequest(env,request,input){
  const key = await ownerKey(request);
  await ensurePrivacySchema(env);
  const details = requireText(input.details,"A correction request",1000);
  const createdAt = new Date().toISOString();
  await env.DB.prepare("INSERT INTO privacy_requests (id,owner_key,request_type,details,status,created_at) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(),key,"correction",details,"pending",createdAt).run();
  return {status:"pending",createdAt};
}
async function deleteAllProfileData(env,request){
  const key = await ownerKey(request);
  await ensurePrivacySchema(env);
  const summary = await env.DB.prepare("SELECT COUNT(*) AS total FROM happenings WHERE owner_key=?").bind(key).first();
  const reputation = await env.DB.prepare("SELECT COUNT(*) AS total FROM reputation_events WHERE owner_key=?").bind(key).first();
  const deletedHappenings = Number(summary?.total || 0);
  const deletedReputationEvents = Number(reputation?.total || 0);
  await env.DB.batch([
    env.DB.prepare("DELETE FROM moderation_reports WHERE reporter_owner_key=? OR target_id IN (SELECT id FROM happenings WHERE owner_key=?) OR target_id IN (SELECT id FROM claims WHERE happening_id IN (SELECT id FROM happenings WHERE owner_key=?)) OR target_id IN (SELECT id FROM evidence WHERE claim_id IN (SELECT id FROM claims WHERE happening_id IN (SELECT id FROM happenings WHERE owner_key=?)))").bind(key,key,key,key),
    env.DB.prepare("DELETE FROM evidence WHERE claim_id IN (SELECT id FROM claims WHERE happening_id IN (SELECT id FROM happenings WHERE owner_key=?))").bind(key),
    env.DB.prepare("DELETE FROM moderation_decisions WHERE happening_id IN (SELECT id FROM happenings WHERE owner_key=?)").bind(key),
    env.DB.prepare("DELETE FROM claims WHERE happening_id IN (SELECT id FROM happenings WHERE owner_key=?)").bind(key),
    env.DB.prepare("DELETE FROM reputation_events WHERE owner_key=?").bind(key),
    env.DB.prepare("DELETE FROM desk_items WHERE owner_key=?").bind(key),
    env.DB.prepare("DELETE FROM happenings WHERE owner_key=?").bind(key),
    env.DB.prepare("DELETE FROM privacy_requests WHERE owner_key=?").bind(key),
    env.DB.prepare("DELETE FROM privacy_preferences WHERE owner_key=?").bind(key),
    env.DB.prepare("INSERT INTO privacy_deletion_audit (id,scope,deleted_happenings,deleted_reputation_events,created_at) VALUES (?,?,?,?,?)").bind(crypto.randomUUID(),"profile",deletedHappenings,deletedReputationEvents,new Date().toISOString())
  ]);
  return {deletedHappenings,deletedReputationEvents,deletedAt:new Date().toISOString()};
}
async function handleApi(request,env,ctx){
  const url = new URL(request.url);
  scheduleRetentionCleanup(env,ctx);
  if(request.method === "OPTIONS") return new Response(null,{status:204,headers:{...securityHeaders,"allow":"GET, POST, OPTIONS"}});
  if(!["GET","POST"].includes(request.method)) return jsonResponse({error:"Method not allowed."},405,{allow:"GET, POST, OPTIONS"});
  if(request.method === "POST"){
    const origin = request.headers.get("origin");
    const fetchSite = request.headers.get("sec-fetch-site");
    if(origin){ try { if(new URL(origin).origin !== url.origin) return jsonResponse({error:"Cross-origin mutations are not accepted."},403); } catch { return jsonResponse({error:"Invalid request origin."},403); } }
    if(fetchSite && !["same-origin","same-site","none"].includes(fetchSite)) return jsonResponse({error:"Cross-site mutations are not accepted."},403);
    if(!(await allowRequest(request,url.pathname))) return jsonResponse({error:"Please wait before sending another report."},429,{"retry-after":"60"});
    if(!(await allowDurableRequest(env,request,url.pathname))) return jsonResponse({error:"This action is temporarily rate-limited. Please try again later."},429,{"retry-after":"60"});
  }
  if(url.pathname === "/api/health" && request.method === "GET") return jsonResponse({ok:true,policyVersion:policy.version});
  if(url.pathname === "/api/policy" && request.method === "GET") return jsonResponse(policy);
  if(url.pathname === "/api/reputation/policy" && request.method === "GET") return jsonResponse(reputationRules);
  if(url.pathname === "/api/profile/privacy" && request.method === "GET"){
    try { return jsonResponse(await privacyProfile(env,request)); }
    catch(error){ return jsonResponse({error:error.message || "Privacy controls are unavailable."},error.status || (error.message === "Durable privacy storage is unavailable." ? 503 : 400)); }
  }
  if(url.pathname === "/api/profile/privacy/export" && request.method === "GET"){
    try { return jsonResponse(await exportPrivacyData(env,request),200,{"content-disposition":"attachment; filename=legit-data-export.json"}); }
    catch(error){ return jsonResponse({error:error.message || "Data export is unavailable."},error.status || (error.message === "Durable privacy storage is unavailable." ? 503 : 400)); }
  }
  if(url.pathname === "/api/profile/privacy" && request.method === "POST"){
    try { const input=await readJson(request); if(input.action === "save_preferences") return jsonResponse({ok:true,controls:await savePrivacyPreferences(env,request,input)},200); if(input.action === "correction_request") return jsonResponse({ok:true,request:await saveCorrectionRequest(env,request,input)},202); if(input.action === "delete_all") return jsonResponse({ok:true,deletion:await deleteAllProfileData(env,request)},200); throw new Error("This privacy action is not supported."); }
    catch(error){ return jsonResponse({error:error.message || "Privacy action was rejected."},error.status || (error.message === "Durable privacy storage is unavailable." ? 503 : 400)); }
  }
  if(url.pathname === "/api/desk" && request.method === "GET"){
    try { return jsonResponse(await deskItems(env,request)); }
    catch(error){ return jsonResponse({error:error.message || "Desk data is unavailable."},error.status || (error.message === "Durable desk storage is unavailable." ? 503 : 400)); }
  }
  if(url.pathname === "/api/desk" && request.method === "POST"){
    try { return jsonResponse({ok:true,desk:await saveDeskItem(env,request,await readJson(request))},200); }
    catch(error){ return jsonResponse({error:error.message || "Desk item could not be saved."},error.status || (error.message === "Durable desk storage is unavailable." ? 503 : 400)); }
  }
  if(url.pathname === "/api/moderation/status" && request.method === "GET"){
    try { return jsonResponse(await moderationStatus(env)); }
    catch(error){ return jsonResponse({error:error.message || "Moderation status is unavailable."},error.message === "Durable moderation storage is unavailable." ? 503 : 400); }
  }
  if(url.pathname === "/api/moderation/verify" && request.method === "POST"){
    try { const moderator = await requireModerator(request,env); return jsonResponse({verified:true,verificationLevel:moderator.verificationLevel,expiresAt:moderator.expiresAt,publicIdentity:"anonymous"}); }
    catch(error){ return jsonResponse({error:error.message || "Moderator verification failed."},error.status || 401); }
  }
  if(url.pathname === "/api/moderation/metrics" && request.method === "GET"){
    try { return jsonResponse(await moderatorMetrics(env,request,url)); }
    catch(error){ return jsonResponse({error:error.message || "Moderator metrics are unavailable."},error.status || 400); }
  }
  if(url.pathname === "/api/moderation/tasks" && request.method === "POST"){
    try { return jsonResponse({ok:true,task:await moderationTask(env,request,await readJson(request))},200); }
    catch(error){ return jsonResponse({error:error.message || "Moderator task action was rejected."},error.status || 400); }
  }
  if(url.pathname === "/api/moderation/quality" && request.method === "POST"){
    try { return jsonResponse({ok:true,review:await moderatorQuality(env,request,await readJson(request))},202); }
    catch(error){ return jsonResponse({error:error.message || "Moderator quality review was rejected."},error.status || 400); }
  }
  if(url.pathname === "/api/happenings" && request.method === "GET"){
    try { return jsonResponse(await publicHappenings(env,url),200,{"cache-control":"public, max-age=15, s-maxage=15"}); }
    catch(error){ return jsonResponse({error:error.message || "Public happenings are unavailable."},error.status || (error.message === "Durable public reporting storage is unavailable." ? 503 : 400)); }
  }
  if(url.pathname === "/api/moderation/queue" && request.method === "GET"){
    try { return jsonResponse(await moderationQueue(env,request)); }
    catch(error){ return jsonResponse({error:error.message || "Moderator queue is unavailable."},error.status || 400); }
  }
  if(url.pathname === "/api/moderation/actions" && request.method === "POST"){
    try { const input=await readJson(request); const action=input.actionType === "privacy_request" ? await recordPrivacyRequestAction(env,request,input) : input.actionType === "moderation_report" ? await recordReportAction(env,request,input) : await recordModerationAction(env,request,input); return jsonResponse({ok:true,action},202); }
    catch(error){ return jsonResponse({error:error.message || "Moderation action was rejected."},error.status || (error.message === "Durable moderation storage is unavailable." ? 503 : 400)); }
  }
  if(url.pathname === "/api/happenings" && request.method === "POST"){
    try { const item = normalizeHappening(await readJson(request)); await persistHappening(env,item,request); return jsonResponse({ok:true,happening:{id:item.id,publicLat:item.publicLat,publicLng:item.publicLng,locationPrecision:item.locationPrecision,identityVisibility:item.identityVisibility,reviewState:item.reviewState,attachmentState:item.attachmentState}},202); }
    catch(error){ return jsonResponse({error:error.message || "Submission was rejected by the privacy gate."},error.status || (error.message === "Durable moderation storage is unavailable." ? 503 : 400)); }
  }
  if(url.pathname === "/api/reports" && request.method === "POST"){
    try { return jsonResponse({ok:true,report:await persistReport(env,await readJson(request),request)},202); }
    catch(error){ return jsonResponse({error:error.message || "Report was rejected."},error.status || (error.message === "Durable moderation storage is unavailable." ? 503 : 400)); }
  }
  if(url.pathname === "/api/reputation/assessment" && request.method === "POST"){
    try { return jsonResponse({ok:true,assessment:await persistAssessment(env,request,await readJson(request))},202); }
    catch(error){ return jsonResponse({error:error.message || "Assessment was rejected."},error.status || (error.message === "Durable reputation storage is unavailable." ? 503 : 400)); }
  }
  return jsonResponse({error:"Not found"},404);
}
function assetResponse(pathname){
  const key = pathname === "/" ? "index.html" : pathname.replace(/^\//,"");
  const asset = ASSET_BUNDLE[key];
  if(!asset) return null;
  return textResponse(asset.body,asset.type);
}

export default {
  async fetch(request,env,ctx){
    const url = new URL(request.url);
    if(url.pathname.startsWith("/api/")) return handleApi(request,env,ctx);
    return assetResponse(url.pathname) || textResponse("Not found","text/plain; charset=utf-8");
  },
  async scheduled(_controller,env){
    await purgeExpiredRecords(env);
  }
};
