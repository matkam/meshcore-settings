# California MeshCore Repeater Settings

A static site that turns "where is your repeater?" into the settings you paste
into its console — duty cycle, advert path hash mode, flood advert interval,
loop detection, and the region scope chain.

Pick North County SLO, for example, and you get:

```
set dutycycle 100
set path.hash.mode 1
set flood.advert.interval 24
set loop.detect moderate
region def west california centralcoast slo slonorth
region save
```

Every one of those is adjustable under **Options** — which also has a free-text
**Owner info** box for your email, Discord handle or callsign — and the whole block
is editable if you want to send something else entirely.

**Live site:** https://matkam.github.io/meshcore-settings/

## Contents

**Using it** —
[Firmware versions](#firmware-versions) ·
[The map](#the-map) ·
[The other settings](#the-other-settings) ·
[Carrying more than one place](#carrying-more-than-one-place) ·
[Editing the commands](#editing-the-commands) ·
[Browsing, and looking a code up](#browsing-and-looking-a-code-up) ·
[Pushing settings over the air](#pushing-settings-over-the-air)

**The data** —
[The region scheme](#the-region-scheme) ·
[Using the region data elsewhere](#using-the-region-data-elsewhere) ·
[Adding or fixing an area](#adding-or-fixing-an-area)

**Working on it** —
[Layout](#layout) ·
[Running it locally](#running-it-locally) ·
[Tests](#tests) ·
[Deployment and PR previews](#deployment-and-pr-previews)

## Firmware versions

Not every repeater is on current firmware, so there's a version selector. Pick
yours and the commands adapt:

| Version | Duty cycle | Path hash | Loop detect | Region tree |
| --- | --- | --- | --- | --- |
| 1.16+ | `set dutycycle` | `set path.hash.mode` | `set loop.detect` | `region def` (one line) |
| 1.15 | `set dutycycle` | `set path.hash.mode` | `set loop.detect` | `region put` per level |
| 1.14 | `set af` | `set path.hash.mode` | `set loop.detect` | `region put` + `region allowf` |
| 1.10 – 1.13 | `set af` | *(not supported)* | *(not supported)* | `region put` + `region allowf` |

`set flood.advert.interval` is sent on every version. `set owner.info` needs 1.12,
which sits inside the 1.10–1.13 tier — nothing here can tell 1.13 from 1.11, so it
is offered on every tier and the oldest one says it may come back unknown.

From 1.15 a region is flood-allowed as it's created, so `region allowf` is only
emitted for 1.14 and older, where the regions would otherwise exist but drop
scoped traffic.

Same tree, different syntax. On 1.10–1.13 that same North County example becomes:

```
set af 0
region put west
region allowf west
region put california west
region allowf california
region put centralcoast california
region allowf centralcoast
region put slo centralcoast
region allowf slo
region put slonorth slo
region allowf slonorth
region save
```

The duty cycle field stays in percent whichever version you pick — on pre-1.15
firmware it's converted to the nearest airtime factor, since `set af` only offers
1/(1+af) steps (100% → `af 0`, 50% → `af 1`, 25% → `af 3`). Check your version on
the node with `ver`.

Every area has a shareable deep link — [`#slonorth`](https://matkam.github.io/meshcore-settings/#slonorth)
opens the page with North County already selected, which is handy for
pasting into a group chat when you're helping someone bring a node up.

## The map

The picker opens with a map of California. Click a dot for a local area, a
boundary for an area-wide scope, or a region label for a region-wide one — the
levels of the scope chain, in the things you can click. Whatever is selected is
reflected back: the region as a wash across the shapes inside it, an area as a
solid fill, a local area as a marked dot. A selection made in the search box or
the picker shows up on the map too, and vice versa.

None of that is coded per level. A place is drawn as a boundary if it names an
outline, as a dot if it carries a lat/lon, and as a label if it sits at the top of
the tree — so a tree shaped differently from California's gets a map without any
change here.

It zooms, which the Bay Area needs — a dozen areas sit within a few pixels of
each other at full extent. Use the buttons, ctrl/⌘ + scroll, or pinch; drag to
pan once zoomed. A plain scroll wheel is left alone so the page still scrolls
normally with the pointer over the map. Zooming is just a narrower `viewBox`, so
nothing is redrawn, and dots and labels hold their size on screen while the
geography grows under them.

Two deliberate limits on what it claims:

- **County lines are real; area boundaries are not drawn.** The county outlines
  are Census TIGER boundaries, and a place claims every one it wholly contains —
  the North Bay claims Marin, Sonoma, Napa and Solano. Where a place cuts across a
  county line nobody claims that shape, so Lake Tahoe, the Mojave and Los Angeles
  draw as dots on plain background. That is deliberate: tinting three whole
  counties for the Tahoe basin would claim an extent the mesh doesn't have.
- **There is no colour per region.** Categorical fills on a map this size
  fail colour-blind separation, and they would compete with the one thing colour
  should mean here: what *you* have selected. Region identity comes from labels
  and from hovering instead.

The map is a shortcut, not the only route — everything on it is also reachable
through the search box and the picker, which are what keyboard and screen-reader
users get. Nothing is map-only.

`window.RegionMap.showPosition(lat, lon)` drops a marker at a real position, for
showing where a connected repeater says it is.

### Regenerating the outlines

`data/outlines.json` is generated and committed. Adding an area never touches it.
If the boundaries ever need replacing:

```sh
npm run build:outlines -- path/to/california-counties.geojson
```

It projects lon/lat into flat viewBox units, simplifies the rings to about 600 m,
drops specks while keeping the real islands, and writes one SVG path per shape.
The projection constants live in the generated file and are shared by the map and
the validator, so a coordinate lands in the same place in both.

The shapes are a library keyed by name, not a level of the tree: a place claims
one with `outline: Del Norte`, or several with `outline: [Marin, Sonoma, Napa,
Solano]`. Today they happen to be counties, which is why the input is a counties
GeoJSON, but nothing in the site assumes that — the tree stopped having a county
level and the shapes carried on working.

## The other settings

These all live under **Options**. The two intervals are on by default; owner info
is blank until you type something.

**Owner info** — `set owner.info <text>`, added in firmware 1.12. A free-text box:
put whatever lets a neighbour reach you about the node — an email address, a Discord
handle, a callsign, a URL. `|` is the firmware's newline marker, so it shows as a
line break where the info is displayed. It is readable by anyone who can query the
repeater, so it is public by design; the hint under the box says so. Leave it empty
and no command is sent, which leaves whatever the repeater already has alone — there
is deliberately no way here to send an empty value and wipe it. The box caps at 120
characters so `set owner.info <text>` stays inside the 160-character serial line.

**Flood advert interval** — `set flood.advert.interval 24`. How often the
repeater floods an advert to the whole mesh so distant nodes can discover it and
build a path. Every repeater rebroadcasts these, so the cost is paid mesh-wide;
the firmware's own default is 12 hours, and 24 halves that traffic while keeping
the node discoverable. The documented range is **3–168 hours**; the parser also
accepts **0 to switch flood adverts off**, and rejects 1 and 2 outright. Leave
the box empty and the command isn't sent at all, which is different from sending 0.

**Loop detection** — `set loop.detect moderate`, added in firmware 1.14. Rejects
a flood packet that already carries this repeater's own id in its path, which is
what a packet going round in circles looks like. Without it, one node
re-forwarding mangled packets can start a storm that runs to the 64-hop limit.

How many repeats each mode tolerates depends on the path hash size **of the
packet being judged** — not on this node's `path.hash.mode`, which only governs
the hashes it stamps on its own adverts:

| Mode | 1-byte path | 2-byte | 3-byte |
| --- | --- | --- | --- |
| `off` | never rejects | — | — |
| `minimal` | 4+ occurrences | 2+ | 1+ |
| `moderate` | 2+ | 1+ | 1+ |
| `strict` | 1+ | 1+ | 1+ |

The firmware default is `off`, so sending `moderate` is a deliberate change.

## Carrying more than one place

The picker is a **tree of checkboxes**: tick a region and the places inside it
appear beneath it, and so on down. Region names are a hierarchy, so showing them
as one keeps the list short and makes the shape of what you're configuring
visible. Each row shows the code that will actually go on the air.

**You carry exactly what you tick**, plus the ancestry each pick implies. Tick
several and the repeater carries them all — which is what a high site bridging
two communities needs, with no separate mode to say so, and no restriction on
staying inside one region.

There is no "deepest level wins" rule to learn. Ticking an area *and* a local area
inside it isn't a contradiction: the local area's chain already contains the area,
so the redundant chain is simply dropped when the commands are built.

*Clear* empties the picker; ticking otherwise adds rather than replaces. Picking
from the search box, the map or a connected repeater replaces the whole set and
scrolls the result into view.

The principle behind it, from the
[PNW region strategy](https://gessaman.com/meshcore/regions/), is that **RF reach
is not a scope boundary**: a mountaintop node is heard far beyond the areas it
carries tags for, but it only forwards traffic matching a tag it holds, and the
non-matching neighbour that hears it won't re-forward. A local message pushed
into non-matching territory dies one hop later — that one hop is the cost of
bridging.

Worth knowing what that document says about *small* nodes, since the instinct is
usually backwards: limited range is **not** a reason to carry fewer tags. A
neighbourhood repeater should hold the same full ancestry as a backbone one.
Dropping a tag doesn't meaningfully reduce your load — wide-scope traffic is rare
by design — it just cuts off the devices that reach the mesh through you.

### One line, not several

`region def` walks a cursor, and the `name|jump` form creates `name` under the
cursor then moves the cursor to `jump`. So several picks share their ancestry
instead of repeating it — North County, San Luis Obispo and Oakland is one line,
not three:

```
region def west california centralcoast slo slonorth|slo slocity|california bayarea eastbay oakland
```

Each jump goes to the deepest name the next branch shares with where the cursor
already is. The 160-character serial limit still applies, so a line that would
overflow starts a fresh command from the root — and on pre-1.16 firmware, where
there is no `region def`, it falls back to one `region put` per name with shared
ancestry placed once.

A link carries every pick: [`#slonorth,slocity`](https://matkam.github.io/meshcore-settings/#slonorth,slocity)
restores the whole set.

### Two limits worth knowing

- **160 characters per serial line.** Handled by splitting into more commands.
- **32 region names per node** (`MAX_REGION_ENTRIES` in the firmware). This one
  can't be worked around — it's the size of the node's region table. Ten local
  areas in ten different regions is already 32 names. Going over doesn't fail cleanly:
  `region def` places names until the table is full and then rejects the rest,
  leaving the repeater half configured. The line under the commands shows the
  count, and warns when a selection won't fit.

## Editing the commands

The generated block has an **Edit** button. Anything you type there becomes what
gets copied and what gets sent over the air — the site stops being in charge.

Edits survive: changing the area, the firmware version or any option afterwards
updates the generated version behind the scenes but **never overwrites what you
typed**. A note says the two have diverged, and *Reset to generated* puts it
back. The 160-character serial limit is checked against your text too, and an
emptied list disables sending rather than sending nothing.

## The region scheme

A chain of names, matching how `region def` is walked — each token becomes a child
of the one before it:

```
west     →  california  →  centralcoast   →  slo         →  slonorth
US West     California     Central Coast     SLO County     North County (Paso Robles, Atascadero)
```

California is split into 13 regions covering all 58 counties, with 161 local areas
under them, and you can generate settings at any level: pick a region for a
region-wide chain, an area for an area-wide one, or a local area for the full
chain.

**The levels follow communities and RF propagation, not administrative lines.**
County boundaries are ignored wherever they cut through a mesh — Lake Tahoe is one
place across three counties, the Mojave gathers the high desert out of four, and
Ventura County is split at the Conejo grade because its east half talks to Los
Angeles and its west half talks up the coast. Counties survive as a `county` field
on each local area, which never appears in a generated chain: it gives the
validator its point-in-boundary check and makes the county name searchable.

**Depth varies by branch, deliberately.** Sparse country needs three levels to
reach something meaningful, so the North Coast lists its towns directly under the
region. A metro where the county already *is* the mesh needs two, so Los Angeles,
Orange County and San Diego hold their local areas with nothing in between. Both
are correct and `region def` does not care — 67 of the 161 places sit on a
four-token chain rather than five, which is a region-table entry back on every
node in those branches.

None of that is coded in. The tree in `data/regions.yaml` nests as deep as you
like — a place has `children`, and those children may have children — up to
MeshCore's eight-level chain limit, with the two root tokens counting toward it.
Nothing in the page knows what a "county" is: the level names come from a `levels`
list in the data, the map draws a boundary for any place that names one and a dot
for any place that carries a lat/lon, and the picker just recurses.

On firmware older than 1.16 the same chain is built with `region put <name> [parent]`
followed by `region allowf <name>` for each level — see
[Firmware versions](#firmware-versions).

A repeater carries every name in its chain, so scoping a message `slonorth`
keeps it in the north county, `slo` covers the county, and `west` reaches the
whole western mesh. Matching is **per name, not per level** — a repeater that has
`slo` but not `centralcoast` will not forward `centralcoast`-scoped traffic,
which is why every node defines the whole chain even though it only sits in one
spot.

### Tags: a scope that cuts across the tree

Some scopes don't fit the hierarchy. `socal` reaches Los Angeles, Orange County,
the Inland Empire, the deserts and San Diego — six regions with no common parent,
and giving them one would be wrong: they sit in four RF-separate basins, so a
single region implying they hear each other is exactly what this scheme is trying
to avoid.

A **tag** is the answer. It is a region name that is not a level: it hangs off the
root as its own short chain, and a place opts into it rather than inheriting one
by position. Everything beneath an opted-in place carries it too.

```
region def west california losangeles dtla
region put socal california
```

`region put`, not a second `region def`, even on firmware that has `def`. A tag is
one extra name rather than a chain, so `put` says what it is; a `def` would
re-assert `west` and `california` that the line above just placed, resetting their flags
on the way past; and this way the tag looks identical on every firmware version,
where only the chain form differs. It flood-allows as it creates on 1.15+, so no
`allowf` is needed there.

The node ends up holding five names and matches traffic scoped to any of them.

Tags are declared once at the top of `data/regions.yaml` and referenced by the
places that carry them:

```yaml
tags:
  - code: socal
    name: Southern California

places:
  - code: losangeles
    tags: [socal]
```

The cost is one region-table entry on the nodes that carry it, and **only** those
nodes — which is the point. Making `socal` a level instead would have cost every
node beneath it a table entry whether or not its operator wanted the wider scope,
and would have pushed 44 southern places from a four-token chain to five.

### These codes are a convention, not a standard

MeshCore does not ship a national region list, and there is no body that assigns
these. What actually matters is that the repeaters around you use the same names.
The codes here follow the widely used `west` / `california` top-level tags and stay
lowercase, but **check with your local mesh group before deploying**, and open a
PR if your area is missing or named wrong.

Region names never appear in packets — a scoped packet carries two 16-bit
transport codes derived from the region's key, so a code's length has no effect on
airtime. The firmware's ceiling is 30 characters (`RegionEntry.name` is
`char[31]`), and the longest chain this file generates is under 60 of the 160
characters a serial line allows, so codes are words rather than abbreviations:
`centralvalley` beats `cv` when nobody has to look it up. Established vernacular
is the exception worth making — `sf`, `oc`, `ie`, `sfv` and `dtla` are what
operators already type.
Two-letter codes that collide with a US state abbreviation are avoided, which is
why Los Angeles is not `la`.

Region names live in one flat namespace on a node, so codes must be unique across
the entire file — `npm run validate` enforces that, along with the 160-character
serial line limit, the 30-character code limit and MeshCore's 8-level depth cap.

## Browsing, and looking a code up

The picker is a tree of checkboxes, and **opening a place is separate from
choosing it**. Each place with something inside it has its own disclosure
control, so you can read the whole scheme end to end without ticking anything —
useful for "what is Mendocino County's code?" or "what did the group settle on
for the Coachella Valley?". *Expand all* opens the lot; the box scrolls rather
than the page growing.

The box grows with the window up to about 720px — roughly nineteen rows — and
stops there so step 1 doesn't become a wall of names. It's only ever as tall as
it has content for, so at rest it's still eight rows. Drag its bottom edge for
more: the cap steps aside the moment you grab the handle, since `resize` writes a
height that `max-height` would otherwise clamp, which would stop the drag dead at
exactly the point you'd reach for it. Phones cap lower, since a row is two lines
there and 70% of the screen would push the map out of sight.

Every row carries its code first, then its name, then a description — a region's
blurb, or for a local area the towns it covers, which is the same alias list that
makes it findable by search. Counties have no description in the data and need
none. Descriptions are clipped to one line so a row stays a row and the tree's
shape stays scannable; the full text is in the tooltip, and on a narrow screen it
drops to a second line instead.

Ticking a place still opens it, because working downwards that way is a good
default. Unticking deliberately leaves it open — you may still want to look at
what you just decided against — and *Clear* clears the selection without
collapsing anything.

One consequence worth knowing if you're reading the DOM: only open rows are
rendered, so a ticked place inside a collapsed one is not in the markup. It is
still selected, and `window.SettingsState.picked()` still reports it.

## Using the region data elsewhere

[`data/regions.json`](data/regions.json) is the tree on its own, with nothing about
this site in it. It's published with the rest of the site, so it can be fetched
directly:

```
https://matkam.github.io/meshcore-settings/data/regions.json
```

GitHub Pages serves it with `Access-Control-Allow-Origin: *`, so a browser app can
read it cross-origin without a proxy. The raw file on GitHub works too, and tracks
`main` rather than the last deploy:

```
https://raw.githubusercontent.com/matkam/meshcore-settings/main/data/regions.json
```

The shape, in brief — the field-by-field documentation lives in the comments at
the top of [`data/regions.yaml`](data/regions.yaml):

```jsonc
{
  "format": 1,                    // bumped only on a breaking change
  "name": "California",
  "updated": "2026-07-31",
  "limits": { "maxLineLength": 160, "maxRegionNames": 32, "maxDepth": 8 },
  "root":   [ { "code": "west", "name": "Western US" }, … ],
  "levels": [ { "name": "region", "plural": "regions" }, … ],
  "places": [
    {
      "code": "cc",             // unique across the whole file
      "name": "Central Coast",
      "children": [
        {
          "code": "slo",
          "name": "San Luis Obispo County",
          "outline": "San Luis Obispo",       // optional, a shape in outlines.json
          "children": [
            {
              "code": "prb",
              "name": "North County",
              "lat": 35.627, "lon": -120.691, // optional
              "aliases": ["Paso Robles", "Atascadero", …]  // search terms only
            }
          ]
        }
      ]
    }
  ]
}
```

A place's chain is `root` plus its ancestors plus itself, which is what
`region def` takes. `children` is absent rather than empty on a leaf. `aliases`
never travel over the air — they exist so a search box can find a place by a town
name.

[`data/outlines.json`](data/outlines.json) sits beside it with the boundary shapes,
already projected into flat SVG units, and carries the projection constants and its
own attribution notice.

Two promises: `format` changes only when the shape does in a way that breaks
readers, and a `code` already in the file is not renamed — codes are on real
hardware, and renaming one splits a mesh.

### The YAML is published too

`data/regions.yaml` goes out with everything else, served as `text/yaml` with the
same `Access-Control-Allow-Origin: *`, so `yaml.safe_load` on that URL gets you
the same tree with the explanatory comments attached. Nothing stops you reading
it, and if you want to see *why* a place is filed where it is, that's the file to
look at.

Every field means the same thing in both, down to the type — `updated` is quoted
in the YAML precisely so it doesn't resolve to a timestamp on one side and a
string on the other.

The JSON is still the one to depend on:

- It parses everywhere without a dependency.
- It is normalised. The build fixes key order, drops `children` when a place has
  none, and rejects unknown fields; the YAML is whatever a contributor typed.

So: the YAML if you're reading, the JSON if you're building on it.

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
  area's point can be well away from where a node actually is. So the page
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

Positions live alongside each place in `data/regions.yaml` — at any level, not
just the deepest. `npm run validate` checks they land on the map, that no two are
identical, and warns when two are close enough that detection can't reliably tell
them apart.

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
| `assets/data.js` | Fetches the two data files and indexes the tree |
| `assets/app.js` | Search, the picker, command generation |
| `assets/map.js` | The map: draws it, handles picking, reflects the selection |
| `assets/push.js` | Over-the-air flow: connect, log in, send, verify, resume |
| `assets/vendor/meshcore.js/` | Vendored [meshcore.js](https://github.com/liamcottle/meshcore.js) (MIT), pinned — see its README |
| `assets/style.css` | Styles, light and dark |
| `data/regions.yaml` | **The region tree.** This is the file worth editing. |
| `data/regions.json` | The same tree, built from the YAML — what the site loads, and what to consume from outside |
| `data/outlines.json` | Boundary shapes for the map — generated, don't hand-edit |
| `scripts/build-regions.mjs` | YAML → JSON, and `--check` that they agree |
| `scripts/build-outlines.mjs` | Regenerates `data/outlines.json` from a GeoJSON |
| `scripts/validate.mjs` | Uniqueness / length / depth / coordinate checks |
| `tests/` | Browser tests — see [Tests](#tests) |

The vendored library is plain ES modules with relative imports, so the browser loads
it directly — the page itself is still unbuilt and unbundled.

## Running it locally

The page is unbuilt — no bundler, no framework. Serve the directory and open it:

```sh
npm run serve       # python3 -m http.server 8000
```

Then http://localhost:8000. It has to be *served*: the tree is a JSON file the
page fetches, and browsers block `fetch` on `file://` URLs. Opening `index.html`
off the filesystem shows a note saying exactly that.

Editing the tree does have a build step, because the file people edit is YAML and
the file everything reads is JSON:

```sh
npm install              # once, for the YAML parser
npm run build:regions    # data/regions.yaml -> data/regions.json
npm run validate:built   # build from the YAML, then check the tree
npm run validate         # the same checks, but insists the committed JSON matches
```

## Tests

Browser tests, driven by Playwright against a simulated companion radio, so the
over-the-air flow is exercised without hardware:

```sh
npm install          # Playwright and the YAML parser; the page itself has neither
npm test             # all suites
npm test -- map      # just one
```

`npm test` serves the repo on a random free port and runs each suite in its own
process, so one broken suite can't take the others' results with it. On CI they
run against every PR, and screenshots are uploaded when something fails.

| Suite | What it covers |
| --- | --- |
| `basic` | Search, the picker, deep links, copy |
| `firmware` | Command output on each of the four version tiers |
| `levels` | A synthetic tree, four levels deep in one branch and two in another |
| `browse` | Reading the tree without selecting from it, and vice versa |
| `detect` | Reading position and firmware from a connected repeater |
| `flow` | Landing on the page cold and working through it |
| `push` | Sending over the air, stopping at a failure, resuming |
| `map` | Drawing, hover, picking at every level, zoom and pan |
| `settings` | Loop detection, flood advert interval, editing the commands |
| `picks` | Multiple selections, branch joining, shared-ancestry dedup |

`tests/sim.mjs` is the fake device: it answers the companion protocol over a
stubbed Web Serial port, so a test can specify what the repeater reports and how
it replies to each command.

`levels` earns its place: every other suite drives California's tree, which is
ragged but never deeper than three, and would keep passing if that were
hard-coded somewhere. It intercepts the fetch of
`data/regions.json` and serves a tree of its own instead, with the outlines and
positions hung off different levels, then checks the picker, the chain, the map
and the level names all follow.

If Playwright can't find a browser — some environments pre-install one whose
build number doesn't match the npm package — point it at the binary:

```sh
CHROMIUM_PATH=/path/to/chrome npm test
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

See [CONTRIBUTING.md](CONTRIBUTING.md). Short version: add an entry under the
right area in `data/regions.yaml`, name the county it sits in, run
`npm run validate:built`, and open a PR — changing `data/regions.yaml` alone is
enough, because CI builds the JSON from it.

## Sources

Command syntax, version gates and value ranges follow the
[MeshCore CLI reference](https://docs.meshcore.io/cli_commands/)
([source](https://github.com/meshcore-dev/MeshCore/blob/main/docs/cli_commands.md)).
This project is community maintained and not affiliated with MeshCore.

## License

MIT
