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

const coords = new Map();
const points = [];

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

      // Coordinates drive the "detect my location" suggestion, so a wrong one
      // silently mis-places a repeater. Bounds are California's extent plus a
      // small margin.
      if (typeof area.lat !== "number" || typeof area.lon !== "number") {
        fail(`${aPath}: missing lat/lon`);
      } else {
        if (area.lat < 32.3 || area.lat > 42.2) {
          fail(`${aPath}: lat ${area.lat} is outside California`);
        }
        if (area.lon < -124.6 || area.lon > -114.0) {
          fail(`${aPath}: lon ${area.lon} is outside California`);
        }
        const key = area.lat.toFixed(3) + "," + area.lon.toFixed(3);
        if (coords.has(key)) {
          fail(`${aPath}: identical coordinates to ${coords.get(key)}`);
        } else {
          coords.set(key, aPath);
        }
        points.push({ path: aPath, lat: area.lat, lon: area.lon, county: county.name });
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

// Areas closer together than this are hard to tell apart from an advertised
// position, so nearest-centroid matching between them is close to a coin flip.
const CLOSE_KM = 4;
for (let i = 0; i < points.length; i++) {
  for (let j = i + 1; j < points.length; j++) {
    const d = haversineKm(points[i], points[j]);
    if (d < CLOSE_KM) {
      warn(`${points[i].path} and ${points[j].path} are ${d.toFixed(1)} km apart — ` +
           `location detection will offer both and let the operator choose`);
    }
  }
}

/* ---------- centroids against the county outlines ----------
 *
 * data/counties.js carries the real county boundaries the map draws, which
 * makes "is this coordinate actually in the county it is filed under?" a
 * question the machine can answer. It catches a transposed digit or a
 * copy-pasted neighbour, which the bounding-box check above cannot.
 */

const countyMapSource = readFileSync(join(root, "data/counties.js"), "utf8");
vm.runInContext(countyMapSource, sandbox, { filename: "data/counties.js" });
const countyMap = sandbox.window.CA_COUNTY_MAP;

if (!countyMap || !Array.isArray(countyMap.counties)) {
  fail("window.CA_COUNTY_MAP.counties is missing or not an array — run scripts/build-counties.mjs");
} else {
  const { lon0, lat1, k, cos0 } = countyMap.projection;
  const project = (lat, lon) => [(lon - lon0) * cos0 * k, (lat1 - lat) * k];
  // The projection is scaled so one viewBox unit is one degree of latitude / k.
  const KM_PER_UNIT = 111.32 / k;

  // "Los Angeles" in the shapes, "Los Angeles County" in the region tree.
  const shapes = new Map();
  for (const c of countyMap.counties) { shapes.set(c.name, parsePath(c.d)); }

  const treeCounties = new Set(points.map((p) => p.county));
  for (const name of treeCounties) {
    if (!shapes.has(name.replace(/ County$/, ""))) {
      fail(`county "${name}" has no outline in data/counties.js`);
    }
  }

  // build-counties.mjs simplifies the rings with a tolerance of about 600 m, so
  // near a convoluted shoreline the drawn line genuinely cannot say which side a
  // point is on. Inside that band, "outside" means nothing.
  const SIMPLIFY_SLACK_KM = 0.8;
  // Past the slack it is worth a look, and this far past it is a mistake rather
  // than a border-hugging centroid.
  const OUTSIDE_FAIL_KM = 5;

  for (const p of points) {
    const own = shapes.get(p.county.replace(/ County$/, ""));
    if (!own) { continue; }
    const xy = project(p.lat, p.lon);
    if (inside(xy, own)) { continue; }

    const offBy = distanceToRings(xy, own) * KM_PER_UNIT;
    if (offBy <= SIMPLIFY_SLACK_KM) { continue; }

    // Naming the county it actually landed in turns "wrong" into "fix it to this".
    let actual = null;
    for (const [name, rings] of shapes) {
      if (inside(xy, rings)) { actual = name; break; }
    }
    const landedIn = actual ? `, which is in ${actual} County` : ", which is offshore or out of state";

    if (offBy > OUTSIDE_FAIL_KM) {
      fail(`${p.path}: ${p.lat}, ${p.lon} is ${offBy.toFixed(1)} km outside ${p.county}${landedIn}`);
    } else {
      warn(`${p.path}: ${p.lat}, ${p.lon} sits ${offBy.toFixed(1)} km outside ${p.county} — ` +
           `close enough to be the simplified outline, but worth a look`);
    }
  }
}

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
  console.log(
    `ok: ${regionCount} regions, ${countyCount} counties, ${areaCount} local areas, ` +
      `${seen.size} unique codes`
  );
  process.exit(0);
}

report();
