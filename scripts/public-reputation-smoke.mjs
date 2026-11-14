import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFile,readdir} from 'node:fs/promises';
import handler from '../dist/server/index.js';
const sqlite=new DatabaseSync(':memory:');
sqlite.exec('PRAGMA foreign_keys=ON');
for(const file of (await readdir('drizzle')).filter(n=>n.endsWith('.sql')).sort())sqlite.exec(await readFile('drizzle/'+file,'utf8'));
const DB={prepare(sql){let values=[];return {bind(...args){values=args;return this;},async first(){return sqlite.prepare(sql).get(...values)||null;},async all(){return {results:sqlite.prepare(sql).all(...values)};},async run(){return sqlite.prepare(sql).run(...values);}};}};
const env={DB},stamp=new Date().toISOString();
function report(id,title){
 sqlite.prepare("INSERT INTO happenings (id,title,body,topic,public_location,public_lat,public_lng,location_precision,identity_visibility,legitimacy_score,review_state,created_at,retention_until) VALUES (?,?,'Synthetic','fixture','district',43,-70,'aggregate','anonymous',40,'approved',?,?)").run(id,title,stamp,stamp);
 sqlite.prepare("INSERT INTO claims (id,happening_id,text,status,attribution,created_at) VALUES (?,?,'Synthetic','unverified','fixture',?)").run('claim-'+id,id,stamp);
}
function evidence(id,reportId){sqlite.prepare("INSERT INTO evidence (id,claim_id,evidence_type,relationship,provenance,review_state,submitted_at) VALUES (?,?,'Record','supports',?,'approved',?)").run(id,'claim-'+reportId,'https://example.invalid/'+id,stamp);}
async function read(time='all'){
 const response=await handler.fetch(new Request('https://public.test/api/happenings?time='+time),env);assert.equal(response.status,200);
 const text=await response.text();for(const secret of ['actor-private','owner-private','actor_fingerprint','owner_key'])assert.equal(text.includes(secret),false,secret);
 return JSON.parse(text).happenings;
}
const ledger=()=>sqlite.prepare('SELECT * FROM reputation_events ORDER BY id').all();
function event(id,target,actor,points=2,risk='normal'){
 sqlite.prepare("INSERT INTO reputation_events (id,actor_fingerprint,action_type,target_id,action_day,points_awarded,basis,risk_state,created_at,owner_key) VALUES (?,?,'evidence_useful',?,?,?,'Synthetic',?,?,?)").run(id,'actor-private-'+actor,target,stamp.slice(0,10),points,risk,stamp,'owner-private');
}
try{
 assert.deepEqual(await read(),[],'empty eligibility set must execute safely');
 report('h1','Shared story');report('h2','Shared story');report('h3','Other story');
 evidence('e:one','h1');evidence('e-two','h2');evidence('other','h3');
 let items=await read();const group=items.find(i=>i.title==='Shared story').id,otherGroup=items.find(i=>i.title==='Other story').id;
 event('r1',group+':e:one','a');event('r2',group+':e:one','b');event('r3',group+':e-two','a');
 event('held',group+':e:one','c',0,'coordination_review');event('zero',group+':e-two','d',0);
 event('missing',group+':not-there','e');event('mismatch',group+':other','f');event('wrong-group',otherGroup+':e-two','g');
 const original=ledger();
 async function expected(useful,actors,held,score,time='all'){
  const item=(await read(time)).find(i=>i.id===group);assert.ok(item);
  assert.equal(item.usefulEvidence,useful);assert.equal(item.independentAssessors,actors);assert.equal(item.coordinationReview,held);assert.equal(item.legitimacyScore,score);
  assert.deepEqual(ledger(),original,'public reads must preserve ledger history');return item;
 }
 await expected(3,2,true,50);
 // Distinct assessors are counted across evidence targets without double counting.
 assert.equal((await read()).find(i=>i.id===otherGroup).usefulEvidence,0,'a mismatched target cannot transfer points');
 for(const state of ['pending','flagged','held']){
  sqlite.prepare('UPDATE evidence SET review_state=? WHERE id=?').run(state,'e:one');await expected(1,1,false,49);
 }
 sqlite.prepare("UPDATE evidence SET review_state='cleared' WHERE id='e:one'").run();await expected(3,2,true,50);
 for(const state of ['pending','flagged','held']){
  sqlite.prepare('UPDATE happenings SET review_state=? WHERE id=?').run(state,'h1');await expected(1,1,false,49);
 }
 sqlite.prepare("UPDATE happenings SET review_state='cleared' WHERE id='h1'").run();await expected(3,2,true,50);
 for(const column of ['public_lat','public_lng']){
  sqlite.prepare('UPDATE happenings SET '+column+'=NULL WHERE id=?').run('h1');await expected(1,1,false,49);
  sqlite.prepare('UPDATE happenings SET '+column+'=? WHERE id=?').run(column==='public_lat'?43:-70,'h1');
 }
 for(const column of ['title','topic','public_location']){
  const old=sqlite.prepare('SELECT '+column+' AS value FROM happenings WHERE id=?').get('h1').value;
  sqlite.prepare('UPDATE happenings SET '+column+'=? WHERE id=?').run('Changed group','h1');await expected(1,1,false,49);
  const moved=(await read()).find(i=>i.evidence.some(e=>e.id==='e:one'));assert.equal(moved.usefulEvidence,0);assert.equal(moved.coordinationReview,false);
  sqlite.prepare('UPDATE happenings SET '+column+'=? WHERE id=?').run(old,'h1');
 }
 // Old reports do not influence a newer window merely because their group still exists there.
 sqlite.prepare('UPDATE happenings SET created_at=? WHERE id=?').run(new Date(Date.now()-4*86400000).toISOString(),'h1');
 await expected(1,1,false,49,'today');await expected(3,2,true,50,'all');
 sqlite.prepare('UPDATE happenings SET created_at=? WHERE id=?').run(stamp,'h1');
 sqlite.prepare('UPDATE evidence SET claim_id=? WHERE id=?').run('claim-h3','e:one');await expected(1,1,false,49);
 sqlite.prepare('UPDATE evidence SET claim_id=? WHERE id=?').run('claim-h1','e:one');await expected(3,2,true,50);
 sqlite.prepare('DELETE FROM evidence WHERE id=?').run('e:one');await expected(1,1,false,49);
 evidence('e:one','h1');await expected(3,2,true,50);
 // The query binds one bounded JSON eligibility set, including more than 100 targets.
 for(let i=0;i<110;i++)evidence('bulk-'+i,'h3');
 event('bulk-last',otherGroup+':bulk-109','last');const withBulk=ledger();
 const bulk=(await read()).find(i=>i.id===otherGroup);assert.equal(bulk.usefulEvidence,1);assert.equal(bulk.independentAssessors,1);assert.deepEqual(ledger(),withBulk);
 console.log('Public reputation smoke passed: eligible target binding, distinct assessors, held/zero points, private/missing/mismatched evidence, withdrawal/restoration, regrouping, pins, time windows, reassociation/deletion, large eligibility sets, unchanged private ledger. Synthetic SQLite only.');
}finally{sqlite.close();}
