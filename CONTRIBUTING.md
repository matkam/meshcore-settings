# Contributing

The useful contribution here is local knowledge: which areas actually have
repeaters, what the operators around you already call them, and where the
boundaries really fall.

## Adding a local area

Everything lives in [`data/regions.js`](data/regions.js). Find your county and add
an entry to its `areas` list:

```js
{
  code: "prb",
  name: "North County",
  cities: ["Paso Robles", "Atascadero", "Templeton", "San Miguel", "Shandon"],
  lat: 35.627, lon: -120.691
},
```

- **`code`** — the region name that goes on the air. Lowercase `a-z0-9`, 1–8
  characters, short as you can make it while staying readable. Must be unique
  across the whole file.
- **`name`** — what a human picks from the dropdown.
- **`cities`** — search aliases only. These never appear in the generated
  commands; they exist so someone can type "Paso Robles" and land on `prb`. List
  the towns people would actually type, including unincorporated ones.
- **`lat` / `lon`** — a representative point for the area, three decimal places.
  A connected repeater's advertised position is matched against these and the
  nearest few offered as a choice, and it's where the map puts your area's dot.
  So put it where the nodes actually are (the main town) rather than at the
  geometric centre of an empty valley.

Then:

```sh
npm run validate
```

It checks code uniqueness, character set, the 160-character serial line limit on
the generated `region def`, MeshCore's 8-level depth cap, and that coordinates are
inside California and not duplicated. It warns when two areas are within 4 km,
since location detection can't tell those apart on distance alone — that's a
warning rather than an error because some genuinely are that close, and the page
handles it by offering both and letting the operator pick.

**It also checks your coordinate is inside the county you filed it under**, using
the same county outlines the map draws, and tells you which county it actually
landed in if not. That catches a transposed digit or a copy-pasted neighbour,
which the "is it in California?" check cannot. A point within about 800 m of the
county line is accepted without comment — the outlines are simplified to roughly
that, so nothing sharper is knowable from them.

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

If an area has grown enough that one code no longer describes it, add child areas
rather than redrawing the county — the hierarchy is there to absorb that. Open an
issue first if you're not sure; someone else may already be running nodes under
the existing name.

## Before you open the PR

- [ ] `npm run validate` passes
- [ ] `npm test` passes (`npm install` first — it needs Playwright)
- [ ] You've checked the names against your local mesh group, not just a map
- [ ] Cities list covers what people would search for
