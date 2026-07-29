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
| 1.15 | `set dutycycle` | `set path.hash.mode` | `region put` + `region allowf` |
| 1.14 | `set af` | `set path.hash.mode` | `region put` + `region allowf` |
| 1.10 – 1.13 | `set af` | *(not supported)* | `region put` + `region allowf` |

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

## Layout

| Path | What it is |
| --- | --- |
| `index.html` | The page |
| `assets/app.js` | Search, cascading selects, command generation. No dependencies. |
| `assets/style.css` | Styles, light and dark |
| `data/regions.js` | **The region tree.** This is the file worth editing. |
| `scripts/validate.mjs` | Uniqueness / length / depth checks |

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

## Adding or fixing an area

See [CONTRIBUTING.md](CONTRIBUTING.md). Short version: add an entry to the right
county in `data/regions.js`, run `npm run validate`, open a PR.

## Sources

Command syntax follows the [MeshCore CLI reference](https://docs.meshcore.io/cli_commands/).
This project is community maintained and not affiliated with MeshCore.

## License

MIT
