#!/usr/bin/env node
/*
 * Regenerates data/counties.js — the county outlines the map draws.
 *
 *   node scripts/build-counties.mjs path/to/california-counties.geojson
 *
 * The output is committed, so this only needs running if the boundaries are
 * ever replaced. Contributors adding an area never touch it.
 *
 * What it does: projects lon/lat into flat viewBox units, simplifies the rings
 * hard enough to keep the file small but not so hard that the coastline stops
 * looking like California, and emits one SVG path per county.
 */
import { readFileSync, writeFileSync } from "node:fs";

const SRC = process.argv[2];
if (!SRC) {
  console.error("usage: build-counties.mjs <california-counties.geojson>");
  process.exit(1);
}

/* ---------- projection ----------
 * Equirectangular with the x axis scaled by cos(latitude) at the middle of the
 * state, so California is the shape people recognise rather than a stretched
 * one. It is linear and invertible, which matters: the site projects area
 * centroids and a connected repeater's position with these same numbers, and
 * the validator runs point-in-county checks in this space.
 */
const LON0 = -124.5;          // left edge, degrees
const LAT1 = 42.1;            // top edge, degrees
const LAT0 = 37.2;            // latitude the x scale is true at
const K = 105;                // viewBox units per degree of latitude
const COS0 = Math.cos((LAT0 * Math.PI) / 180);

const project = ([lon, lat]) => [(lon - LON0) * COS0 * K, (LAT1 - lat) * K];

/* ---------- simplification ---------- */

// Perpendicular distance from p to the segment a–b, squared.
function segDist2(p, a, b) {
  let [x, y] = a;
  let dx = b[0] - x;
  let dy = b[1] - y;
  if (dx !== 0 || dy !== 0) {
    const t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) { [x, y] = b; } else if (t > 0) { x += dx * t; y += dy * t; }
  }
  return (p[0] - x) ** 2 + (p[1] - y) ** 2;
}

// Douglas-Peucker. Iterative rather than recursive: a few rings are long enough
// to blow the stack on a pathological split.
function simplify(points, tolerance) {
  if (points.length < 3) { return points.slice(); }
  const tol2 = tolerance * tolerance;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop();
    let index = -1;
    let maxDist = tol2;
    for (let i = first + 1; i < last; i++) {
      const d = segDist2(points[i], points[first], points[last]);
      if (d > maxDist) { index = i; maxDist = d; }
    }
    if (index !== -1) {
      keep[index] = 1;
      stack.push([first, index], [index, last]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

function ringArea(points) {
  let a = 0;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    a += (points[j][0] + points[i][0]) * (points[j][1] - points[i][1]);
  }
  return Math.abs(a / 2);
}

/* ---------- build ---------- */

const TOLERANCE = 0.55;   // viewBox units — about 600 m on the ground
const MIN_AREA = 4;       // drop specks, keep the real islands (Catalina is ~180)

const geo = JSON.parse(readFileSync(SRC, "utf8"));
const counties = [];
let rawPoints = 0;
let keptPoints = 0;
let droppedRings = 0;

for (const feature of geo.features) {
  const name = feature.properties.name;
  const geom = feature.geometry;
  const polygons = geom.type === "MultiPolygon" ? geom.coordinates : [geom.coordinates];

  const parts = [];
  for (const polygon of polygons) {
    // Index 0 is the outer ring; the rest are holes. California's counties have
    // no holes in this source, but honour them rather than assume.
    for (const ring of polygon) {
      rawPoints += ring.length;
      const projected = ring.map(project);
      const simplified = simplify(projected, TOLERANCE);
      if (simplified.length < 4 || ringArea(simplified) < MIN_AREA) {
        droppedRings++;
        continue;
      }
      keptPoints += simplified.length;
      parts.push(simplified);
    }
  }

  if (!parts.length) { throw new Error(`every ring of ${name} was dropped`); }

  // Sorting by area puts the mainland body first, so the label anchor and any
  // "biggest part" logic downstream gets the part people think of as the county.
  parts.sort((a, b) => ringArea(b) - ringArea(a));

  const d = parts.map((part) => {
    const pts = part.map(([x, y]) => `${round(x)},${round(y)}`);
    return "M" + pts.join("L") + "Z";
  }).join("");

  counties.push({ name, d, area: Math.round(parts.reduce((s, p) => s + ringArea(p), 0)) });
}

function round(n) { return Math.round(n * 10) / 10; }

counties.sort((a, b) => a.name.localeCompare(b.name));

// The projection's origin is a round lon/lat, which leaves empty margin around
// the state. Trim the viewBox to what is actually drawn — the projection is
// untouched, so lat/lon still lands in the same place.
function extent(d) {
  return d.replace(/[MZ]/g, " ").split(/[L ]+/).filter(Boolean)
    .map((p) => p.split(",").map(Number));
}

const all = counties.flatMap((c) => extent(c.d));
const PAD = 4;
const minX = Math.floor(Math.min(...all.map((p) => p[0]))) - PAD;
const minY = Math.floor(Math.min(...all.map((p) => p[1]))) - PAD;
const width = Math.ceil(Math.max(...all.map((p) => p[0]))) - minX + PAD;
const height = Math.ceil(Math.max(...all.map((p) => p[1]))) - minY + PAD;

const out = `/*
 * County outlines for the map, generated by scripts/build-counties.mjs —
 * do not edit by hand.
 *
 * Boundaries: US Census TIGER/Line, via the click_that_hood project
 * (https://github.com/codeforgermany/click_that_hood, MIT). Census boundary
 * data is a work of the US government and in the public domain.
 *
 * Coordinates are projected into viewBox units by data/counties.js's own
 * projection block, not degrees. Anything plotting a lat/lon onto this map has
 * to use the same numbers — see MapProjection below.
 */
window.CA_COUNTY_MAP = {
  // Feed straight into the SVG viewBox attribute, in this order.
  viewBox: { x: ${minX}, y: ${minY}, width: ${width}, height: ${height} },

  // x = (lon - lon0) * cos0 * k        lon = x / (cos0 * k) + lon0
  // y = (lat1 - lat) * k               lat = lat1 - y / k
  projection: { lon0: ${LON0}, lat1: ${LAT1}, k: ${K}, cos0: ${COS0.toFixed(9)} },

  counties: [
${counties.map((c) => `    { name: ${JSON.stringify(c.name)}, d: ${JSON.stringify(c.d)} }`).join(",\n")}
  ]
};
`;

writeFileSync(new URL("../data/counties.js", import.meta.url), out);

console.log(`counties: ${counties.length}`);
console.log(`points:   ${rawPoints} -> ${keptPoints} (${droppedRings} tiny rings dropped)`);
console.log(`viewBox:  ${minX} ${minY} ${width} ${height}`);
console.log(`size:     ${(out.length / 1024).toFixed(1)} KB`);
