import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import handler from "../dist/server/index.js";

const origin = "https://legit.example";
const headerNames = ["content-security-policy","strict-transport-security","x-content-type-options","x-frame-options","referrer-policy","permissions-policy"];
const workerSource = await readFile(new URL("../worker/index.js",import.meta.url),"utf8");
assert.doesNotMatch(workerSource,/CREATE TABLE IF NOT EXISTS|CREATE INDEX IF NOT EXISTS/i,"runtime DDL must remain out of the Worker");
assert.equal(typeof handler.scheduled,"function","retention scheduled handler is missing");

async function request(path,options={}){
  return requestWithEnv(path,options,{});
}
async function requestWithEnv(path,options={},env={}){
  return handler.fetch(new Request(`${origin}${path}`,options),env);
}

const health = await request("/api/health");
assert.equal(health.status,200);
for(const header of headerNames) assert.ok(health.headers.get(header),`missing ${header}`);

const options = await request("/api/happenings",{method:"OPTIONS"});
assert.equal(options.status,204);
assert.equal(options.headers.get("access-control-allow-origin"),null);

const method = await request("/api/happenings",{method:"PUT"});
assert.equal(method.status,405);

const crossOrigin = await request("/api/happenings",{method:"POST",headers:{origin:"https://evil.example","content-type":"application/json"},body:"{}"});
assert.equal(crossOrigin.status,403);

const wrongType = await request("/api/happenings",{method:"POST",headers:{origin,"content-type":"text/plain"},body:"{}"});
assert.equal(wrongType.status,415);

const malformed = await request("/api/happenings",{method:"POST",headers:{origin,"content-type":"application/json","CF-Connecting-IP":"security-smoke"},body:"{"});
assert.equal(malformed.status,400);

const policy = await request("/api/policy");
assert.equal(policy.status,200);
const policyBody = await policy.json();
assert.match(policyBody.location,/never stored/);

const anonymousProfile = await request("/api/profile/privacy");
assert.equal(anonymousProfile.status,401);

const anonymousExport = await request("/api/profile/privacy/export");
assert.equal(anonymousExport.status,401);

const publicHappenings = await request("/api/happenings");
assert.equal(publicHappenings.status,503);

const now = new Date().toISOString();
const mockRows = [
  {id:"h-1",title:"Road closed",body:"Report one",topic:"Public safety",public_location:"Downtown",public_lat:43.65,public_lng:-70.26,balance:"left",impact:2,legitimacy_score:40,review_state:"cleared",created_at:now,source_count:1},
  {id:"h-2",title:"Road closed",body:"Report two",topic:"Public safety",public_location:"Downtown",public_lat:43.65,public_lng:-70.26,balance:"right",impact:4,legitimacy_score:80,review_state:"cleared",created_at:now,source_count:2}
];
const mockEvidence = [{happening_id:"h-1",id:"e-1",evidence_type:"Public record",relationship:"supports",provenance:"https://example.com/record?token=removed",submitted_at:now}];
const mockDb = {prepare(sql){
  const statement = {bind(){return statement},run:async()=>({}),first:async()=>sql.includes("SELECT id FROM privacy_requests") ? {id:"privacy-1"} : sql.includes("SELECT id FROM reputation_events") ? null : {total:0},all:async()=>({results:sql.includes("FROM happenings h") ? mockRows : sql.includes("FROM evidence e") ? mockEvidence : sql.includes("FROM privacy_requests") ? [{id:"privacy-1",request_type:"correction",details:"Fix record",status:"pending",created_at:now}] : []})};
  return statement;
}};
const databaseEnv = {DB:mockDb,MODERATOR_TOKEN:"smoke-token"};
const publicRead = await requestWithEnv("/api/happenings?time=all",{},databaseEnv);
assert.equal(publicRead.status,200);
const publicBody = await publicRead.json();
assert.equal(publicBody.happenings.length,1);
assert.equal(publicBody.happenings[0].reports,2);
assert.equal(publicBody.happenings[0].balance,"agnostic");
assert.equal(publicBody.happenings[0].sourceCount,1);
assert.equal(publicBody.happenings[0].evidence.length,1);
assert.match(publicBody.happenings[0].evidence[0].provenance,/example\.com\/record$/);

