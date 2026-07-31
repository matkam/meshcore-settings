/*
 * Arbitrary levels.
 *
 * The site is built for California's regions > counties > local areas, so every
 * other suite exercises exactly three levels and would keep passing if three
 * were hard-coded somewhere. This one swaps the fetched tree for a synthetic
 * one that is four levels deep in one branch and two in another, with the
 * outlines and the positions hung off different levels than California uses.
 *
 * Nothing about the page changes — same HTML, same scripts, same outlines file.
 * Only data/regions.json is intercepted.
 */
import { chromium } from "playwright";
import { launchOptions, tick, clearPicks } from "./harness.mjs";

const SITE = process.env.SITE || "http://127.0.0.1:8765/";

/* A ragged tree:
 *
 *   za  Zone A                      (label)
 *     da  District A
 *       ta  Town A                  (outline "Alameda", dot)
 *         na  North End             (dot)
 *   zb  Zone B                      (label, kind: sector)
 *     db  District B                (outline "Kern", dot, kind: borough)
 *
 * Deepest chain is west > tl > za > da > ta > na — six names, two more than
 * California ever produces.
 */
const TREE = {
  format: 1,
  name: "Testland",
  description: "Synthetic tree for the arbitrary-depth suite.",
  updated: "2026-07-31",
  limits: { maxLineLength: 160, maxRegionNames: 32, maxDepth: 8 },
  root: [{ code: "west", name: "Western US" }, { code: "tl", name: "Testland" }],
  levels: [
    { name: "zone", plural: "zones" },
    { name: "district", plural: "districts" },
    { name: "town", plural: "towns" },
    { name: "neighbourhood", plural: "neighbourhoods" }
  ],
  places: [
    {
      code: "za",
      name: "Zone A",
      children: [{
        code: "da",
        name: "District A",
        children: [{
          code: "ta",
          name: "Town A",
          outline: "Alameda",
          lat: 37.77,
          lon: -122.2,
          aliases: ["Testville"],
          children: [{ code: "na", name: "North End", lat: 37.8, lon: -122.25 }]
        }]
      }]
    },
    {
      code: "zb",
      name: "Zone B",
      kind: "sector",
      children: [{
        code: "db",
        name: "District B",
        kind: "borough",
        outline: "Kern",
        lat: 35.4,
        lon: -118.9
      }]
    }
  ]
};

const browser = await chromium.launch(launchOptions);
const page = await browser.newPage({ viewport: { width: 1000, height: 1200 } });

const errors = [];
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });

await page.route("**/data/regions.json", (route) =>
  route.fulfill({ contentType: "application/json", body: JSON.stringify(TREE) }));

await page.goto(SITE, { waitUntil: "networkidle" });

let pass = true;
function check(name, ok, detail) {
  pass = pass && !!ok;
  console.log((ok ? "PASS " : "FAIL ") + name + (ok || detail === undefined ? "" : `  -> ${detail}`));
}

const rows = (level) => page.$$eval(`.pick-row.lvl-${level}`, (n) => n.length);
const cmds = async () => (await page.textContent("#commands")).trim();

/* ---------- the picker goes as deep as the data ---------- */

check("only the top level is listed at rest", (await rows(0)) === 2, await rows(0));
check("nothing below it is shown yet", (await rows(1)) === 0, await rows(1));

await tick(page, "za");
check("ticking a zone reveals its districts", (await rows(1)) === 1, await rows(1));

await tick(page, "da");
check("ticking a district reveals its towns", (await rows(2)) === 1, await rows(2));

await tick(page, "ta");
check("ticking a town reveals a fourth level", (await rows(3)) === 1, await rows(3));

await tick(page, "na");
check("the whole chain is carried",
  (await cmds()).includes("region def west tl za da ta na"), await cmds());
check("six names, which is deeper than California ever goes",
  /5 of 32 region names|6 of 32 region names/.test(await page.textContent("#line-note")),
  await page.textContent("#line-note"));

const chain = await page.$$eval("#chain .tok", (n) => n.map((x) => x.textContent));
check("the chain display shows all six", chain.join(" ") === "west tl za da ta na", chain.join(" "));

