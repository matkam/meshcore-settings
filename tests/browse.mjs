/*
 * Reading the tree without selecting from it.
 *
 * The picker used to reveal what was inside a place only when you ticked it,
 * which made looking a code up require selecting two places you did not want.
 * Expansion is now its own gesture, and the thing most worth pinning down is
 * that it stays its own gesture: opening the whole tree must leave the
 * generated commands completely alone.
 *
 * The last section swaps in a synthetic four-level tree, as tests/levels.mjs
 * does, so "it recurses" is checked rather than inferred from a dataset that
 * happens to be three deep.
 */
import { chromium } from "playwright";
import { launchOptions, tick, untick, expand, picks, collapseAll } from "./harness.mjs";

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

const rows = () => page.$$eval(".pick-row", (n) => n.length);
// What is selected, from the model rather than the markup. Only open rows are
// rendered, so once something is collapsed the DOM no longer lists every tick.
const selected = () => page.evaluate(() => window.SettingsState.picked().map((p) => p.code));
const rowsAt = (d) => page.$$eval(`.pick-row.lvl-${d}`, (n) => n.length);
const isOpen = (code) => page.getAttribute(`.pick-toggle[data-code="${code}"]`, "aria-expanded");
const cmds = async () => (await page.textContent("#commands")).trim();

/* ---------- browsing, with nothing selected ---------- */

check("only the top level is listed at rest", (await rows()) === 13, await rows());
check("every top-level place can be opened",
  (await page.$$eval(".pick-toggle:not(.is-leaf)", (n) => n.length)) === 13);

await expand(page, "bayarea");
check("opening a region reveals its areas", (await rowsAt(1)) === 5, await rowsAt(1));
check("and ticks nothing", (await picks(page)).length === 0, JSON.stringify(await picks(page)));
check("so the settings panel stays away", await page.isHidden("#output-panel"));
check("the toggle reports itself as open", (await isOpen("bayarea")) === "true");

await expand(page, "eastbay");
check("opening an area reveals its local areas", (await rowsAt(2)) === 8, await rowsAt(2));
check("still nothing ticked", (await picks(page)).length === 0);

/* ---------- a leaf has nothing to open ----------
 * Checked with the row actually rendered: asserting the toggle is missing while
 * its row is collapsed out of the DOM would pass for the wrong reason. */

check("the local area's row is on screen to be judged",
  (await page.$$('input[data-code="oakland"]')).length === 1);
check("and a place with no children gets no toggle",
  (await page.$$('.pick-toggle[data-code="oakland"]')).length === 0);

/* ---------- descriptions ---------- */

const descOf = (code) =>
  page.$eval(`.pick-row:has(input[data-code="${code}"]) .pick-desc`, (e) => ({
    text: e.textContent, title: e.title, clipped: e.scrollWidth > e.clientWidth
  })).catch(() => null);

check("a region describes itself with its blurb",
  (await descOf("bayarea")).text === "The nine Bay Area counties.",
  JSON.stringify(await descOf("bayarea")));

check("a local area describes itself with its towns",
  (await descOf("oakland")).text === "Oakland, Berkeley, Emeryville, Alameda, Piedmont, Albany",
  JSON.stringify(await descOf("oakland")));

check("the full text is on the element, since the visible text may be clipped",
  (await descOf("oakland")).title === (await descOf("oakland")).text);

check("rows stay one line so the tree's shape survives",
  await page.$eval('.pick-row:has(input[data-code="oakland"])',
    (r) => r.getBoundingClientRect().height < 40),
  await page.$eval('.pick-row:has(input[data-code="oakland"])',
    (r) => r.getBoundingClientRect().height));

/* ---------- closing, and what is remembered ---------- */

await expand(page, "bayarea");
check("closing a region hides what was under it", (await rowsAt(1)) === 0, await rowsAt(1));
check("and says so", (await isOpen("bayarea")) === "false");

await expand(page, "bayarea");
check("reopening it remembers the area that was open inside",
  (await rowsAt(2)) === 8, await rowsAt(2));

/* ---------- expand all ---------- */

check("the button offers to expand while anything is closed",
  (await page.textContent("#expand-picks")) === "Expand all");

