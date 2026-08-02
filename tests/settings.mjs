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

const page = await browser.newPage({ viewport: { width: 1000, height: 1200 } });
const errs = [];
page.on("pageerror", (e) => errs.push(e.message));
await page.goto(SITE + "#slonorth", { waitUntil: "networkidle" });
await page.evaluate(() => { document.querySelector("details.advanced").open = true; });

const cmds = async () => (await page.textContent("#commands")).trim();
const lines = async () => (await cmds()).split("\n");

/* ---------- the two new settings ---------- */

check("loop detection defaults to moderate", (await page.inputValue("#opt-loop")) === "moderate",
  await page.inputValue("#opt-loop"));
check("flood advert interval defaults to 24", (await page.inputValue("#opt-flood")) === "24",
  await page.inputValue("#opt-flood"));
check("both appear in the commands",
  (await lines()).includes("set loop.detect moderate") &&
  (await lines()).includes("set flood.advert.interval 24"), await cmds());

// They belong with the other set commands, before anything touches regions.
{
  const l = await lines();
  const lastSet = Math.max(l.indexOf("set loop.detect moderate"), l.indexOf("set flood.advert.interval 24"));
  const firstRegion = l.findIndex((x) => x.startsWith("region "));
  check("new settings come before the region block", lastSet < firstRegion, JSON.stringify(l));
}

for (const mode of ["off", "minimal", "strict"]) {
  await page.selectOption("#opt-loop", mode);
  check(`loop.detect ${mode}`, (await lines()).includes("set loop.detect " + mode), await cmds());
}

await page.selectOption("#opt-loop", "");
check("loop detection can be left unset",
  !(await cmds()).includes("loop.detect"), await cmds());
await page.selectOption("#opt-loop", "moderate");

// Flood interval range: the firmware takes 3-168, or 0 to switch it off.
await page.fill("#opt-flood", "3");
check("flood interval 3 is accepted", (await lines()).includes("set flood.advert.interval 3"));
await page.fill("#opt-flood", "168");
check("flood interval 168 is accepted", (await lines()).includes("set flood.advert.interval 168"));
await page.fill("#opt-flood", "0");
check("0 is emitted, to turn flood adverts off", (await lines()).includes("set flood.advert.interval 0"));
check("0 is explained as off", /stops flood adverts/.test(await page.textContent("#flood-hint")),
  await page.textContent("#flood-hint"));
await page.fill("#opt-flood", "2");
check("an out-of-range interval is called out",
  /will be rejected/.test(await page.textContent("#flood-hint")), await page.textContent("#flood-hint"));
await page.fill("#opt-flood", "");
check("a blank interval sends nothing", !(await cmds()).includes("flood.advert.interval"), await cmds());
check("blank is explained as leaving it alone",
  /left alone/.test(await page.textContent("#flood-hint")), await page.textContent("#flood-hint"));
await page.fill("#opt-flood", "24");

// Version gating.
// loop.detect landed in 1.14, the same release as path.hash.mode.
await page.selectOption("#opt-fw", "115");
check("loop.detect is still sent on 1.15", (await lines()).includes("set loop.detect moderate"), await cmds());
await page.selectOption("#opt-fw", "114");
check("loop.detect is sent on 1.14, the version that added it",
  (await lines()).includes("set loop.detect moderate"), await cmds());
check("the loop control is enabled on 1.14", !(await page.isDisabled("#opt-loop")));
await page.selectOption("#opt-fw", "110");
check("loop.detect is withheld below 1.14", !(await cmds()).includes("loop.detect"), await cmds());
check("the loop control is disabled there", await page.isDisabled("#opt-loop"));
check("and names the version that added it",
  /firmware 1\.14/.test(await page.textContent("#loop-hint")), await page.textContent("#loop-hint"));
check("flood interval still sent on the oldest tier",
  (await lines()).includes("set flood.advert.interval 24"), await cmds());
await page.selectOption("#opt-fw", "116");