/* ---------- a shallower branch is not padded out ---------- */

await clearPicks(page);
await tick(page, "zb", "db");
check("a two-level branch stops where it stops",
  (await cmds()).includes("region def west tl zb db"), await cmds());
check("and shows no empty level under it", (await rows(2)) === 0, await rows(2));

/* ---------- level names come from the data ---------- */

await page.fill("#search", "zzzzz");
await page.waitForTimeout(80);
check("the no-match hint names the second level",
  (await page.textContent("#results")).includes("Try a district"),
  (await page.textContent("#results")).trim());

await page.fill("#search", "");
await page.fill("#search", "Zone A");
await page.waitForTimeout(80);
check("a top-level place is described by its level name",
  (await page.textContent("#results")).includes("Testland zone"),
  (await page.textContent("#results")).trim());

await page.fill("#search", "");
await page.fill("#search", "Zone B");
await page.waitForTimeout(80);
check("and `kind` overrides it for one place",
  (await page.textContent("#results")).includes("Testland sector"),
  (await page.textContent("#results")).trim());

await page.fill("#search", "");
await page.fill("#search", "Testville");
await page.waitForTimeout(80);
check("aliases still search, at whatever level they sit",
  (await page.$$eval("#results li .r-code", (n) => n.map((x) => x.textContent.trim()))).includes("ta"));

check("the map describes itself with the data's own level names",
  (await page.getAttribute(".map-svg", "aria-label")) ===
    "Map of Testland's districts with a marker for each town. " +
    "The picker below makes the same choices.",
  await page.getAttribute(".map-svg", "aria-label"));

/* ---------- the map hangs shapes and dots off whatever level claims them ---------- */

check("an outline claimed three levels down is drawn",
  (await page.$$(".map-county[data-place='ta']")).length === 1);
check("an outline claimed two levels down is drawn too",
  (await page.$$(".map-county[data-place='db']")).length === 1);
check("only the two claimed shapes are wired up",
  (await page.$$eval(".map-county", (e) => e.filter((p) => p.dataset.place).length)) === 2,
  await page.$$eval(".map-county", (e) => e.filter((p) => p.dataset.place).length));

check("a dot is drawn for every place with a position",
  (await page.$$eval(".map-dot", (e) => e.map((d) => d.dataset.place).sort().join(","))) === "db,na,ta",
  await page.$$eval(".map-dot", (e) => e.map((d) => d.dataset.place).sort().join(",")));

check("top-level places get the labels",
  (await page.$$eval(".map-label", (e) => e.map((t) => t.dataset.place).sort().join(","))) === "za,zb",
  await page.$$eval(".map-label", (e) => e.map((t) => t.dataset.place).sort().join(",")));

/* ---------- selection reaches across the levels between ---------- */

await clearPicks(page);
await tick(page, "za");
await page.waitForTimeout(150);
check("picking a zone tints a shape two levels beneath it",
  await page.$eval(".map-county[data-place='ta']", (c) => c.classList.contains("is-in-region")));
check("and leaves the other branch alone",
  await page.$eval(".map-county[data-place='db']", (c) => !c.classList.contains("is-in-region")));

await tick(page, "da", "ta");
await page.waitForTimeout(150);
check("picking the town marks its own shape",
  await page.$eval(".map-county[data-place='ta']", (c) => c.classList.contains("is-on")));
check("and its dot, since it has both",
  await page.$eval(".map-dot[data-place='ta']", (d) => d.classList.contains("is-on")));

/* ---------- detection works off points at any level ---------- */

const near = await page.evaluate(() =>
  window.SettingsState.nearestPlaces(35.41, -118.91, 3).map((h) => h.entry.code));
check("a position matches the nearest point, even one only two levels down",
  near[0] === "db", JSON.stringify(near));

console.log(errors.length ? "\nJS ERRORS:\n" + errors.join("\n") : "\nno JS errors");
await browser.close();
process.exit(pass && !errors.length ? 0 : 1);
