import assert from "node:assert/strict";
import handler from "../dist/server/index.js";
const origin="https://legit.test";
const writes=[];const reads=[];
const db={prepare(sql){const statement={sql,values:[],bind(...values){this.values=values;return this;},first:async()=>sql.includes("RETURNING request_count") ? {request_count:1} : {total:0},run:async()=>({success:true}),all:async()=>{reads.push(sql);return {results:[]};}};return statement;},batch:async statements=>{writes.push(...statements.filter(s=>s.sql.startsWith("INSERT INTO")));return [];}};
const env={DB:db,LEGIT_ABUSE_HMAC_SECRET:"synthetic-abuse-secret",LEGIT_OWNER_HMAC_SECRET:"synthetic-owner-secret"};
let actor=0;
const base={title:"Synthetic signal",body:"Synthetic observation",location:"Example neighborhood",lat:43.651234,lng:-70.261234};
async function post(input,extraEnv={},headers={}){
 const start=writes.length;
 const response=await handler.fetch(new Request(origin+"/api/happenings",{method:"POST",headers:{origin,"content-type":"application/json","CF-Connecting-IP":"synthetic-actor-"+(actor++),...headers},body:JSON.stringify(input)}),{...env,...extraEnv});
 const body=await response.json();
 const inserted=writes.slice(start);
 const row=inserted.find(s=>s.sql.startsWith("INSERT INTO happenings"));
 let happening;
 if(row){const columns=row.sql.match(/\(([^)]+)\) VALUES/)[1].split(",");happening=Object.fromEntries(columns.map((name,index)=>[name,row.values[index]]));}
 return {response,body,inserted,happening};
}
// Inspect prepared durable values, not just the small response returned to the browser.
const scrubbed=await post({...base,title:"Call 202-555-0147",body:"Email fixture@example.invalid at 123 Example Street",location:"123 Example Street",source:"https://user:password@example.invalid/record?secret=fixture#private",displayIdentity:"Unrequested name",owner_key:"spoof-owner",reviewState:"approved",legitimacyScore:100,attachments:[{bytes:"raw-media-sentinel"}],extra:"discard-me"});
assert.equal(scrubbed.response.status,202);
assert.equal(scrubbed.happening.identity_visibility,"anonymous");assert.equal(scrubbed.happening.identity_display,null);assert.equal(scrubbed.happening.owner_key,null);
assert.equal(scrubbed.happening.review_state,"pending");assert.equal(scrubbed.happening.legitimacy_score,0);assert.equal(scrubbed.happening.attachment_state,"private_review");
assert.equal(scrubbed.happening.public_lat,43.651);assert.equal(scrubbed.happening.public_lng,-70.261);
const stored=JSON.stringify(scrubbed.inserted.map(s=>s.values));
for(const raw of ["202-555-0147","fixture@example.invalid","123 Example Street","user:password","secret=fixture","#private","raw-media-sentinel","discard-me","spoof-owner","43.651234","-70.261234"]) assert.equal(stored.includes(raw),false,raw);
assert.match(stored,/phone removed/);assert.match(stored,/email removed/);assert.match(stored,/address removed/);
assert.ok(scrubbed.inserted.some(s=>s.sql.startsWith("INSERT INTO evidence") && s.values.includes("https://example.invalid/record")));
for(const source of ["https://[invalid]?secret=fixture", "javascript:private-token", "data:text/plain,private-token", "//user:password@example.invalid/private?secret=fixture"]){
 const r=await post({...base,source});assert.equal(r.response.status,202);assert.equal(r.inserted.some(s=>s.sql.startsWith("INSERT INTO evidence")),false,source);
}
const described=await post({...base,source:"Observed fixture@example.invalid near 123 Example Street"});
assert.equal(JSON.stringify(described.inserted.map(s=>s.values)).includes("fixture@example.invalid"),false);
// Sensitive reports never persist or return a map pin, including attributed reports.
for(const identityVisibility of [undefined,"attributed"]){
 const r=await post({...base,sensitive:true,identityVisibility,displayIdentity:"Synthetic contributor"});
 assert.equal(r.response.status,202);
 for(const value of [r.happening.public_lat,r.happening.public_lng,r.body.happening.publicLat,r.body.happening.publicLng]) assert.equal(value,null);
 assert.equal(r.happening.location_precision,"aggregate-sensitive-no-pin");
}
// Null/blank/boolean/container coordinates must not be coerced into a pin at zero.
for(const invalid of [null,"", "   ",false,true,[],[1],{},"NaN"]){
 const r=await post({...base,lat:invalid,lng:invalid});assert.equal(r.response.status,202);
 assert.equal(r.happening.public_lat,null,JSON.stringify(invalid));assert.equal(r.happening.public_lng,null,JSON.stringify(invalid));
}
for(const [lat,lng] of [[91,181],[-91,-181]]){const r=await post({...base,lat,lng});assert.equal(r.happening.public_lat,null);assert.equal(r.happening.public_lng,null);}
const zero=await post({...base,lat:0,lng:0});assert.equal(zero.happening.public_lat,0);assert.equal(zero.happening.public_lng,0);
const numeric=await post({...base,lat:"43.651234",lng:"-70.261234"});assert.equal(numeric.happening.public_lat,43.651);
const bounded=await post({...base,title:"t".repeat(120),body:"b".repeat(600),topic:"x".repeat(60),attachments:Array(15).fill({bytes:"private"})});
assert.equal(bounded.happening.title.length,90);assert.equal(bounded.happening.body.length,420);assert.equal(bounded.happening.topic.length,40);assert.equal(bounded.happening.attachment_count,10);
const signed=await post(base,{}, {"oai-authenticated-user-id":"synthetic-account-id"});assert.ok(signed.happening.owner_key);assert.notEqual(signed.happening.owner_key,"synthetic-account-id");assert.equal(signed.happening.identity_visibility,"anonymous");
for(const input of [{...base,title:""},{...base,location:""},{...base,body:"x".repeat(70000)}]){const r=await post(input);assert.equal(r.response.status,400);assert.equal(r.happening,undefined);}
const unavailable=await post(base,{DB:undefined});assert.equal(unavailable.response.status,503);assert.equal(unavailable.happening,undefined);
const publicResponse=await handler.fetch(new Request(origin+"/api/happenings?time=all"),env);assert.equal(publicResponse.status,200);
assert.deepEqual((await publicResponse.json()).happenings,[]);
const publicQuery=reads.find(sql=>sql.includes("FROM happenings h"));
assert.match(publicQuery,/review_state IN \('cleared', 'approved'\)/);assert.match(publicQuery,/public_lat IS NOT NULL AND h.public_lng IS NOT NULL/);
console.log("Submission privacy smoke passed: durable text/source scrubbing, anonymous defaults, pending review, rounded coordinates, sensitive no-pin behavior, invalid-coordinate handling, bounded metadata, opaque ownership, rejection paths, and public-query privacy filters. Uses a recording D1 mock; no production writes.");