await page.click("#expand-picks");
await page.waitForTimeout(500);
check("expand all opens the whole tree", (await rows()) === 191, await rows());
check("and it is still a selection of nothing", (await picks(page)).length === 0);
check("the button turns into collapse",
  (await page.textContent("#expand-picks")) === "Collapse all");
check("the list scrolls rather than the page growing without limit",
  await page.$eval(".picker", (e) => e.scrollHeight > e.clientHeight));

await page.click("#expand-picks");
await page.waitForTimeout(300);
check("collapse all flattens it again", (await rows()) === 13, await rows());

await expand(page, "sacramentovalley");
check("opening one by hand puts the button back to expand",
  (await page.textContent("#expand-picks")) === "Expand all");

/* ---------- the resize handle ----------
 * `resize` writes an inline height, but max-height clamps what that renders as,
 * so the handle used to stop dead at the cap — the exact point someone reaches
 * for it. Grabbing it now hands the height over.
 */
{
  const height = () => page.$eval(".picker", (e) => Math.round(e.getBoundingClientRect().height));
  const drag = async (dy) => {
    await page.$eval(".picker", (e) => e.scrollIntoView({ block: "center" }));
    await page.waitForTimeout(150);
    const c = await page.$eval(".picker", (e) => {
      const r = e.getBoundingClientRect();
      return { x: r.right - 5, y: r.bottom - 5 };
    });
    await page.mouse.move(c.x, c.y);
    await page.mouse.down();
    await page.mouse.move(c.x, c.y + dy, { steps: 12 });
    await page.mouse.up();
    await page.waitForTimeout(200);
    return height();
  };

  await page.click("#expand-picks");           // fill it so the cap is binding
  await page.waitForTimeout(600);
  const capped = await height();

  const taller = await drag(300);
  check("the handle drags past the automatic cap", taller > capped + 200,
    `${capped} -> ${taller}`);

  const shorter = await drag(-500);
  check("and back down below it", shorter < capped && shorter < taller - 300,
    `cap ${capped}, dragged ${taller} -> ${shorter}`);

  await page.click("#expand-picks");
  await page.waitForTimeout(300);
}

/* A grab that never became a drag should leave nothing behind, or an accidental
 * click on the corner would pin the box at whatever size it happened to be. */
{
  await page.goto(SITE, { waitUntil: "networkidle" });
  const c = await page.$eval(".picker", (e) => {
    const r = e.getBoundingClientRect();
    return { x: r.right - 5, y: r.bottom - 5 };
  });
  await page.mouse.move(c.x, c.y);
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(150);
  const style = await page.$eval(".picker", (e) => ({ h: e.style.height, m: e.style.maxHeight }));
  check("a click on the handle that never drags leaves no inline height",
    style.h === "" && style.m === "", JSON.stringify(style));

  const before = await page.$eval(".picker", (e) => Math.round(e.getBoundingClientRect().height));
  await page.click("#expand-picks");
  await page.waitForTimeout(600);
  check("so the box still grows with its content afterwards",
    (await page.$eval(".picker", (e) => Math.round(e.getBoundingClientRect().height))) > before + 200);
  await page.click("#expand-picks");
  await page.waitForTimeout(300);
}

/* ---------- selecting still works, and still cascades ---------- */

await collapseAll(page);
await tick(page, "centralcoast");
check("ticking a place still opens it", (await isOpen("centralcoast")) === "true");
check("which is what makes the next level reachable", (await rowsAt(1)) === 7, await rowsAt(1));

await tick(page, "slocounty", "pasorobles");
check("the chain builds as before",
  (await cmds()).includes("region def west ca centralcoast slocounty pasorobles"), await cmds());

// The name sits inside a wrapper now, so the rule that marks a chosen row is
// two levels down from the checkbox rather than beside it. Easy to break by
// restructuring the row and never notice by eye.
const weightOf = (code) => page.$eval(`.pick-row:has(input[data-code="${code}"]) .pick-name`,
  (e) => getComputedStyle(e).fontWeight);
check("a ticked row reads as chosen", (await weightOf("pasorobles")) === "600", await weightOf("pasorobles"));
check("and an unticked one does not", (await weightOf("bigsur")) === "400", await weightOf("bigsur"));

