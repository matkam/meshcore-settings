# meshcore.js (vendored)

Browser-path subset of [liamcottle/meshcore.js](https://github.com/liamcottle/meshcore.js),
MIT licensed — see `LICENSE`. Copyright © Liam Cottle.

**Pinned to commit** `bbe1f9301b801cbd48a053687f16eea9634634cd` (package version 1.13.0).

## Why it's vendored rather than installed

This site has no build step and no package manager. These modules are native ES
modules with only relative imports, so the browser loads them directly from
`assets/vendor/`.

## What was left out

Only the modules reachable from the two browser transports are here:

```
connection/web_serial_connection.js  → connection/serial_connection.js ─┐
connection/web_ble_connection.js ───────────────────────────────────────┤
                                                                        ▼
                                                          connection/connection.js
        → constants, events, buffer_reader, buffer_writer, buffer_utils,
          random_utils, packet → advert, meshcore_path, hex_util
```

Deliberately excluded:

- `nodejs_serial_connection.js` and `tcp_connection.js` — they import `serialport`
  and `node:net`, which do not resolve in a browser.
- `src/index.js` — it re-exports the Node transports above, so importing it would
  drag them in. Import the specific modules instead.
- `transport_key_util.js` — not reachable from `connection.js`.

## One landmine to know about

`advert.js` verifies signatures via a **dynamic** `import("@noble/curves/ed25519")`.
Being dynamic, it does not break module loading — but it is a bare specifier that
will fail to resolve if that code path ever runs in the browser. Nothing this site
does reaches it. If you start verifying advert signatures, vendor `@noble/curves`
too and rewrite that import to a relative path.

## Updating

Re-download the file list above at the new commit, update the SHA in this file,
re-run `npm run validate` and the browser tests, and re-check the exclusions —
upstream may have added imports that pull in Node-only modules.
