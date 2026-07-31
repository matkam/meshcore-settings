# Contributing

The useful contribution here is local knowledge: which areas actually have
repeaters, what the operators around you already call them, and where the
boundaries really fall.

## Adding a local area

Everything lives in [`data/regions.yaml`](data/regions.yaml). Find your county
and add an entry to its `children` list:

```yaml
      - code: prb
        name: North County
        lat: 35.627
        lon: -120.691
        aliases: ["Paso Robles", "Atascadero", "Templeton", "San Miguel", "Shandon"]
```

- **`code`** — the region name. Lowercase `a-z0-9`, 1–8 characters, short as you
  can make it while staying readable, and unique across the whole file. Short is
  for legibility at the console, **not** for airtime: a scoped packet carries a
  16-bit transport code derived from the name, never the name itself, so code
  length has no effect on the air.
- **`name`** — what a human picks from the list.
- **`aliases`** — search terms only. These never appear in the generated
  commands; they exist so someone can type "Paso Robles" and land on `prb`. List
  the towns people would actually type, including unincorporated ones.
- **`lat` / `lon`** — a representative point, three decimal places. A connected
  repeater's advertised position is matched against these and the nearest few
  offered as a choice, and it's where the map puts your dot. So put it where the
  nodes actually are (the main town) rather than at the geometric centre of an
  empty valley.

Two more fields exist and are rarely needed:

- **`outline`** — the name of a shape in `data/outlines.json`, which makes the
  map draw this place as a boundary instead of a dot. The counties use it.
- **`kind`** — overrides the level name for a single place, for a branch that
  sits deeper or shallower than its siblings.

Then:

```sh
npm install              # first time only, for the YAML parser
npm run build:regions
npm run validate
```

`build:regions` regenerates [`data/regions.json`](data/regions.json), which is
what the site actually loads and what anything outside this repo consumes.
**Commit both files** — `npm run validate` fails if they disagree, and so does CI.

`validate` checks code uniqueness, character set, the 160-character serial line
limit on the generated `region def`, MeshCore's 8-level depth cap, and that
coordinates are on the map and not duplicated. It warns when two places are
within 4 km, since location detection can't tell those apart on distance alone —
that's a warning rather than an error because some genuinely are that close, and
the page handles it by offering both and letting the operator pick.

**It also checks your coordinate is inside the outline it sits under**, using the
same shapes the map draws, and tells you which one it actually landed in if not.
That catches a transposed digit or a copy-pasted neighbour, which a bounding-box
check cannot. A point within about 800 m of the line is accepted without comment
— the outlines are simplified to roughly that, so nothing sharper is knowable
from them.

## Adding a level

The tree is not fixed at regions > counties > local areas. A place may have
`children`, and those children may have children, up to MeshCore's eight-level
chain limit (the two root tokens count toward it). If you add a level, add a name
for it to the `levels` list at the top of the file — that's what the interface
calls it — and check that `npm run validate` doesn't warn the tree has outgrown
that list.

Whether a *new* level is a good idea is a question for your local mesh group
first. It costs every repeater in that branch another region-table entry, and a
node holds 32.

## Renaming a code

Please don't, unless it's genuinely wrong and barely deployed. Once a code is on
real hardware, changing it silently splits the mesh — nodes on the old name stop
matching nodes on the new one until every operator reflashes their config. Adding
a new code is cheap; changing one is not.

If a rename really is necessary, say so explicitly in the PR description so it
can be announced to the affected operators.

## Choosing a code

- Unique across the whole file. The validator will catch collisions, but it can't
  tell you which of the two should give way.
- Try not to collide with codes other states' meshes are likely to want. Region
  names are global on any repeater that carries both trees.
- Prefer something an operator would guess: `bak` for Bakersfield, `trk` for
  Truckee, `cch` for the Coachella Valley.

## Boundaries and splits

If an area has grown enough that one code no longer describes it, add children
under it rather than redrawing the county — the hierarchy is there to absorb
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

Both routes run `npm run validate` before publishing, so a `regions.yaml` that
disagrees with `regions.json` fails the publish rather than shipping a broken
preview.

## Before you open the PR

- [ ] `data/regions.json` is rebuilt and committed alongside the YAML
- [ ] `npm run validate` passes
- [ ] `npm test` passes (`npm install` first — it needs Playwright)
- [ ] You've checked the names against your local mesh group, not just a map
- [ ] The alias list covers what people would search for