await untick(page, "pasorobles");
check("unticking does not close anything", (await isOpen("slocounty")) === "true");
check("but it does drop the pick",
  !(await picks(page)).includes("pasorobles"), JSON.stringify(await picks(page)));

/* ---------- browsing never disturbs a selection ---------- */

const before = await cmds();
await page.click("#expand-picks");
await page.waitForTimeout(500);
check("expanding everything leaves the commands untouched", (await cmds()) === before, await cmds());
await page.click("#expand-picks");
await page.waitForTimeout(300);
check("and collapsing everything leaves them untouched too",
  (await cmds()) === before, await cmds());
check("including what is ticked",
  JSON.stringify(await selected()) === JSON.stringify(["centralcoast", "slocounty"]),
  JSON.stringify(await selected()));

// Worth stating outright: only open rows are rendered, so a collapsed tick is
// invisible without being undone. The commands above are the proof.
check("a ticked row inside a closed place leaves the markup, not the selection",
  (await picks(page)).length === 1 && (await selected()).length === 2,
  `dom=${JSON.stringify(await picks(page))} model=${JSON.stringify(await selected())}`);

await page.click("#expand-picks");
await page.waitForTimeout(500);
check("and comes back ticked when it is opened again",
  JSON.stringify(await picks(page)) === JSON.stringify(["centralcoast", "slocounty"]),
  JSON.stringify(await picks(page)));

/* ---------- a pick from elsewhere opens its way in ---------- */

await page.goto(SITE + "#pasorobles", { waitUntil: "networkidle" });
check("a deep link opens the tree down to what it selected",
  (await isOpen("centralcoast")) === "true" && (await isOpen("slocounty")) === "true",
  `centralcoast=${await isOpen("centralcoast")} slocounty=${await isOpen("slocounty")}`);
check("so the selected row is actually on screen",
  await page.$eval('.pick-row:has(input[data-code="pasorobles"])', (r) => r.checkVisibility()));

await page.fill("#search", "Bakersfield");
await page.waitForSelector("#results li[role=option]");
await page.click("#results li[role=option]:first-child");
await page.waitForTimeout(200);
check("and so does a search result",
  await page.$eval('.pick-row:has(input[data-code="bakersfield"])', (r) => r.checkVisibility()));

/* ---------- the scope line ---------- */

check("the scope line says where chains start and how much there is",
  (await page.textContent("#pick-scope")) ===
    "west › ca prefixes every chain · 13 regions, 84 areas and 94 local areas to choose from.",
  await page.textContent("#pick-scope"));

/* ---------- keyboard ---------- */

await page.goto(SITE, { waitUntil: "networkidle" });
await page.focus('.pick-toggle[data-code="northcoast"]');
await page.keyboard.press("Enter");
await page.waitForTimeout(150);
check("the disclosure works from the keyboard", (await isOpen("northcoast")) === "true");
check("without selecting anything", (await picks(page)).length === 0);

await page.keyboard.press("Tab");
check("and tab moves on to that row's checkbox",
  await page.evaluate(() => document.activeElement.dataset.code) === "northcoast",
  await page.evaluate(() => document.activeElement.tagName + "/" +
    (document.activeElement.dataset.code || "")));

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
      blurb: "A zone four levels deep.",
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

check("the scope line uses the data's own level names",
  (await page.textContent("#pick-scope")) ===
    "west › tl prefixes every chain · 2 zones, 2 districts, 1 town and 1 neighbourhood to choose from.",
  await page.textContent("#pick-scope"));

await expand(page, "za", "da", "ta");
check("browsing reaches a fourth level", (await rowsAt(3)) === 1, await rowsAt(3));
check("with nothing selected on the way down", (await picks(page)).length === 0);
check("and aliases describe a place at whatever level it sits",
  (await descOf("na")).text === "Northtown, Upper End", JSON.stringify(await descOf("na")));

await page.click("#expand-picks");
await page.waitForTimeout(300);
check("expand all covers a ragged tree", (await rows()) === 6, await rows());
check("and the shallow branch grows no phantom level",
  (await page.$$('.pick-toggle[data-code="db"]')).length === 0);

console.log(errors.length ? "\nJS ERRORS:\n" + errors.join("\n") : "\nno JS errors");
await browser.close();
process.exit(pass && !errors.length ? 0 : 1);
