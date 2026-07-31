import { chromium } from "playwright";
import { launchOptions, shot, isTicked } from "./harness.mjs";

const SITE = process.env.SITE || "http://127.0.0.1:8765/";
const browser = await chromium.launch(launchOptions);

let pass = true;
function check(name, ok, detail) {
  pass &&= !!ok;
  console.log((ok ? "PASS " : "FAIL ") + name + (detail !== undefined && !ok ? "  -> " + detail : ""));
}

// ---------- 1. panel stays hidden with no APIs ----------
{
  const page = await browser.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "serial", { get: () => undefined, configurable: true });
    Object.defineProperty(navigator, "bluetooth", { get: () => undefined, configurable: true });
  });
  await page.goto(SITE + "#slonorth", { waitUntil: "networkidle" });
  check("push panel hidden without Web Serial/BLE", await page.isHidden("#push-panel"));
  check("no JS errors (unsupported browser path)", errs.length === 0, errs.join("; "));
  await page.close();
}

// ---------- 2. full flow against a simulated companion ----------
const page = await browser.newPage({ viewport: { width: 1000, height: 1400 } });
const errs = [];
page.on("pageerror", (e) => errs.push("pageerror: " + e.message));
page.on("console", (m) => { if (m.type() === "error") errs.push("console: " + m.text()); });

await page.addInitScript(() => {
  const RPT_KEY = new Uint8Array(32).map((_, i) => (i === 0 ? 0xaa : i));
  window.__pos = { lat: 35.630, lon: -120.690 };   // Paso Robles
  window.__ver = "v1.16.1 (Build: 12 Jan 2026)";
  const CHAT_KEY = new Uint8Array(32).map((_, i) => (i === 0 ? 0xbb : i + 100));

  const log = [];
  window.__sim = { log, replies: {} };

  let ctrl = null;
  let outBuf = new Uint8Array(0);
  const msgQueue = [];

  const readable = new ReadableStream({ start(c) { ctrl = c; } });

  function send(payload) {
    const f = new Uint8Array(3 + payload.length);
    f[0] = 0x3e;
    f[1] = payload.length & 0xff;
    f[2] = (payload.length >> 8) & 0xff;
    f.set(payload, 3);
    ctrl.enqueue(f);
  }

  const te = new TextEncoder();
  function u32(v) { return [v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >> 24) & 0xff]; }

  function contactRecord(key, type, name) {
    const b = [0x03, ...key, type, 0, 0];
    for (let i = 0; i < 64; i++) b.push(0);           // out path
    const n = te.encode(name);
    for (let i = 0; i < 32; i++) b.push(i < n.length ? n[i] : 0);
    const la = type === 2 ? Math.round(window.__pos.lat * 1e6) : 0;
    const lo = type === 2 ? Math.round(window.__pos.lon * 1e6) : 0;
    b.push(...u32(1700000000), ...u32(la >>> 0), ...u32(lo >>> 0), ...u32(1700000000));
    return new Uint8Array(b);
  }

  function handle(frame) {
    const cmd = frame[0];
    if (cmd === 1) {                                   // APP_START
      log.push("appStart");
      send(new Uint8Array([0x05, ...new Array(40).fill(0)]));
    } else if (cmd === 22) {                           // DEVICE_QUERY
      log.push("deviceQuery");
      const model = te.encode("SimNode");
      const date = te.encode("01 Jan 2026");
      const b = [0x0d, 8, 0, 0, 0, 0, 0, 0];
      for (let i = 0; i < 12; i++) b.push(i < date.length ? date[i] : 0);
      send(new Uint8Array([...b, ...model]));
    } else if (cmd === 4) {                            // GET_CONTACTS
      log.push("getContacts");
      send(new Uint8Array([0x02, ...u32(2)]));
      send(contactRecord(RPT_KEY, 2, "SLO North Repeater"));
      send(contactRecord(CHAT_KEY, 1, "Somebody's Phone"));
      send(new Uint8Array([0x04, ...u32(1700000000)]));
    } else if (cmd === 26) {                           // SEND_LOGIN
      const pw = new TextDecoder().decode(frame.slice(33));
      log.push("login:" + pw);
      send(new Uint8Array([0x06, 0, ...u32(1234), ...u32(400)]));
      setTimeout(() => {
        if (pw === "hunter2") send(new Uint8Array([0x85, 0, ...RPT_KEY.slice(0, 6)]));
        else send(new Uint8Array([0x86, 0, ...RPT_KEY.slice(0, 6)]));
      }, 60);
    } else if (cmd === 2) {                            // SEND_TXT_MSG
      const text = new TextDecoder().decode(frame.slice(13));
      log.push("cli:" + text);
      send(new Uint8Array([0x06, 0, ...u32(4321), ...u32(400)]));
      const reply = window.__sim.replies[text] !== undefined
        ? window.__sim.replies[text]
        : (text === "ver" ? window.__ver : "OK");
      setTimeout(() => {
        msgQueue.push(reply);
        send(new Uint8Array([0x83, 1]));
      }, 60);
    } else if (cmd === 10) {                           // SYNC_NEXT_MESSAGE
      if (msgQueue.length) {
        const t = te.encode(msgQueue.shift());
        send(new Uint8Array([0x07, ...RPT_KEY.slice(0, 6), 0, 1, ...u32(1700000000), ...t]));
      } else {
        send(new Uint8Array([0x0a]));
      }
    }
  }

  function onWrite(chunk) {
    const merged = new Uint8Array(outBuf.length + chunk.length);
    merged.set(outBuf, 0);
    merged.set(chunk, outBuf.length);
    outBuf = merged;
    while (outBuf.length >= 3) {
      if (outBuf[0] !== 0x3c) { outBuf = outBuf.slice(1); continue; }
      const len = outBuf[1] | (outBuf[2] << 8);
      if (outBuf.length < 3 + len) break;
      const payload = outBuf.slice(3, 3 + len);
      outBuf = outBuf.slice(3 + len);
      handle(payload);
    }
  }

  const writable = new WritableStream({ write(chunk) { onWrite(chunk); } });

  Object.defineProperty(navigator, "serial", { configurable: true, value: {
    requestPort: async () => ({
      open: async () => {},
      close: async () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      readable,
      writable
    })
  }});
});

