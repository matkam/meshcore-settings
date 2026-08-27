# Contributing

The useful contribution here is local knowledge: which areas actually have
repeaters, what the operators around you already call them, and where the
boundaries really fall.

## Adding a local area

Everything lives in [`data/regions.yaml`](data/regions.yaml). Find the area
yours belongs to and add an entry to its `children` list:

```yaml
          - code: slonorth
            name: North County
            county: San Luis Obispo
            lat: 35.627
            lon: -120.691
            aliases: ["Paso Robles", "Atascadero", "Templeton", "San Miguel", "Shandon"]
```

- **`code`** — the region name. Lowercase `a-z0-9`, 1–30 characters, and unique
  across the whole file. 30 is the firmware's ceiling (`RegionEntry.name` is
  `char[31]`), and length costs nothing on the air: a scoped packet carries a
  16-bit transport code derived from the name, never the name itself. So prefer
  the word people say over an abbreviation they have to look up — `slonorth`,
  not `prb`. Established vernacular is the exception worth making: `sf`, `oc`,
  `ie`, `sfv` and `dtla` are what operators already type. Avoid two-letter codes
  that collide with a US state abbreviation, since the namespace spans states —
  that is why Los Angeles is not `la`.
- **`name`** — what a human picks from the list. It has to stand on its own:
  "South County" made sense when a county sat above it in the tree and means
  nothing now that one doesn't.
- **`county`** — which county the place is in. This is **not** a level and never
  appears in a generated chain; it gives the validator its point-in-boundary
  check and makes the county name searchable.
- **`aliases`** — search terms only. These never appear in the generated
  commands; they exist so someone can type "Paso Robles" and land on `prb`. List
  the towns people would actually type, including unincorporated ones.
- **`lat` / `lon`** — a representative point, three decimal places. A connected
  repeater's advertised position is matched against these and the nearest few
  offered as a choice, and it's where the map puts your dot. So put it where the
  nodes actually are (the main town) rather than at the geometric centre of an
  empty valley.

Three more fields exist and are rarely needed:

- **`outline`** — the name of a shape in `data/outlines.json`, or a list of them,
  which makes the map draw this place as a boundary instead of a dot. A place
  claims every shape it wholly contains, and a shape split across two places is
  claimed by neither.
- **`short`** — what the map label says, when the code is too long to read at map
  size. Defaults to the code.
- **`kind`** — overrides the level name for a single place, for a branch that
  sits deeper or shallower than its siblings.

Then:

```sh
npm install              # first time only, for the YAML parser
npm run validate:built   # build the JSON from your YAML, then check it
```

`data/regions.yaml` is the only file you need to edit.
[`data/regions.json`](data/regions.json) is built from it — it's what the site
loads and what anything outside this repo consumes — but CI builds it from your
YAML, so a PR that changes only the YAML is complete. Committing a rebuilt JSON
too is welcome and keeps the diff honest; forgetting to is not an error.

`validate` checks code uniqueness, character set, the 160-character serial line
limit on the generated `region def`, MeshCore's 8-level depth cap, and that
coordinates are on the map and not duplicated. It warns when two places are
within 4 km, since location detection can't tell those apart on distance alone —
that's a warning rather than an error because some genuinely are that close, and
the page handles it by offering both and letting the operator pick.

**It also checks your coordinate is inside the county you gave it**, using the
same shapes the map draws, and tells you which one it actually landed in if not.
That catches a transposed digit or a copy-pasted neighbour, which a bounding-box
check cannot. A point within about 800 m of the line is accepted without comment
— the outlines are simplified to roughly that, so nothing sharper is knowable
from them.

## Adding a level

The tree is not fixed at regions > areas > local areas, and it is deliberately
ragged: the North Coast lists its towns straight under the region because there
is nothing in between worth naming, while the Bay Area has North Bay, East Bay,
Peninsula and South Bay in between. A place may have `children`, and those
children may have children, up to MeshCore's eight-level chain limit (the two
root tokens count toward it). If you add a level, add a name for it to the
`levels` list at the top of the file — that's what the interface calls it — and
check that `npm run validate` doesn't warn the tree has outgrown that list.

Depth should follow how big the local mesh community actually is, not a wish to
make every branch look the same. Every level costs each node in that branch
another region-table entry, against the 32 a node holds — so whether a *new*
level is worth it is a question for your local mesh group first.

## Adding a tag

A tag is a region name that is **not** a level — use one for a scope that cuts
across the tree, where making it a parent would be wrong. Declare it once at the
top of `data/regions.yaml`, then opt places into it:

```yaml
tags:
  - code: socal
    name: Southern California
    blurb: One line on what it reaches.

places:
  - code: losangeles
    tags: [socal]
```

Everything beneath an opted-in place carries it, so tag the highest place that
should have it and don't repeat it below — `npm run validate` rejects a tag that
is already inherited, since two copies only invite the two to drift.

A tag costs one region-table entry on every node that carries it, against the 32
a node holds. That is cheaper than a level, which would cost the same entry *and*
lengthen every chain beneath it — but it is not free, and a tag nobody scopes
traffic to is dead weight on real hardware. Ask your mesh group whether they'd
actually use the scope before adding one.

## Renaming a code

Please don't, unless it's genuinely wrong and barely deployed. Once a code is on
real hardware, changing it silently splits the mesh — nodes on the old name stop
matching nodes on the new one until every operator reflashes their config. Adding
a new code is cheap; changing one is not.

That window is open now and will not stay open. Nothing here is on hardware yet,
so getting a name right today costs a pull request; getting it right in a year
costs every operator in that branch a reflash. If you think a code is wrong, say
so while it is still free.

If a rename really is necessary later, say so explicitly in the PR description so
it can be announced to the affected operators.

## Choosing a code

- Unique across the whole file. The validator will catch collisions, but it can't
  tell you which of the two should give way.
- Try not to collide with codes other states' meshes are likely to want. Region
  names are global on any repeater that carries both trees, which rules out bare
  words like `valley` and any two-letter US state abbreviation.
- Prefer something an operator would guess, spelled out: `bakersfield`,
  `truckee`, `palmsprings`. The anchor town makes a good code even when the name
  is the wider area — `palmsprings` is named "Coachella Valley".

## Boundaries and splits

If an area has grown enough that one code no longer describes it, add children
under it rather than redrawing anything above — the hierarchy is there to absorb
that. Open an issue first if you're not sure; someone else may already be running
nodes under the existing name.

## Previewing your change

`npm run serve` is enough for most edits, including the push panel against real
hardware — `http://localhost` counts as a secure context, so Web Serial and Web
Bluetooth both work there. Where it runs out is any other device: open that same
server at your machine's LAN address and the page is no longer in a secure
context, so the push panel goes away. Testing Web Bluetooth from a phone, or
letting someone in your mesh group try the change, needs real HTTPS — which
means GitHub Pages.

This repo publishes a preview for every PR opened from a branch on the repo
itself, and deliberately doesn't for PRs from forks. That isn't an oversight
about permissions: the preview would be served from the maintainer's
`github.io`, the same origin as the live site, and browsers remember Web Serial
grants **per origin, ignoring the path**. Preview code would inherit access to
whatever repeater a reviewer had already approved for the live site, with no
fresh prompt. Nobody should hand that to unreviewed code, including you.

Publishing from your own fork moves the preview to your origin, where the only
grants at stake are ones you made yourself. Both routes below use workflows
already in the repo — there is nothing to write.

### One-time setup on your fork

1. Open the **Actions** tab and accept the "workflows aren't being run on this
   forked repository" banner. Forks ship with Actions off.
2. Run either route below once. It creates the `gh-pages` branch, which doesn't
   exist in a fresh fork.
3. Now go to **Settings → Pages** and set the source to **Deploy from a branch**,
   `gh-pages`, `/ (root)`. This step has to come third — the branch has to exist
   before you can point Pages at it.

Your fork has to be public; Pages on a private repo needs a paid plan.

### Publishing a single branch

**Actions → Deploy to GitHub Pages → Run workflow**, and pick your branch from
the dropdown. It lands at:

```
https://<your-username>.github.io/meshcore-settings/
```

One branch at a time, and re-running replaces it. This is the quicker route when
you just want to check one change against hardware.

### Publishing a preview per PR

Open a pull request **inside your fork** — your branch into your fork's `main` —
alongside the real one upstream. The preview workflow treats that as a
same-repo PR, publishes to a subdirectory, and comments the link on your own PR:

```
https://<your-username>.github.io/meshcore-settings/pr-1/
```

It republishes on every push to the branch and deletes the directory when you
close the PR, so several branches can be up at once without colliding. Worth the
extra bookkeeping if you're iterating, or if you want to link a stable URL from
the upstream PR description.

Both routes build the JSON from `regions.yaml` and validate it before
publishing, so what you preview is the tree your YAML describes.

## Before you open the PR

- [ ] `npm run validate:built` passes
- [ ] `npm test` passes (`npm install` first — it needs Playwright)
- [ ] You've checked the names against your local mesh group, not just a map
- [ ] The alias list covers what people would search for
