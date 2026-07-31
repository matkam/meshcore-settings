import { chromium } from "playwright";
import { launchOptions, shot, tick, untick, clearPicks } from "./harness.mjs";

const SITE = process.env.SITE || "http://127.0.0.1:8765/";
const browser = await chromium.launch(launchOptions);
const page = await browser.newPage({ viewport: { width: 1000, height: 1200 } });

const errors = [];
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });

await page.goto(SITE, { waitUntil: "networkidle" });

function check(name, actual, expected) {
  const ok = actual === expected;
  console.log((ok ? "PASS " : "FAIL ") + name);
  if (!ok) { console.log("  expected:\n" + expected + "\n  actual:\n" + actual); }
  return ok;
}

let pass = true;

// --- 1. the user's headline case, via search
await page.fill("#search", "Paso Robles");
await page.waitForSelector("#results li[role=option]");
const first = await page.textContent("#results li[role=option]:first-child");
console.log("first search hit:", JSON.stringify(first));
await page.click("#results li[role=option]:first-child");
await page.waitForSelector("#output-panel:not([hidden])");

pass &= check("north county SLO commands",
  (await page.textContent("#commands")).trim(),
  ["set dutycycle 100",
   "set path.hash.mode 1",
   "set flood.advert.interval 24",
   "set loop.detect moderate",
   "region def west ca centralcoast slocounty pasorobles",
   "region save"].join("\n"));

console.log("chain:", (await page.$$eval("#chain .tok", (n) => n.map((x) => x.textContent))).join(" > "));
console.log("line note:", await page.textContent("#line-note"));
console.log("scopes:", (await page.$$eval("#scope-list li", (n) => n.map((x) => x.textContent.trim()))).join(" | "));

// --- 2. county-wide via selects
// Ticking adds, so start from nothing rather than on top of the search result.
await clearPicks(page);
await tick(page, "bayarea", "eastbay");
pass &= check("area-wide (East Bay)",
  (await page.textContent("#commands")).trim(),
  ["set dutycycle 100", "set path.hash.mode 1", "set flood.advert.interval 24", "set loop.detect moderate",
   "region def west ca bayarea eastbay", "region save"].join("\n"));

await tick(page, "oakland");
pass &= check("area (Oakland)",
  (await page.textContent("#commands")).trim(),
  ["set dutycycle 100", "set path.hash.mode 1", "set flood.advert.interval 24", "set loop.detect moderate",
   "region def west ca bayarea eastbay oakland", "region save"].join("\n"));

// --- 3. region-wide
await untick(page, "eastbay");
pass &= check("region-wide (Bay Area)",
  (await page.textContent("#commands")).trim(),
  ["set dutycycle 100", "set path.hash.mode 1", "set flood.advert.interval 24", "set loop.detect moderate",
   "region def west ca bayarea", "region save"].join("\n"));

// --- 4. options
await clearPicks(page);
await tick(page, "bayarea", "southbay", "sanjose");
await page.evaluate(() => { document.querySelector("details.advanced").open = true; });
await page.check("#opt-home");
await page.fill("#opt-duty", "50");
await page.selectOption("#opt-hash", "0");
pass &= check("options applied",
  (await page.textContent("#commands")).trim(),
  ["set dutycycle 50", "set path.hash.mode 0", "set flood.advert.interval 24", "set loop.detect moderate",
   "region def west ca bayarea southbay sanjose",
   "region home sanjose", "region default sanjose", "region save"].join("\n"));

await page.uncheck("#opt-home");
await page.fill("#opt-duty", "100");
await page.selectOption("#opt-hash", "1");

// --- 5. deep link
await page.goto(SITE + "#cch", { waitUntil: "networkidle" });
// #cch is a retired code: it exercises the legacy map as well as deep linking.
pass &= check("deep link #cch (retired code)",
  (await page.textContent("#commands")).trim(),
  ["set dutycycle 100", "set path.hash.mode 1", "set flood.advert.interval 24", "set loop.detect moderate",
   "region def west ca lowdesert palmsprings", "region save"].join("\n"));
console.log("deep-link search box:", JSON.stringify(await page.inputValue("#search")));

// --- 6. searches that should resolve
// The last two are retired codes, which stay searchable through `aliases`.
for (const [q, want] of [["Big Bear", "bigbear"], ["Humboldt", "eureka"], ["Truckee", "truckee"],
                         ["slo", "slocity"], ["Santa Cruz", "santacruz"], ["Bakersfield", "bakersfield"],
                         ["Yosemite", "mariposa"], ["Chula Vista", "chulavista"],
                         ["prb", "pasorobles"], ["sfb", "bayarea"]]) {
  await page.fill("#search", "");
  await page.fill("#search", q);
  await page.waitForTimeout(60);
  const codes = await page.$$eval("#results li[role=option] .r-code", (n) => n.map((x) => x.textContent.trim()));
  const ok = codes.includes(want);
  pass &= ok;
  console.log((ok ? "PASS " : "FAIL ") + `search "${q}" -> ${want} (got: ${codes.slice(0, 4).join(", ")})`);
}

// --- 7. no-match path
await page.fill("#search", "");
await page.fill("#search", "zzzzz");
await page.waitForTimeout(60);
console.log("no-match:", (await page.textContent("#results")).trim());

// --- 8. copy button
await page.goto(SITE + "#prb", { waitUntil: "networkidle" });
await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
await page.click("#copy");
const clip = await page.evaluate(() => navigator.clipboard.readText());
pass &= check("clipboard", clip.trim(),
  ["set dutycycle 100", "set path.hash.mode 1", "set flood.advert.interval 24", "set loop.detect moderate",
   "region def west ca centralcoast slocounty pasorobles", "region save"].join("\n"));

// --- 9. screenshots
await page.screenshot({ path: shot("shot-desktop.png"), fullPage: true });
await page.setViewportSize({ width: 390, height: 844 });
await page.screenshot({ path: shot("shot-mobile.png"), fullPage: true });
await page.emulateMedia({ colorScheme: "dark" });
await page.setViewportSize({ width: 1000, height: 1200 });
await page.screenshot({ path: shot("shot-dark.png"), fullPage: true });

// --- 10. horizontal overflow check
for (const w of [390, 768, 1200]) {
  await page.setViewportSize({ width: w, height: 900 });
  await page.waitForTimeout(80);
  const over = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  console.log((over ? "FAIL " : "PASS ") + `no horizontal scroll at ${w}px`);
  pass &= !over;
}

console.log(errors.length ? "\nJS ERRORS:\n" + errors.join("\n") : "\nno JS errors");
await browser.close();
process.exit(pass && !errors.length ? 0 : 1);