await page.goto(SITE + "#slonorth", { waitUntil: "networkidle" });

check("push panel visible with Web Serial", await page.isVisible("#push-panel"));
check("BLE button hidden when unsupported", await page.isHidden("#btn-ble"));

await page.click("#btn-usb");
try {
  await page.waitForSelector("#push-session:not([hidden])", { timeout: 8000 });
} catch (e) {
  console.log("DEBUG status:", await page.textContent("#push-status"));
  console.log("DEBUG sim log:", JSON.stringify(await page.evaluate(() => window.__sim.log)));
  console.log("DEBUG errs:", errs.join(" | "));
  throw e;
}

const opts = await page.$$eval("#sel-repeater option", (n) => n.map((o) => o.textContent.trim()));
check("only repeaters listed (chat contact filtered out)",
  opts.length === 1 && opts[0] === "SLO North Repeater", JSON.stringify(opts));
console.log("  repeater hint:", await page.textContent("#repeater-hint"));

// wrong password
await page.fill("#admin-pw", "wrong");
await page.click("#btn-login");
await page.waitForFunction(
  () => /Login failed/.test(document.getElementById("push-status").textContent), null, { timeout: 10000 });
check("wrong password rejected",
  /Login failed/i.test(await page.textContent("#push-status")),
  await page.textContent("#push-status"));
check("send disabled after failed login", await page.isDisabled("#btn-push"));

// correct password
await page.fill("#admin-pw", "hunter2");
await page.click("#btn-login");
await page.waitForFunction(
  () => /Logged in/.test(document.getElementById("push-status").textContent), null, { timeout: 10000 });
check("correct password accepted", true);
await page.waitForSelector("#btn-push:not([disabled])", { timeout: 15000 });
check("send enabled after login (once ver completes)", true);
check("firmware auto-applied from ver",
  (await page.inputValue("#opt-fw")) === "116", await page.inputValue("#opt-fw"));
check("location offered as choices, none marked chosen until clicked",
  (await page.isVisible("#detect-choices")) &&
  (await page.$$eval("#detect-choices button", (bs) => bs.every((b) => b.getAttribute("aria-pressed") === "false"))));
const locText = await page.textContent("#detect-loc");
const locChoices = await page.$$eval("#detect-choices button", (bs) => bs.map((b) => b.textContent));
check("nearest area is North County",
  /^North County · [0-9]\.[0-9] km$/.test(locChoices[0] || ""), locChoices.join(" | "));
console.log("  detect loc:", locText);
console.log("  detect choices:", locChoices.join(" | "));
console.log("  detect ver:", await page.textContent("#detect-ver"));
await page.click("#detect-choices button");
check("clicking suggestion selects the area",
  await isTicked(page, "slonorth"),
  JSON.stringify(await page.$$eval(".picker input:checked", (n) => n.map((x) => x.dataset.code))));