const report = await requestWithEnv("/api/reports",{method:"POST",headers:{origin,"content-type":"application/json","CF-Connecting-IP":"reporter"},body:JSON.stringify({targetType:"happening",targetId:publicBody.happenings[0].id,reason:"correction",details:"The time in the primary claim needs review."})},databaseEnv);
assert.equal(report.status,202);

const deskHeaders = {origin,"content-type":"application/json","oai-authenticated-user-id":"smoke-user","CF-Connecting-IP":"desk-user"};
const deskSave = await requestWithEnv("/api/desk",{method:"POST",headers:deskHeaders,body:JSON.stringify({action:"save",happeningKey:publicBody.happenings[0].id})},databaseEnv);
assert.equal(deskSave.status,200);
const deskRead = await requestWithEnv("/api/desk",{headers:{"oai-authenticated-user-id":"smoke-user"}},databaseEnv);
assert.equal(deskRead.status,200);

const reputationRows = [
  {id:"r-1",actor_fingerprint:"actor-1",action_type:"evidence_useful",target_id:"public-story:e1",action_day:now.slice(0,10),points_awarded:2,risk_state:"normal",created_at:now},
  {id:"r-2",actor_fingerprint:"actor-2",action_type:"evidence_useful",target_id:"public-story:e2",action_day:now.slice(0,10),points_awarded:2,risk_state:"normal",created_at:now},
  {id:"r-3",actor_fingerprint:"actor-3",action_type:"evidence_useful",target_id:"public-story:e3",action_day:now.slice(0,10),points_awarded:2,risk_state:"normal",created_at:now}
];
const reputationDb = {
  prepare(sql){
    const statement = {bind(...values){statement.values=values; return statement},run:async()=>({}),first:async()=>{
      if(sql.includes("SELECT id FROM reputation_events")) return reputationRows.find(row => row.actor_fingerprint === "actor-4" && row.target_id === statement.values?.[2]) || null;
      if(sql.includes("COUNT(*) AS total") && sql.includes("actor_fingerprint=?")) return {total:0};
      if(sql.includes("COUNT(*) AS events")) return {events:3,actors:3};
      return {total:0};
    },all:async()=>({results:[]})};
    if(sql.startsWith("INSERT INTO reputation_events")) statement.run=async()=>({ok:true});
    return statement;
  }
};
const assessment = await requestWithEnv("/api/reputation/assessment",{method:"POST",headers:{origin,"content-type":"application/json","CF-Connecting-IP":"actor-4","user-agent":"smoke"},body:JSON.stringify({targetId:"public-story:e4",actionType:"evidence_useful"})},{DB:reputationDb});
assert.equal(assessment.status,202);
assert.equal((await assessment.json()).assessment.riskState,"coordination_review");

const moderatorQueue = await requestWithEnv("/api/moderation/queue",{headers:{authorization:"Bearer smoke-token"}},databaseEnv);
assert.equal(moderatorQueue.status,200);
assert.equal((await moderatorQueue.json()).privacyRequests.length,1);

const missingModerator = await requestWithEnv("/api/moderation/queue",{}, {DB:mockDb});
assert.equal(missingModerator.status,503);

const wrongModerator = await requestWithEnv("/api/moderation/queue",{headers:{authorization:"Bearer wrong-token"}},databaseEnv);
assert.equal(wrongModerator.status,401);

const privacyAction = await requestWithEnv("/api/moderation/actions",{method:"POST",headers:{origin,"authorization":"Bearer smoke-token","content-type":"application/json"},body:JSON.stringify({actionType:"privacy_request",requestId:"privacy-1",status:"resolved",resolution:"Reviewed by moderator."})},databaseEnv);
assert.equal(privacyAction.status,202);

await handler.scheduled({cron:"0 * * * *"},databaseEnv);

console.log("Security smoke passed: headers, same-origin boundary, method gate, JSON gate, malformed-body handling, public read fail-closed behavior, report aggregation, coordination-review scoring, moderator fail-closed checks, privacy-request moderation, scheduled retention wiring, and profile privacy checks.");
