import assert from "node:assert/strict";
import {DatabaseSync} from "node:sqlite";
import {readFile,readdir} from "node:fs/promises";
import handler from "../dist/server/index.js";

// Exercise actual Worker SQL against canonical migrations; this adapter only maps D1 methods.
const sqlite=new DatabaseSync(":memory:");
sqlite.exec("PRAGMA foreign_keys=ON");
for(const file of (await readdir(new URL("../drizzle/",import.meta.url))).filter(name=>name.endsWith(".sql")).sort()) sqlite.exec(await readFile(new URL(`../drizzle/${file}`,import.meta.url),"utf8"));
const DB={prepare(sql){let values=[];return {bind(...args){values=args;return this;},async first(){return sqlite.prepare(sql).get(...values) || null;},async all(){return {results:sqlite.prepare(sql).all(...values)};},async run(){return sqlite.prepare(sql).run(...values);},sql,get values(){return values;}};},async batch(statements){sqlite.exec("BEGIN");try{const results=statements.map(s=>sqlite.prepare(s.sql).run(...s.values));sqlite.exec("COMMIT");return results;}catch(error){sqlite.exec("ROLLBACK");throw error;}}};
const env={DB,LEGIT_ABUSE_HMAC_SECRET:"sqlite-fixture-abuse",LEGIT_OWNER_HMAC_SECRET:"sqlite-fixture-owner"};
const origin="https://legit.test";let actor=0;const pending=[];
const ctx={waitUntil(p){pending.push(p);}};
async function submit(title,{state="pending",days=0,sensitive=false,...extra}={}){
 const response=await handler.fetch(new Request(origin+"/api/happenings",{method:"POST",headers:{origin,"content-type":"application/json","CF-Connecting-IP":"fixture-"+(actor++)},body:JSON.stringify({title,body:"Synthetic report",location:"Fixture district",lat:43.651234,lng:-70.261234,sensitive,source:"https://example.invalid/public?private=removed",...extra})}),env,ctx);
 const data=await response.json();assert.equal(response.status,202,JSON.stringify(data));
 const id=data.happening.id;
 sqlite.prepare("UPDATE happenings SET review_state=?,created_at=? WHERE id=?").run(state,new Date(Date.now()-days*86400000).toISOString(),id);
 return {id,data};
}
async function publicRead(window="all"){
 const response=await handler.fetch(new Request(`${origin}/api/happenings?time=${window}`),env,ctx);assert.equal(response.status,200);
 return {response,...await response.json()};
}
try{
 // Sensitive path must satisfy the real schema, not merely a recording mock.
 const sensitive=await submit("Private sensitive sentinel",{sensitive:true,state:"approved",identityVisibility:"attributed",displayIdentity:"Private person sentinel"});
 assert.equal(sensitive.data.happening.publicLat,null);assert.equal(sensitive.data.happening.publicLng,null);
 const stored=sqlite.prepare("SELECT public_lat,public_lng,location_precision FROM happenings WHERE id=?").get(sensitive.id);
 assert.equal(stored.public_lat,null);assert.equal(stored.public_lng,null);assert.equal(stored.location_precision,"aggregate");
 await submit("Private pending sentinel");await submit("Private flagged sentinel",{state:"flagged"});await submit("Private held sentinel",{state:"held"});
 await submit("Private nullpin sentinel",{state:"approved",lat:null,lng:null});
 await submit("Private partialpin sentinel",{state:"cleared",lng:null});
 const first=await submit("Shared approved story",{state:"approved",balance:"left",identityVisibility:"attributed",displayIdentity:"Private author sentinel"});
 const second=await submit("Shared approved story",{state:"cleared",balance:"right"});
 const yesterday=await submit("Yesterday story",{state:"approved",days:1.5});
 await submit("Week story",{state:"approved",days:4});await submit("Month story",{state:"approved",days:15});await submit("Year story",{state:"approved",days:100});await submit("Archive story",{state:"approved",days:400});
 // Approved evidence on private reports still cannot escape the happenings join.
 sqlite.exec("UPDATE evidence SET review_state='approved'");
 sqlite.prepare("INSERT INTO evidence (id,claim_id,evidence_type,relationship,provenance,review_state,submitted_at) VALUES (?,?,?,?,?,?,?)").run("private-evidence","claim-"+first.id,"Private evidence sentinel","supports","https://example.invalid/private-evidence","pending",new Date().toISOString());
 const initial=await publicRead();assert.equal(initial.happenings.length,6);
 const shared=initial.happenings.find(h=>h.title==="Shared approved story");assert.equal(shared.reports,2);assert.equal(shared.balance,"agnostic");assert.equal(shared.evidence.length,2);assert.equal(shared.sourceCount,1);
 assert.equal(shared.publicLat,43.651);assert.equal(shared.publicLng,-70.261);
 for(const state of ["approved","pending","rejected"]) sqlite.prepare("INSERT INTO correction_history (id,history_type,public_story_id,summary,review_state,created_at) VALUES (?,?,?,?,?,?)").run("correction-"+state,"correction",shared.id,state==="approved"?"Public correction":"Private correction sentinel",state,new Date().toISOString());
 sqlite.prepare("INSERT INTO correction_history (id,history_type,public_story_id,summary,review_state,created_at) VALUES (?,?,?,?,?,?)").run("orphan","correction","not-visible","Orphan correction sentinel","approved",new Date().toISOString());
 const published=await publicRead();const serialized=JSON.stringify(published.happenings);
 for(const forbidden of ["Private ","Orphan correction sentinel","identity_display","owner_key","43.651234","-70.261234","private=removed"])assert.equal(serialized.includes(forbidden),false,forbidden);
 assert.deepEqual(published.happenings.find(h=>h.id===shared.id).corrections.map(c=>c.summary),["Public correction"]);
 const expected={today:1,yesterday:1,week:3,month:4,year:5,all:6};
 for(const [window,count] of Object.entries(expected)){const result=await publicRead(window);assert.equal(result.window,window);assert.equal(result.happenings.length,count,window);}
 assert.equal((await publicRead("yesterday")).happenings[0].title,"Yesterday story");
 // Withdrawal and removal of a pin exclude the report and its approved evidence immediately.
 sqlite.prepare("UPDATE happenings SET review_state='flagged' WHERE id IN (?,?)").run(first.id,second.id);
 const withdrawn=await publicRead();assert.equal(withdrawn.happenings.some(h=>h.id===shared.id),false);
 sqlite.prepare("UPDATE happenings SET public_lat=NULL WHERE id=?").run(yesterday.id);
 assert.equal((await publicRead("yesterday")).happenings.length,0);
 // Foreign keys are active; the adapter does not simply echo handpicked rows.
 assert.throws(()=>sqlite.prepare("INSERT INTO claims (id,happening_id,text,status,attribution,created_at) VALUES ('bad','missing','x','unverified','fixture','now')").run(),/FOREIGN KEY/);
 console.log("SQLite privacy smoke passed: all migrations, real submission storage, sensitive/null/partial pin exclusion, review-state and evidence joins, correction visibility, aggregation, all time windows, withdrawals, and foreign-key enforcement. In-memory SQLite only; not Cloudflare D1 qualification.");
}finally{await Promise.allSettled(pending);sqlite.close();}