// push, accepting the confirm
page.once("dialog", (d) => d.accept());
await page.click("#btn-push");
await page.waitForFunction(
  () => /Done\./.test(document.getElementById("push-status").textContent), null, { timeout: 30000 });

const sim = await page.evaluate(() => window.__sim.log);
console.log("  device saw:", JSON.stringify(sim, null, 0));

const sentCmds = sim.filter((l) => l.startsWith("cli:")).map((l) => l.slice(4)).filter((c) => c !== "ver");
check("sent exactly the generated commands + verification",
  JSON.stringify(sentCmds) === JSON.stringify([
    "set dutycycle 100", "set path.hash.mode 1", "set flood.advert.interval 24", "set loop.detect moderate",
    "region def west ca centralcoast slo slonorth", "region save", "region get slonorth"]),
  JSON.stringify(sentCmds));

const states = await page.$$eval("#push-progress li", (n) => n.map((x) => x.className));
check("all steps marked ok", states.every((c) => /\bok\b/.test(c)), JSON.stringify(states));
console.log("  final status:", await page.textContent("#push-status"));

await page.screenshot({ path: shot("push-success.png"), fullPage: false, clip: await page.locator("#push-panel").boundingBox() });

// ---------- 3. failure mid-sequence stops and resumes ----------
await page.evaluate(() => {
  window.__sim.log.length = 0;
  window.__sim.replies["region def west ca centralcoast slo slonorth"] = "Err - unknown jump: nope";
});
page.once("dialog", (d) => d.accept());
await page.click("#btn-push");
await page.waitForFunction(
  () => /rejected command/.test(document.getElementById("push-status").textContent), null, { timeout: 30000 });

const afterFail = await page.evaluate(() => window.__sim.log.filter((l) => l.startsWith("cli:")).map((l) => l.slice(4)).filter((c) => c !== "ver"));
check("stops at the failing command, sends nothing after",
  JSON.stringify(afterFail) === JSON.stringify([
    "set dutycycle 100", "set path.hash.mode 1", "set flood.advert.interval 24", "set loop.detect moderate",
    "region def west ca centralcoast slo slonorth"]),
  JSON.stringify(afterFail));

const failStates = await page.$$eval("#push-progress li", (n) => n.map((x) => x.className));
// The failing line is whatever was sent last, wherever it sits in the list.
const failIdx = afterFail.length - 1;
check("the failing step is marked failed", /\bfail\b/.test(failStates[failIdx]),
  failIdx + " of " + JSON.stringify(failStates));
check("later steps left as todo", /\btodo\b/.test(failStates[failIdx + 1]), JSON.stringify(failStates));

await page.screenshot({ path: shot("push-fail.png"), clip: await page.locator("#push-panel").boundingBox() });

// resume after fixing
await page.evaluate(() => {
  window.__sim.log.length = 0;
  delete window.__sim.replies["region def west ca centralcoast slo slonorth"];
});
await page.click("#btn-push");   // no confirm on resume
await page.waitForFunction(
  () => /Done\./.test(document.getElementById("push-status").textContent), null, { timeout: 30000 });

const resumed = await page.evaluate(() => window.__sim.log.filter((l) => l.startsWith("cli:")).map((l) => l.slice(4)).filter((c) => c !== "ver"));
check("resume restarts at the failed line, not from scratch",
  JSON.stringify(resumed) === JSON.stringify([
    "region def west ca centralcoast slo slonorth", "region save", "region get slonorth"]),
  JSON.stringify(resumed));

// ---------- 4. changing settings resets progress ----------
await page.selectOption("#opt-fw", "110");
check("progress cleared when settings change", await page.isHidden("#push-progress"));

// ---------- detection ----------
console.log("  detect loc:", await page.textContent("#detect-loc"));
console.log("  detect ver:", await page.textContent("#detect-ver"));

// ---------- 5. password never persisted ----------
const leaked = await page.evaluate(() => {
  const blobs = [JSON.stringify(localStorage), JSON.stringify(sessionStorage), location.href, document.cookie];
  return blobs.join("|").includes("hunter2");
});
check("password not in storage, URL or cookies", !leaked);

await page.click("#btn-disconnect");
check("password field cleared on disconnect", (await page.inputValue("#admin-pw")) === "");

console.log(errs.length ? "\nJS ERRORS:\n" + errs.join("\n") : "\nno JS errors");
pass &&= errs.length === 0;

await browser.close();
process.exit(pass ? 0 : 1);
