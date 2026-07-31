#!/usr/bin/env node
/*
 * Runs every browser suite against a freshly served copy of the site.
 *
 *   npm test                 # all suites
 *   npm test -- map settings # just those two
 *
 * Each suite is its own process that exits non-zero on failure, so one crashed
 * suite cannot take the others' results with it. The server is started here
 * rather than per suite, and torn down whatever happens.
 */
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

// Ordered cheapest-first, so an obvious break surfaces before the slow ones.
const SUITES = ["basic", "firmware", "levels", "detect", "flow", "push", "map", "settings", "picks"];

const only = process.argv.slice(2);
const suites = only.length ? SUITES.filter((s) => only.includes(s)) : SUITES;

if (!suites.length) {
  console.error(`no matching suites. available: ${SUITES.join(", ")}`);
  process.exit(1);
}

/* ---------- serve the site ----------
 * A few lines of http rather than a dependency: the site is static files and
 * the suites only ever GET them.
 */

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

const { readFile } = await import("node:fs/promises");

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    let path = decodeURIComponent(url.pathname);
    if (path.endsWith("/")) { path += "index.html"; }
    // Serve only from the repo, whatever the request says.
    const file = join(root, path);
    if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
    const body = await readFile(file);
    const ext = path.slice(path.lastIndexOf("."));
    res.writeHead(200, { "content-type": TYPES[ext] || "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404).end("not found");
  }
});

// Port 0 lets the OS pick a free one, so a stray server from an earlier run
// cannot make this one fail or, worse, silently test stale files.
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const site = `http://127.0.0.1:${server.address().port}/`;
console.log(`serving ${root} at ${site}\n`);

/* ---------- run them ---------- */

function runSuite(name) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [join(here, `${name}.mjs`)], {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, SITE: site }
    });
    let out = "";
    child.stdout.on("data", (d) => { out += d; });
    child.stderr.on("data", (d) => { out += d; });
    child.on("close", (code) => resolve({ name, code, out }));
  });
}

let failed = 0;
let checks = 0;

for (const name of suites) {
  process.stdout.write(`${name.padEnd(10)} `);
  const { code, out } = await runSuite(name);
  const passes = (out.match(/^PASS /gm) || []).length;
  const fails = (out.match(/^FAIL /gm) || []).length;
  checks += passes + fails;

  if (code === 0) {
    console.log(`ok    ${passes} checks`);
  } else {
    failed++;
    console.log(`FAIL  ${fails} of ${passes + fails} checks`);
    // Only the failures, and the surrounding output, are worth printing.
    for (const line of out.split("\n")) {
      if (/^FAIL /.test(line) || /Error|error:/.test(line)) { console.log(`  ${line}`); }
    }
  }
}

server.close();

console.log(`\n${checks} checks in ${suites.length} suite(s), ${failed} suite(s) failed`);
process.exit(failed ? 1 : 0);
