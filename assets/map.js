/*
 * The map. Draws California's counties, drops a dot on every local area, and
 * makes both of them selectable.
 *
 * Design notes worth keeping:
 *
 * - Counties are real boundaries (data/counties.js, from Census TIGER). Local
 *   areas are not — they are a community convention with no official shape, so
 *   they are drawn as points, not invented polygons. The map does not imply a
 *   precision the data does not have.
 *
 * - There is no per-region colour scheme. Eight categorical fills on a map this
 *   size fail colour-blind separation, and more to the point they would compete
 *   with the one thing colour should mean here: what you have selected. Region
 *   identity comes from labels and from hovering instead.
 *
 * - This is a shortcut, not the only route. Everything here is also reachable
 *   through the search box and the three dropdowns, which are what keyboard and
 *   screen-reader users get. Nothing is map-only.
 */
(function () {
  "use strict";

  var MAP = window.CA_COUNTY_MAP;
  var DATA = window.CA_REGIONS;
  var host = document.getElementById("map-host");
  if (!MAP || !DATA || !host) { return; }

  var SVG_NS = "http://www.w3.org/2000/svg";

  // Screen pixels, converted to viewBox units whenever the map is resized. Small
  // marks by design: 162 of them, and in the Bay Area they nearly touch.
  var DOT_PX = 2.6;
  var DOT_SELECTED_PX = 5;
  var LABEL_PX = 11;
  // The pointer only has to be closest, not accurate — see the nearest-dot
  // lookup below. This is how far "closest" is still allowed to be.
  var HIT_PX = 22;

  // Region labels are placed automatically, but a few land badly: the Bay Area's
  // areas cluster so tightly that its label needs pushing out over the water, and
  // the coastal regions read better shifted off the dots they sit among. viewBox
  // units, x then y.
  var LABEL_NUDGE = {
    sfb: [-52, 6],
    cc: [-30, 22],
    nor: [-22, 0],
    sv: [16, 0],
    sn: [10, -10],
    sjv: [10, 26],
    soc: [10, 30],
    // The North Coast is a narrow strip, so its own centre is half in the sea.
    nco: [40, -20]
  };

  /* ---------- lookups ---------- */

  var countyByName = {};    // "Kern" -> { county, region }
  var areas = [];           // every area, with its projected position
  var regionOf = {};        // county code -> region code

  DATA.regions.forEach(function (region) {
    region.counties.forEach(function (county) {
      countyByName[county.name.replace(/ County$/, "")] = { county: county, region: region };
      regionOf[county.code] = region.code;
      (county.areas || []).forEach(function (area) {
        areas.push({ area: area, county: county, region: region });
      });
    });
  });

  var p = MAP.projection;
  function project(lat, lon) {
    return { x: (lon - p.lon0) * p.cos0 * p.k, y: (p.lat1 - lat) * p.k };
  }

  areas.forEach(function (a) {
    var xy = project(a.area.lat, a.area.lon);
    a.x = xy.x;
    a.y = xy.y;
  });

  /* ---------- build the svg ---------- */

  var vb = MAP.viewBox;
  var svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", vb.x + " " + vb.y + " " + vb.width + " " + vb.height);
  svg.setAttribute("class", "map-svg");
  // The selects below carry the same information for anyone not using a pointer,
  // so the map describes itself as one image rather than 220 unlabelled shapes.
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label",
    "Map of California's counties with a marker for each local area. " +
    "The dropdowns below make the same choices.");

  var gCounties = document.createElementNS(SVG_NS, "g");
  gCounties.setAttribute("class", "map-counties");
  var gDots = document.createElementNS(SVG_NS, "g");
  gDots.setAttribute("class", "map-dots");
  var gLabels = document.createElementNS(SVG_NS, "g");
  gLabels.setAttribute("class", "map-labels");
  var gMark = document.createElementNS(SVG_NS, "g");
  gMark.setAttribute("class", "map-mark");
  // display, not the hidden attribute: SVG elements ignore hidden in Chromium,
  // which left an unplaced marker drawn at the origin.
  gMark.style.display = "none";

  var countyEls = {};    // county code -> <path>

  MAP.counties.forEach(function (shape) {
    var hit = countyByName[shape.name];
    var path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", shape.d);
    path.setAttribute("class", "map-county");
    if (hit) {
      path.dataset.county = hit.county.code;
      path.dataset.region = hit.region.code;
      countyEls[hit.county.code] = path;
    }
    gCounties.appendChild(path);
  });

  areas.forEach(function (a) {
    var dot = document.createElementNS(SVG_NS, "circle");
    dot.setAttribute("cx", a.x);
    dot.setAttribute("cy", a.y);
    dot.setAttribute("class", "map-dot");
    dot.dataset.area = a.area.code;
    a.el = dot;
    gDots.appendChild(dot);
  });

  // Region labels sit at the centre of the region's own area dots rather than a
  // polygon centroid: it puts the word where the nodes are, which for a region
  // like the Sierra means the populated western slope, not an empty summit.
  DATA.regions.forEach(function (region) {
    var mine = areas.filter(function (a) { return a.region.code === region.code; });
    if (!mine.length) { return; }
    var cx = mine.reduce(function (s, a) { return s + a.x; }, 0) / mine.length;
    var cy = mine.reduce(function (s, a) { return s + a.y; }, 0) / mine.length;
    var nudge = LABEL_NUDGE[region.code] || [0, 0];

    var text = document.createElementNS(SVG_NS, "text");
    text.setAttribute("x", cx + nudge[0]);
    text.setAttribute("y", cy + nudge[1]);
    text.setAttribute("class", "map-label");
    text.dataset.region = region.code;
    text.textContent = region.code.toUpperCase();
    gLabels.appendChild(text);
  });

  var markRing = document.createElementNS(SVG_NS, "circle");
  markRing.setAttribute("class", "map-mark-ring");
  var markDot = document.createElementNS(SVG_NS, "circle");
  markDot.setAttribute("class", "map-mark-dot");
  gMark.appendChild(markRing);
  gMark.appendChild(markDot);

  svg.appendChild(gCounties);
  svg.appendChild(gDots);
  svg.appendChild(gLabels);
  svg.appendChild(gMark);
  host.appendChild(svg);

  var tip = document.createElement("div");
  tip.className = "map-tip";
  tip.hidden = true;
  host.appendChild(tip);

  /* ---------- sizing ----------
   * Marks are specified in screen pixels but drawn in viewBox units, so the
   * conversion has to be redone whenever the map changes size.
   */

  var unitsPerPx = 1;

  function resize() {
    var rendered = svg.getBoundingClientRect().width;
    if (!rendered) { return; }
    unitsPerPx = vb.width / rendered;
    gDots.style.setProperty("--dot-r", (DOT_PX * unitsPerPx).toFixed(2));
    gDots.style.setProperty("--dot-r-on", (DOT_SELECTED_PX * unitsPerPx).toFixed(2));
    gMark.style.setProperty("--dot-r", (DOT_PX * unitsPerPx).toFixed(2));
    svg.style.setProperty("--hair", (unitsPerPx).toFixed(2));
    // Labels too, or they shrink to nothing on a phone.
    gLabels.style.setProperty("--label-size", (LABEL_PX * unitsPerPx).toFixed(2));
  }

  if (window.ResizeObserver) {
    new ResizeObserver(resize).observe(svg);
  } else {
    window.addEventListener("resize", resize);
  }
  resize();

  /* ---------- hover ---------- */

  var hovered = null;   // { kind: "area"|"county", code, label }

  function nearestDot(x, y) {
    var limit = HIT_PX * unitsPerPx;
    var best = null;
    var bestD = limit * limit;
    for (var i = 0; i < areas.length; i++) {
      var dx = areas[i].x - x;
      var dy = areas[i].y - y;
      var d = dx * dx + dy * dy;
      if (d <= bestD) { bestD = d; best = areas[i]; }
    }
    return best;
  }

  function svgPoint(evt) {
    var rect = svg.getBoundingClientRect();
    return {
      x: vb.x + ((evt.clientX - rect.left) / rect.width) * vb.width,
      y: vb.y + ((evt.clientY - rect.top) / rect.height) * vb.height
    };
  }

  svg.addEventListener("pointermove", function (evt) {
    var at = svgPoint(evt);

    // Order matters. A label is only ever hit dead-on, so landing on one is a
    // clear statement of intent and outranks the proximity guess below —
    // otherwise a label sitting among dots (SJV does) could never be reached.
    var label = hitLabel(evt);
    if (label) {
      var region = regionByCode(label.dataset.region);
      setHover({ kind: "region", code: label.dataset.region, el: label,
                 label: region.name, sub: "Click for a region-wide scope" }, evt);
      return;
    }

    // Then a dot, which beats the county under it: the smaller target is the one
    // the pointer was aiming for, and it only has to be the closest.
    var dot = nearestDot(at.x, at.y);
    if (dot) {
      setHover({ kind: "area", code: dot.area.code, el: dot.el,
                 label: dot.area.name, sub: dot.county.name + " · " + dot.region.name }, evt);
      return;
    }

    var path = evt.target.closest ? evt.target.closest(".map-county") : null;
    if (path && path.dataset.county) {
      var entry = byCountyCode(path.dataset.county);
      setHover({ kind: "county", code: path.dataset.county, el: path,
                 label: entry.county.name, sub: entry.region.name + " · click for a county-wide scope" }, evt);
      return;
    }

    clearHover();
  });

  svg.addEventListener("pointerleave", clearHover);

  function regionByCode(code) {
    return DATA.regions.filter(function (r) { return r.code === code; })[0];
  }

  function byCountyCode(code) {
    var found = null;
    DATA.regions.forEach(function (region) {
      region.counties.forEach(function (county) {
        if (county.code === code) { found = { county: county, region: region }; }
      });
    });
    return found;
  }

  function setHover(next, evt) {
    if (!hovered || hovered.code !== next.code) {
      clearMarks("is-hover");
      if (next.el) { next.el.classList.add("is-hover"); }
      hovered = next;
    }
    // textContent, not innerHTML: these names come from a data file that
    // contributors edit.
    tip.textContent = "";
    var strong = document.createElement("strong");
    strong.textContent = next.label;
    var small = document.createElement("span");
    small.textContent = next.sub;
    tip.appendChild(strong);
    tip.appendChild(small);
    tip.hidden = false;
    placeTip(evt);
    svg.classList.add("is-pointing");
  }

  function placeTip(evt) {
    var rect = host.getBoundingClientRect();
    var x = evt.clientX - rect.left;
    var y = evt.clientY - rect.top;
    var w = tip.offsetWidth;
    // Flip before the tooltip runs off the panel rather than after.
    tip.style.left = Math.max(0, Math.min(x + 14, rect.width - w - 2)) + "px";
    tip.style.top = Math.max(0, y - tip.offsetHeight - 12) + "px";
  }

  function clearHover() {
    clearMarks("is-hover");
    hovered = null;
    tip.hidden = true;
    svg.classList.remove("is-pointing");
  }

  function clearMarks(cls) {
    var marked = svg.querySelectorAll("." + cls);
    for (var i = 0; i < marked.length; i++) { marked[i].classList.remove(cls); }
  }

  function dotEl(code) {
    for (var i = 0; i < areas.length; i++) {
      if (areas[i].area.code === code) { return areas[i].el; }
    }
    return null;
  }

  /* ---------- clicking ---------- */

  // Same precedence as hovering, so what you click is what the tooltip promised.
  svg.addEventListener("click", function (evt) {
    var label = hitLabel(evt);
    if (label) { window.SettingsState.select(label.dataset.region); return; }

    var at = svgPoint(evt);
    var dot = nearestDot(at.x, at.y);
    if (dot) { window.SettingsState.select(dot.area.code); return; }

    var path = evt.target.closest ? evt.target.closest(".map-county") : null;
    if (path && path.dataset.county) { window.SettingsState.select(path.dataset.county); }
  });

  function hitLabel(evt) {
    return evt.target.closest ? evt.target.closest(".map-label") : null;
  }

  /* ---------- reflecting the current selection ----------
   * Read straight off the dropdowns app.js already keeps in sync, so the map
   * follows a selection made by search, by dropdown, or by a connected repeater
   * without app.js needing to know the map exists.
   */

  var selRegion = document.getElementById("sel-region");
  var selCounty = document.getElementById("sel-county");
  var selArea = document.getElementById("sel-area");

  function refresh() {
    clearMarks("is-on");
    clearMarks("is-in-region");

    var region = selRegion.value;
    var county = selCounty.value;
    var area = selArea.value;

    if (region) {
      var inRegion = gCounties.querySelectorAll('[data-region="' + region + '"]');
      for (var i = 0; i < inRegion.length; i++) { inRegion[i].classList.add("is-in-region"); }
      var label = gLabels.querySelector('[data-region="' + region + '"]');
      if (label) { label.classList.add("is-on"); }
    }
    if (county && countyEls[county]) { countyEls[county].classList.add("is-on"); }
    if (area) {
      var el = dotEl(area);
      if (el) { el.classList.add("is-on"); }
    }
  }

  [selRegion, selCounty, selArea].forEach(function (sel) {
    sel.addEventListener("change", refresh);
  });
  window.SettingsState.onChange(refresh);
  refresh();

  /* ---------- public bits ---------- */

  window.RegionMap = {
    // Drop a marker at a real position — for showing where a connected repeater
    // says it is. Call with no arguments to clear it.
    showPosition: function (lat, lon) {
      if (typeof lat !== "number" || typeof lon !== "number") {
        gMark.style.display = "none";
        return false;
      }
      var xy = project(lat, lon);
      // Off the map entirely — a node in Nevada, or one advertising 0,0.
      if (xy.x < vb.x || xy.x > vb.x + vb.width || xy.y < vb.y || xy.y > vb.y + vb.height) {
        gMark.style.display = "none";
        return false;
      }
      markRing.setAttribute("cx", xy.x);
      markRing.setAttribute("cy", xy.y);
      markDot.setAttribute("cx", xy.x);
      markDot.setAttribute("cy", xy.y);
      gMark.style.display = "";
      return true;
    }
  };
})();
