import {mkdir, readFile, writeFile} from "node:fs/promises";
import path from "node:path";

const args=process.argv.slice(2);
if(args.length && (args.length !== 1 || args[0] !== "--check")) throw new Error("Usage: node scripts/build-worker.mjs [--check]");
const checkOnly=args[0] === "--check";
const root = process.cwd();
const files = {
  "index.html": ["dist/index.html","text/html; charset=utf-8"],
  "styles.css": ["dist/styles.css","text/css; charset=utf-8"],
  "app.js": ["dist/app.js","text/javascript; charset=utf-8"],
  "sw.js": ["dist/sw.js","text/javascript; charset=utf-8"]
};
const assets = {};
for(const [name,[relative,type]] of Object.entries(files)) assets[name] = {body:await readFile(path.join(root,relative),"utf8"),type};
const template = await readFile(path.join(root,"worker/index.js"),"utf8");
const marker = "const ASSET_BUNDLE = __ASSET_BUNDLE__;";
if(template.split(marker).length !== 2) throw new Error("Worker template must contain exactly one asset bundle marker.");
const generated = template.replace("const ASSET_BUNDLE = __ASSET_BUNDLE__;",`const ASSET_BUNDLE = ${JSON.stringify(assets)};`);
const output=path.join(root,"dist/server/index.js");
if(checkOnly){
  const committed=await readFile(output,"utf8").catch(error => { if(error.code === "ENOENT") return null; throw error; });
  if(committed !== generated){
    console.error("Generated Worker is missing or stale. Run npm run build and commit dist/server/index.js.");
    process.exitCode=1;
  }else console.log("Generated Worker matches current source.");
}else{
  await mkdir(path.dirname(output),{recursive:true});
  await writeFile(output,generated);
}
