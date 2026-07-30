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
  // lookup below. This is how far "closest" is still allowed to be, so a dot
  // owns a disc twice this wide.
  //
  // It has to stay modest. There are 162 dots: at 22 the discs covered four
  // fifths of the state's land area, which left most of the map unable to hover
  // or click the county it was over.
  var HIT_PX = 12;

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
    text.dataset.baseX = cx + nudge[0];
    text.dataset.baseY = cy + nudge[1];
    text.setAttribute("x", text.dataset.baseX);
    text.setAttribute("y", text.dataset.baseY);
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

  /* ---------- view, zoom and pan ----------
   * Zooming an SVG is just a narrower viewBox, so there is no re-rendering and
   * nothing to redraw — the geometry above is untouched. `view` is the window
   * onto it, always inside the full extent.
   */

  var view = { x: vb.x, y: vb.y, width: vb.width, height: vb.height };
  var MAX_ZOOM = 12;   // enough to pull the Bay Area cluster apart

  function zoom() { return vb.width / view.width; }

  function clampView() {
    // Never wider than the whole state, and never past its edges: panning into
    // blank space is disorienting and there is nothing out there.
    var scale = Math.min(Math.max(zoom(), 1), MAX_ZOOM);
    view.width = vb.width / scale;
    view.height = vb.height / scale;
    view.x = Math.min(Math.max(view.x, vb.x), vb.x + vb.width - view.width);
    view.y = Math.min(Math.max(view.y, vb.y), vb.y + vb.height - view.height);
  }

  function applyView() {
    clampView();
    svg.setAttribute("viewBox", view.x + " " + view.y + " " + view.width + " " + view.height);
    // Marks are sized in screen pixels, so their size in map units changes with
    // the zoom — they stay the same size on screen while the map grows.
    resize();
    scheduleLabels();
    svg.classList.toggle("is-zoomed", zoom() > 1.001);
    if (btnReset) { btnReset.disabled = zoom() <= 1.001; }
  }

  // Zoom about a fixed point, so whatever is under the pointer stays there.
  function zoomAt(factor, mapX, mapY) {
    var before = zoom();
    var after = Math.min(Math.max(before * factor, 1), MAX_ZOOM);
    if (after === before) { return; }
    var w = vb.width / after;
    var h = vb.height / after;
    view.x = mapX - ((mapX - view.x) * w) / view.width;
    view.y = mapY - ((mapY - view.y) * h) / view.height;
    view.width = w;
    view.height = h;
    applyView();
  }

  function zoomCentre(factor) {
    zoomAt(factor, view.x + view.width / 2, view.y + view.height / 2);
  }

  function resetView() {
    view = { x: vb.x, y: vb.y, width: vb.width, height: vb.height };
    applyView();
  }

  /* ---------- sizing ----------
   * Marks are specified in screen pixels but drawn in viewBox units, so the
   * conversion has to be redone whenever the map changes size or zoom.
   */

  var unitsPerPx = 1;

  function resize() {
    var rendered = svg.getBoundingClientRect().width;
    if (!rendered) { return; }
    unitsPerPx = view.width / rendered;
    gDots.style.setProperty("--dot-r", (DOT_PX * unitsPerPx).toFixed(2));
    gDots.style.setProperty("--dot-r-on", (DOT_SELECTED_PX * unitsPerPx).toFixed(2));
    gMark.style.setProperty("--dot-r", (DOT_PX * unitsPerPx).toFixed(2));
    svg.style.setProperty("--hair", (unitsPerPx).toFixed(2));
    // Labels too, or they shrink to nothing on a phone.
    gLabels.style.setProperty("--label-size", (LABEL_PX * unitsPerPx).toFixed(2));
  }

  /* ---------- keeping labels off the dots ----------
   * A label that covers a dot makes that area unreachable: the label is hit
   * first, by design, so that a label among dots stays clickable. Yuba City and
   * Marysville sat under SV, and Temecula under SOC.
   *
   * Nudging those by hand would fix today and break the next time somebody adds
   * an area near a label, so the label looks for its own clear spot instead —
   * starting from where it wants to be and spiralling out until nothing is
   * underneath. Re-run on resize, since the label's size in map units changes.
   */

  // Screen pixels, like everything else here, so the search behaves the same at
  // every zoom level rather than flinging labels across a magnified map.
  var LABEL_PAD_PX = 1.5;
  var LABEL_STEP_PX = [0, 8, 16, 25, 35];
  var LABEL_DIRS = [
    [0, -1], [0, 1], [-1, 0], [1, 0],
    [-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]
  ];

  function boxIsClear(box, ignoreLabel) {
    // Bounds are the whole state, not the current view: a label belongs to the
    // map, so zooming must not shuffle it to a different place.
    if (box.x < vb.x || box.x + box.width > vb.x + vb.width ||
        box.y < vb.y || box.y + box.height > vb.y + vb.height) {
      return false;
    }
    var pad = LABEL_PAD_PX * unitsPerPx;
    for (var i = 0; i < areas.length; i++) {
      if (areas[i].x >= box.x - pad && areas[i].x <= box.x + box.width + pad &&
          areas[i].y >= box.y - pad && areas[i].y <= box.y + box.height + pad) {
        return false;
      }
    }
    // Labels must not stack on each other either.
    var others = gLabels.querySelectorAll(".map-label");
    for (var j = 0; j < others.length; j++) {
      if (others[j] === ignoreLabel || !others[j].dataset.placed) { continue; }
      var b = others[j].getBBox();
      if (box.x < b.x + b.width && box.x + box.width > b.x &&
          box.y < b.y + b.height && box.y + box.height > b.y) {
        return false;
      }
    }
    return true;
  }

  function placeLabels() {
    var labels = gLabels.querySelectorAll(".map-label");
    var i;
    for (i = 0; i < labels.length; i++) { delete labels[i].dataset.placed; }

    for (i = 0; i < labels.length; i++) {
      var text = labels[i];
      var baseX = parseFloat(text.dataset.baseX);
      var baseY = parseFloat(text.dataset.baseY);
      var best = null;

      outer:
      for (var s = 0; s < LABEL_STEP_PX.length; s++) {
        var step = LABEL_STEP_PX[s] * unitsPerPx;
        var dirs = step === 0 ? [[0, 0]] : LABEL_DIRS;
        for (var d = 0; d < dirs.length; d++) {
          var x = baseX + dirs[d][0] * step;
          var y = baseY + dirs[d][1] * step;
          text.setAttribute("x", x);
          text.setAttribute("y", y);
          if (boxIsClear(text.getBBox(), text)) { best = [x, y]; break outer; }
        }
      }

      // Nowhere is clear — put it back where it belongs and accept the overlap
      // rather than flinging it into the ocean.
      if (!best) { best = [baseX, baseY]; }
      text.setAttribute("x", best[0]);
      text.setAttribute("y", best[1]);
      text.dataset.placed = "1";
    }
  }

  // Re-placing on every wheel tick would make the labels twitch, so let the zoom
  // settle first.
  var labelTimer = null;
  function scheduleLabels() {
    clearTimeout(labelTimer);
    labelTimer = setTimeout(placeLabels, 120);
  }

  if (window.ResizeObserver) {
    new ResizeObserver(function () { resize(); placeLabels(); }).observe(svg);
  } else {
    window.addEventListener("resize", function () { resize(); placeLabels(); });
  }
  resize();
  placeLabels();

  /* ---------- driving the view ---------- */

  // Wheel alone stays page scrolling — the map is a small thing inside a
  // document, and swallowing the wheel over it is infuriating. Ctrl/⌘ + wheel is
  // the browser's own zoom gesture, and a trackpad pinch arrives as exactly that.
  svg.addEventListener("wheel", function (evt) {
    if (!evt.ctrlKey && !evt.metaKey) { return; }
    evt.preventDefault();
    var at = svgPoint(evt);
    zoomAt(Math.pow(0.998, evt.deltaY), at.x, at.y);
  }, { passive: false });

  var pointers = {};              // live pointers by id, for drag and pinch
  var pointerCount = 0;
  var dragFrom = null;            // map point grabbed when the drag began
  var pressAt = null;             // screen point, to tell a click from a drag
  var dragged = 0;
  var pinchFrom = null;

  function twoPointers() {
    var out = [];
    for (var id in pointers) { out.push(pointers[id]); }
    return out;
  }

  svg.addEventListener("pointerdown", function (evt) {
    if (!pointers[evt.pointerId]) { pointerCount++; }
    pointers[evt.pointerId] = { x: evt.clientX, y: evt.clientY };
    pressAt = { x: evt.clientX, y: evt.clientY };
    dragged = 0;

    if (pointerCount === 2) {
      var two = twoPointers();
      pinchFrom = { dist: Math.hypot(two[0].x - two[1].x, two[0].y - two[1].y), zoom: zoom() };
      dragFrom = null;
      return;
    }
    if (zoom() > 1.001) {
      dragFrom = svgPoint(evt);
      svg.setPointerCapture(evt.pointerId);
      svg.classList.add("is-dragging");
    }
  });

  svg.addEventListener("pointermove", function (evt) {
    if (!pointers[evt.pointerId]) { return; }
    pointers[evt.pointerId] = { x: evt.clientX, y: evt.clientY };
    if (pressAt) {
      dragged = Math.max(dragged, Math.hypot(evt.clientX - pressAt.x, evt.clientY - pressAt.y));
    }

    if (pinchFrom && pointerCount === 2) {
      var two = twoPointers();
      var dist = Math.hypot(two[0].x - two[1].x, two[0].y - two[1].y);
      var mid = clientPoint((two[0].x + two[1].x) / 2, (two[0].y + two[1].y) / 2);
      zoomAt((pinchFrom.zoom * (dist / pinchFrom.dist)) / zoom(), mid.x, mid.y);
      return;
    }

    if (!dragFrom) { return; }
    // Move the map so the point grabbed stays under the pointer. Measuring
    // through the *current* view each time is what makes the drag track the
    // cursor exactly instead of drifting.
    var now = svgPoint(evt);
    view.x += dragFrom.x - now.x;
    view.y += dragFrom.y - now.y;
    clampView();
    svg.setAttribute("viewBox", view.x + " " + view.y + " " + view.width + " " + view.height);
  });

  function endPointer(evt) {
    if (pointers[evt.pointerId]) {
      delete pointers[evt.pointerId];
      pointerCount--;
    }
    if (pointerCount < 2) { pinchFrom = null; }
    if (pointerCount <= 0) {
      pointerCount = 0;
      dragFrom = null;
      svg.classList.remove("is-dragging");
    }
  }
  svg.addEventListener("pointerup", endPointer);
  svg.addEventListener("pointercancel", endPointer);

  /* ---------- zoom controls ----------
   * Real buttons, so zooming works without a trackpad and from the keyboard —
   * the rest of the map is pointer-only.
   */

  var controls = document.createElement("div");
  controls.className = "map-zoom";
  function control(label, title, fn) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = label;
    btn.title = title;
    btn.setAttribute("aria-label", title);
    btn.addEventListener("click", fn);
    controls.appendChild(btn);
    return btn;
  }
  control("+", "Zoom in", function () { zoomCentre(1.6); });
  control("−", "Zoom out", function () { zoomCentre(1 / 1.6); });
  var btnReset = control("⤢", "Show the whole state", resetView);
  btnReset.disabled = true;
  host.appendChild(controls);

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

  function svgPoint(evt) { return clientPoint(evt.clientX, evt.clientY); }

  // Screen coordinates to map units, through whatever the current view is.
  function clientPoint(clientX, clientY) {
    var rect = svg.getBoundingClientRect();
    return {
      x: view.x + ((clientX - rect.left) / rect.width) * view.width,
      y: view.y + ((clientY - rect.top) / rect.height) * view.height
    };
  }

  svg.addEventListener("pointermove", function (evt) {
    // Mid-drag the pointer is moving the map, not pointing at things on it.
    if (dragFrom || pinchFrom) { clearHover(); return; }

    var at = svgPoint(evt);

    // Order matters. A label is only ever hit dead-on, so landing on one is a
    // clear statement of intent and outranks the proximity guess below —
    // otherwise a label sitting among dots (SJV does) could never be reached.
    var label = hitLabel(evt);
    if (label) {
      var region = regionByCode(label.dataset.region);
      setHover({ kind: "region", code: label.dataset.region, els: [label],
                 label: region.name, sub: "Click for a region-wide scope" }, evt);
      return;
    }

    // Then a dot, which beats the county under it: the smaller target is the one
    // the pointer was aiming for, and it only has to be the closest.
    var dot = nearestDot(at.x, at.y);
    if (dot) {
      // The dot's county lights up too. Selecting an area selects its county as
      // part of the chain, so this previews what a click actually does — and it
      // means the county under the pointer responds everywhere, rather than only
      // in the gaps between dots.
      setHover({ kind: "area", code: dot.area.code,
                 els: [dot.el, countyEls[dot.county.code]],
                 label: dot.area.name, sub: dot.county.name + " · " + dot.region.name }, evt);
      return;
    }

    var path = evt.target.closest ? evt.target.closest(".map-county") : null;
    if (path && path.dataset.county) {
      var entry = byCountyCode(path.dataset.county);
      setHover({ kind: "county", code: path.dataset.county, els: [path],
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
      (next.els || []).forEach(function (el) {
        if (el) { el.classList.add("is-hover"); }
      });
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
    // A pan ends in a click event. Anything past a few pixels was a drag, and
    // changing the selection because someone moved the map would be maddening.
    if (dragged > 4) { return; }

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

  // The selects take several picks each, so everything chosen is marked, not
  // just the first — otherwise a site bridging two areas would show one dot.
  function picked(sel) {
    return Array.prototype.filter.call(sel.options, function (o) { return o.selected; })
      .map(function (o) { return o.value; })
      .filter(Boolean);
  }

  function refresh() {
    clearMarks("is-on");
    clearMarks("is-in-region");

    picked(selRegion).forEach(function (region) {
      var inRegion = gCounties.querySelectorAll('[data-region="' + region + '"]');
      for (var i = 0; i < inRegion.length; i++) { inRegion[i].classList.add("is-in-region"); }
      var label = gLabels.querySelector('[data-region="' + region + '"]');
      if (label) { label.classList.add("is-on"); }
    });

    picked(selCounty).forEach(function (county) {
      if (countyEls[county]) { countyEls[county].classList.add("is-on"); }
    });

    picked(selArea).forEach(function (area) {
      var el = dotEl(area);
      if (el) { el.classList.add("is-on"); }
    });
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