/* ---------- owner info ---------- */
{
  check("owner info starts empty", (await page.inputValue("#opt-owner")) === "",
    await page.inputValue("#opt-owner"));
  check("an empty box sends nothing", !(await cmds()).includes("owner.info"), await cmds());
  check("empty is explained as leaving it alone",
    /keeps whatever it already has/.test(await page.textContent("#owner-hint")),
    await page.textContent("#owner-hint"));

  await page.fill("#opt-owner", "K6ABC | matt@example.com");
  await page.waitForTimeout(50);
  const l = await lines();
  check("whatever is typed becomes set owner.info",
    l.includes("set owner.info K6ABC | matt@example.com"), await cmds());
  check("it sits with the other set commands",
    l.findIndex((x) => x.startsWith("set owner.info")) < l.findIndex((x) => x.startsWith("region ")),
    JSON.stringify(l));
  check("the box holds a useful amount of text",
    Number(await page.getAttribute("#opt-owner", "maxlength")) >= 100);

  check("it is read back in the verification block",
    /get owner\.info/.test(await page.textContent("#verify-block")),
    await page.textContent("#verify-block"));
  check("and explained", /set owner\.info K6ABC/.test(await page.textContent("#explain")));
  check("the hint warns that it is public",
    /public/.test(await page.textContent("#owner-hint")), await page.textContent("#owner-hint"));

  // Surrounding whitespace is not contact information.
  await page.fill("#opt-owner", "  matt@example.com  ");
  await page.waitForTimeout(50);
  check("padding is trimmed", (await lines()).includes("set owner.info matt@example.com"), await cmds());

  await page.fill("#opt-owner", "   ");
  await page.waitForTimeout(50);
  check("whitespace alone counts as empty", !(await cmds()).includes("owner.info"), await cmds());

  // set owner.info landed in 1.12, inside the 1.10-1.13 tier, so it is still
  // offered there — with the caveat spelled out.
  await page.fill("#opt-owner", "matt@example.com");
  await page.selectOption("#opt-fw", "110");
  await page.waitForTimeout(50);
  check("still sent on the oldest tier",
    (await lines()).includes("set owner.info matt@example.com"), await cmds());
  check("which names the version that added it",
    /1\.12/.test(await page.textContent("#owner-hint")), await page.textContent("#owner-hint"));
  await page.selectOption("#opt-fw", "116");
  check("no such caveat on current firmware",
    !/1\.12/.test(await page.textContent("#owner-hint")), await page.textContent("#owner-hint"));

  await page.fill("#opt-owner", "");
  await page.waitForTimeout(50);
}

/* ---------- editing ---------- */

check("editor is hidden until asked for", await page.isHidden("#commands-edit"));
check("no edit note at rest", await page.isHidden("#edit-note"));

await page.click("#edit-cmds");
check("edit swaps in the textarea",
  (await page.isVisible("#commands-edit")) && (await page.isHidden("#commands")));
check("textarea starts from the generated commands",
  (await page.inputValue("#commands-edit")).trim() === (await cmds()));
check("the button becomes Done", (await page.textContent("#edit-cmds")) === "Done");

await page.fill("#commands-edit", "set dutycycle 50\nregion def west california centralcoast slo slonorth\nregion save");
await page.waitForTimeout(120);
check("edits become the command list",
  JSON.stringify(await page.evaluate(() => window.SettingsState.get().lines)) ===
  JSON.stringify(["set dutycycle 50", "region def west california centralcoast slo slonorth", "region save"]),
  JSON.stringify(await page.evaluate(() => window.SettingsState.get().lines)));
check("the edit is flagged as such", await page.evaluate(() => window.SettingsState.get().edited) === true);
check("a note says the two have diverged", await page.isVisible("#edit-note"));
check("the note counts what will be sent", /3 lines/.test(await page.textContent("#edit-note")),
  await page.textContent("#edit-note"));

// Blank lines and stray whitespace are the user's, not commands.
await page.fill("#commands-edit", "  set dutycycle 50  \n\n\nregion save\n");
await page.waitForTimeout(120);
check("blank lines and padding are stripped",
  JSON.stringify(await page.evaluate(() => window.SettingsState.get().lines)) ===
  JSON.stringify(["set dutycycle 50", "region save"]),
  JSON.stringify(await page.evaluate(() => window.SettingsState.get().lines)));

// The whole point: changing the selection must not destroy typed work.
await page.evaluate(() => window.SettingsState.select("oakland"));
await page.waitForTimeout(150);
check("changing the area does not overwrite an edit",
  (await page.inputValue("#commands-edit")).includes("set dutycycle 50"),
  await page.inputValue("#commands-edit"));
check("the generated view still follows the selection",
  (await cmds()).includes("region def west california bayarea eastbay oakland"), await cmds());
await page.selectOption("#opt-fw", "110");
await page.waitForTimeout(150);
check("changing firmware does not overwrite an edit either",
  (await page.inputValue("#commands-edit")).includes("set dutycycle 50"));
await page.selectOption("#opt-fw", "116");

// The serial limit applies to whatever is actually sent.
await page.fill("#commands-edit", "region def " + "a".repeat(200));
await page.waitForTimeout(120);
check("an over-long edited line is flagged",
  /over the 160-character serial limit/.test(await page.textContent("#edit-note")),
  await page.textContent("#edit-note"));
check("and the note is styled as a warning",
  (await page.getAttribute("#edit-note", "class")).includes("over"));

