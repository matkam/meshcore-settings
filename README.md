# California MeshCore Repeater Settings

A static site that turns "where is your repeater?" into the settings you paste
into its console — duty cycle, advert path hash mode, and the region scope chain.

Pick North County SLO, for example, and you get:

```
set dutycycle 100
set path.hash.mode 1
region def west ca cc slo prb
region save
```

**Live site:** https://matkam.github.io/meshcore-settings/

## Firmware versions

Not every repeater is on current firmware, so there's a version selector. Pick
yours and the commands adapt:

| Version | Duty cycle | Path hash | Region tree |
| --- | --- | --- | --- |
| 1.16+ | `set dutycycle` | `set path.hash.mode` | `region def` (one line) |
| 1.15 | `set dutycycle` | `set path.hash.mode` | `region put` per level |
| 1.14 | `set af` | `set path.hash.mode` | `region put` + `region allowf` |
| 1.10 – 1.13 | `set af` | *(not supported)* | `region put` + `region allowf` |

From 1.15 a region is flood-allowed as it's created, so `region allowf` is only
emitted for 1.14 and older, where the regions would otherwise exist but drop
scoped traffic.

Same tree, different syntax. On 1.10–1.13 that same North County example becomes:

```
set af 0
region put west
region allowf west
region put ca west
region allowf ca
region put cc ca
region allowf cc
region put slo cc
region allowf slo
region put prb slo
region allowf prb
region save
```

The duty cycle field stays in percent whichever version you pick — on pre-1.15
firmware it's converted to the nearest airtime factor, since `set af` only offers
1/(1+af) steps (100% → `af 0`, 50% → `af 1`, 25% → `af 3`). Check your version on
the node with `ver`.

