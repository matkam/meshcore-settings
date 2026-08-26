import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, extname } from "node:path";
import { spawn } from "node:child_process";
const TYPES={".html":"text/html",".js":"text/javascript",".mjs":"text/javascript",".json":"application/json",".css":"text/css",".svg":"image/svg+xml"};
const server=createServer(async(req,res)=>{const rel=decodeURIComponent(req.url.split("?")[0]);
  const path=join(process.cwd(), rel==="/"?"index.html":rel);
  try{const b=await readFile(path);
    res.writeHead(200,{"content-type":TYPES[extname(path)]||"text/plain","cache-control":"no-store"});res.end(b);}
  catch{res.writeHead(404);res.end("no");}});
await new Promise(r=>server.listen(0,"127.0.0.1",r));
const site=`http://127.0.0.1:${server.address().port}/`;
const p=spawn("node",[process.argv[2]],{stdio:"inherit",env:{...process.env,SITE:site}});
p.on("exit",()=>server.close());
