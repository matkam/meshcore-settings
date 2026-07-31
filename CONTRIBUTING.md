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

## Before you open the PR

- [ ] `data/regions.json` is rebuilt and committed alongside the YAML
- [ ] `npm run validate` passes
- [ ] `npm test` passes (`npm install` first — it needs Playwright)
- [ ] You've checked the names against your local mesh group, not just a map
- [ ] The alias list covers what people would search for
