import {spawnSync} from "node:child_process";
import {readdirSync} from "node:fs";
import {fileURLToPath} from "node:url";

const root=fileURLToPath(new URL("../",import.meta.url));
function run(args){
  const result=spawnSync(process.execPath,args,{cwd:root,stdio:"inherit"});
  if(result.error){ console.error(result.error.message); process.exit(1); }
  if(result.status !== 0) process.exit(result.status || 1);
}
// Rebuild before importing the Worker in any regression suite.
run(["scripts/build-worker.mjs"]);
const scripts=readdirSync(new URL("./",import.meta.url)).filter(name => name.endsWith(".mjs")).sort();
for(const file of ["dist/app.js","dist/sw.js","worker/index.js","dist/server/index.js",...scripts.map(name => `scripts/${name}`)]) run(["--check",file]);
for(const suite of ["generated-output","profile-sqlite","profile-browser","retention-sqlite","sqlite-privacy","submission-privacy","security","offline-privacy","refresh-reliability","detail-refresh","map-focus"]) run([`scripts/${suite}-smoke.mjs`]);
console.log("Validation passed: Worker regenerated, JavaScript syntax checked, and all eleven regression suites passed.");
