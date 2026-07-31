import { chromium } from "playwright";
import { launchOptions, shot, tick, clearPicks, isTicked } from "./harness.mjs";

const SITE = process.env.SITE || "http://127.0.0.1:8765/";
const browser = await chromium.launch(launchOptions);

let pass = true;
function check(name, ok, detail) {
  pass &&= !!ok;
  console.log((ok ? "PASS " : "FAIL ") + name + (!ok && detail !== undefined ? "  -> " + detail : ""));
}

const page = await browser.newPage({ viewport: { width: 1000, height: 1000 } });
const errs = [];
page.on("pageerror", (e) => errs.push(e.message));
await page.goto(SITE, { waitUntil: "networkidle" });

// --- it drew
check("map rendered", await page.isVisible("#map-host .map-svg"));
check("58 county paths", (await page.$$eval(".map-county", (e) => e.length)) === 58,
  await page.$$eval(".map-county", (e) => e.length));
check("161 area dots", (await page.$$eval(".map-dot", (e) => e.length)) === 161,
  await page.$$eval(".map-dot", (e) => e.length));
check("13 region labels", (await page.$$eval(".map-label", (e) => e.length)) === 13,
  await page.$$eval(".map-label", (e) => e.length));

// A shape goes to the deepest place that wholly contains it: a cluster where one
// does, the region where two of its clusters split it — Placer is Gold Country
// and Tahoe, but it is all Sierra Nevada. Six counties are split across two
// regions (the Mojave takes part of Kern, LA and San Bernardino; the low desert
// part of Riverside; Ventura splits at the Conejo grade), so nobody claims those
// and they draw as background with the dots inside carrying the meaning.
check("52 county paths are wired to a place",
  (await page.$$eval(".map-county", (e) => e.filter((p) => p.dataset.place).length)) === 52,
  await page.$$eval(".map-county", (e) => e.filter((p) => p.dataset.place).length));
check("and the 6 split across two regions are left as background",
  (await page.$$eval(".map-county", (e) => e.filter((p) => !p.dataset.place).length)) === 6);

// --- the position marker is not drawn until asked for
check("position marker hidden at rest",
  await page.$eval(".map-mark", (g) => getComputedStyle(g).display === "none"));

// The map sits below the fold on a 1000px viewport, and the mouse cannot reach
// what is not on screen. Panels opening above it move it, so re-scroll before
// every pointer interaction rather than once.
async function mapInView() {
  await page.locator("#map-host").scrollIntoViewIfNeeded();
  await page.waitForTimeout(150);
}
// Clicks a point returned by fn, having first made sure it is actually on screen.
async function clickPoint(fn, label) {
  await mapInView();
  const pt = await page.evaluate(fn);
  const ok = await page.evaluate(
    (p) => p.x > 0 && p.y > 0 && p.x < window.innerWidth && p.y < window.innerHeight, pt);
  check(`${label}: target is on screen`, ok, JSON.stringify(pt));
  await page.mouse.click(pt.x, pt.y);
  await page.waitForTimeout(150);
}
await mapInView();

