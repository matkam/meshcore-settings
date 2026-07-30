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
await page.goto(SITE + "#prb", { waitUntil: "networkidle" });
await page.evaluate(() => { document.querySelector("details.advanced").open = true; });

const cmds = async () => (await page.textContent("#commands")).trim();
const lines = async () => (await cmds()).split("\n");
const chain = async () => (await page.$$eval("#chain .tok", (n) => n.map((x) => x.textContent))).join(" ");

const boxes = async () => page.$$eval("#bridge-picker input", (n) => n.length);

async function tick(code) {
  await page.check(`#bridge-picker input[value=${code}]`);
  await page.waitForTimeout(150);
}
async function untick(code) {
  await page.uncheck(`#bridge-picker input[value=${code}]`);
  await page.waitForTimeout(150);
}

/* ---------- the default is unchanged ---------- */

check("defaults to the ordinary local site", (await page.inputValue("#opt-role")) === "local");
check("local carries the full chain",
  (await lines()).includes("region def west ca cc slo prb"), await cmds());
check("the extras picker is hidden unless bridging", await page.isHidden("#bridge-field"));

/* ---------- long-haul: strategy 1, ancestry to the state and no further ---------- */
{
  await page.selectOption("#opt-role", "longhaul");
  await page.waitForTimeout(120);
  check("long-haul carries only the root tags",
    (await lines()).includes("region def west ca"), await cmds());
  check("long-haul drops the local tags",
    !(await cmds()).includes("slo") && !(await cmds()).includes("prb"), await cmds());
  check("the chain display shows the truth", (await chain()) === "west ca", await chain());
  check("verification reads back the new leaf",
    /region get ca/.test(await page.textContent("#verify-block")));
  check("it says what it is for",
    /long-haul|dedicated relay/i.test(await page.textContent("#role-hint")),
    await page.textContent("#role-hint"));
  check("the explanation covers the missing tags",
    /no local tags/i.test(await page.textContent("#explain")));

  // Also correct on the oldest firmware, where each name is placed by hand.
  await page.selectOption("#opt-fw", "110");
  await page.waitForTimeout(120);
  check("long-haul on 1.10 puts only the root tags",
    JSON.stringify((await lines()).filter((l) => l.startsWith("region put"))) ===
    JSON.stringify(["region put west", "region put ca west"]),
    JSON.stringify((await lines()).filter((l) => l.startsWith("region put"))));
  await page.selectOption("#opt-fw", "116");
}

