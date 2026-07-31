#!/usr/bin/env node
/*
 * Validates data/regions.json — the built tree, which is what actually ships.
 * (`npm run validate` runs build-regions.mjs --check first, so a JSON that has
 * drifted from the YAML is caught before any of this.)
 *
 * MeshCore region names live in one flat namespace on a node, so a duplicate
 * code anywhere in the tree is a real bug — it would silently merge two
 * unrelated places on any repeater that carries both.
 *
 * Nothing here knows what a "county" is. The tree nests as deep as it likes;
 * every check below is a property of a place, not of a level.
 *
 * Usage: node scripts/validate.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => JSON.parse(readFileSync(join(root, rel), "utf8"));

const errors = [];
const warnings = [];
const fail = (msg) => errors.push(msg);
const warn = (msg) => warnings.push(msg);

let data;
let map;
try {
  data = read("data/regions.json");
  map = read("data/outlines.json");
} catch (e) {
  fail(`${e.message} — run npm run build:regions`);
  report();
}

if (!Array.isArray(data.places)) {
  fail("regions.json has no places array");
  report();
}

const rootTokens = data.root ?? [];
const limits = data.limits ?? {};
const maxLine = limits.maxLineLength ?? 160;
const maxNames = limits.maxRegionNames ?? 32;
const maxDepth = limits.maxDepth ?? 8;
const levels = data.levels ?? [];

if (!rootTokens.length) { fail("root must contain at least one token"); }

// Boundary shapes, by the name a place claims them with.
const shapes = new Map();
for (const shape of map.shapes ?? []) { shapes.set(shape.name, parsePath(shape.d)); }
if (!shapes.size) { fail("data/outlines.json has no shapes — run npm run build:outlines"); }

/* ---------- codes ---------- */

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

rootTokens.forEach((r) => claim(r.code, "root"));

/* ---------- walk ---------- */

const places = [];      // every place, with its ancestry
const points = [];      // every place carrying a position

(function walk(list, trail) {
  for (const node of list ?? []) {
    const label = `${trail.map((t) => t.name).concat(node.name ?? node.code).join(" > ")}`;
    if (!node.name) { fail(`${label}: missing name`); }
    claim(node.code, label);

    const entry = { node, trail, depth: trail.length, label };
    places.push(entry);

    const chain = rootTokens.concat(trail, [node]);
    if (chain.length > maxDepth) {
      fail(`${label}: chain is ${chain.length} deep, the firmware allows ${maxDepth}`);
    }
    const line = `region def ${chain.map((t) => t.code).join(" ")}`;
    if (line.length > maxLine) {
      fail(`${label}: "${line}" is ${line.length} chars, over the ${maxLine} limit`);
    }

    const kids = node.children ?? [];
    const hasPoint = typeof node.lat === "number" || typeof node.lon === "number";
    if (hasPoint) {
      if (typeof node.lat !== "number" || typeof node.lon !== "number") {
        fail(`${label}: has one of lat/lon but not the other`);
      } else {
        points.push(entry);
      }
    }

    // A place with nothing under it, no position and no shape cannot be found
    // on the map or by "where is this repeater?" — only by name.
    if (!kids.length && !hasPoint && !node.outline) {
      warn(`${label}: no children, no position and no outline, so only search can reach it`);
    }
    if (!kids.length && !(node.aliases ?? []).length) {
      warn(`${label}: no aliases listed, it will be hard to find by search`);
    }
    if (node.outline && !shapes.has(node.outline)) {
      fail(`${label}: outline "${node.outline}" is not in data/outlines.json`);
    }

    walk(kids, trail.concat([node]));
  }
})(data.places, []);

const deepest = places.reduce((d, p) => Math.max(d, p.depth), 0) + 1;
if (deepest > levels.length) {
  warn(`the tree runs ${deepest} levels deep but only ${levels.length} are named in ` +
       `levels — the rest will be called "place" in the interface`);
}

// One chain per place is the worst case a single pick can produce, but a
// bridging site picks several. This is the ceiling for one, which is the only
// thing checkable without knowing what somebody will tick.
const longest = places.reduce((d, p) => Math.max(d, p.depth), 0) + 1 + rootTokens.length;
if (longest > maxNames) {
  fail(`a single chain needs ${longest} region names, over the ${maxNames} a node holds`);
}

/* ---------- positions ----------
 *
 * Coordinates drive the "detect my location" suggestion, so a wrong one
 * silently mis-places a repeater. Three checks, weakest first: is it on the
 * map at all, is it unique, and is it inside the shape it is filed under.
 */

const { lon0, lat1, k, cos0 } = map.projection;
const project = (lat, lon) => [(lon - lon0) * cos0 * k, (lat1 - lat) * k];
// The projection is scaled so one viewBox unit is one degree of latitude / k.
const KM_PER_UNIT = 111.32 / k;
const vb = map.viewBox;

const coords = new Map();

