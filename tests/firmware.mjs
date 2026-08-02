import { chromium } from "playwright";
import { launchOptions, shot, tick, untick } from "./harness.mjs";

const SITE = process.env.SITE || "http://127.0.0.1:8765/";
const browser = await chromium.launch(launchOptions);
const page = await browser.newPage({ viewport: { width: 1000, height: 1200 } });

const errors = [];
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });

let pass = true;
function check(name, actual, expected) {
  const ok = actual === expected;
  pass &&= ok;
  console.log((ok ? "PASS " : "FAIL ") + name);
  if (!ok) console.log("--- expected ---\n" + expected + "\n--- actual ---\n" + actual + "\n");
}

await page.goto(SITE + "#slonorth", { waitUntil: "networkidle" });
const cmds = async () => (await page.textContent("#commands")).trim();

// 1.16+ default
check("1.16 default", await cmds(), [
  "set dutycycle 100", "set path.hash.mode 1", "set flood.advert.interval 24", "set loop.detect moderate",
  "region def west california centralcoast slo slonorth", "region save"].join("\n"));

// 1.15: region put/allowf, dutycycle + hash still present
await page.selectOption("#opt-fw", "115");
check("1.15 (no allowf)", await cmds(), [
  "set dutycycle 100", "set path.hash.mode 1", "set flood.advert.interval 24", "set loop.detect moderate",
  "region put west", "region put california west", "region put centralcoast california",
  "region put slo centralcoast", "region put slonorth slo",
  "region save"].join("\n"));

// 1.14: set af, hash still present
await page.selectOption("#opt-fw", "114");
check("1.14", await cmds(), [
  "set af 0", "set path.hash.mode 1", "set flood.advert.interval 24", "set loop.detect moderate",
  "region put west", "region allowf west",
  "region put california west", "region allowf california",
  "region put centralcoast california", "region allowf centralcoast",
  "region put slo centralcoast", "region allowf slo",
  "region put slonorth slo", "region allowf slonorth",
  "region save"].join("\n"));

// 1.10-1.13: exactly the user's example
await page.selectOption("#opt-fw", "110");
check("1.10-1.13 matches user's example", await cmds(), [
  "set af 0", "set flood.advert.interval 24",
  "region put west", "region allowf west",
  "region put california west", "region allowf california",
  "region put centralcoast california", "region allowf centralcoast",
  "region put slo centralcoast", "region allowf slo",
  "region put slonorth slo", "region allowf slonorth",
  "region save"].join("\n"));

console.log("\nhash select disabled on 1.10-1.13:", await page.isDisabled("#opt-hash"));
console.log("fw hint:", await page.textContent("#fw-hint"));
console.log("line note:", await page.textContent("#line-note"));
console.log("verify block:\n" + (await page.textContent("#verify-block")).trim());

// af rounding
await page.evaluate(() => { document.querySelector("details.advanced").open = true; });
await page.fill("#opt-duty", "50");
check("af from 50%", (await cmds()).split("\n")[0], "set af 1");
console.log("duty hint @50:", await page.textContent("#duty-hint"));
await page.fill("#opt-duty", "25");
check("af from 25%", (await cmds()).split("\n")[0], "set af 3");
await page.fill("#opt-duty", "10");
check("af from 10%", (await cmds()).split("\n")[0], "set af 9");
await page.fill("#opt-duty", "100");

// home/default still work on old firmware
await page.check("#opt-home");
const withHome = (await cmds()).split("\n");
check("home/default on old fw", withHome.slice(-3).join("\n"),
  ["region home slonorth", "region default slonorth", "region save"].join("\n"));
await page.uncheck("#opt-home");

// county-level chain on old firmware (4 tokens)
await untick(page, "slonorth");
check("county-level on 1.10", await cmds(), [
  "set af 0", "set flood.advert.interval 24",
  "region put west", "region allowf west",
  "region put california west", "region allowf california",
  "region put centralcoast california", "region allowf centralcoast",
  "region put slo centralcoast", "region allowf slo",
  "region save"].join("\n"));

// switching back restores region def
await page.selectOption("#opt-fw", "116");
check("back to 1.16", await cmds(), [
  "set dutycycle 100", "set path.hash.mode 1", "set flood.advert.interval 24", "set loop.detect moderate",
  "region def west california centralcoast slo", "region save"].join("\n"));
console.log("hash re-enabled:", !(await page.isDisabled("#opt-hash")));

// screenshot of the old-firmware view
await page.selectOption("#opt-fw", "110");
await tick(page, "slonorth");
await page.evaluate(() => { document.querySelector("details.advanced").open = false; });
await page.screenshot({ path: shot("fw-old.png"), clip: { x: 0, y: 180, width: 1000, height: 1250 } });

/* ---------- tags ----------
 * A tag is one extra name rather than a chain, so `region put` places it on
 * every tier — the only difference further down is that 1.14 and older need an
 * explicit allowf, the same as every other name.
 */
await page.goto(SITE + "#dtla", { waitUntil: "networkidle" });
await page.selectOption("#opt-fw", "110");
check("a tag is placed as its own name on 1.10", await cmds(), [
  "set af 0", "set flood.advert.interval 24",
  "region put west", "region allowf west",
  "region put california west", "region allowf california",
  "region put losangeles california", "region allowf losangeles",
  "region put dtla losangeles", "region allowf dtla",
  "region put socal california", "region allowf socal",
  "region save"].join("\n"));
await page.selectOption("#opt-fw", "116");
check("and the same line on 1.16, where the chain uses region def", await cmds(), [
  "set dutycycle 100", "set path.hash.mode 1", "set flood.advert.interval 24", "set loop.detect moderate",
  "region def west california losangeles dtla", "region put socal california", "region save"].join("\n"));
await page.goto(SITE + "#slonorth", { waitUntil: "networkidle" });

for (const w of [390, 768, 1200]) {
  await page.setViewportSize({ width: w, height: 900 });
  await page.waitForTimeout(80);
  const over = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  pass &&= !over;
  console.log((over ? "FAIL " : "PASS ") + `no horizontal scroll at ${w}px`);
}

console.log(errors.length ? "\nJS ERRORS:\n" + errors.join("\n") : "\nno JS errors");
await browser.close();
process.exit(pass && !errors.length ? 0 : 1);
