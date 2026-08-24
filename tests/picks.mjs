import { chromium } from "playwright";
import { launchOptions, tick, untick, clearPicks, isTicked, picks } from "./harness.mjs";

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
const rows = (level) => page.$$eval(`.pick-row.lvl-${level}`, (n) => n.length);

// Ticking adds, so a scenario that wants only these picks says so.
async function only(...codes) {
  await clearPicks(page);
  await tick(page, ...codes);
}

/* ---------- one of each level ---------- */

await only("centralcoast");
check("a region alone gives a region chain",
  (await defs())[0] === "region def west california centralcoast", await cmds());
check("nothing is generated before anything is picked", true);

await tick(page, "slo");
check("adding an area deepens the chain",
  (await defs())[0] === "region def west california centralcoast slo", await cmds());

await tick(page, "slonorth");
check("adding a local area deepens it again",
  (await defs())[0] === "region def west california centralcoast slo slonorth", await cmds());

/* ---------- several at the deepest level ---------- */

await tick(page, "slocity");
check("two local areas share their ancestry on one line",
  (await defs())[0] === "region def west california centralcoast slo slonorth|slo slocity", await cmds());
check("one def line, not two", (await defs()).length === 1, JSON.stringify(await defs()));

const verifyText = await page.textContent("#verify-block");
check("both leaves are verified",
  verifyText.includes("region get slonorth") && verifyText.includes("region get slocity"), verifyText);
check("carrying several is explained where they are picked",
  /Carrying 2 places/.test(await page.textContent("#pick-note")),
  await page.textContent("#pick-note"));

/* ---------- across an area, and across a region ---------- */

await only("centralcoast", "bayarea", "slo", "eastbay", "slonorth", "oakland");
check("areas from every ticked region are shown", (await rows(1)) > 10,
  String(await rows(1)));
check("local areas from every ticked area are shown",
  (await page.$$eval('.picker input[data-code="oakland"]', (n) => n.length)) === 1);
{
  const line = (await defs())[0];
  check("a cross-region pick jumps back to the shared root",
    /\|california /.test(line) && line.includes("slonorth") && line.includes("oakland"), line);
  check("still one line", (await defs()).length === 1, JSON.stringify(await defs()));
}

/* ---------- the deepest level with anything ticked is what counts ---------- */

await untick(page, "slonorth", "oakland");
check("unticking the local areas falls back to the areas",
  (await defs()).length === 1 && (await defs())[0].includes("slo") &&
  (await defs())[0].includes("eastbay") &&
  !(await cmds()).includes("slonorth"), await cmds());

await untick(page, "slo", "eastbay");
// Order follows the option order, which is the order they appear in the data
// file — bayarea before centralcoast — not the order they were clicked.
check("unticking the areas falls back to the regions",
  (await defs())[0] === "region def west california bayarea|california centralcoast", (await defs())[0]);

await clearPicks(page);
check("clearing everything hides the output", await page.isHidden("#output-panel"));

/* ---------- the serial limit still applies ---------- */

{
  // The tree rebuilds on every tick, so the nodes have to be re-queried each
  // time rather than collected once and clicked in a loop.
  await clearPicks(page);
  async function tickAll(level) {
    for (;;) {
      const next = await page.$$eval(`.pick-row.lvl-${level} input:not(:checked)`,
        (n) => (n.length ? n[0].dataset.code : null));
      if (!next) { break; }
      await page.check(`.picker input[data-code="${next}"]`);
      await page.waitForTimeout(30);
    }
  }
  await tickAll(0);
  await tickAll(1);
  const areas = await page.$$eval(".pick-row.lvl-2 input", (n) => n.map((x) => x.dataset.code));
  await tickAll(2);
  await page.waitForTimeout(300);
  const many = await defs();
  check("a line that would overflow starts a new command", many.length > 1, String(many.length));
  check("every def line stays inside the serial limit",
    many.every((l) => l.length <= 160), JSON.stringify(many.map((l) => l.length)));
  check("no area is lost in the split",
    areas.every((c) => many.join(" ").includes(c)), JSON.stringify(many));
}

/* ---------- pre-1.16, where each name is placed by hand ---------- */

{
  await only("centralcoast", "bayarea", "slo", "eastbay", "slonorth", "oakland");
  await page.selectOption("#opt-fw", "110");
  await page.waitForTimeout(150);
  const puts = (await lines()).filter((l) => l.startsWith("region put"));
  check("no def lines on 1.10", !(await cmds()).includes("region def"));
  check("shared ancestry is placed once",
    puts.filter((l) => l === "region put west").length === 1 &&
    puts.filter((l) => l === "region put california west").length === 1, JSON.stringify(puts));
  check("each pick's own ancestry is placed",
    puts.includes("region put slonorth slo") && puts.includes("region put oakland eastbay"), JSON.stringify(puts));
  check("every placed region is flood-allowed",
    (await lines()).filter((l) => l.startsWith("region allowf")).length === puts.length,
    JSON.stringify(await lines()));
  await page.selectOption("#opt-fw", "116");
}

/* ---------- deep links ---------- */

{
  await page.goto(SITE + "#slonorth", { waitUntil: "networkidle" });
  check("a single deep link still works",
    (await defs())[0] === "region def west california centralcoast slo slonorth", await cmds());
  await tick(page, "slocity");
  check("picking several writes them all to the hash",
    /^#(slonorth,slocity|centralcoast,slo,slonorth,slocity)$/
      .test(await page.evaluate(() => location.hash)),
    await page.evaluate(() => location.hash));
}

