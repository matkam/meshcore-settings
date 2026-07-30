import { chromium } from "playwright";
import { launchOptions, shot } from "./harness.mjs";
import { simInit } from "./sim.mjs";

const SITE = process.env.SITE || "http://127.0.0.1:8765/";
const browser = await chromium.launch(launchOptions);
let pass = true;
const check = (n, ok, d) => { pass &&= !!ok; console.log((ok?"PASS ":"FAIL ")+n+(!ok&&d!==undefined?"  -> "+d:"")); };

const page = await browser.newPage({ viewport: { width: 1000, height: 1400 } });
const errs = [];
page.on("pageerror", e => errs.push("pageerror: " + e.message));
page.on("console", m => { if (m.type()==="error") errs.push("console: "+m.text()); });

await page.addInitScript(simInit);
await page.addInitScript(() => { window.__pos = { lat: 35.630, lon: -120.690 }; window.__ver = "v1.16.1 (Build: x)"; });

// --- land on a bare page with NO area selected
await page.goto(SITE, { waitUntil: "networkidle" });

check("push panel visible with no selection", await page.isVisible("#push-panel"));
check("settings panel still hidden with no selection", await page.isHidden("#output-panel"));

// push panel must be the first panel in the page
const order = await page.$$eval("main section.panel", ns => ns.map(n => n.id || n.getAttribute("aria-labelledby")));
check("push panel is first", order[0] === "push-panel", JSON.stringify(order));
check("picker comes second", order[1] === "pick-heading", JSON.stringify(order));

// --- connect with nothing selected
await page.click("#btn-usb");
await page.waitForSelector("#push-session:not([hidden])", { timeout: 10000 });
check("can connect with no area selected", true);
check("send disabled before login", await page.isDisabled("#btn-push"));
check("disabled reason names login",
  /log in/i.test(await page.getAttribute("#btn-push", "title")),
  await page.getAttribute("#btn-push", "title"));

const loc = await page.textContent("#detect-loc");
const locChoices = await page.$$eval("#detect-choices button", (bs) => bs.map((b) => b.textContent));
check("location suggested with no prior selection",
  /^North County · /.test(locChoices[0] || ""), loc + " | " + locChoices.join(" | "));

await page.fill("#admin-pw", "hunter2");
await page.click("#btn-login");
await page.waitForFunction(() => document.getElementById("detect-ver").textContent.length > 0, null, { timeout: 20000 });
await page.waitForSelector("#btn-login:not([disabled])", { timeout: 20000 });

check("still no selection after login", await page.isHidden("#output-panel"));
check("send still disabled without an area", await page.isDisabled("#btn-push"));
check("disabled reason now names the area",
  /choose an area/i.test(await page.getAttribute("#btn-push", "title")),
  await page.getAttribute("#btn-push", "title"));
check("status tells you what's missing",
  /choose an area below/i.test(await page.textContent("#push-status")),
  await page.textContent("#push-status"));
check("firmware applied even with no area", (await page.inputValue("#opt-fw")) === "116");

// --- accept the suggestion -> everything unlocks
await page.click("#detect-choices button");
await page.waitForSelector("#output-panel:not([hidden])", { timeout: 5000 });
check("accepting suggestion reveals the settings", true);
check("send enabled once an area exists", !(await page.isDisabled("#btn-push")));
check("area is North County", await page.$eval('.picker input[data-code="prb"]', (x) => x.checked));
check("commands generated", /region def west ca cc slo prb/.test(await page.textContent("#commands")));

// --- and it can actually send
page.once("dialog", d => d.accept());
await page.click("#btn-push");
await page.waitForFunction(() => /Done\./.test(document.getElementById("push-status").textContent), null, { timeout: 30000 });
check("push completes from the detected selection", true);

// --- unsupported browser: panel hidden, page still usable
const p2 = await browser.newPage();
const e2 = []; p2.on("pageerror", e => e2.push(e.message));
await p2.addInitScript(() => {
  Object.defineProperty(navigator, "serial", { get: () => undefined, configurable: true });
  Object.defineProperty(navigator, "bluetooth", { get: () => undefined, configurable: true });
});
await p2.goto(SITE, { waitUntil: "networkidle" });
check("panel hidden when unsupported, even at top", await p2.isHidden("#push-panel"));
const order2 = await p2.$$eval("main section.panel:not([hidden])", ns => ns.map(n => n.id || n.getAttribute("aria-labelledby")));
check("picker is first visible panel when unsupported", order2[0] === "pick-heading", JSON.stringify(order2));
check("no JS errors when unsupported", e2.length === 0, e2.join("; "));

for (const w of [390, 768, 1200]) {
  await page.setViewportSize({ width: w, height: 900 });
  await page.waitForTimeout(80);
  const over = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  check(`no horizontal scroll at ${w}px`, !over);
}

console.log(errs.length ? "\nJS ERRORS:\n" + errs.join("\n") : "\nno JS errors");
pass &&= errs.length === 0;
await browser.close();
process.exit(pass ? 0 : 1);
