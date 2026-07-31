/*
 * The reference box.
 *
 * Two things are worth pinning down: that it stays compact until asked (the
 * whole point of it being collapsible), and that it is genuinely read-only —
 * a reference that quietly changed the generated commands would be worse than
 * no reference at all.
 *
 * The second half swaps in a synthetic four-level tree, like tests/levels.mjs,
 * so "it recurses" is checked rather than assumed from a three-level dataset.
 */
import { chromium } from "playwright";
import { launchOptions, tick, picks } from "./harness.mjs";

const SITE = process.env.SITE || "http://127.0.0.1:8765/";
const browser = await chromium.launch(launchOptions);
const page = await browser.newPage({ viewport: { width: 1000, height: 1200 } });

const errors = [];
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });

await page.goto(SITE, { waitUntil: "networkidle" });

let pass = true;
function check(name, ok, detail) {
  pass = pass && !!ok;
  console.log((ok ? "PASS " : "FAIL ") + name + (ok || detail === undefined ? "" : `  -> ${detail}`));
}

const visibleRows = () => page.$$eval(".ref-row", (n) => n.filter((r) => r.checkVisibility()).length);
const openGroups = () => page.$$eval(".ref-group", (n) => n.filter((g) => g.open).length);
const toggleText = () => page.textContent("#reference .link-btn");

/* ---------- compact until asked ---------- */

check("one group per top-level place", (await page.$$eval(".ref-group", (n) => n.length)) === 8,
  await page.$$eval(".ref-group", (n) => n.length));
check("everything starts collapsed", (await openGroups()) === 0);
check("so no county or area row is on screen", (await visibleRows()) === 0, await visibleRows());

check("the totals are spelled out",
  (await page.textContent(".ref-total")).includes("8 regions · 58 counties · 162 local areas"),
  await page.textContent(".ref-total"));

check("every region shows its description while collapsed",
  (await page.$$eval(".ref-blurb", (n) => n.filter((b) => b.checkVisibility() && b.textContent.trim()).length)) === 8);

check("and a count of what is inside it",
  (await page.$eval(".ref-group:first-of-type .ref-count", (e) => e.textContent)) ===
    "5 counties · 8 local areas",
  await page.$eval(".ref-group:first-of-type .ref-count", (e) => e.textContent));

check("the root tokens are shown, since every chain starts with them",
  (await page.$$eval(".ref-root .ref-code", (n) => n.map((c) => c.textContent).join(" "))) === "west ca",
  await page.$$eval(".ref-root .ref-code", (n) => n.map((c) => c.textContent).join(" ")));

/* ---------- opening one ---------- */

await page.click(".ref-group:first-of-type summary");
await page.waitForTimeout(150);
check("opening a region shows its whole subtree at once, not one level",
  (await visibleRows()) === 13, await visibleRows());
check("and leaves the other seven closed", (await openGroups()) === 1);

const firstRows = await page.$$eval(".ref-group:first-of-type .ref-row", (n) =>
  n.map((r) => ({
    code: r.querySelector(".ref-code").textContent,
    name: r.querySelector(".ref-name").textContent,
    desc: r.querySelector(".ref-desc") ? r.querySelector(".ref-desc").textContent : "",
    depth: r.style.getPropertyValue("--depth")
  })));

check("a county row carries its code and name",
  firstRows[0].code === "dnr" && firstRows[0].name === "Del Norte County",
  JSON.stringify(firstRows[0]));
check("an area row describes itself with its towns",
  firstRows[1].code === "cre" && firstRows[1].desc === "Crescent City, Smith River, Klamath, Gasquet",
  JSON.stringify(firstRows[1]));
check("rows are indented by depth", firstRows[0].depth === "0" && firstRows[1].depth === "1",
  `${firstRows[0].depth}, ${firstRows[1].depth}`);
check("rows with something under them are marked as such",
  await page.$eval('.ref-row:has(.ref-code:text-is("dnr"))', (r) => r.classList.contains("ref-parent")));