/* ---------- it still composes with the rest ---------- */

{
  await page.goto(SITE + "#slonorth", { waitUntil: "networkidle" });
  await page.click("#edit-cmds");
  await page.fill("#commands-edit", "set dutycycle 7\nregion save");
  await page.waitForTimeout(120);
  await tick(page, "slocity");
  check("changing the picks does not overwrite an edit",
    (await page.inputValue("#commands-edit")).includes("set dutycycle 7"),
    await page.inputValue("#commands-edit"));
  await page.click("#reset-cmds");
  await page.waitForTimeout(120);
}

// A link to a bridging site has to restore the whole set, not just its first tag.
{
  await page.goto(SITE + "#slonorth,oakland", { waitUntil: "networkidle" });
  const line = (await defs())[0];
  check("a multi deep link restores every pick",
    line.includes("slonorth") && line.includes("oakland") && (await defs()).length === 1, line);
  check("ticking a parent is what reveals its children",
    (await rows(1)) > 0 && (await rows(2)) > 0,
    `${await rows(1)} areas, ${await rows(2)} local areas`);
  check("and ticks the levels above them, so the rows are visible",
    (await page.$$eval(".pick-row.lvl-0 input:checked", (n) => n.length)) === 2,
    JSON.stringify(await page.$$eval(".picker input:checked", (n) => n.map((x) => x.dataset.code))));
}

// The map has to show every pick, not just the first.
{
  await page.goto(SITE + "#slonorth,oakland", { waitUntil: "networkidle" });
  await page.waitForTimeout(250);
  check("the map marks every picked area",
    (await page.$$eval(".map-dot.is-on", (n) => n.length)) === 2,
    String(await page.$$eval(".map-dot.is-on", (n) => n.length)));
  // A place may claim several shapes — the East Bay is two counties — so this
  // is about which places are lit, not how many paths that comes to.
  check("and every outline the areas above them claim",
    (await page.$eval('.map-county[data-place="slo"]', (c) => c.classList.contains("is-on"))) &&
    (await page.$$eval('.map-county[data-place="eastbay"]',
      (ns) => ns.length === 2 && ns.every((c) => c.classList.contains("is-on")))),
    JSON.stringify(await page.$$eval(".map-county.is-on", (n) => n.map((c) => c.dataset.place))));
}

/* ---------- the node's own region table has a ceiling ----------
 * MAX_REGION_ENTRIES in the firmware is 32. Going over does not fail cleanly:
 * names are placed until the table is full, then the rest are rejected, which
 * leaves the repeater half configured.
 */
{
  await page.goto(SITE + "#slonorth", { waitUntil: "networkidle" });
  check("the count is shown while it is comfortable",
    /5 of 32 region names/.test(await page.textContent("#line-note")),
    await page.textContent("#line-note"));

  for (const code of ["norcal", "sacramentofoothills", "sierranevada",
                      "bayarea", "centralcoast", "centralvalley", "socal"]) {
    await page.check(`.picker input[data-code="${code}"]`);
    await page.waitForTimeout(35);
  }
  const inner = await page.$$eval(".pick-row.lvl-1 input",
    (n) => n.slice(0, 26).map((x) => x.dataset.code));
  for (const code of inner) {
    await page.check(`.picker input[data-code="${code}"]`);
    await page.waitForTimeout(20);
  }
  await page.waitForTimeout(300);
  check("going over the node's region limit is called out",
    /a node holds 32/.test(await page.textContent("#line-note")),
    await page.textContent("#line-note"));
  check("and it says what actually goes wrong, not just that it is too many",
    /half configured/.test(await page.textContent("#line-note")));
  check("styled as a warning",
    (await page.getAttribute("#line-note", "class")).includes("over"));
}

/* ---------- getting back out ---------- */
{
  await page.goto(SITE, { waitUntil: "networkidle" });
  check("Clear is hidden until something is picked", await page.isHidden("#clear-picks"));

  // A pick made by search can be far down a scrolling list, so it has to be
  // brought into view or it looks as though nothing happened.
  await page.fill("#search", "Big Bear");
  await page.waitForSelector("#results li");
  await page.click("#results li");
  await page.waitForTimeout(300);
  // Assert the row is actually visible rather than that the list scrolled: a
  // taller picker can bring it into view without scrolling at all, and
  // scrollTop > 0 never proved the row was among what the scroll revealed.
  check("a pick made by search is brought into view",
    await page.$eval('.pick-row:has(input[data-code="sbmountains"])', (r) => {
      const row = r.getBoundingClientRect();
      const box = r.closest(".picker").getBoundingClientRect();
      return row.top >= box.top - 1 && row.bottom <= box.bottom + 1;
    }));
  check("and ticks its ancestors so the row is reachable",
    (await picks(page)).join(",") === "socal,sanbernardino,sbmountains", (await picks(page)).join(","));
  check("Clear appears once something is picked", await page.isVisible("#clear-picks"));

  await page.click("#clear-picks");
  await page.waitForTimeout(200);
  check("Clear empties the picker", (await picks(page)).length === 0);
  check("and hides the output", await page.isHidden("#output-panel"));
  check("and drops the hash, so a reload starts fresh",
    (await page.evaluate(() => location.hash)) === "",
    await page.evaluate(() => location.hash));
}

check("no role selector remains", (await page.$$("#opt-role")).length === 0);
check("no JS errors", errs.length === 0, errs.join("; "));

await page.close();
await browser.close();
process.exit(pass ? 0 : 1);
