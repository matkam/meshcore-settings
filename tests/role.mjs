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

  await page.selectOption("#opt-bridge", "oak");
  await page.waitForTimeout(120);
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

  // Picking your own area as the second one is a no-op, not a duplicate chain.
  await page.selectOption("#opt-bridge", "prb");
  await page.waitForTimeout(120);
  check("bridging to yourself changes nothing",
    (await lines()).filter((l) => l.startsWith("region def")).length === 1, await cmds());
  await page.selectOption("#opt-bridge", "oak");

  // On firmware without region def, shared ancestry must not be placed twice —
  // west and ca belong to both chains.
  await page.selectOption("#opt-fw", "110");
  await page.waitForTimeout(120);
  const puts = (await lines()).filter((l) => l.startsWith("region put"));
  check("shared ancestry is placed once, not twice",
    puts.filter((l) => l === "region put west").length === 1 &&
    puts.filter((l) => l === "region put ca west").length === 1,
    JSON.stringify(puts));
  check("the second area's own ancestry is placed",
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