/* ---------- expand all ---------- */

check("the button offers to expand while anything is closed", (await toggleText()) === "Expand all");
await page.click("#reference .link-btn");
await page.waitForTimeout(200);
check("expand all opens every group", (await openGroups()) === 8);
check("which is every place below the top level", (await visibleRows()) === 220, await visibleRows());
check("and the button turns into collapse", (await toggleText()) === "Collapse all");

await page.click("#reference .link-btn");
await page.waitForTimeout(200);
check("collapse all closes them again", (await openGroups()) === 0);

await page.click(".ref-group:nth-of-type(3) summary");
await page.waitForTimeout(150);
check("opening one by hand puts the button back to expand", (await toggleText()) === "Expand all");

/* ---------- read-only ---------- */

check("nothing is selected by browsing the reference",
  (await picks(page)).length === 0, JSON.stringify(await picks(page)));
check("and the command panel stays hidden",
  await page.isHidden("#output-panel"));

await tick(page, "cc", "slo", "prb");
const before = (await page.textContent("#commands")).trim();
await page.click("#reference .link-btn");
await page.waitForTimeout(200);
check("expanding the reference does not disturb an existing selection",
  (await page.textContent("#commands")).trim() === before,
  (await page.textContent("#commands")).trim());
check("nor what is ticked",
  JSON.stringify(await picks(page)) === JSON.stringify(["cc", "slo", "prb"]),
  JSON.stringify(await picks(page)));

/* ---------- arbitrary depth ---------- */

const TREE = {
  format: 1,
  name: "Testland",
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
      blurb: "A zone with four levels in it.",
      children: [{
        code: "da",
        name: "District A",
        children: [{
          code: "ta",
          name: "Town A",
          children: [{ code: "na", name: "North End", aliases: ["Northtown", "Upper End"] }]
        }]
      }]
    },
    { code: "zb", name: "Zone B", children: [{ code: "db", name: "District B" }] }
  ]
};

await page.route("**/data/regions.json", (route) =>
  route.fulfill({ contentType: "application/json", body: JSON.stringify(TREE) }));
await page.goto(SITE, { waitUntil: "networkidle" });

check("the totals name every level from the data",
  (await page.textContent(".ref-total")).includes("2 zones · 2 districts · 1 town · 1 neighbourhood"),
  await page.textContent(".ref-total"));

check("a group counts only what is under it",
  (await page.$eval(".ref-group:first-of-type .ref-count", (e) => e.textContent)) ===
    "1 district · 1 town · 1 neighbourhood",
  await page.$eval(".ref-group:first-of-type .ref-count", (e) => e.textContent));

await page.click(".ref-group:first-of-type summary");
await page.waitForTimeout(150);
const deep = await page.$$eval(".ref-group:first-of-type .ref-row", (n) =>
  n.map((r) => r.querySelector(".ref-code").textContent + "@" + r.style.getPropertyValue("--depth")));
check("a four-level branch is rendered to its full depth",
  deep.join(" ") === "da@0 ta@1 na@2", deep.join(" "));

check("aliases describe a place at whatever level it sits",
  (await page.$eval('.ref-row:has(.ref-code:text-is("na")) .ref-desc', (e) => e.textContent)) ===
    "Northtown, Upper End");

await page.click(".ref-group:nth-of-type(2) summary");
await page.waitForTimeout(150);
check("a shallower branch stops where it stops",
  (await page.$$eval(".ref-group:nth-of-type(2) .ref-row", (n) => n.length)) === 1);
check("and a place with nothing under it is not marked as a parent",
  await page.$eval('.ref-row:has(.ref-code:text-is("db"))', (r) => !r.classList.contains("ref-parent")));

console.log(errors.length ? "\nJS ERRORS:\n" + errors.join("\n") : "\nno JS errors");
await browser.close();
process.exit(pass && !errors.length ? 0 : 1);
