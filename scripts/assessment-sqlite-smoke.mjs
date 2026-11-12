import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFile,readdir} from 'node:fs/promises';
import handler from '../dist/server/index.js';
const sqlite=new DatabaseSync(':memory:');
for(const file of (await readdir('drizzle')).filter(n=>n.endsWith('.sql')).sort())sqlite.exec(await readFile('drizzle/'+file,'utf8'));
let beforeWrite=null;
const DB={prepare(sql){let values=[];return {bind(...args){values=args;return this;},async first(){if(/INSERT INTO reputation_events/.test(sql)&&beforeWrite){const action=beforeWrite;beforeWrite=null;await action();}return sqlite.prepare(sql).get(...values)||null;},async all(){return {results:sqlite.prepare(sql).all(...values)};},async run(){return sqlite.prepare(sql).run(...values);}};}};
const env={DB,LEGIT_ABUSE_HMAC_SECRET:'synthetic-assessment-secret',LEGIT_OWNER_HMAC_SECRET:'synthetic-owner-secret'};
const origin='https://assessment.test';
async function assess(actor,target,extra={}){
 const response=await handler.fetch(new Request(origin+'/api/reputation/assessment',{method:'POST',headers:{origin,'content-type':'application/json','CF-Connecting-IP':actor,'user-agent':'synthetic'},body:JSON.stringify({actionType:'evidence_useful',targetId:target,...extra})}),env);
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
 for(let i=0;i<3;i++)sqlite.prepare("INSERT INTO reputation_events (id,actor_fingerprint,action_type,target_id,action_day,points_awarded,basis,created_at,risk_state,owner_key) SELECT ?,actor_fingerprint,action_type,?,action_day,1,basis,created_at,risk_state,owner_key FROM reputation_events WHERE target_id='public-day-seed:e1'").run('daily-seed-'+i,'public-seed-'+i+':e1');
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
 await assess('rollover','public-yesterday:e1');sqlite.prepare("UPDATE reputation_events SET action_day='2000-01-01' WHERE target_id='public-yesterday:e1'").run();assert.equal((await assess('rollover','public-today:e1')).pointsAwarded,2);assert.equal((await assess('rollover','public-yesterday:e1')).accepted,false);
 const before=rows().length;sqlite.exec("CREATE TRIGGER fail_assessment BEFORE INSERT ON reputation_events WHEN NEW.target_id='public-failure:e1' BEGIN SELECT RAISE(ABORT,'synthetic failure'); END");
 const failed=await handler.fetch(new Request(origin+'/api/reputation/assessment',{method:'POST',headers:{origin,'content-type':'application/json','CF-Connecting-IP':'failure'},body:JSON.stringify({actionType:'evidence_useful',targetId:'public-failure:e1'})}),env);assert.equal(failed.status,400);assert.equal((await failed.json()).assessment,undefined);assert.equal(rows().length,before);
 sqlite.exec('DROP TRIGGER fail_assessment');assert.equal((await assess('failure','public-failure:e1')).accepted,true);
 for(const row of rows()){assert.equal(row.owner_key,null);assert.equal(row.actor_fingerprint.length,32);assert.equal(row.actor_fingerprint.includes('burst-'),false);}
 console.log('Assessment SQLite smoke passed: overlapping target/story retries, daily cap and decay, literal prefixes, coordination snapshot and write-boundary races, rollover, insert failure, anonymous storage. Synthetic SQLite only.');
}finally{sqlite.close();}