// Emptying it leaves nothing to send.
await page.fill("#commands-edit", "");
await page.waitForTimeout(120);
check("an empty list says so", /nothing to copy or send/.test(await page.textContent("#edit-note")),
  await page.textContent("#edit-note"));
check("an empty list yields no lines",
  (await page.evaluate(() => window.SettingsState.get().lines)).length === 0);

// Reset.
await page.fill("#commands-edit", "set dutycycle 1");
await page.waitForTimeout(120);
await page.click("#reset-cmds");
await page.waitForTimeout(150);
check("reset clears the note", await page.isHidden("#edit-note"));
check("reset restores the generated view", await page.isVisible("#commands"));
check("reset restores the generated commands",
  (await page.evaluate(() => window.SettingsState.get().lines)).includes("set loop.detect moderate"),
  JSON.stringify(await page.evaluate(() => window.SettingsState.get().lines)));
check("reset is not flagged as edited",
  !(await page.evaluate(() => window.SettingsState.get().edited)));

// Copy takes the edited text.
await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
await page.click("#edit-cmds");
await page.fill("#commands-edit", "set dutycycle 42\nregion save");
await page.waitForTimeout(120);
await page.click("#copy");
check("copy copies the edited commands",
  (await page.evaluate(() => navigator.clipboard.readText())).trim() === "set dutycycle 42\nregion save",
  JSON.stringify(await page.evaluate(() => navigator.clipboard.readText())));

/* ---------- the surrounding blocks know about them too ---------- */
{
  await page.click("#reset-cmds");
  await page.waitForTimeout(150);
  const verify = await page.textContent("#verify-block");
  check("verification block reads the new settings back",
    /get flood\.advert\.interval/.test(verify) && /get loop\.detect/.test(verify), verify);

  const explain = await page.textContent("#explain");
  check("the explanation covers the flood interval", /flood\.advert\.interval/.test(explain));
  check("the explanation covers loop detection", /loop\.detect/.test(explain));

  // Whatever isn't sent isn't read back either.
  await page.selectOption("#opt-loop", "");
  await page.fill("#opt-flood", "");
  await page.waitForTimeout(150);
  const verify2 = await page.textContent("#verify-block");
  check("unset settings are not read back",
    !/loop\.detect/.test(verify2) && !/flood\.advert/.test(verify2), verify2);
  await page.selectOption("#opt-loop", "moderate");
  await page.fill("#opt-flood", "24");
}

check("no JS errors", errs.length === 0, errs.join("; "));
await page.close();

/* ---------- the over-the-air push sends the edited list ---------- */
{
  const p2 = await browser.newPage({ viewport: { width: 1000, height: 1200 } });
  const e2 = [];
  p2.on("pageerror", (e) => e2.push(e.message));
  await p2.addInitScript(simInit);
  await p2.addInitScript(() => { window.__pos = { lat: 35.63, lon: -120.69 }; window.__ver = "v1.16.0 (Build: x)"; });
  await p2.goto(SITE + "#slonorth", { waitUntil: "networkidle" });

  await p2.click("#edit-cmds");
  await p2.fill("#commands-edit", "set dutycycle 33\nregion def west california centralcoast slo slonorth\nregion save");
  await p2.waitForTimeout(120);

  await p2.click("#btn-usb");
  await p2.waitForSelector("#push-session:not([hidden])", { timeout: 10000 });
  await p2.fill("#admin-pw", "hunter2");
  await p2.click("#btn-login");
  await p2.waitForSelector("#btn-push:not([disabled])", { timeout: 20000 });
  p2.once("dialog", (d) => d.accept());
  await p2.click("#btn-push");
  await p2.waitForFunction(
    () => /Done\./.test(document.getElementById("push-status").textContent), null, { timeout: 30000 });

  const sent = await p2.evaluate(() => window.__sim.log
    .filter((l) => l.startsWith("cli:")).map((l) => l.slice(4)).filter((c) => c !== "ver"));
  check("the push sends the edited commands, not the generated ones",
    JSON.stringify(sent) === JSON.stringify([
      "set dutycycle 33", "region def west california centralcoast slo slonorth", "region save", "region get slonorth"]),
    JSON.stringify(sent));

  // An emptied list must not be sendable.
  await p2.fill("#commands-edit", "");
  await p2.waitForTimeout(200);
  check("send is disabled when the command list is empty", await p2.isDisabled("#btn-push"));
  check("and the button says why",
    /command list is empty/.test(await p2.getAttribute("#btn-push", "title")),
    await p2.getAttribute("#btn-push", "title"));

  check("no JS errors in the push flow", e2.length === 0, e2.join("; "));
  await p2.close();
}

await browser.close();
process.exit(pass ? 0 : 1);
