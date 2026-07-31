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

await page.goto(SITE + "#pasorobles", { waitUntil: "networkidle" });
const cmds = async () => (await page.textContent("#commands")).trim();

// 1.16+ default
check("1.16 default", await cmds(), [
  "set dutycycle 100", "set path.hash.mode 1", "set flood.advert.interval 24", "set loop.detect moderate",
  "region def west ca centralcoast slocounty pasorobles", "region save"].join("\n"));

// 1.15: region put/allowf, dutycycle + hash still present
await page.selectOption("#opt-fw", "115");
check("1.15 (no allowf)", await cmds(), [
  "set dutycycle 100", "set path.hash.mode 1", "set flood.advert.interval 24", "set loop.detect moderate",
  "region put west", "region put ca west", "region put centralcoast ca",
  "region put slocounty centralcoast", "region put pasorobles slocounty",
  "region save"].join("\n"));

// 1.14: set af, hash still present
await page.selectOption("#opt-fw", "114");
check("1.14", await cmds(), [
  "set af 0", "set path.hash.mode 1", "set flood.advert.interval 24", "set loop.detect moderate",
  "region put west", "region allowf west",
  "region put ca west", "region allowf ca",
  "region put centralcoast ca", "region allowf centralcoast",
  "region put slocounty centralcoast", "region allowf slocounty",
  "region put pasorobles slocounty", "region allowf pasorobles",
  "region save"].join("\n"));

// 1.10-1.13: exactly the user's example
await page.selectOption("#opt-fw", "110");
check("1.10-1.13 matches user's example", await cmds(), [
  "set af 0", "set flood.advert.interval 24",
  "region put west", "region allowf west",
  "region put ca west", "region allowf ca",
  "region put centralcoast ca", "region allowf centralcoast",
  "region put slocounty centralcoast", "region allowf slocounty",
  "region put pasorobles slocounty", "region allowf pasorobles",
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
  ["region home pasorobles", "region default pasorobles", "region save"].join("\n"));
await page.uncheck("#opt-home");

// county-level chain on old firmware (4 tokens)
await untick(page, "pasorobles");
check("county-level on 1.10", await cmds(), [
  "set af 0", "set flood.advert.interval 24",
  "region put west", "region allowf west",
  "region put ca west", "region allowf ca",
  "region put centralcoast ca", "region allowf centralcoast",
  "region put slocounty centralcoast", "region allowf slocounty",
  "region save"].join("\n"));

// switching back restores region def
await page.selectOption("#opt-fw", "116");
check("back to 1.16", await cmds(), [
  "set dutycycle 100", "set path.hash.mode 1", "set flood.advert.interval 24", "set loop.detect moderate",
  "region def west ca centralcoast slocounty", "region save"].join("\n"));
console.log("hash re-enabled:", !(await page.isDisabled("#opt-hash")));

// screenshot of the old-firmware view
await page.selectOption("#opt-fw", "110");
await tick(page, "pasorobles");
await page.evaluate(() => { document.querySelector("details.advanced").open = false; });
await page.screenshot({ path: shot("fw-old.png"), clip: { x: 0, y: 180, width: 1000, height: 1250 } });

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
