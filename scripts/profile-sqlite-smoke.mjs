import assert from "node:assert/strict";
import {DatabaseSync} from "node:sqlite";
import {readFile,readdir} from "node:fs/promises";
import handler from "../dist/server/index.js";
const sqlite=new DatabaseSync(":memory:");sqlite.exec("PRAGMA foreign_keys=ON");
for(const file of (await readdir(new URL("../drizzle/",import.meta.url))).filter(name=>name.endsWith(".sql")).sort())sqlite.exec(await readFile(new URL(`../drizzle/${file}`,import.meta.url),"utf8"));
const DB={prepare(sql){let values=[];return {bind(...args){values=args;return this;},async first(){return sqlite.prepare(sql).get(...values)||null;},async all(){return {results:sqlite.prepare(sql).all(...values)};},async run(){return sqlite.prepare(sql).run(...values);},sql,get values(){return values;}};},async batch(statements){sqlite.exec("BEGIN");try{const result=statements.map(s=>sqlite.prepare(s.sql).run(...s.values));sqlite.exec("COMMIT");return result;}catch(error){sqlite.exec("ROLLBACK");throw error;}}};
const env={DB,LEGIT_ABUSE_HMAC_SECRET:"synthetic-abuse-secret",LEGIT_OWNER_HMAC_SECRET:"synthetic-owner-secret"};
const origin="https://legit.test";let actor=0;const pending=[];
async function request(path,user,body,envOverride={}){
 const headers={accept:"application/json","CF-Connecting-IP":"fixture-"+(actor++)};if(user)headers["oai-authenticated-user-id"]=user;
 if(body){headers.origin=origin;headers["content-type"]="application/json";}
 const response=await handler.fetch(new Request(origin+path,{method:body?"POST":"GET",headers,body:body?JSON.stringify(body):undefined}),{...env,...envOverride},{waitUntil(p){pending.push(p);}});
 await Promise.allSettled(pending.splice(0));assert.equal(response.headers.get("cache-control"),"no-store");
 return {response,data:await response.json()};
}
async function submit(label,user){const r=await request("/api/happenings",user,{title:label,body:"Synthetic observation",location:"Fixture district",lat:43.651234,lng:-70.261234,source:"https://example.invalid/"+label+"?secret=removed"});assert.equal(r.response.status,202);return r.data.happening.id;}
function insert(table,row){const keys=Object.keys(row);sqlite.prepare(`INSERT INTO ${table} (${keys.join(",")}) VALUES (${keys.map(()=>"?").join(",")})`).run(...Object.values(row));}
async function exported(user){const r=await request("/api/profile/privacy/export",user);assert.equal(r.response.status,200);assert.match(r.response.headers.get("content-disposition"),/attachment/);return r.data;}
const tables=["happenings","claims","evidence","moderation_reports","moderation_decisions","reputation_events","desk_items","privacy_preferences","privacy_requests","privacy_deletion_audit"];
const snapshot=()=>Object.fromEntries(tables.map(table=>[table,sqlite.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()]));
try{
 const a=await submit("profile-a","synthetic-account-a");const b=await submit("profile-b","synthetic-account-b");const anon=await submit("anonymous-contribution",null);
 const key=id=>sqlite.prepare("SELECT owner_key FROM happenings WHERE id=?").get(id).owner_key;
 const ka=key(a),kb=key(b);assert.ok(ka&&kb&&ka!==kb);assert.notEqual(ka,"synthetic-account-a");assert.equal(key(anon),null);
 const now=new Date().toISOString();
 for(const [user,k,id,label] of [["synthetic-account-a",ka,a,"a"],["synthetic-account-b",kb,b,"b"]]){
  assert.equal((await request("/api/profile/privacy",user,{action:"save_preferences",limitSensitive:true,optOutSharing:true})).response.status,200);
  assert.equal((await request("/api/profile/privacy",user,{action:"correction_request",details:"Synthetic correction "+label})).response.status,202);
  assert.equal((await request("/api/desk",user,{action:"save",happeningKey:"public-fixture-"+label})).response.status,200);
  insert("reputation_events",{id:"rep-"+label,actor_fingerprint:"private-actor-"+label,owner_key:k,action_type:"evidence_useful",target_id:"public-fixture:"+label,action_day:now.slice(0,10),points_awarded:2,basis:"Synthetic evidence",created_at:now});
  insert("moderation_decisions",{id:"decision-"+label,happening_id:id,decision:"hold",reason:"Synthetic",moderator_fingerprint:"private-moderator-"+label,created_at:now});
  insert("moderation_reports",{id:"report-"+label,target_type:"happening",target_id:id,reason:"privacy",details:"Synthetic",reporter_owner_key:k,review_state:"pending",created_at:now});
 }
 insert("reputation_events",{id:"rep-anon",actor_fingerprint:"private-anon-actor",owner_key:null,action_type:"evidence_useful",target_id:"public-fixture:anon",action_day:now.slice(0,10),points_awarded:1,basis:"Synthetic anonymous evidence",created_at:now});
 insert("moderation_reports",{id:"a-report-on-b",target_type:"happening",target_id:b,reason:"privacy",details:"Synthetic A-owned report on B",reporter_owner_key:ka,review_state:"pending",created_at:now});
 const ea=await exported("synthetic-account-a");const eb=await exported("synthetic-account-b");
 for(const [data,id,other,label] of [[ea,a,b,"a"],[eb,b,a,"b"]]){
  assert.deepEqual(data.happenings.map(h=>h.id),[id]);assert.equal(data.claims.length,1);assert.equal(data.evidence.length,1);assert.equal(data.privacyRequests.length,1);assert.equal(data.reputationEvents.length,1);assert.equal(data.deskItems.length,1);
  const text=JSON.stringify(data);for(const value of [other,anon,ka,kb,"private-actor-","private-moderator-","synthetic-account-","secret=removed","43.651234"])assert.equal(text.includes(value),false,value);
  assert.equal(data.reputationEvents[0].id,"rep-"+label);
 }
 const beforeDenied=snapshot();
 assert.equal((await request("/api/profile/privacy/export?owner_key="+ka,null)).response.status,401);
 assert.equal((await request("/api/profile/privacy",null,{action:"delete_all",owner_key:ka,"oai-authenticated-user-id":"synthetic-account-a"})).response.status,401);
 assert.equal((await request("/api/profile/privacy/export","synthetic-account-a",undefined,{LEGIT_OWNER_HMAC_SECRET:undefined})).response.status,503);
 assert.equal((await request("/api/profile/privacy/export","synthetic-account-a",undefined,{DB:undefined})).response.status,503);
 assert.deepEqual(snapshot(),beforeDenied);
 // Query/body identifiers cannot substitute for the authenticated principal.
 const spoof=await request("/api/profile/privacy/export?owner_key="+kb,"synthetic-account-a");assert.deepEqual(spoof.data.happenings.map(h=>h.id),[a]);
 sqlite.exec("CREATE TRIGGER reject_profile_audit BEFORE INSERT ON privacy_deletion_audit WHEN NEW.scope='profile' BEGIN SELECT RAISE(ABORT,'synthetic profile audit failure'); END;");
 const beforeFailed=snapshot();const failed=await request("/api/profile/privacy","synthetic-account-a",{action:"delete_all",owner_key:kb});assert.notEqual(failed.response.status,200);assert.deepEqual(snapshot(),beforeFailed);
 sqlite.exec("DROP TRIGGER reject_profile_audit");
 const deletion=await request("/api/profile/privacy","synthetic-account-a",{action:"delete_all",owner_key:kb});assert.equal(deletion.response.status,200);assert.equal(deletion.data.deletion.deletedHappenings,1);assert.equal(deletion.data.deletion.deletedReputationEvents,1);
 assert.deepEqual(sqlite.prepare("SELECT id FROM happenings ORDER BY id").all().map(r=>r.id).sort(),[b,anon].sort());
 for(const table of ["claims","evidence"])assert.equal(sqlite.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n,2);
 assert.deepEqual(sqlite.prepare("SELECT id FROM moderation_decisions").all().map(r=>r.id),["decision-b"]);
 assert.deepEqual(sqlite.prepare("SELECT id FROM moderation_reports").all().map(r=>r.id),["report-b"]);
 assert.deepEqual(sqlite.prepare("SELECT id FROM reputation_events ORDER BY id").all().map(r=>r.id),["rep-anon","rep-b"]);
 for(const table of ["privacy_preferences","privacy_requests","desk_items"])assert.equal(sqlite.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE owner_key=?`).get(ka).n,0);
 const afterA=await exported("synthetic-account-a");for(const field of ["happenings","claims","evidence","privacyRequests","reputationEvents","deskItems"])assert.deepEqual(afterA[field],[]);
 assert.deepEqual(afterA.preferences,{opt_out_sharing:1,limit_sensitive:1});
 const afterB=await exported("synthetic-account-b");delete eb.exportedAt;delete afterB.exportedAt;assert.deepEqual(afterB,eb);
 const audit=sqlite.prepare("SELECT * FROM privacy_deletion_audit").get();assert.equal(audit.scope,"profile");assert.equal(audit.deleted_happenings,1);assert.equal(audit.deleted_reputation_events,1);assert.equal(JSON.stringify(audit).includes(ka),false);
 const repeated=await request("/api/profile/privacy","synthetic-account-a",{action:"delete_all"});assert.equal(repeated.response.status,200);assert.equal(repeated.data.deletion.deletedHappenings,0);assert.equal(repeated.data.deletion.deletedReputationEvents,0);
 assert.equal(sqlite.prepare("SELECT SUM(deleted_happenings) AS n FROM privacy_deletion_audit").get().n,1);
 assert.equal(sqlite.prepare("PRAGMA foreign_key_check").all().length,0);
 console.log("Profile SQLite smoke passed: real migrations/routes, two-profile export isolation, anonymous preservation, identifier spoof rejection, fail-closed auth/configuration, transactional deletion rollback/retry, dependent cleanup, audit counts, repeat deletion, and foreign keys. Synthetic in-memory data only; not hosted identity or D1 qualification.");
}finally{await Promise.allSettled(pending);sqlite.close();}