/* ---------- bridge: strategy 3, extra peer tags ---------- */
{
  await page.selectOption("#opt-role", "bridge");
  await page.waitForTimeout(150);
  check("choosing bridge reveals the picker", await page.isVisible("#bridge-field"));
  check("with nothing ticked it behaves as an ordinary site",
    (await lines()).filter((l) => l.startsWith("region def")).length === 1, await cmds());

  // Extras are peers of what is selected, never a different level.
  check("the picker offers other local areas", (await boxes()) === 161, String(await boxes()));
  check("it does not offer the area already selected",
    (await page.$$eval("#bridge-picker input", (n) => n.map((x) => x.value))).indexOf("prb") === -1);
  check("the label names the level", /other local areas/.test(await page.textContent("#bridge-label")),
    await page.textContent("#bridge-label"));

  // A bridging site covers its neighbours, so those should not need scrolling for.
  const order = await page.$$eval("#bridge-picker .bridge-km",
    (n) => n.slice(0, 12).map((x) => parseFloat(x.textContent)));
  check("candidates are ordered nearest first",
    order.every((km, i) => i === 0 || km >= order[i - 1]), JSON.stringify(order));
  check("the nearest is a neighbour, not an arbitrary first entry",
    order[0] < 60, String(order[0]));
  check("each row says where it is, since names repeat across the state",
    (await page.$$eval("#bridge-picker .bridge-where", (n) => n.length)) === (await boxes()));

  await tick("oak");
  const defs = (await lines()).filter((l) => l.startsWith("region def"));
  check("one def line, not two", defs.length === 1, JSON.stringify(defs));
  check("the branch is joined with a cursor jump",
    defs[0] === "region def west ca cc slo prb|ca sfb ala oak", defs[0]);
  check("both leaves are verified",
    /region get prb/.test(await page.textContent("#verify-block")) &&
    /region get oak/.test(await page.textContent("#verify-block")),
    await page.textContent("#verify-block"));

  // Two more, on the same line, each jumping back to the deepest shared name.
  await tick("eka");
  await tick("cre");
  const one = (await lines()).filter((l) => l.startsWith("region def"));
  check("three extras still fit on one line", one.length === 1, JSON.stringify(one));
  check("each branch jumps from where the cursor actually is",
    one[0] === "region def west ca cc slo prb|ca sfb ala oak|ca nco hum eka|nco dnr cre", one[0]);
  const verifyText = await page.textContent("#verify-block");
  check("every leaf is verified",
    ["prb", "oak", "eka", "cre"].every((c) => verifyText.includes("region get " + c)), verifyText);

  // Unticking drops that branch.
  await untick("oak");
  check("unticking removes the branch",
    !(await cmds()).includes("oak"), await cmds());

  // The serial limit still applies to the joined line.
  {
    const all = await page.$$eval("#bridge-picker input", (n) => n.slice(0, 30).map((x) => x.value));
    for (const c of all) { await page.check(`#bridge-picker input[value=${c}]`); }
    await page.waitForTimeout(300);
    const many = (await lines()).filter((l) => l.startsWith("region def"));
    check("a line that would overflow starts a new command", many.length > 1, String(many.length));
    check("every def line stays inside the serial limit",
      many.every((l) => l.length <= 160), JSON.stringify(many.map((l) => l.length)));
    check("no branch is lost in the split",
      many.join(" ").includes("cre") && many.join(" ").includes("eka"), JSON.stringify(many));
    for (const c of all) { await page.uncheck(`#bridge-picker input[value=${c}]`); }
    await page.waitForTimeout(200);
  }

  // A county-wide site bridges other counties, not areas.
  await page.evaluate(() => window.SettingsState.select("slo"));
  await page.waitForTimeout(250);
  check("a county selection offers counties", (await boxes()) === 57, String(await boxes()));
  check("the label follows the level", /other counties/.test(await page.textContent("#bridge-label")),
    await page.textContent("#bridge-label"));
  check("picks from the old level are dropped",
    (await page.$$eval("#bridge-picker input:checked", (n) => n.length)) === 0);
  await tick("mry");
  check("county bridging jumps from the shared region",
    (await lines()).includes("region def west ca cc slo|cc mry"), await cmds());

  // And a region-wide site bridges other regions.
  await page.evaluate(() => window.SettingsState.select("cc"));
  await page.waitForTimeout(250);
  check("a region selection offers regions", (await boxes()) === 7, String(await boxes()));
  await tick("sfb");
  check("region bridging jumps from ca",
    (await lines()).includes("region def west ca cc|ca sfb"), await cmds());

  // Pre-1.16 has no region def, so it falls back to one put per name, deduped.
  await page.evaluate(() => window.SettingsState.select("prb"));
  await page.waitForTimeout(200);
  await tick("oak");
  await page.selectOption("#opt-fw", "110");
  await page.waitForTimeout(200);
  const puts = (await lines()).filter((l) => l.startsWith("region put"));
  check("no def lines on 1.10", !(await cmds()).includes("region def"));
  check("shared ancestry is placed once", 
    puts.filter((l) => l === "region put west").length === 1 &&
    puts.filter((l) => l === "region put ca west").length === 1, JSON.stringify(puts));
  check("the bridged area's own ancestry is placed",
    puts.includes("region put sfb ca") && puts.includes("region put ala sfb") &&
    puts.includes("region put oak ala"), JSON.stringify(puts));
  check("every placed region is flood-allowed on 1.10",
    (await lines()).filter((l) => l.startsWith("region allowf")).length === puts.length,
    JSON.stringify(await lines()));
  await page.selectOption("#opt-fw", "116");
}

/* ---------- it composes with everything else ---------- */
{
  await page.selectOption("#opt-role", "local");
  await page.waitForTimeout(120);
  check("switching back restores the full chain",
    (await lines()).includes("region def west ca cc slo prb"), await cmds());

  // A role change is a generated-command change, so an edit must still win.
  await page.click("#edit-cmds");
  await page.fill("#commands-edit", "set dutycycle 7\nregion save");
  await page.waitForTimeout(120);
  await page.selectOption("#opt-role", "longhaul");
  await page.waitForTimeout(150);
  check("changing role does not overwrite an edit",
    (await page.inputValue("#commands-edit")).includes("set dutycycle 7"),
    await page.inputValue("#commands-edit"));
  check("the edited list is still what would be sent",
    JSON.stringify(await page.evaluate(() => window.SettingsState.get().lines)) ===
    JSON.stringify(["set dutycycle 7", "region save"]));
  await page.click("#reset-cmds");
  await page.waitForTimeout(120);
  await page.selectOption("#opt-role", "local");
}

check("no JS errors", errs.length === 0, errs.join("; "));

await page.close();
await browser.close();
process.exit(pass ? 0 : 1);
