import assert from "node:assert/strict";
import {mkdtemp,mkdir,writeFile,readFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";
const builder=fileURLToPath(new URL("./build-worker.mjs",import.meta.url));
const fixture=await mkdtemp(path.join(tmpdir(),"legit-generated-"));
const template="const ASSET_BUNDLE = __ASSET_BUNDLE__;\n";
const output=path.join(fixture,"dist/server/index.js");
function build(...args){const r=spawnSync(process.execPath,[builder,...args],{cwd:fixture,encoding:"utf8"});if(r.error)throw r.error;return r;}
try{
  await mkdir(path.join(fixture,"dist"));await mkdir(path.join(fixture,"worker"));
  for(const name of ["index.html","styles.css","app.js","sw.js"]) await writeFile(path.join(fixture,"dist",name),`fixture ${name}`);
  await writeFile(path.join(fixture,"worker/index.js"),template);
  assert.equal(build().status,0);
  const initial=await readFile(output,"utf8");assert.equal(build("--check").status,0);
  await writeFile(path.join(fixture,"dist/app.js"),"changed public asset");
  assert.equal(build("--check").status,1);assert.equal(await readFile(output,"utf8"),initial,"check must not rewrite stale output");
  assert.equal(build().status,0);assert.match(await readFile(output,"utf8"),/changed public asset/);
  await writeFile(path.join(fixture,"worker/index.js"),template+"// Worker edit\n");assert.equal(build("--check").status,1);
  assert.equal(build().status,0);assert.equal(build("--check").status,0);
  await rm(output);assert.equal(build("--check").status,1);await assert.rejects(readFile(output),{code:"ENOENT"});
  await writeFile(path.join(fixture,"worker/index.js"),"invalid template");assert.notEqual(build("--check").status,0);
  assert.notEqual(build("--unknown").status,0);
  console.log("Generated output smoke passed: current, stale asset/template, missing output, non-writing check mode, rebuild recovery, invalid template and arguments.");
}finally{await rm(fixture,{recursive:true,force:true});}