Every area has a shareable deep link — [`#prb`](https://matkam.github.io/meshcore-settings/#prb)
opens the page with North County already selected, which is handy for pasting into
a group chat when you're helping someone bring a node up.

## The map

The picker opens with a map of California. Click a dot for a local area, a
county for a county-wide scope, or a region label for a region-wide one — the
three levels of the scope chain, in the three things you can click. Whatever is
selected is reflected back: the region as a wash across its counties, the county
as a solid fill, the area as a marked dot. A selection made in the search box or
the dropdowns shows up on the map too, and vice versa.

It zooms, which the Bay Area needs — a dozen areas sit within a few pixels of
each other at full extent. Use the buttons, ctrl/⌘ + scroll, or pinch; drag to
pan once zoomed. A plain scroll wheel is left alone so the page still scrolls
normally with the pointer over the map. Zooming is just a narrower `viewBox`, so
nothing is redrawn, and dots and labels hold their size on screen while the
geography grows under them.

Two deliberate limits on what it claims:

- **County lines are real; area boundaries are not drawn.** The county outlines
  are Census TIGER boundaries. Local areas are a community convention with no
  official shape, so they are marked as points. Drawing them as polygons would
  invent a precision the data doesn't have.
- **There is no colour per region.** Eight categorical fills on a map this size
  fail colour-blind separation, and they would compete with the one thing colour
  should mean here: what *you* have selected. Region identity comes from labels
  and from hovering instead.

The map is a shortcut, not the only route — everything on it is also reachable
through the search box and the dropdowns, which are what keyboard and
screen-reader users get. Nothing is map-only.

`window.RegionMap.showPosition(lat, lon)` drops a marker at a real position, for
showing where a connected repeater says it is.

### Regenerating the outlines

`data/counties.js` is generated and committed. Adding an area never touches it.
If the boundaries ever need replacing:

```sh
npm run build:counties -- path/to/california-counties.geojson
```

It projects lon/lat into flat viewBox units, simplifies the rings to about 600 m,
drops specks while keeping the real islands, and writes one SVG path per county.
The projection constants live in the generated file and are shared by the map and
the validator, so a coordinate lands in the same place in both.

## The region scheme

Five levels, matching how a `region def` chain is walked — each token becomes a
child of the one before it:

```
west  →  ca  →  cc            →  slo                     →  prb
US West  California  Central Coast  San Luis Obispo County   North County
```

California is split into 8 regions covering all 58 counties, with 162 local areas
under them. You can generate settings at any of the three lower levels: pick a
region for a region-wide chain, a county for a county-wide chain, or a local area
for the full five-token chain.

On firmware older than 1.16 the same chain is built with `region put <name> [parent]`
followed by `region allowf <name>` for each level — see
[Firmware versions](#firmware-versions).

A repeater carries every name in its chain, so scoping a message `prb` keeps it in
North County, `slo` covers the county, and `west` reaches the whole western mesh.
Matching is **per name, not per level** — a repeater that has `slo` but not `cc`
will not forward `cc`-scoped traffic, which is why every node defines the whole
chain even though it only sits in one spot.

### These codes are a convention, not a standard

MeshCore does not ship a national region list, and there is no body that assigns
these. What actually matters is that the repeaters around you use the same names.
The codes here follow the widely used `west` / `ca` top-level tags and stay short
and lowercase, but **check with your local mesh group before deploying**, and open
a PR if your area is missing or named wrong.

Region names live in one flat namespace on a node, so codes must be unique across
the entire file — `npm run validate` enforces that, along with the 160-character
serial line limit and MeshCore's 8-level depth cap.

## Pushing settings over the air

On browsers with Web Serial or Web Bluetooth (Chrome/Edge desktop, plus Chrome on
Android for Bluetooth), the page can talk to a MeshCore companion node directly and
apply the settings itself: pick a repeater from the companion's contacts, log in
with its admin password, and the generated commands are sent one at a time.

The panel is feature-detected and simply doesn't appear otherwise — **iOS and
Firefox support neither API**, so copy-paste stays the primary path for everyone.

### Filling in the selections from the repeater

Once connected, the repeater can answer both questions the page otherwise asks you:

- **Location** comes from the advertised lat/lon in the companion's contact record,
  so it needs no login. Each area is represented by a single centroid, so the
  nearest one is a guess rather than an answer — some areas genuinely sit a few km
  apart (Yuba City and Marysville face each other across the river), and a large
  area's centroid can be well away from where a node actually is. So the page
  offers a **shortlist of up to three, closest first, with distances** and you
  click the right one; nothing is applied silently. Runners-up are only listed
  while they're within 25 km of the closest match, so a genuinely isolated area
  offers just itself. The choices stay on screen after you pick, so a wrong guess
  is one click to correct. If even the closest match is further than 25 km it's
  reported but not offered, and a node that doesn't advertise a position says so.
- **Firmware version** comes from running `ver` after login, which replies
  `<version> (Build: <date>)`. That's the device stating a fact about itself, so the
  version selector is set directly. An unparseable reply is reported and the
  selector left alone.

Area centroids live alongside each area in `data/regions.js`. `npm run validate`
checks they're inside California, that no two are identical, and warns when two are
close enough that detection can't reliably tell them apart.

Two things worth knowing:

- Each command is a separate LoRa round trip. The flow **stops at the first
  failure** and resumes from that line rather than continuing, because a partly
  applied region chain leaves the repeater holding some names and silently dropping
  traffic for the rest. On 1.16+ the whole chain is one `region def` packet, which
  is a real reliability advantage over the ten-packet `region put` sequence.
- The admin password never leaves the browser except over USB/BLE to your own
  companion node, and is never written to storage or the URL. There is no server.

## Layout

| Path | What it is |
| --- | --- |
| `index.html` | The page |
| `assets/app.js` | Search, cascading selects, command generation |
| `assets/map.js` | The map: draws it, handles picking, reflects the selection |
| `assets/push.js` | Over-the-air flow: connect, log in, send, verify, resume |
| `assets/vendor/meshcore.js/` | Vendored [meshcore.js](https://github.com/liamcottle/meshcore.js) (MIT), pinned — see its README |
| `assets/style.css` | Styles, light and dark |
| `data/regions.js` | **The region tree.** This is the file worth editing. |
| `data/counties.js` | County outlines for the map — generated, don't hand-edit |
| `scripts/validate.mjs` | Uniqueness / length / depth / coordinate checks |
| `scripts/build-counties.mjs` | Regenerates `data/counties.js` from a GeoJSON |

The vendored library is plain ES modules with relative imports, so the browser loads
it directly — there is still no build step and no package manager.

## Running it locally

There is no build step. Serve the directory and open it:

```sh
npm run serve       # python3 -m http.server 8000
```

Then http://localhost:8000. Opening `index.html` directly off the filesystem works
too — the region data is a plain `.js` file rather than JSON precisely so `file://`
doesn't trip over CORS.

Before opening a PR:

```sh
npm run validate
```

## Deployment and PR previews

GitHub Pages serves one site per repo, so everything lives on the `gh-pages`
branch: production at the root, and each open PR at `/pr-<number>/`.

| Trigger | Publishes to |
| --- | --- |
| push to `main` | site root |
| PR opened / updated | `/pr-<number>/`, linked in a PR comment |
| PR closed | preview directory deleted |

Both paths run `.github/scripts/publish.sh`, which is careful about the one thing
that could go wrong: a root publish replaces the root **but never touches `pr-*`**,
and a preview publish touches only its own directory. Publishes are serialised
through a shared concurrency group and retry on a rejected push, since both can
target the branch at once.

Previews are served over HTTPS, which matters — Web Serial and Web Bluetooth
require a secure context, so the push panel is fully testable from a preview URL.
All asset paths are relative, so a copy under `pr-12/` runs unmodified.

Previews are skipped for PRs from forks: a fork's token is read-only and cannot
publish. The alternative, `pull_request_target`, would run fork code with a write
token, which is not worth a preview.

> **Repo setting this depends on:** Settings → Pages → Source must be
> **Deploy from a branch**, branch `gh-pages`, folder `/ (root)`. The workflows
> only push the branch; GitHub serves it.

## Adding or fixing an area

See [CONTRIBUTING.md](CONTRIBUTING.md). Short version: add an entry to the right
county in `data/regions.js`, run `npm run validate`, open a PR.

## Sources

Command syntax follows the [MeshCore CLI reference](https://docs.meshcore.io/cli_commands/).
This project is community maintained and not affiliated with MeshCore.

## License

MIT
