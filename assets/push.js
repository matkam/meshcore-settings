/*
 * "Push straight to the repeater" panel.
 *
 * Transport and protocol come from the vendored meshcore.js (see
 * assets/vendor/meshcore.js/README.md). This file only adds the flow this site
 * needs on top: pick a repeater, log in, then run the generated commands one at
 * a time, stopping at the first failure so a half-applied region chain is
 * obvious rather than silent.
 *
 * Loaded as a module, so it runs after app.js (a classic script) has already
 * defined window.SettingsState.
 */
import WebSerialConnection from "./vendor/meshcore.js/src/connection/web_serial_connection.js";
import WebBleConnection from "./vendor/meshcore.js/src/connection/web_ble_connection.js";
import Constants from "./vendor/meshcore.js/src/constants.js";

const $ = (id) => document.getElementById(id);

const els = {
  panel: $("push-panel"),
  connect: $("push-connect"),
  session: $("push-session"),
  support: $("push-support"),
  btnUsb: $("btn-usb"),
  btnBle: $("btn-ble"),
  btnLogin: $("btn-login"),
  btnPush: $("btn-push"),
  btnDisconnect: $("btn-disconnect"),
  connStatus: $("conn-status"),
  repeater: $("sel-repeater"),
  repeaterHint: $("repeater-hint"),
  password: $("admin-pw"),
  progress: $("push-progress"),
  status: $("push-status")
};

// Truthiness rather than `in` — some browsers expose the property as undefined.
const hasSerial = typeof navigator !== "undefined" && !!navigator.serial;
const hasBle = typeof navigator !== "undefined" && !!navigator.bluetooth;

// Without either API there is nothing to offer — leave the panel hidden so the
// copy-paste flow is all anyone sees.
if (hasSerial || hasBle) { init(); }

function init() {
  els.btnUsb.hidden = !hasSerial;
  els.btnBle.hidden = !hasBle;
  els.support.textContent = hasSerial && hasBle
    ? "Your browser supports both transports."
    : hasSerial
      ? "Your browser supports USB only. Bluetooth needs Chrome or Edge."
      : "Your browser supports Bluetooth only.";

  els.btnUsb.addEventListener("click", () => connect("usb"));
  els.btnBle.addEventListener("click", () => connect("ble"));
  els.btnLogin.addEventListener("click", login);
  els.btnPush.addEventListener("click", push);
  els.btnDisconnect.addEventListener("click", disconnect);

  els.repeater.addEventListener("change", () => {
    loggedInTo = null;
    resumeFrom = 0;
    els.btnPush.disabled = true;
    els.progress.hidden = true;
    setStatus("Log in to this repeater to continue.");
  });

  window.SettingsState.onChange(() => {
    els.panel.hidden = false;
    if (busy) { return; }
    resumeFrom = 0;
    els.progress.hidden = true;
  });

  // app.js may already have rendered a deep-linked area before this ran.
  if (window.SettingsState.get()) { els.panel.hidden = false; }
}

let conn = null;
let contacts = [];
let loggedInTo = null;  // hex public key of the repeater we authenticated with
let resumeFrom = 0;     // index into the command list to restart at
let busy = false;

/* ---------- helpers ---------- */

function setStatus(text, kind) {
  els.status.textContent = text || "";
  els.status.className = "line-note" + (kind ? " " + kind : "");
}

function setBusy(on) {
  busy = on;
  els.btnLogin.disabled = on;
  els.btnPush.disabled = on || !loggedInTo;
  els.btnUsb.disabled = on;
  els.btnBle.disabled = on;
}

function toHex(bytes) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function describe(e) {
  const msg = (e && e.message) || (typeof e === "string" ? e : "") || "unknown error";
  if (/securityerror|permission/i.test(msg)) {
    return "The browser blocked device access. This needs a user gesture over HTTPS.";
  }
  return msg;
}

function selectedContact() {
  return contacts.find((c) => toHex(c.publicKey) === els.repeater.value) || null;
}

function commandList() {
  const built = window.SettingsState.get();
  return built ? built.lines : [];
}

/* ---------- connection ---------- */

