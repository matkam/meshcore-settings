// Simulated MeshCore companion node, shared by the browser tests.
export const simInit = () => {
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
};
