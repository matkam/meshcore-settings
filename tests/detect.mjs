import { chromium } from "playwright";
import { launchOptions, shot } from "./harness.mjs";
import { simInit } from "./sim.mjs";

const SITE = process.env.SITE || "http://127.0.0.1:8765/";
const browser = await chromium.launch(launchOptions);

let pass = true;
function check(name, ok, detail) {
  pass &&= !!ok;
  console.log((ok ? "PASS " : "FAIL ") + name + (!ok && detail !== undefined ? "  -> " + detail : ""));
}

function km(label) {
  const part = label.split("· ")[1];
  return part.startsWith("under") ? 0 : parseFloat(part);
}
function ordered(labels) {
  for (let i = 1; i < labels.length; i++) { if (km(labels[i]) < km(labels[i - 1])) { return false; } }
  return true;
}

async function scenario({ lat, lon, ver }) {
  const page = await browser.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.addInitScript(simInit);
  await page.addInitScript(({ lat, lon, ver }) => {
    window.__pos = { lat, lon };
    window.__ver = ver;
  }, { lat, lon, ver });

  await page.goto(SITE + "#prb", { waitUntil: "networkidle" });
  await page.click("#btn-usb");
  await page.waitForSelector("#push-session:not([hidden])", { timeout: 10000 });

  const loc = await page.textContent("#detect-loc");
  const choices = await page.$$eval("#detect-choices button", (bs) => bs.map((b) => b.textContent));

  await page.fill("#admin-pw", "hunter2");
  await page.click("#btn-login");
  await page.waitForSelector("#btn-push:not([disabled])", { timeout: 20000 });

  const verText = await page.textContent("#detect-ver");
  const tier = await page.inputValue("#opt-fw");
  await page.close();
  return { loc, choices, verText, tier, errs };
}

// --- position not advertised
{
  const r = await scenario({ lat: 0, lon: 0, ver: "v1.16.0 (Build: x)" });
  check("0,0 treated as no position", /doesn't advertise a position/.test(r.loc), r.loc);
  check("no suggestions when position unknown", r.choices.length === 0, r.choices.join(" | "));
}

// --- position far outside California
{
  const r = await scenario({ lat: 40.7128, lon: -74.006, ver: "v1.16.0 (Build: x)" });
  check("out-of-state position refuses to guess", /Too far to guess/.test(r.loc), r.loc);
  check("no suggestions when too far", r.choices.length === 0, r.choices.join(" | "));
}

// --- a real but different California spot
{
  const r = await scenario({ lat: 37.8210, lon: -122.2590, ver: "v1.16.0 (Build: x)" });
  check("Oakland position leads with Oakland / Berkeley",
    /^Oakland \/ Berkeley ·/.test(r.choices[0] || ""), r.choices.join(" | "));
  check("dense area offers alternatives too", r.choices.length > 1, r.choices.join(" | "));
  check("never more than three choices", r.choices.length <= 3, r.choices.join(" | "));
  check("choices are ordered nearest first", ordered(r.choices), r.choices.join(" | "));
}

// --- a sparse area: the runner-up filter should drop distant ones
{
  const r = await scenario({ lat: 41.4871, lon: -120.5422, ver: "v1.16.0 (Build: x)" });
  check("remote north-east still offers something", r.choices.length >= 1, r.choices.join(" | "));
  check("remote north-east isn't padded to three with far areas",
    r.choices.every((c) => km(c) - km(r.choices[0]) <= 25), r.choices.join(" | "));
}

// --- every choice actually applies when clicked
{
  const page = await browser.newPage();
  await page.addInitScript(simInit);
  await page.addInitScript(() => { window.__pos = { lat: 37.8210, lon: -122.2590 }; window.__ver = "v1.16.0 (Build: x)"; });
  await page.goto(SITE, { waitUntil: "networkidle" });
  await page.click("#btn-usb");
  await page.waitForSelector("#push-session:not([hidden])", { timeout: 10000 });

  const n = await page.$$eval("#detect-choices button", (bs) => bs.length);
  let allApplied = true;
  for (let i = 0; i < n; i++) {
    const label = (await page.$$eval("#detect-choices button", (bs) => bs.map((b) => b.textContent)))[i];
    await page.$$eval("#detect-choices button", (bs, i) => bs[i].click(), i);
    // The chain renders codes, so compare against the picker's own label instead.
    const picked = await page.$eval(".pick-row.lvl-2 input:checked ~ .pick-title .pick-name",
      (x) => x.textContent);
    if (picked !== label.split(" · ")[0]) { allApplied = false; }
  }
  check("clicking any choice applies it", allApplied);

  const pressed = await page.$$eval("#detect-choices button",
    (bs) => bs.map((b) => b.getAttribute("aria-pressed")));
  check("only the last-clicked choice is marked pressed",
    pressed.filter((p) => p === "true").length === 1, pressed.join(","));
  check("choices survive being clicked, so a wrong pick is correctable",
    await page.isVisible("#detect-choices"));
  await page.close();
}

// --- firmware tiers
for (const [ver, want] of [
  ["v1.16.1 (Build: 12 Jan 2026)", "116"],
  ["v1.17.0 (Build: x)", "116"],
  ["v2.0.0 (Build: x)", "116"],
  ["v1.15.0 (Build: x)", "115"],
  ["v1.14.3 (Build: x)", "114"],
  ["v1.13.1 (Build: x)", "110"],
  ["v1.10.0 (Build: x)", "110"],
  ["1.16.0", "116"]
]) {
  const r = await scenario({ lat: 35.63, lon: -120.69, ver });
  check(`ver "${ver}" -> tier ${want}`, r.tier === want, r.tier);
}

// --- unparseable version leaves the selector alone
{
  const r = await scenario({ lat: 35.63, lon: -120.69, ver: "unknown command" });
  check("garbage ver reported, not applied", /no recognisable version/.test(r.verText), r.verText);
  check("garbage ver leaves default tier", r.tier === "116", r.tier);
  check("no JS errors on garbage ver", r.errs.length === 0, r.errs.join("; "));
}

await browser.close();
process.exit(pass ? 0 : 1);
