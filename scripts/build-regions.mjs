#!/usr/bin/env node
/*
 * Builds data/regions.json from data/regions.yaml.
 *
 *   npm run build:regions            # write the JSON
 *   npm run build:regions -- --check # fail if the JSON is out of date
 *
 * Why two files: YAML is what a person edits — it takes comments, and the
 * comments in regions.yaml are half the documentation. JSON is what everything
 * else reads: the site fetches it with no parser at all, and anyone consuming
 * the region tree from outside this repo gets a file their language already
 * understands. Both are committed, and CI runs --check so they cannot drift.
 *
 * The output is deliberately stable — same key order, same formatting, every
 * time — so a rebuild with no edits produces no diff.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parse } from "yaml";
import { printJson } from "./print-json.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(root, "data/regions.yaml");
const OUT = join(root, "data/regions.json");

const check = process.argv.includes("--check");
const data = parse(readFileSync(SRC, "utf8"));

/* ---------- normalise ----------
 * Key order in the output is fixed here rather than inherited from the YAML,
 * so re-ordering keys in the source doesn't churn the JSON.
 */

const PLACE_KEYS = ["code", "name", "kind", "blurb", "outline", "nudge", "lat", "lon", "aliases"];

function place(node, trail) {
  if (!node || typeof node !== "object") {
    throw new Error(`not a place: ${JSON.stringify(node)} under ${trail.join(" > ") || "places"}`);
  }
  if (!node.code || !node.name) {
    throw new Error(`place under ${trail.join(" > ") || "places"} needs both code and name`);
  }

  const where = trail.concat(node.code);
  const known = new Set(PLACE_KEYS.concat(["children"]));
  for (const key of Object.keys(node)) {
    // A typo in a field name would otherwise vanish silently into the JSON.
    if (!known.has(key)) {
      throw new Error(`${where.join(" > ")}: unknown field "${key}"`);
    }
  }

  const out = {};
  for (const key of PLACE_KEYS) {
    if (node[key] !== undefined && node[key] !== null) { out[key] = node[key]; }
  }
  if (Array.isArray(node.children) && node.children.length) {
    out.children = node.children.map((child) => place(child, where));
  }
  return out;
}

const built = {
  format: data.format,
  name: data.name,
  description: data.description,
  updated: data.updated instanceof Date
    ? data.updated.toISOString().slice(0, 10)
    : String(data.updated),
  license: data.license,
  source: data.source,
  limits: data.limits,
  root: (data.root || []).map((r) => ({ code: r.code, name: r.name })),
  levels: (data.levels || []).map((l) => ({ name: l.name, plural: l.plural })),
  places: (data.places || []).map((node) => place(node, []))
};

const text = printJson(built) + "\n";

if (check) {
  let current = null;
  try { current = readFileSync(OUT, "utf8"); } catch { /* missing counts as stale */ }
  if (current !== text) {
    console.error("data/regions.json is out of date — run: npm run build:regions");
    process.exit(1);
  }
  console.log("ok: data/regions.json matches data/regions.yaml");
  process.exit(0);
}

writeFileSync(OUT, text);

let places = 0;
(function count(list) {
  for (const node of list) { places += 1; count(node.children || []); }
})(built.places);

console.log(`wrote data/regions.json: ${places} places, ${(text.length / 1024).toFixed(1)} KB`);
