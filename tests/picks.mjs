import { chromium } from "playwright";
import { launchOptions } from "./harness.mjs";

const SITE = process.env.SITE || "http://127.0.0.1:8765/";
const browser = await chromium.launch(launchOptions);

let pass = true;
function check(name, ok, detail) {
  pass &&= !!ok;
  console.log((ok ? "PASS " : "FAIL ") + name + (!ok && detail !== undefined ? "  -> " + detail : ""));
}

const page = await browser.newPage({ viewport: { width: 1000, height: 1200 } });
const errs = [];
page.on("pageerror", (e) => errs.push(e.message));
await page.goto(SITE, { waitUntil: "networkidle" });

const cmds = async () => (await page.textContent("#commands")).trim();
const lines = async () => (await cmds()).split("\n");
const defs = async () => (await lines()).filter((l) => l.startsWith("region def"));
const opts = (sel) => page.$$eval(sel, (s) => s[0].options.length);

async function pick(region, county, area) {
  await page.selectOption("#sel-region", region);
  await page.waitForTimeout(120);
  if (county) { await page.selectOption("#sel-county", county); await page.waitForTimeout(120); }
  if (area) { await page.selectOption("#sel-area", area); await page.waitForTimeout(120); }
}

/* ---------- one of each level ---------- */

await pick(["cc"]);
check("a region alone gives a region chain",
  (await defs())[0] === "region def west ca cc", await cmds());
check("nothing is generated before anything is picked", true);

await page.selectOption("#sel-county", ["slo"]);
await page.waitForTimeout(120);
check("adding a county deepens the chain",
  (await defs())[0] === "region def west ca cc slo", await cmds());

await page.selectOption("#sel-area", ["prb"]);
await page.waitForTimeout(120);
check("adding an area deepens it again",
  (await defs())[0] === "region def west ca cc slo prb", await cmds());

/* ---------- several at the deepest level ---------- */

await page.selectOption("#sel-area", ["prb", "slc"]);
await page.waitForTimeout(150);
check("two areas share their ancestry on one line",
  (await defs())[0] === "region def west ca cc slo prb|slo slc", await cmds());
check("one def line, not two", (await defs()).length === 1, JSON.stringify(await defs()));

const verifyText = await page.textContent("#verify-block");
check("both leaves are verified",
  verifyText.includes("region get prb") && verifyText.includes("region get slc"), verifyText);
check("carrying several is explained where they are picked",
  /Carrying 2 tags/.test(await page.textContent("#pick-note")),
  await page.textContent("#pick-note"));

/* ---------- across a county, and across a region ---------- */

await pick(["cc", "sfb"], ["slo", "ala"], ["prb", "oak"]);
check("the county list draws from every selected region", (await opts("#sel-county")) > 12,
  String(await opts("#sel-county")));
check("the area list draws from every selected county",
  (await page.$$eval("#sel-area option", (o) => o.map((x) => x.value))).includes("oak"));
{
  const line = (await defs())[0];
  check("a cross-county pick jumps back to the shared region",
    /\|ca /.test(line) && line.includes("prb") && line.includes("oak"), line);
  check("still one line", (await defs()).length === 1, JSON.stringify(await defs()));
}

/* ---------- the deepest level with anything ticked is what counts ---------- */

await page.selectOption("#sel-area", []);
await page.waitForTimeout(150);
check("clearing the areas falls back to the counties",
  (await defs()).length === 1 && (await defs())[0].includes("slo") && (await defs())[0].includes("ala") &&
  !(await cmds()).includes("prb"), await cmds());

await page.selectOption("#sel-county", []);
await page.waitForTimeout(150);
// Order follows the option order, which is the order they appear in the data
// file — sfb before cc — not the order they were clicked.
check("clearing the counties falls back to the regions",
  (await defs())[0] === "region def west ca sfb|ca cc", (await defs())[0]);

await page.selectOption("#sel-region", []);
await page.waitForTimeout(150);
check("clearing everything hides the output", await page.isHidden("#output-panel"));

/* ---------- the serial limit still applies ---------- */

