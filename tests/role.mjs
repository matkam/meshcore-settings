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

// The picker is add-one-at-a-time, so a test that wants three says so three times.
async function addBridge(code) {
  await page.selectOption("#opt-bridge", code);
  await page.click("#add-bridge");
  await page.waitForTimeout(120);
}

/* ---------- the default is unchanged ---------- */

check("defaults to the ordinary local site", (await page.inputValue("#opt-role")) === "local");
check("local carries the full chain",
  (await lines()).includes("region def west ca cc slo prb"), await cmds());
check("the second-area picker is hidden unless bridging", await page.isHidden("#bridge-field"));

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

/* ---------- bridge: strategy 3, a second chain ---------- */
{
  await page.selectOption("#opt-role", "bridge");
  await page.waitForTimeout(120);
  check("choosing bridge reveals the second-area picker", await page.isVisible("#bridge-field"));
  check("with nothing chosen it behaves as an ordinary site",
    (await lines()).filter((l) => l.startsWith("region def")).length === 1, await cmds());

  await addBridge("oak");
  const defs = (await lines()).filter((l) => l.startsWith("region def"));
  check("a bridge emits two chains", defs.length === 2, JSON.stringify(defs));
  check("the primary chain is first", defs[0] === "region def west ca cc slo prb", defs[0]);
  check("the second chain is the other area's ancestry",
    defs[1] === "region def west ca sfb ala oak", defs[1]);
  check("both leaves are verified",
    /region get prb/.test(await page.textContent("#verify-block")) &&
    /region get oak/.test(await page.textContent("#verify-block")),
    await page.textContent("#verify-block"));
  check("the explanation names the second area",
    /Oakland/.test(await page.textContent("#explain")));
  check("the advice is to use it sparingly",
    /sparingly/i.test(await page.textContent("#role-hint")));

  // Adding your own area is a no-op, and must not leave a chip claiming otherwise.
  await addBridge("prb");
  check("bridging to yourself adds no chain",
    (await lines()).filter((l) => l.startsWith("region def")).length === 2, await cmds());
  check("and adds no chip either",
    (await page.$$eval("#bridge-list li", (n) => n.length)) === 1,
    JSON.stringify(await page.$$eval("#bridge-list li span", (n) => n.map((x) => x.textContent))));

  // Selecting a bridged area as the primary one makes its chip redundant.
  await page.evaluate(() => window.SettingsState.select("oak"));
  await page.waitForTimeout(150);
  check("a chip for the newly primary area is dropped",
    !(await page.$$eval("#bridge-list li span", (n) => n.map((x) => x.textContent)))
      .includes("Oakland / Berkeley"),
    JSON.stringify(await page.$$eval("#bridge-list li span", (n) => n.map((x) => x.textContent))));
  await page.evaluate(() => window.SettingsState.select("prb"));
  await page.waitForTimeout(150);
  await addBridge("oak");

  // Adding the same area twice is a no-op too — the tag is carried either way.
  const before = (await page.$$eval("#bridge-list li", (n) => n.length));
  await addBridge("oak");
  check("adding the same area twice does nothing",
    (await page.$$eval("#bridge-list li", (n) => n.length)) === before,
    `${before} -> ${await page.$$eval("#bridge-list li", (n) => n.length)}`);

  // More than two: our local areas are finer than the metro tags the source
  // describes, so one high site can genuinely cover several.
  await addBridge("eka");
  await addBridge("cre");
  const many = (await lines()).filter((l) => l.startsWith("region def"));
  check("several areas can be carried at once", many.length === 4, JSON.stringify(many));
  check("each extra area gets its own chain",
    many.some((l) => l.endsWith(" oak")) && many.some((l) => l.endsWith(" eka")) &&
    many.some((l) => l.endsWith(" cre")), JSON.stringify(many));
  const verifyText = await page.textContent("#verify-block");
  check("every leaf is verified",
    ["prb", "oak", "eka", "cre"].every((c) => verifyText.includes("region get " + c)),
    verifyText);
  check("a long list is called out rather than silently accepted",
    /lot of local traffic/.test(await page.textContent("#bridge-hint")) ||
    (await page.$$eval("#bridge-list li", (n) => n.length)) <= 3,
    await page.textContent("#bridge-hint"));

  // Removing one takes its chain with it.
  await page.click("#bridge-list li:first-child .chip-x");
  await page.waitForTimeout(150);
  check("removing an area drops its chain",
    (await lines()).filter((l) => l.startsWith("region def")).length === 3, await cmds());
  check("the chip goes too",
    (await page.$$eval("#bridge-list li", (n) => n.length)) === 2,
    JSON.stringify(await page.$$eval("#bridge-list li span", (n) => n.map((x) => x.textContent))));

  // On firmware without region def, shared ancestry must not be placed twice —
  // west and ca belong to both chains.
  await page.selectOption("#opt-fw", "110");
  await page.waitForTimeout(120);
  const puts = (await lines()).filter((l) => l.startsWith("region put"));
  check("shared ancestry is placed once, not twice",
    puts.filter((l) => l === "region put west").length === 1 &&
    puts.filter((l) => l === "region put ca west").length === 1,
    JSON.stringify(puts));
  // oak was the one removed above, so what should be here is eka's and cre's
  // ancestry — and nco, shared by both, exactly once.
  check("each remaining area's own ancestry is placed",
    puts.includes("region put nco ca") && puts.includes("region put hum nco") &&
    puts.includes("region put eka hum") && puts.includes("region put dnr nco") &&
    puts.includes("region put cre dnr"), JSON.stringify(puts));
  check("ancestry shared between two bridged areas is placed once",
    puts.filter((l) => l === "region put nco ca").length === 1, JSON.stringify(puts));
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