async function connect(kind) {
  setBusy(true);
  setStatus("Connecting over " + (kind === "usb" ? "USB" : "Bluetooth") + "…");

  try {
    conn = kind === "usb" ? await WebSerialConnection.open() : await WebBleConnection.open();
    if (!conn) { throw new Error("Could not open the device."); }

    conn.on("disconnected", onDisconnected);

    // The transports fire "connected" once the read loop is running; commands
    // sent before that are dropped.
    await waitFor(conn, "connected", 10000, "device handshake");

    setStatus("Fetching contacts…");
    contacts = await withTimeout(conn.getContacts(), 20000, "contact list");

    fillRepeaters();
    els.connect.hidden = true;
    els.session.hidden = false;
    els.connStatus.textContent = "Connected over " + (kind === "usb" ? "USB" : "Bluetooth") + ".";
    setStatus("");
  } catch (e) {
    // A cancelled device picker is a normal outcome, not an error to shout about.
    if (e && (e.name === "NotFoundError" || /cancel/i.test(e.message || ""))) {
      setStatus("");
    } else {
      setStatus(describe(e), "over");
    }
    if (conn) { try { await conn.close(); } catch (x) { /* never opened */ } }
    conn = null;
  } finally {
    setBusy(false);
  }
}

function waitFor(emitter, event, ms, label) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      emitter.off(event, ok);
      reject(new Error(label + " timed out"));
    }, ms);
    function ok(v) {
      clearTimeout(timer);
      emitter.off(event, ok);
      resolve(v);
    }
    emitter.on(event, ok);
  });
}

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(label + " timed out")), ms))
  ]);
}

function fillRepeaters() {
  const list = contacts.filter(
    (c) => c.type === Constants.AdvType.Repeater || c.type === Constants.AdvType.Room
  );

  els.repeater.textContent = "";

  if (!list.length) {
    const o = document.createElement("option");
    o.textContent = "No repeaters in this node's contacts";
    els.repeater.appendChild(o);
    els.repeater.disabled = true;
    els.btnLogin.disabled = true;
    els.repeaterHint.textContent =
      "Your companion only lists repeaters it has heard an advert from. Bring it " +
      "within range and let it pick one up first.";
    return;
  }

  els.repeater.disabled = false;
  list.sort((a, b) => a.advName.localeCompare(b.advName));
  for (const c of list) {
    const o = document.createElement("option");
    o.value = toHex(c.publicKey);
    o.textContent = c.advName + (c.type === Constants.AdvType.Room ? "  (room server)" : "");
    els.repeater.appendChild(o);
  }

  els.repeaterHint.textContent =
    list.length + " of " + contacts.length + " contacts are repeaters or room servers.";
}

function onDisconnected() {
  els.connect.hidden = false;
  els.session.hidden = true;
  els.btnPush.disabled = true;
  loggedInTo = null;
  resumeFrom = 0;
  conn = null;
  setStatus("Device disconnected.", "over");
}

async function disconnect() {
  els.password.value = "";
  if (conn) { try { await conn.close(); } catch (e) { /* already gone */ } }
  onDisconnected();
  setStatus("");
}

/* ---------- login ---------- */

async function login() {
  const contact = selectedContact();
  if (!contact) { return; }

  const pw = els.password.value;
  if (!pw) {
    setStatus("Enter the repeater's admin password first.", "over");
    els.password.focus();
    return;
  }

  setBusy(true);
  loggedInTo = null;
  els.progress.hidden = true;
  setStatus("Logging in to " + contact.advName + "… this is a round trip over the air.");

  try {
    await conn.login(contact.publicKey, pw);
    loggedInTo = toHex(contact.publicKey);
    resumeFrom = 0;
    setStatus("Logged in to " + contact.advName + ".", "ok");
  } catch (e) {
    // login() rejects with "timeout" or bare undefined depending on the failure.
    const why = !e ? "no response — wrong password, or the repeater is out of reach"
      : /timeout/i.test(describe(e)) ? "no response — wrong password, or the repeater is out of reach"
      : describe(e);
    setStatus("Login failed: " + why, "over");
  } finally {
    setBusy(false);
  }
}

/* ---------- remote CLI ---------- */

/*
 * Run one CLI command and return the repeater's reply.
 *
 * The reply is not pushed to us directly: the firmware signals that a message
 * is waiting and we then drain the queue. We also poll blind after the
 * estimated round trip, since a msgWaiting push can land while we are busy.
 */