{
  const allRegions = await page.$$eval("#sel-region option", (o) => o.map((x) => x.value));
  await pick(allRegions);
  const counties = await page.$$eval("#sel-county option", (o) => o.map((x) => x.value));
  await page.selectOption("#sel-county", counties);
  await page.waitForTimeout(150);
  const areas = await page.$$eval("#sel-area option", (o) => o.map((x) => x.value));
  await page.selectOption("#sel-area", areas);
  await page.waitForTimeout(250);
  const many = await defs();
  check("a line that would overflow starts a new command", many.length > 1, String(many.length));
  check("every def line stays inside the serial limit",
    many.every((l) => l.length <= 160), JSON.stringify(many.map((l) => l.length)));
  check("no area is lost in the split",
    areas.every((c) => many.join(" ").includes(c)), JSON.stringify(many));
}

/* ---------- pre-1.16, where each name is placed by hand ---------- */

{
  await pick(["cc", "sfb"], ["slo", "ala"], ["prb", "oak"]);
  await page.selectOption("#opt-fw", "110");
  await page.waitForTimeout(150);
  const puts = (await lines()).filter((l) => l.startsWith("region put"));
  check("no def lines on 1.10", !(await cmds()).includes("region def"));
  check("shared ancestry is placed once",
    puts.filter((l) => l === "region put west").length === 1 &&
    puts.filter((l) => l === "region put ca west").length === 1, JSON.stringify(puts));
  check("each pick's own ancestry is placed",
    puts.includes("region put prb slo") && puts.includes("region put oak ala"), JSON.stringify(puts));
  check("every placed region is flood-allowed",
    (await lines()).filter((l) => l.startsWith("region allowf")).length === puts.length,
    JSON.stringify(await lines()));
  await page.selectOption("#opt-fw", "116");
}

/* ---------- deep links ---------- */

{
  await page.goto(SITE + "#prb", { waitUntil: "networkidle" });
  check("a single deep link still works",
    (await defs())[0] === "region def west ca cc slo prb", await cmds());
  await page.selectOption("#sel-area", ["prb", "slc"]);
  await page.waitForTimeout(150);
  check("picking several writes them all to the hash",
    (await page.evaluate(() => location.hash)) === "#prb,slc",
    await page.evaluate(() => location.hash));
}

/* ---------- it still composes with the rest ---------- */

{
  await page.goto(SITE + "#prb", { waitUntil: "networkidle" });
  await page.click("#edit-cmds");
  await page.fill("#commands-edit", "set dutycycle 7\nregion save");
  await page.waitForTimeout(120);
  await page.selectOption("#sel-area", ["prb", "slc"]);
  await page.waitForTimeout(150);
  check("changing the picks does not overwrite an edit",
    (await page.inputValue("#commands-edit")).includes("set dutycycle 7"),
    await page.inputValue("#commands-edit"));
  await page.click("#reset-cmds");
  await page.waitForTimeout(120);
}

// A link to a bridging site has to restore the whole set, not just its first tag.
{
  await page.goto(SITE + "#prb,oak", { waitUntil: "networkidle" });
  const line = (await defs())[0];
  check("a multi deep link restores every pick",
    line.includes("prb") && line.includes("oak") && (await defs()).length === 1, line);
  check("and selects the levels above them",
    (await page.$$eval("#sel-region option:checked", (o) => o.map((x) => x.value))).length === 2,
    JSON.stringify(await page.$$eval("#sel-region option:checked", (o) => o.map((x) => x.value))));
}

// The map has to show every pick, not just the first.
{
  await page.goto(SITE + "#prb,oak", { waitUntil: "networkidle" });
  await page.waitForTimeout(250);
  check("the map marks every picked area",
    (await page.$$eval(".map-dot.is-on", (n) => n.length)) === 2,
    String(await page.$$eval(".map-dot.is-on", (n) => n.length)));
  check("and every county they sit in",
    (await page.$$eval(".map-county.is-on", (n) => n.length)) === 2,
    String(await page.$$eval(".map-county.is-on", (n) => n.length)));
}

check("no role selector remains", (await page.$$("#opt-role")).length === 0);
check("no JS errors", errs.length === 0, errs.join("; "));

await page.close();
await browser.close();
process.exit(pass ? 0 : 1);
