import assert from "node:assert/strict";
import {DatabaseSync} from "node:sqlite";
import {readFile,readdir} from "node:fs/promises";
import handler from "../dist/server/index.js";

const sqlite=new DatabaseSync(":memory:");sqlite.exec("PRAGMA foreign_keys=ON");
for(const file of (await readdir(new URL("../drizzle/",import.meta.url))).filter(name=>name.endsWith(".sql")).sort())sqlite.exec(await readFile(new URL(`../drizzle/${file}`,import.meta.url),"utf8"));
const DB={prepare(sql){let values=[];return {bind(...args){values=args;return this;},async first(){return sqlite.prepare(sql).get(...values)||null;},async all(){return {results:sqlite.prepare(sql).all(...values)};},async run(){return sqlite.prepare(sql).run(...values);},sql,get values(){return values;}};},async batch(statements){sqlite.exec("BEGIN");try{const result=statements.map(s=>sqlite.prepare(s.sql).run(...s.values));sqlite.exec("COMMIT");return result;}catch(error){sqlite.exec("ROLLBACK");throw error;}}};
const now=Date.now();const daysAgo=days=>new Date(now-days*86400000).toISOString();
function insert(table,row){const keys=Object.keys(row);sqlite.prepare(`INSERT INTO ${table} (${keys.join(",")}) VALUES (${keys.map(()=>"?").join(",")})`).run(...Object.values(row));}
function ids(table){return sqlite.prepare(`SELECT id FROM ${table} ORDER BY id`).all().map(row=>row.id);}
function happening(id,state,expiry){
 insert("happenings",{id,title:"Synthetic retention fixture",body:"Synthetic",topic:"Other",public_location:"Fixture district",public_lat:43.65,public_lng:-70.26,location_precision:"aggregate",identity_visibility:"anonymous",review_state:state,created_at:daysAgo(60),retention_until:expiry});
 insert("claims",{id:"claim-"+id,happening_id:id,text:"Synthetic",status:"unverified",attribution:"Fixture",created_at:daysAgo(60)});
 insert("evidence",{id:"evidence-"+id,claim_id:"claim-"+id,evidence_type:"Fixture",relationship:"supports",provenance:"Synthetic source",review_state:"pending",submitted_at:daysAgo(60)});
 insert("moderation_decisions",{id:"decision-"+id,happening_id:id,decision:"hold",reason:"Fixture",moderator_fingerprint:"synthetic-fingerprint",created_at:daysAgo(60)});
 for(const [kind,target] of [["happening",id],["claim","claim-"+id],["evidence","evidence-"+id]])insert("moderation_reports",{id:`report-${kind}-${id}`,target_type:kind,target_id:target,reason:"privacy",details:"Synthetic",review_state:"pending",created_at:daysAgo(60)});
}
async function cleanup(){await handler.scheduled({cron:"0 * * * *"},{DB});}
try{
 happening("expired-pending","pending",daysAgo(1));happening("expired-flagged","flagged",daysAgo(1));
 for(const state of ["approved","cleared","held"])happening("keep-"+state,state,daysAgo(1));
 happening("keep-pending","pending",daysAgo(-1));
 for(const [id,age] of [["expired",3/24],["fresh",1/24]])insert("abuse_buckets",{actor_fingerprint:id,scope:"write",bucket_start:daysAgo(age),request_count:1,updated_at:daysAgo(age)});
 for(const [id,expiry] of [["expired",1],["fresh",-1]])insert("moderator_verification_events",{id,moderator_fingerprint:"fixture",verification_level:"token",created_at:daysAgo(2),expires_at:daysAgo(expiry)});
 for(const [id,status,age] of [["old-completed","completed",181],["old-released","released",181],["old-expired","expired",181],["old-claimed","claimed",181],["fresh-completed","completed",179]])insert("moderator_tasks",{id,task_type:"happening",target_id:"fixture",moderator_fingerprint:"fixture",status,claimed_at:daysAgo(age),completed_at:status==="completed"?daysAgo(age):null});
 for(const [id,age] of [["old",366],["fresh",364]])insert("moderator_quality_events",{id,decision_id:id,outcome:"upheld",basis:"Fixture",reviewer_fingerprint:"fixture",created_at:daysAgo(age)});
 await cleanup();
 const kept=["keep-approved","keep-cleared","keep-held","keep-pending"];
 assert.deepEqual(ids("happenings"),kept);
 for(const [table,prefix] of [["claims","claim-"],["evidence","evidence-"],["moderation_decisions","decision-"]])assert.deepEqual(ids(table),kept.map(id=>prefix+id));
 assert.equal(ids("moderation_reports").length,12);assert.equal(ids("moderation_reports").some(id=>id.includes("expired-")),false);
 assert.deepEqual(sqlite.prepare("SELECT actor_fingerprint FROM abuse_buckets").all().map(row=>row.actor_fingerprint),["fresh"]);
 assert.deepEqual(ids("moderator_verification_events"),["fresh"]);
 assert.deepEqual(ids("moderator_tasks"),["fresh-completed","old-claimed"]);
 assert.deepEqual(ids("moderator_quality_events"),["fresh"]);
 const audit=sqlite.prepare("SELECT * FROM privacy_deletion_audit").get();assert.equal(audit.scope,"retention");assert.equal(audit.deleted_happenings,2);assert.equal(audit.deleted_reputation_events,0);
 assert.deepEqual(Object.keys(audit).sort(),["created_at","deleted_happenings","deleted_reputation_events","id","scope"]);
 await cleanup();assert.equal(ids("privacy_deletion_audit").length,1,"repeated cleanup must not create duplicate deletion counts");
 assert.equal(sqlite.prepare("PRAGMA foreign_key_check").all().length,0);
 // Fail the last statement in the parent-cleanup batch after deletes have executed.
 happening("rollback","pending",daysAgo(1));
 sqlite.exec("CREATE TRIGGER reject_audit BEFORE INSERT ON privacy_deletion_audit BEGIN SELECT RAISE(ABORT,'synthetic audit failure'); END;");
 const tables=["happenings","claims","evidence","moderation_reports","moderation_decisions","privacy_deletion_audit"];
 const before=Object.fromEntries(tables.map(table=>[table,ids(table)]));
 await assert.rejects(cleanup,/synthetic audit failure/);
 for(const table of tables)assert.deepEqual(ids(table),before[table],table+" must roll back with audit failure");
 sqlite.exec("DROP TRIGGER reject_audit");await cleanup();assert.equal(ids("happenings").includes("rollback"),false);
 assert.equal(sqlite.prepare("SELECT SUM(deleted_happenings) AS total FROM privacy_deletion_audit").get().total,3);
 assert.equal(sqlite.prepare("PRAGMA foreign_key_check").all().length,0);
 await handler.scheduled({cron:"0 * * * *"},{});
 console.log("Retention SQLite smoke passed: migrated schema, expired pending/flagged cleanup, dependent records, preserved review states/future records, auxiliary retention windows, non-identifying audit counts, idempotency, foreign keys, rollback on audit failure, and retry. In-memory synthetic data only; not hosted D1 qualification.");
}finally{sqlite.close();}
