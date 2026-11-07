import assert from "node:assert/strict";
import {DatabaseSync} from "node:sqlite";
import {readFile,readdir} from "node:fs/promises";
import handler from "../dist/server/index.js";
const sqlite=new DatabaseSync(":memory:");sqlite.exec("PRAGMA foreign_keys=ON");
for(const file of (await readdir(new URL("../drizzle/",import.meta.url))).filter(name=>name.endsWith(".sql")).sort())sqlite.exec(await readFile(new URL(`../drizzle/${file}`,import.meta.url),"utf8"));
let raceHook=null;
function injectRace(phase,sql){ if(raceHook && raceHook.phase===phase && raceHook.match.test(sql)){const action=raceHook.action;raceHook=null;action();} }
const DB={prepare(sql){let values=[];return {bind(...args){values=args;return this;},async first(){injectRace("beforeRead",sql);return sqlite.prepare(sql).get(...values)||null;},async all(){return {results:sqlite.prepare(sql).all(...values)};},async run(){injectRace("beforeWrite",sql);return sqlite.prepare(sql).run(...values);},sql,get values(){return values;}};},async batch(statements){sqlite.exec("BEGIN");try{const result=statements.map(s=>sqlite.prepare(s.sql).run(...s.values));sqlite.exec("COMMIT");return result;}catch(error){sqlite.exec("ROLLBACK");throw error;}}};
const env={DB,LEGIT_ABUSE_HMAC_SECRET:"synthetic-abuse-secret",LEGIT_OWNER_HMAC_SECRET:"synthetic-owner-secret"};
const origin="https://legit.test";let actor=0;const pending=[];
async function request(path,user,body,envOverride={}){
 const headers={accept:"application/json","CF-Connecting-IP":"fixture-"+(actor++)};if(user)headers["oai-authenticated-user-id"]=user;
 if(body){headers.origin=origin;headers["content-type"]="application/json";}
 const response=await handler.fetch(new Request(origin+path,{method:body?"POST":"GET",headers,body:body?JSON.stringify(body):undefined}),{...env,...envOverride},{waitUntil(p){pending.push(p);}});
 await Promise.allSettled(pending.splice(0));assert.equal(response.headers.get("cache-control"),"no-store");
 return {response,data:await response.json()};
}
const submit=(user,details,extra={})=>request('/api/profile/privacy',user,{action:'correction_request',details,...extra});
const rows=()=>sqlite.prepare('SELECT * FROM privacy_requests ORDER BY created_at,id').all();
try{
 const text='Synthetic correction for the timeline';
 const first=await submit('synthetic-a',text);assert.equal(first.response.status,202);assert.equal(rows().length,1);
 const original=rows()[0];
 const retry=await submit('synthetic-a','  '+text+'  ');assert.equal(retry.response.status,202);assert.deepEqual(retry.data.request,first.data.request);assert.equal(rows().length,1);
 const simultaneous=await Promise.all(Array.from({length:6},()=>submit('synthetic-a',text)));
 for(const result of simultaneous){assert.equal(result.response.status,202);assert.deepEqual(result.data.request,first.data.request);}
 assert.equal(rows().length,1,'overlapping retries must reuse one pending row');assert.deepEqual(rows()[0],original);
 const other=await submit('synthetic-b',text,{owner_key:original.owner_key});assert.equal(other.response.status,202);assert.equal(rows().length,2);assert.equal(new Set(rows().map(r=>r.owner_key)).size,2,'authenticated owner determines isolation');
 const changed=await submit('synthetic-a',text+' with different evidence');assert.equal(changed.response.status,202);assert.equal(rows().length,3);
 sqlite.prepare("UPDATE privacy_requests SET status='resolved' WHERE id=?").run(original.id);
 const afterResolution=await submit('synthetic-a',text);assert.equal(afterResolution.response.status,202);assert.equal(rows().length,4,'resolved requests must not suppress new corrections');assert.equal(rows().find(r=>r.id===original.id).status,'resolved');
 // Historical duplicate pending rows remain untouched; retries return their earliest timestamp.
 const earliest='2026-01-01T00:00:00.000Z';sqlite.prepare('INSERT INTO privacy_requests (id,owner_key,request_type,details,status,created_at) VALUES (?,?,?,?,?,?)').run('historical-duplicate',original.owner_key,'correction',text,'pending',earliest);
 const before=rows();const historical=await submit('synthetic-a',text);assert.equal(historical.data.request.createdAt,earliest);assert.deepEqual(rows(),before);
 const denied=await submit(null,text,{owner_key:original.owner_key});assert.equal(denied.response.status,401);assert.deepEqual(rows(),before);
 const invalid=await submit('synthetic-a','  ');assert.equal(invalid.response.status,400);assert.deepEqual(rows(),before);
 const exported=await request('/api/profile/privacy/export','synthetic-a');assert.equal(exported.response.status,200);assert.equal(exported.data.privacyRequests.length,4);const serialized=JSON.stringify(exported.data);assert.equal(serialized.includes(original.owner_key),false);
 // An insert failure creates nothing, and a later retry still deduplicates correctly.
 sqlite.exec("CREATE TRIGGER reject_correction BEFORE INSERT ON privacy_requests WHEN NEW.details='Synthetic failure' BEGIN SELECT RAISE(ABORT,'synthetic insert failure'); END;");
 const failed=await submit('synthetic-a','Synthetic failure');assert.notEqual(failed.response.status,202);assert.deepEqual(rows(),before);
 sqlite.exec('DROP TRIGGER reject_correction');assert.equal((await submit('synthetic-a','Synthetic failure')).response.status,202);assert.equal(rows().length,before.length+1);
 assert.equal((await submit('synthetic-a','Synthetic failure')).response.status,202);assert.equal(rows().length,before.length+1);

 // Inject resolution at exact SQL boundaries to model separate request interleavings.
 const pendingRead=/^SELECT created_at FROM privacy_requests/;
 const correctionWrite=/^INSERT INTO privacy_requests/;
 const resolveText=details=>sqlite.prepare("UPDATE privacy_requests SET status='resolved' WHERE owner_key=? AND details=?").run(original.owner_key,details);
 for(const isNew of [false,true]){
  const details='Synthetic resolution between statements '+isNew;
  if(!isNew)assert.equal((await submit('synthetic-a',details)).response.status,202);
  const countBefore=rows().length;
  raceHook={phase:'beforeRead',match:pendingRead,action:()=>resolveText(details)};
  const raced=await submit('synthetic-a',details);assert.equal(raceHook,null,'resolution hook executed');
  assert.equal(raced.response.status,400);assert.match(raced.data.error,/status changed/);assert.equal(raced.data.request,undefined,'must not claim a resolved correction is pending');
  const matching=rows().filter(r=>r.owner_key===original.owner_key&&r.details===details);assert.equal(matching.length,1);assert.equal(matching[0].status,'resolved');assert.equal(rows().length,countBefore+(isNew?1:0),'no hidden resubmission');
  const retried=await submit('synthetic-a',details);assert.equal(retried.response.status,202);assert.equal(rows().filter(r=>r.owner_key===original.owner_key&&r.details===details&&r.status==='pending').length,1);
 }
 const early='Synthetic resolved before conditional insert';await submit('synthetic-a',early);
 raceHook={phase:'beforeWrite',match:correctionWrite,action:()=>resolveText(early)};
 assert.equal((await submit('synthetic-a',early)).response.status,202);assert.equal(raceHook,null);
 assert.deepEqual(rows().filter(r=>r.owner_key===original.owner_key&&r.details===early).map(r=>r.status).sort(),['pending','resolved']);
 // Deletion between statements must not silently recreate profile-linked records.
 const removed='Synthetic record disappears before lookup';await submit('synthetic-a',removed);
 raceHook={phase:'beforeRead',match:pendingRead,action:()=>sqlite.prepare('DELETE FROM privacy_requests WHERE owner_key=? AND details=?').run(original.owner_key,removed)};
 const vanished=await submit('synthetic-a',removed);assert.equal(vanished.response.status,400);assert.equal(raceHook,null);assert.equal(rows().some(r=>r.owner_key===original.owner_key&&r.details===removed),false);
 // Resolving only the earliest historical duplicate selects the remaining pending row.
 const duplicate='Synthetic duplicate resolution';await submit('synthetic-a',duplicate);
 sqlite.prepare('INSERT INTO privacy_requests (id,owner_key,request_type,details,status,created_at) VALUES (?,?,?,?,?,?)').run('race-historical',original.owner_key,'correction',duplicate,'pending','2025-01-01T00:00:00.000Z');
 const survivor=rows().find(r=>r.owner_key===original.owner_key&&r.details===duplicate&&r.id!=='race-historical');
 raceHook={phase:'beforeRead',match:pendingRead,action:()=>sqlite.prepare("UPDATE privacy_requests SET status='resolved' WHERE id='race-historical'").run()};
 const remaining=await submit('synthetic-a',duplicate);assert.equal(remaining.response.status,202);assert.equal(remaining.data.request.createdAt,survivor.created_at);assert.equal(rows().filter(r=>r.owner_key===original.owner_key&&r.details===duplicate).length,2);
 const otherRows=rows().filter(r=>r.owner_key!==original.owner_key);assert.equal(otherRows.length,1);assert.equal(otherRows[0].details,text);assert.equal(otherRows[0].status,'pending');
 assert.equal(sqlite.prepare('PRAGMA foreign_key_check').all().length,0);
 console.log('Correction deduplication smoke passed: actual migrations/routes, atomic overlapping retries, sanitized-text matching, owner isolation/spoof rejection, changed/resolved requests, preserved historical duplicates, export privacy, failure/retry, and deterministic resolution/deletion interleavings. In-memory SQLite only; no production writes.');
}finally{await Promise.allSettled(pending);sqlite.close();}