for (const p of points) {
  const { lat, lon } = p.node;
  const [x, y] = project(lat, lon);
  if (x < vb.x || x > vb.x + vb.width || y < vb.y || y > vb.y + vb.height) {
    fail(`${p.label}: ${lat}, ${lon} is outside the mapped area`);
    continue;
  }

  const key = lat.toFixed(3) + "," + lon.toFixed(3);
  if (coords.has(key)) {
    fail(`${p.label}: identical coordinates to ${coords.get(key)}`);
  } else {
    coords.set(key, p.label);
  }
}

// Places closer together than this are hard to tell apart from an advertised
// position, so nearest-point matching between them is close to a coin flip.
const CLOSE_KM = 4;
for (let i = 0; i < points.length; i++) {
  for (let j = i + 1; j < points.length; j++) {
    const d = haversineKm(points[i].node, points[j].node);
    if (d < CLOSE_KM) {
      warn(`${points[i].label} and ${points[j].label} are ${d.toFixed(1)} km apart — ` +
           `location detection will offer both and let the operator choose`);
    }
  }
}

/* ---------- positions against the outlines ----------
 *
 * data/outlines.json carries the real boundaries the map draws, which makes
 * "is this coordinate actually inside the shape it sits under?" a question the
 * machine can answer. It catches a transposed digit or a copy-pasted
 * neighbour, which the bounds check above cannot.
 *
 * The shape checked is the nearest ancestor that claims one — not the parent,
 * because a level may pass through without having a boundary of its own.
 */

// build-outlines.mjs simplifies the rings with a tolerance of about 600 m, so
// near a convoluted shoreline the drawn line genuinely cannot say which side a
// point is on. Inside that band, "outside" means nothing.
const SIMPLIFY_SLACK_KM = 0.8;
// Past the slack it is worth a look, and this far past it is a mistake rather
// than a border-hugging point.
const OUTSIDE_FAIL_KM = 5;

for (const p of points) {
  const owner = [p.node, ...p.trail].reverse().find((n) => n.outline);
  if (!owner) { continue; }
  const rings = shapes.get(owner.outline);
  if (!rings) { continue; }

  const xy = project(p.node.lat, p.node.lon);
  if (inside(xy, rings)) { continue; }

  const offBy = distanceToRings(xy, rings) * KM_PER_UNIT;
  if (offBy <= SIMPLIFY_SLACK_KM) { continue; }

  // Naming the shape it actually landed in turns "wrong" into "fix it to this".
  let actual = null;
  for (const [name, other] of shapes) {
    if (inside(xy, other)) { actual = name; break; }
  }
  const landedIn = actual ? `, which is in ${actual}` : ", which is outside every outline";

  const where = `${p.node.lat}, ${p.node.lon}`;
  if (offBy > OUTSIDE_FAIL_KM) {
    fail(`${p.label}: ${where} is ${offBy.toFixed(1)} km outside ${owner.outline}${landedIn}`);
  } else {
    warn(`${p.label}: ${where} sits ${offBy.toFixed(1)} km outside ${owner.outline} — ` +
         `close enough to be the simplified outline, but worth a look`);
  }
}

/* ---------- geometry ---------- */

// "M x,y L x,y ... Z M ..." back into rings of points.
function parsePath(d) {
  return d.split("M").filter(Boolean).map((part) =>
    part.replace(/Z$/, "").split("L").map((pair) => pair.split(",").map(Number)));
}

// Even-odd ray cast across every ring, so a hole would correctly read as outside.
function inside([x, y], rings) {
  let hit = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
        hit = !hit;
      }
    }
  }
  return hit;
}

function distanceToRings(p, rings) {
  let best = Infinity;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      best = Math.min(best, pointToSegment(p, ring[j], ring[i]));
    }
  }
  return best;
}

function pointToSegment([px, py], a, b) {
  let [x, y] = a;
  const dx = b[0] - x;
  const dy = b[1] - y;
  if (dx !== 0 || dy !== 0) {
    const t = ((px - x) * dx + (py - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) { [x, y] = b; } else if (t > 0) { x += dx * t; y += dy * t; }
  }
  return Math.hypot(px - x, py - y);
}

function haversineKm(a, b) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function report() {
  for (const w of warnings) console.warn(`warn: ${w}`);
  if (errors.length) {
    for (const e of errors) console.error(`error: ${e}`);
    console.error(`\n${errors.length} error(s)`);
    process.exit(1);
  }
  const byDepth = [];
  for (const p of places) { byDepth[p.depth] = (byDepth[p.depth] ?? 0) + 1; }
  const shape = byDepth
    .map((n, d) => `${n} ${n === 1 ? levelName(d) : levelPlural(d)}`)
    .join(", ");
  console.log(`ok: ${shape}, ${seen.size} unique codes`);
  process.exit(0);
}

function levelName(depth) { return levels[depth]?.name ?? "place"; }
function levelPlural(depth) { return levels[depth]?.plural ?? "places"; }

report();