// --- helper: screen point for an area code
async function pointFor(code) {
  return await page.evaluate((code) => {
    const dot = document.querySelector(`.map-dot[data-place="${code}"]`);
    const r = dot.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, code);
}

// --- hovering a dot
{
  await mapInView();
  const p = await pointFor("slonorth");
  await page.mouse.move(p.x, p.y);
  await page.waitForSelector(".map-tip:not([hidden])", { timeout: 3000 });
  const tip = await page.textContent(".map-tip");
  check("hovering a dot names the area", /North County/.test(tip), tip);
  check("hover tooltip names the area and region",
    /SLO County/.test(tip) && /Central Coast/.test(tip), tip);
  check("hovered dot is marked",
    await page.$eval('.map-dot[data-place="slonorth"]', (d) => d.classList.contains("is-hover")));
  check("cursor becomes a pointer over a target",
    await page.$eval(".map-svg", (s) => s.classList.contains("is-pointing")));
}

// --- clicking a dot selects that area
{
  await mapInView();
  const p = await pointFor("slonorth");
  await page.mouse.click(p.x, p.y);
  await page.waitForSelector("#output-panel:not([hidden])", { timeout: 3000 });
  check("clicking a dot selects the area", await isTicked(page, "slonorth"),
    JSON.stringify(await page.$$eval(".picker input:checked", (n) => n.map((x) => x.dataset.code))));
  check("clicking a dot generates the commands",
    /region def west ca centralcoast slo slonorth/.test(await page.textContent("#commands")));
  check("selected dot is marked on",
    await page.$eval('.map-dot[data-place="slonorth"]', (d) => d.classList.contains("is-on")));
  check("selected area's own outline is marked on",
    await page.$eval('.map-county[data-place="slo"]', (c) => c.classList.contains("is-on")));
  check("selected area's region is washed in",
    await page.$eval('.map-county[data-place="santabarbara"]', (c) => c.classList.contains("is-in-region")));
  check("a shape outside the region is not washed in",
    await page.$eval('.map-county[data-place="eastbay"]', (c) => !c.classList.contains("is-in-region")));
}

// --- a selection made elsewhere is reflected on the map
{
  await clearPicks(page);
  await tick(page, "bayarea");
  check("selecting a region elsewhere washes it in on the map",
    await page.$eval('.map-county[data-place="eastbay"]', (c) => c.classList.contains("is-in-region")));
  check("the old selection is cleared",
    await page.$eval('.map-dot[data-place="slonorth"]', (d) => !d.classList.contains("is-on")));
  check("that region's label lights up",
    await page.$eval('.map-label[data-place="bayarea"]', (t) => t.classList.contains("is-on")));
}

// --- searching also drives the map
{
  await clearPicks(page);
  await page.fill("#search", "Paso Robles");
  await page.waitForSelector("#results li", { timeout: 3000 });
  await page.click("#results li");
  await page.waitForTimeout(120);
  check("search selection is reflected on the map",
    await page.$eval('.map-dot[data-place="slonorth"]', (d) => d.classList.contains("is-on")));
}

// --- clicking a region label
{
  await clickPoint(() => {
    const r = document.querySelector('.map-label[data-place="sanjoaquinvalley"]').getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, "region label");
  const afterLabel = await page.$$eval(".picker input:checked", (n) => n.map((x) => x.dataset.code));
  check("clicking a region label selects just that region",
    JSON.stringify(afterLabel) === JSON.stringify(["sanjoaquinvalley"]), JSON.stringify(afterLabel));
}

// --- clicking a county away from any dot
{
  // Find ground that is inside some county but well clear of every dot — the
  // nearest-dot rule owns anything close to one, by design. Which county it
  // lands in is whatever has room; the point is that open ground selects it.
  await mapInView();
  const spot = await page.evaluate(() => {
    const dots = [...document.querySelectorAll(".map-dot")].map((d) => {
      const b = d.getBoundingClientRect();
      return [b.x + b.width / 2, b.y + b.height / 2];
    });
    for (const path of document.querySelectorAll(".map-county")) {
      const r = path.getBoundingClientRect();
      if (r.width < 20 || r.height < 20) { continue; }
      for (let fy = 0.15; fy <= 0.85; fy += 0.05) {
        for (let fx = 0.15; fx <= 0.85; fx += 0.05) {
          const x = r.x + r.width * fx;
          const y = r.y + r.height * fy;
          if (y < 0 || y > window.innerHeight) { continue; }
          if (document.elementFromPoint(x, y) !== path) { continue; }
          const nearest = Math.min(...dots.map(([dx, dy]) => Math.hypot(dx - x, dy - y)));
          if (nearest > 30) { return { x, y, county: path.dataset.place }; }
        }
      }
    }
    return null;
  });
  check("found open county ground to click", !!spot, JSON.stringify(spot));
  await page.mouse.click(spot.x, spot.y);
  await page.waitForTimeout(150);
  const county = await isTicked(page, spot.county);
  check("clicking open ground selects the place that claims it", county,
    JSON.stringify(await page.$$eval(".picker input:checked", (n) => n.map((x) => x.dataset.code))));
  check("that click leaves no local area ticked",
    (await page.$$eval(".pick-row.lvl-2 input:checked", (n) => n.length)) === 0);
}

// --- the position marker
{
  const shown = await page.evaluate(() => window.RegionMap.showPosition(35.627, -120.691));
  check("showPosition places a marker", shown === true);
  check("marker becomes visible",
    await page.$eval(".map-mark", (g) => getComputedStyle(g).display !== "none"));
  const near = await page.evaluate(() => {
    const m = document.querySelector(".map-mark-dot").getBoundingClientRect();
    const d = document.querySelector('.map-dot[data-place="slonorth"]').getBoundingClientRect();
    return Math.hypot(m.x - d.x, m.y - d.y);
  });
  check("marker lands on the matching area's dot", near < 6, near.toFixed(1) + " px away");

  check("an out-of-state position is refused",
    (await page.evaluate(() => window.RegionMap.showPosition(40.7128, -74.006))) === false);
  check("0,0 is refused",
    (await page.evaluate(() => window.RegionMap.showPosition(0, 0))) === false);
  check("marker hidden again after a refusal",
    await page.$eval(".map-mark", (g) => getComputedStyle(g).display === "none"));
  check("no arguments clears it",
    (await page.evaluate(() => window.RegionMap.showPosition())) === false);
}

// --- pointer leaving
{
  await mapInView();
  await page.mouse.move(5, 5);
  await page.waitForTimeout(120);
  check("tooltip hides when the pointer leaves", await page.isHidden(".map-tip"));
}

/* ---------- hover coverage ----------
 * A dot owns a disc around itself, and for a while that disc was wide enough
 * that four fifths of the state could not hover or click the county it was
 * over — the map felt like it only sometimes responded. These three checks
 * pin down the fix.
 */
{
  await mapInView();
  const box = await page.evaluate(() => {
    const b = document.querySelector(".map-svg").getBoundingClientRect();
    return { x: b.x, y: b.y, w: b.width, h: b.height };
  });

  let land = 0, lit = 0, countyOnly = 0;
  for (let i = 0; i < 22; i++) {
    for (let j = 0; j < 22; j++) {
      const x = box.x + box.w * (i + 0.5) / 22;
      const y = box.y + box.h * (j + 0.5) / 22;
      if (y < 0 || y > 1000) { continue; }
      const onLand = await page.evaluate(([x, y]) => {
        const e = document.elementFromPoint(x, y);
        return !!(e && e.classList && e.classList.contains("map-county"));
      }, [x, y]);
      if (!onLand) { continue; }
      // Six counties are split across two regions, so no place wholly contains
      // them and none claims their shape. They draw as background and stay
      // inert on purpose — the dots inside them carry the meaning. Only claimed
      // ground is required to respond.
      const claimed = await page.evaluate(([x, y]) => {
        const e = document.elementFromPoint(x, y);
        return !!(e && e.dataset && e.dataset.place);
      }, [x, y]);
      if (!claimed) { continue; }
      land++;
      await page.mouse.move(x, y);
      const st = await page.evaluate(() => ({
        c: !!document.querySelector(".map-county.is-hover"),
        d: !!document.querySelector(".map-dot.is-hover")
      }));
      if (st.c) { lit++; }
      if (st.c && !st.d) { countyOnly++; }
    }
  }
  check("every point over claimed land highlights its place", lit === land, `${lit}/${land}`);
  check("a good share of land still selects the place rather than a dot",
    countyOnly / land > 0.35, `${Math.round((countyOnly / land) * 100)}%`);
}

// A label sitting on top of a dot makes that area unreachable, because labels
// are hit first on purpose. Placement is automatic, so this guards the whole
// data file rather than the three that were broken.
{
  const covered = await page.evaluate(() => {
    const dots = [...document.querySelectorAll(".map-dot")].map((d) => {
      const b = d.getBoundingClientRect();
      return { c: d.dataset.place, x: b.x + b.width / 2, y: b.y + b.height / 2 };
    });
    const bad = [];
    for (const t of document.querySelectorAll(".map-label")) {
      const b = t.getBoundingClientRect();
      for (const d of dots) {
        if (d.x >= b.x && d.x <= b.right && d.y >= b.y && d.y <= b.bottom) {
          bad.push(t.dataset.place + "/" + d.c);
        }
      }
    }
    return bad;
  });
  check("no region label covers an area dot", covered.length === 0, covered.join(", "));
}

// Every dot answers when aimed at squarely.
{
  await mapInView();
  const codes = await page.$$eval(".map-dot", (ds) => ds.map((d) => d.dataset.place));
  const missed = [];
  for (const code of codes) {
    const pt = await page.evaluate((c) => {
      const b = document.querySelector(`.map-dot[data-place="${c}"]`).getBoundingClientRect();
      return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    }, code);
    if (pt.y < 0 || pt.y > 1000) { continue; }
    await page.mouse.move(pt.x, pt.y);
    const hit = await page.evaluate(() => {
      const d = document.querySelector(".map-dot.is-hover");
      return d ? d.dataset.place : null;
    });
    if (hit !== code) { missed.push(`${code}->${hit}`); }
  }
  check("every dot is reachable at its own centre", missed.length === 0,
    missed.slice(0, 6).join(", "));
}

/* ---------- zoom and pan ---------- */
{
  const vbOf = () => page.getAttribute(".map-svg", "viewBox");
  const widthOf = async () => parseFloat((await vbOf()).split(" ")[2]);
  const zoomIn = '.map-zoom button[aria-label="Zoom in"]';
  const zoomOut = '.map-zoom button[aria-label="Zoom out"]';
  const reset = '.map-zoom button[aria-label="Show the whole state"]';

  await mapInView();
  const base = await vbOf();
  check("zoom controls are real buttons", (await page.$$(".map-zoom button")).length === 3);
  check("reset is disabled at full extent", await page.isDisabled(reset));

  // Zooming out from the whole state would just add empty space.
  await page.click(zoomOut);
  await page.waitForTimeout(150);
  check("cannot zoom out past the whole state", (await vbOf()) === base, await vbOf());

  await page.click(zoomIn);
  await page.waitForTimeout(200);
  check("zooming in narrows the view", (await widthOf()) < parseFloat(base.split(" ")[2]));
  check("reset becomes available once zoomed", !(await page.isDisabled(reset)));

  // Marks are sized in screen pixels, so the map grows but they don't.
  const dotAt = async () => parseFloat(await page.$eval(".map-dot", (d) => d.getBoundingClientRect().width));
  const dotBefore = await dotAt();
  await page.click(zoomIn);
  await page.waitForTimeout(250);
  check("dots keep their size on screen as the map grows",
    Math.abs((await dotAt()) - dotBefore) < 0.5, `${dotBefore} -> ${await dotAt()}`);

  // Panning.
  await mapInView();
  const beforePan = await vbOf();
  const mid = await page.evaluate(() => {
    const b = document.querySelector(".map-svg").getBoundingClientRect();
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  });
  await page.mouse.move(mid.x, mid.y);
  await page.mouse.down();
  await page.mouse.move(mid.x - 55, mid.y - 35, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(200);
  check("dragging pans the map", (await vbOf()) !== beforePan);
  check("a drag does not change the selection",
    (await page.$$eval(".pick-row.lvl-2 input:checked", (n) => n.length)) === 0,
    JSON.stringify(await page.$$eval(".picker input:checked", (n) => n.map((x) => x.dataset.code))));

  // Clicking still works while zoomed, and lands on the right thing.
  await mapInView();
  const target = await page.evaluate(() => {
    const s = document.querySelector(".map-svg").getBoundingClientRect();
    const inside = [...document.querySelectorAll(".map-dot")]
      .map((d) => ({ c: d.dataset.place, r: d.getBoundingClientRect() }))
      .filter((o) => o.r.x > s.x + 10 && o.r.right < s.right - 10 &&
                     o.r.y > Math.max(s.y, 0) + 10 && o.r.bottom < Math.min(s.bottom, 990) - 10);
    if (!inside.length) { return null; }
    const o = inside[0];
    return { c: o.c, x: o.r.x + o.r.width / 2, y: o.r.y + o.r.height / 2 };
  });
  check("dots are still in view when zoomed", !!target);
  await page.mouse.click(target.x, target.y);
  await page.waitForTimeout(200);
  check("clicking a dot still selects it while zoomed",
    await isTicked(page, target.c),
    JSON.stringify(await page.$$eval(".picker input:checked", (n) => n.map((x) => x.dataset.code))));

  // Label placement is redone on zoom, so it has to hold there too.
  const coveredZoomed = await page.evaluate(() => {
    const dots = [...document.querySelectorAll(".map-dot")].map((d) => {
      const b = d.getBoundingClientRect();
      return { c: d.dataset.place, x: b.x + b.width / 2, y: b.y + b.height / 2 };
    });
    const bad = [];
    for (const t of document.querySelectorAll(".map-label")) {
      const b = t.getBoundingClientRect();
      for (const d of dots) {
        if (d.x >= b.x && d.x <= b.right && d.y >= b.y && d.y <= b.bottom) { bad.push(t.dataset.place + "/" + d.c); }
      }
    }
    return bad;
  });
  check("no label covers a dot when zoomed in", coveredZoomed.length === 0, coveredZoomed.join(", "));

  // A plain wheel belongs to the page; the map only takes it with a modifier.
  // Recompute the centre: selecting an area opened a panel and moved the map,
  // and a wheel aimed at stale coordinates would "pass" by doing nothing.
  await mapInView();
  const mid2 = await page.evaluate(() => {
    const b = document.querySelector(".map-svg").getBoundingClientRect();
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  });
  check("map centre is on screen for the wheel checks",
    mid2.y > 0 && mid2.y < 1000, JSON.stringify(mid2));
  const beforeWheel = await vbOf();
  const scrollBefore = await page.evaluate(() => window.scrollY);
  await page.mouse.move(mid2.x, mid2.y);
  await page.mouse.wheel(0, -300);
  await page.waitForTimeout(200);
  check("a plain wheel does not zoom the map", (await vbOf()) === beforeWheel);
  check("a plain wheel scrolls the page instead",
    (await page.evaluate(() => window.scrollY)) !== scrollBefore);

  // That scroll moved the map, so aim again before the modified wheel.
  await mapInView();
  const mid3 = await page.evaluate(() => {
    const b = document.querySelector(".map-svg").getBoundingClientRect();
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  });
  await page.mouse.move(mid3.x, mid3.y);
  await page.keyboard.down("Control");
  await page.mouse.wheel(0, -400);
  await page.keyboard.up("Control");
  await page.waitForTimeout(250);
  check("ctrl + wheel does zoom the map", (await vbOf()) !== beforeWheel);

  await page.click(reset);
  await page.waitForTimeout(200);
  check("reset returns to the whole state", (await vbOf()) === base, await vbOf());
  check("reset disables itself again", await page.isDisabled(reset));

  // Panning is clamped, so it can never wander off the state.
  await page.click(zoomIn);
  await page.waitForTimeout(200);
  await mapInView();
  for (let i = 0; i < 3; i++) {
    await page.mouse.move(mid.x, mid.y);
    await page.mouse.down();
    await page.mouse.move(mid.x + 400, mid.y + 400, { steps: 6 });
    await page.mouse.up();
  }
  await page.waitForTimeout(200);
  const [vx, vy, vw, vh] = (await vbOf()).split(" ").map(Number);
  const [bx, by, bw, bh] = base.split(" ").map(Number);
  check("panning stays inside the state",
    vx >= bx - 0.5 && vy >= by - 0.5 && vx + vw <= bx + bw + 0.5 && vy + vh <= by + bh + 0.5,
    await vbOf());
  await page.click(reset);
  await page.waitForTimeout(150);
}

check("no JS errors", errs.length === 0, errs.join("; "));

// --- responsive: no horizontal overflow, map still square-ish
for (const w of [390, 768, 1200]) {
  await page.setViewportSize({ width: w, height: 900 });
  await page.waitForTimeout(200);
  const over = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  check(`no horizontal overflow at ${w}px`, !over);
  const fits = await page.evaluate(() => {
    const r = document.querySelector(".map-svg").getBoundingClientRect();
    return r.width > 100 && r.height > 100 && r.width <= window.innerWidth;
  });
  check(`map is drawn at a usable size at ${w}px`, fits);
}

await page.close();
await browser.close();
process.exit(pass ? 0 : 1);