async function runCli(publicKey, text) {
  const prefix = toHex(publicKey.slice(0, 6));

  const sent = await withTimeout(
    conn.sendTextMessage(publicKey, text, Constants.TxtTypes.CliData),
    10000,
    "command send"
  );

  if (sent && typeof sent.result === "number" && sent.result < 0) {
    throw new Error("companion refused to send (result " + sent.result + ")");
  }

  const estTimeout = (sent && sent.estTimeout) || 10000;
  const deadline = Date.now() + estTimeout + 10000;

  // Wait for the nudge, but don't depend on it arriving.
  await new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) { return; }
      done = true;
      clearTimeout(timer);
      conn.off(Constants.PushCodes.MsgWaiting, finish);
      resolve();
    };
    const timer = setTimeout(finish, estTimeout + 1500);
    conn.on(Constants.PushCodes.MsgWaiting, finish);
  });

  const replies = [];
  while (Date.now() < deadline) {
    const batch = await withTimeout(conn.getWaitingMessages(), 15000, "message sync");
    for (const entry of batch) {
      // syncNextMessage wraps each result by kind; channel traffic isn't ours.
      const m = entry.contactMessage;
      if (m && toHex(m.pubKeyPrefix) === prefix) { replies.push(m.text); }
    }
    if (replies.length) { break; }
    await new Promise((r) => setTimeout(r, 1200));
  }

  if (!replies.length) { throw new Error("no reply from repeater"); }
  return replies.join("\n");
}

/* ---------- push ---------- */

function renderProgress(lines, states) {
  els.progress.hidden = false;
  els.progress.textContent = "";

  lines.forEach((line, i) => {
    const li = document.createElement("li");
    li.className = "prog " + (states[i] ? states[i].kind : "todo");

    const cmd = document.createElement("code");
    cmd.className = "prog-cmd";
    cmd.textContent = line;
    li.appendChild(cmd);

    if (states[i] && states[i].reply) {
      const reply = document.createElement("pre");
      reply.className = "prog-reply";
      reply.textContent = states[i].reply;
      li.appendChild(reply);
    }
    els.progress.appendChild(li);
  });
}

async function push() {
  const contact = selectedContact();
  const lines = commandList();
  if (!contact || !lines.length) { return; }

  if (toHex(contact.publicKey) !== loggedInTo) {
    setStatus("Log in to this repeater first.", "over");
    return;
  }

  if (resumeFrom === 0) {
    const ok = window.confirm(
      "Send " + lines.length + " command" + (lines.length === 1 ? "" : "s") +
      " to " + contact.advName + "?\n\nThis changes the repeater's live configuration."
    );
    if (!ok) { return; }
  }

  const states = new Array(lines.length);
  for (let i = 0; i < resumeFrom; i++) {
    states[i] = { kind: "ok", reply: "(already sent)" };
  }

  setBusy(true);
  renderProgress(lines, states);

  for (let n = resumeFrom; n < lines.length; n++) {
    states[n] = { kind: "active" };
    renderProgress(lines, states);
    setStatus("Sending " + (n + 1) + " of " + lines.length + ": " + lines[n]);

    let reply;
    try {
      reply = await runCli(contact.publicKey, lines[n]);
    } catch (e) {
      states[n] = { kind: "fail", reply: describe(e) };
      renderProgress(lines, states);
      resumeFrom = n;
      setStatus(
        "Command " + (n + 1) + " did not complete, so commands after it were not sent. " +
        "The repeater may or may not have applied it — press Send settings to retry " +
        "from this line.", "over");
      setBusy(false);
      return;
    }

    if (/^Err\b/i.test(reply.trim())) {
      states[n] = { kind: "fail", reply: reply };
      renderProgress(lines, states);
      resumeFrom = n;
      setStatus(
        "The repeater rejected command " + (n + 1) + ". Nothing after it was sent — " +
        "fix the problem and press Send settings to resume from here.", "over");
      setBusy(false);
      return;
    }

    states[n] = { kind: "ok", reply: reply };
    renderProgress(lines, states);
  }

  resumeFrom = 0;
  setStatus("All " + lines.length + " commands applied. Verifying…");

  const built = window.SettingsState.get();
  const verify = "region get " + built.leaf;
  try {
    const check = await runCli(contact.publicKey, verify);
    states.push({ kind: "ok", reply: check });
    renderProgress(lines.concat([verify]), states);
    setStatus("Done. The verification reply above should show " + built.leaf +
              " with flood permission (F).", "ok");
  } catch (e) {
    setStatus("Settings were applied, but the verification read failed: " + describe(e));
  } finally {
    setBusy(false);
  }
}
