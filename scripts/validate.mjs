#!/usr/bin/env node
/*
 * Validates data/regions.js.
 *
 * MeshCore region names live in one flat namespace on a node, so a duplicate
 * code anywhere in the tree is a real bug -- it would silently merge two
 * unrelated places on any repeater that carries both. This also enforces the
 * 160-character serial line limit on the generated `region def` command.
 *
 * Usage: node scripts/validate.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import vm from "node:vm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(join(root, "data/regions.js"), "utf8");

const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(source, sandbox, { filename: "data/regions.js" });

const data = sandbox.window.CA_REGIONS;
const errors = [];
const warnings = [];

const fail = (msg) => errors.push(msg);
const warn = (msg) => warnings.push(msg);

if (!data || !Array.isArray(data.regions)) {
  fail("window.CA_REGIONS.regions is missing or not an array");
  report();
}

const rootTokens = data.meta?.root ?? [];
const maxLine = data.meta?.maxLineLength ?? 160;

if (!rootTokens.length) fail("meta.root must contain at least one token");

// code -> human-readable path, for duplicate reporting
const seen = new Map();
const CODE_RE = /^[a-z0-9]{1,8}$/;

function claim(code, path) {
  if (typeof code !== "string" || !CODE_RE.test(code)) {
    fail(`invalid code ${JSON.stringify(code)} at ${path} (expect 1-8 chars, lowercase a-z0-9)`);
    return;
  }
  if (seen.has(code)) {
    fail(`duplicate code "${code}": ${seen.get(code)} and ${path}`);
    return;
  }
  seen.set(code, path);
}

rootTokens.forEach((code) => claim(code, "meta.root"));

let regionCount = 0;
let countyCount = 0;
let areaCount = 0;

for (const region of data.regions) {
  regionCount += 1;
  const rPath = `region ${region.name ?? region.code}`;
  if (!region.name) fail(`${rPath}: missing name`);
  claim(region.code, rPath);

  if (!Array.isArray(region.counties) || region.counties.length === 0) {
    fail(`${rPath}: has no counties`);
    continue;
  }

  for (const county of region.counties) {
    countyCount += 1;
    const cPath = `${rPath} > ${county.name ?? county.code}`;
    if (!county.name) fail(`${cPath}: missing name`);
    claim(county.code, cPath);

    const areas = Array.isArray(county.areas) ? county.areas : [];
    if (areas.length === 0) warn(`${cPath}: no local areas defined (county-level only)`);

    for (const area of areas) {
      areaCount += 1;
      const aPath = `${cPath} > ${area.name ?? area.code}`;
      if (!area.name) fail(`${aPath}: missing name`);
      claim(area.code, aPath);
      if (!Array.isArray(area.cities) || area.cities.length === 0) {
        warn(`${aPath}: no cities listed, it will be hard to find by search`);
      }

      const chain = [...rootTokens, region.code, county.code, area.code];
      const line = `region def ${chain.join(" ")}`;
      if (line.length > maxLine) {
        fail(`${aPath}: "${line}" is ${line.length} chars, over the ${maxLine} limit`);
      }
      if (chain.length > 8) {
        fail(`${aPath}: chain is ${chain.length} deep, MeshCore allows max 8 levels`);
      }
    }
  }
}

function report() {
  for (const w of warnings) console.warn(`warn: ${w}`);
  if (errors.length) {
    for (const e of errors) console.error(`error: ${e}`);
    console.error(`\n${errors.length} error(s)`);
    process.exit(1);
  }
  console.log(
    `ok: ${regionCount} regions, ${countyCount} counties, ${areaCount} local areas, ` +
      `${seen.size} unique codes`
  );
  process.exit(0);
}

report();
