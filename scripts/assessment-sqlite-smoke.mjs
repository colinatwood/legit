import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {readFile,readdir} from 'node:fs/promises';
import handler from '../dist/server/index.js';
const sqlite=new DatabaseSync(':memory:');
for(const file of (await readdir('drizzle')).filter(n=>n.endsWith('.sql')).sort())sqlite.exec(await readFile('drizzle/'+file,'utf8'));
let beforeWrite=null;
const DB={prepare(sql){let values=[];return {bind(...args){values=args;return this;},async first(){if(/INSERT INTO reputation_events/.test(sql)&&beforeWrite){const action=beforeWrite;beforeWrite=null;await action();}return sqlite.prepare(sql).get(...values)||null;},async all(){return {results:sqlite.prepare(sql).all(...values)};},async run(){return sqlite.prepare(sql).run(...values);}};}};
const env={DB,LEGIT_ABUSE_HMAC_SECRET:'synthetic-assessment-secret',LEGIT_OWNER_HMAC_SECRET:'synthetic-owner-secret'};
const origin='https://assessment.test';
const fixtureTargets=new Map();
function fixtureTarget(symbol){
 if(fixtureTargets.has(symbol))return fixtureTargets.get(symbol);
 const story=symbol.split(':')[0],stamp=new Date().toISOString();
 if(!sqlite.prepare('SELECT id FROM happenings WHERE id=?').get(story)){
  sqlite.prepare("INSERT INTO happenings (id,title,body,topic,public_location,public_lat,public_lng,location_precision,identity_visibility,review_state,created_at,retention_until) VALUES (?,?,?,'fixture','district',43,-70,'aggregate','anonymous','approved',?,?)").run(story,story,'Synthetic',stamp,stamp);
  sqlite.prepare("INSERT INTO claims (id,happening_id,text,status,attribution,created_at) VALUES (?,?,'Synthetic','unverified','fixture',?)").run('claim-'+story,story,stamp);
 }
 sqlite.prepare("INSERT INTO evidence (id,claim_id,evidence_type,relationship,provenance,review_state,submitted_at) VALUES (?,?,'Source','supports','https://example.invalid','approved',?)").run(symbol,'claim-'+story,stamp);
 const label=v=>v.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().slice(0,180);
 const title=label(story).replace(/\b(?:question|update|report|reports|anyone know|is)\b/g,' ').replace(/\s+/g,' ').trim().slice(0,180);
 const key=createHash('sha256').update('legit-public-group-v2|district|fixture|'+title).digest('hex').slice(0,24);
 const target='public-'+key+':'+symbol;fixtureTargets.set(symbol,target);return target;
}
async function assess(actor,target,extra={}){
 const response=await handler.fetch(new Request(origin+'/api/reputation/assessment',{method:'POST',headers:{origin,'content-type':'application/json','CF-Connecting-IP':actor,'user-agent':'synthetic'},body:JSON.stringify({actionType:'evidence_useful',targetId:fixtureTarget(target),...extra})}),env);
 const data=await response.json();assert.equal(response.status,202,JSON.stringify(data));assert.equal(response.headers.get('cache-control'),'no-store');return data.assessment;
}
const rows=()=>sqlite.prepare('SELECT * FROM reputation_events').all();
try{
 const first=await assess('repeat','public-repeat:e1');assert.equal(first.pointsAwarded,2);assert.equal(first.riskState,'normal');
 assert.equal((await assess('repeat','public-repeat:e1')).reason,'Already counted');assert.equal((await assess('repeat','public-repeat:e2')).reason,'Already counted for this story');assert.equal(rows().length,1);
 // All requests begin together. Read-then-write implementations race here.
 const same=await Promise.all(Array.from({length:8},(_,i)=>assess('overlap-story','public-overlap:e'+i)));
 assert.equal(same.filter(r=>r.accepted).length,1);assert.equal(same.reduce((n,r)=>n+r.pointsAwarded,0),2);
 const duplicates=await Promise.all(Array.from({length:6},()=>assess('overlap-target','public-duplicate:e1')));assert.equal(duplicates.filter(r=>r.accepted).length,1);
 await assess('daily','public-day-seed:e1');
 for(let i=0;i<3;i++)sqlite.prepare("INSERT INTO reputation_events (id,actor_fingerprint,action_type,target_id,action_day,points_awarded,basis,created_at,risk_state,owner_key) SELECT ?,actor_fingerprint,action_type,?,action_day,1,basis,created_at,risk_state,owner_key FROM reputation_events WHERE target_id=?").run('daily-seed-'+i,fixtureTarget('public-seed-'+i+':e1'),fixtureTarget('public-day-seed:e1'));
 const capped=await Promise.all(Array.from({length:7},(_,i)=>assess('daily','public-day-'+i+':e1')));
 assert.equal(capped.filter(r=>r.accepted).length,6);assert.equal(capped.reduce((n,r)=>n+r.pointsAwarded,0),6);assert.equal(capped.filter(r=>!r.accepted).every(r=>r.reason==='Daily assessment limit reached'),true);
 // Literal story prefixes: underscores and percent signs must not act as LIKE wildcards.
 for(const actor of ['literal-percent','literal-underscore']){
  const mark=actor.endsWith('percent')?'%':'_';assert.equal((await assess(actor,'public-a'+mark+':one')).accepted,true);assert.equal((await assess(actor,'public-ab:two')).accepted,true);
 }
 const burst=await Promise.all(Array.from({length:6},(_,i)=>assess('burst-'+i,'public-burst:e'+i)));
 assert.deepEqual(burst.map(r=>r.pointsAwarded).sort(),[0,0,0,2,2,2]);assert.equal(burst.filter(r=>r.pointsAwarded===0).every(r=>r.riskState==='coordination_review'),true);
 // Another write lands exactly before the current INSERT snapshot.
 await assess('boundary-1','public-boundary:e1');await assess('boundary-2','public-boundary:e2');
 beforeWrite=()=>assess('boundary-3','public-boundary:e3');const held=await assess('boundary-4','public-boundary:e4');assert.equal(beforeWrite,null);assert.equal(held.pointsAwarded,0);assert.equal(held.riskState,'coordination_review');
 beforeWrite=()=>assess('boundary-story','public-boundary-story:other');const lost=await assess('boundary-story','public-boundary-story:original');assert.equal(lost.accepted,false);assert.equal(lost.pointsAwarded,0);
 // Day rollover permits new stories while preserving lifetime duplicate protection.
 await assess('rollover','public-yesterday:e1');sqlite.prepare("UPDATE reputation_events SET action_day='2000-01-01' WHERE target_id=?").run(fixtureTarget('public-yesterday:e1'));assert.equal((await assess('rollover','public-today:e1')).pointsAwarded,2);assert.equal((await assess('rollover','public-yesterday:e1')).accepted,false);
 const before=rows().length;sqlite.exec(`CREATE TRIGGER fail_assessment BEFORE INSERT ON reputation_events WHEN NEW.target_id='${fixtureTarget('public-failure:e1')}' BEGIN SELECT RAISE(ABORT,'synthetic failure'); END`);
 const failed=await handler.fetch(new Request(origin+'/api/reputation/assessment',{method:'POST',headers:{origin,'content-type':'application/json','CF-Connecting-IP':'failure'},body:JSON.stringify({actionType:'evidence_useful',targetId:fixtureTarget('public-failure:e1')})}),env);assert.equal(failed.status,400);assert.equal((await failed.json()).assessment,undefined);assert.equal(rows().length,before);
 sqlite.exec('DROP TRIGGER fail_assessment');assert.equal((await assess('failure','public-failure:e1')).accepted,true);
 // Eligibility uses the same group identity as the public response, not a caller's story claim.
 const publicResponse=await handler.fetch(new Request(origin+'/api/happenings?time=all'),env);
 assert.equal(publicResponse.status,200);const publicItems=(await publicResponse.json()).happenings;
 const shown=publicItems.find(item=>item.evidence.some(e=>e.id==='public-repeat:e1'));
 assert.equal(shown.id+':public-repeat:e1',fixtureTarget('public-repeat:e1'));
 let rejectedActor=0;
 async function rejected(target){
  const count=rows().length;
  const response=await handler.fetch(new Request(origin+'/api/reputation/assessment',{method:'POST',headers:{origin,'content-type':'application/json','CF-Connecting-IP':'eligibility-'+rejectedActor++},body:JSON.stringify({actionType:'evidence_useful',targetId:target,pointsAwarded:99,reviewState:'approved'})}),env);
  assert.equal(response.status,202);const data=await response.json();
  assert.deepEqual(data,{ok:true,assessment:{accepted:false,pointsAwarded:0,reason:'Evidence is not available for assessment'}});
  assert.equal(rows().length,count,'ineligible evidence must not add ledger rows');
 }
 await rejected('invented');await rejected('public-fake:e1');await rejected(shown.id+':missing');
 const other=fixtureTarget('public-wrong-group:e1');await rejected(shown.id+':public-wrong-group:e1');
 for(const state of ['pending','flagged','held']){
  const symbol='public-evidence-'+state+':e1',target=fixtureTarget(symbol);
  sqlite.prepare('UPDATE evidence SET review_state=? WHERE id=?').run(state,symbol);await rejected(target);
  const story='public-story-'+state,symbol2=story+':e1',target2=fixtureTarget(symbol2);
  sqlite.prepare('UPDATE happenings SET review_state=? WHERE id=?').run(state,story);await rejected(target2);
 }
 for(const column of ['public_lat','public_lng']){
  const story='public-hidden-'+column,target=fixtureTarget(story+':e1');sqlite.prepare('UPDATE happenings SET '+column+'=NULL WHERE id=?').run(story);await rejected(target);
 }
 // Review, grouping, pin, association, or deletion can change after lookup; the INSERT must recheck.
 for(const mutation of ['evidence','story','title','topic','location','pin','association','removed']){
  const story='public-race-'+mutation,symbol=story+':e1',target=fixtureTarget(symbol);
  beforeWrite=()=>{
   if(mutation==='evidence')sqlite.prepare("UPDATE evidence SET review_state='flagged' WHERE id=?").run(symbol);
   else if(mutation==='story')sqlite.prepare("UPDATE happenings SET review_state='held' WHERE id=?").run(story);
   else if(mutation==='removed')sqlite.prepare('DELETE FROM evidence WHERE id=?').run(symbol);
   else if(mutation==='association')sqlite.prepare('UPDATE evidence SET claim_id=? WHERE id=?').run('claim-public-wrong-group',symbol);
   else {const column={title:'title',topic:'topic',location:'public_location',pin:'public_lat'}[mutation];sqlite.prepare('UPDATE happenings SET '+column+'=? WHERE id=?').run(mutation==='pin'?null:'Changed group',story);}
  };
  await rejected(target);assert.equal(beforeWrite,null);
 }
 // Historical ledgers are preserved, including points recorded before evidence withdrawal.
 const historic=rows().find(row=>row.target_id===fixtureTarget('public-repeat:e1'));
 sqlite.prepare("UPDATE evidence SET review_state='flagged' WHERE id='public-repeat:e1'").run();await rejected(historic.target_id);
 assert.deepEqual(rows().find(row=>row.id===historic.id),historic);
 for(const row of rows()){assert.equal(row.owner_key,null);assert.equal(row.actor_fingerprint.length,32);assert.equal(row.actor_fingerprint.includes('burst-'),false);}
 console.log('Assessment SQLite smoke passed: overlapping target/story retries, daily cap and decay, literal prefixes, coordination snapshot and write-boundary races, rollover, insert failure, public group binding, private/missing evidence rejection, withdrawal/regrouping races, preserved history, anonymous storage. Synthetic SQLite only.');
}finally{sqlite.close();}
