/*
 * The map. Draws the boundary shapes places claim, drops a dot on every place
 * that carries a point, and makes both of them selectable.
 *
 * Nothing here is per-level. A place is drawn as an outline if it names one, as
 * a dot if it has a lat/lon, and as a label if it sits at the top of the tree —
 * so today's counties-and-areas map falls out of the data rather than being
 * coded in.
 *
 * Design notes worth keeping:
 *
 * - Outlines are real boundaries (data/outlines.json, from Census TIGER). The
 *   places drawn as dots have no official shape — they are a community
 *   convention — so they stay points rather than invented polygons. The map
 *   does not imply a precision the data does not have.
 *
 * - There is no per-region colour scheme. Eight categorical fills on a map this
 *   size fail colour-blind separation, and more to the point they would compete
 *   with the one thing colour should mean here: what you have selected. Region
 *   identity comes from labels and from hovering instead.
 *
 * - This is a shortcut, not the only route. Everything here is also reachable
 *   through the search box and the picker, which are what keyboard and
 *   screen-reader users get. Nothing is map-only.
 */
window.RegionData.ready(function (DATA) {
  "use strict";

  var MAP = DATA.outlines;
  var host = document.getElementById("map-host");
  if (!MAP || !host) { return; }

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

  /* ---------- lookups ----------
   * What a place gets drawn as follows from what it carries, not from where it
   * sits in the tree: an `outline` makes it a shape, a lat/lon makes it a dot.
   * A place may have both, or neither.
   */

  var byShape = {};   // shape name -> the place claiming it
  var points = [];    // every place with a position, with that position projected

  DATA.nodes.forEach(function (node) {
    // `outline` is a name or a list of them: a place claims every shape it
    // wholly contains. Where a place cuts across a shape nobody claims it, and
    // it draws as plain background with the dots inside describing the extent.
    outlineNames(node).forEach(function (name) { byShape[name] = node; });
    if (typeof node.lat === "number" && typeof node.lon === "number") {
      points.push({ node: node });
    }
  });

  function outlineNames(node) {
    if (!node.outline) { return []; }
    return Array.isArray(node.outline) ? node.outline : [node.outline];
  }

  // Ancestors, nearest first — "Del Norte County · North Coast".
  function ancestry(node) {
    return node.trail.slice().reverse().map(function (code) {
      return DATA.byCode[code].name;
    }).join(" · ");
  }

  var p = MAP.projection;
  function project(lat, lon) {
    return { x: (lon - p.lon0) * p.cos0 * p.k, y: (p.lat1 - lat) * p.k };
  }

  points.forEach(function (a) {
    var xy = project(a.node.lat, a.node.lon);
    a.x = xy.x;
    a.y = xy.y;
  });

  /* ---------- build the svg ---------- */

  var vb = MAP.viewBox;
  var svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", vb.x + " " + vb.y + " " + vb.width + " " + vb.height);
  svg.setAttribute("class", "map-svg");
  // The picker below carries the same information for anyone not using a
  // pointer, so the map describes itself as one image rather than 220
  // unlabelled shapes.
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label",
    "Map of " + DATA.regions.name + "'s " + DATA.levelPluralAt(1) +
    " with a marker for each " + DATA.levelNameAt(2) + ". " +
    "The picker below makes the same choices.");

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

  var outlineEls = {};   // place code -> [<path>], one per shape it claims

  MAP.shapes.forEach(function (shape) {
    var owner = byShape[shape.name];
    var path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", shape.d);
    path.setAttribute("class", "map-county");
    if (owner) {
      path.dataset.place = owner.code;
      // Every ancestor, so "tint everything inside this place" is one selector
      // with ~= rather than a walk back up the tree.
      path.dataset.trail = owner.trail.join(" ");
      (outlineEls[owner.code] = outlineEls[owner.code] || []).push(path);
    }
    gCounties.appendChild(path);
  });

  points.forEach(function (a) {
    var dot = document.createElementNS(SVG_NS, "circle");
    dot.setAttribute("cx", a.x);
    dot.setAttribute("cy", a.y);
    dot.setAttribute("class", "map-dot");
    dot.dataset.place = a.node.code;
    a.el = dot;
    gDots.appendChild(dot);
  });

  // Top-level places get a label, sitting at the centre of the dots beneath them
  // rather than at a polygon centroid: it puts the word where the nodes are,
  // which for a region like the Sierra means the populated western slope rather
  // than an empty summit.
  DATA.places.forEach(function (place) {
    var mine = points.filter(function (a) { return a.node.trail.indexOf(place.code) !== -1; });
    if (!mine.length) { return; }
    var cx = mine.reduce(function (s, a) { return s + a.x; }, 0) / mine.length;
    var cy = mine.reduce(function (s, a) { return s + a.y; }, 0) / mine.length;
    // Automatic placement gets most of them right; `nudge` in the data file is
    // for the ones it can't, like a coastal strip whose own centre is at sea.
    var nudge = place.nudge || [0, 0];

    var text = document.createElementNS(SVG_NS, "text");
    text.dataset.baseX = cx + nudge[0];
    text.dataset.baseY = cy + nudge[1];
    text.setAttribute("x", text.dataset.baseX);
    text.setAttribute("y", text.dataset.baseY);
    text.setAttribute("class", "map-label");
    text.dataset.place = place.code;
    // Codes are words now, and "SACRAMENTOVALLEY" across the valley floor is
    // unreadable, so a place may carry a `short` for the label only.
    text.textContent = (place.short || place.code).toUpperCase();
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
    for (var i = 0; i < points.length; i++) {
      if (points[i].x >= box.x - pad && points[i].x <= box.x + box.width + pad &&
          points[i].y >= box.y - pad && points[i].y <= box.y + box.height + pad) {
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

  var hovered = null;   // { code, els, label, sub }

  function nearestDot(x, y) {
    var limit = HIT_PX * unitsPerPx;
    var best = null;
    var bestD = limit * limit;
    for (var i = 0; i < points.length; i++) {
      var dx = points[i].x - x;
      var dy = points[i].y - y;
      var d = dx * dx + dy * dy;
      if (d <= bestD) { bestD = d; best = points[i]; }
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
      var place = DATA.byCode[label.dataset.place];
      setHover({ code: place.code, els: [label], label: place.name,
                 sub: "Click for a " + DATA.levelName(place) + "-wide scope" }, evt);
      return;
    }

    // Then a dot, which beats the outline under it: the smaller target is the
    // one the pointer was aiming for, and it only has to be the closest.
    var dot = nearestDot(at.x, at.y);
    if (dot) {
      // The outline it sits inside lights up too. Selecting a place selects its
      // ancestors as part of the chain, so this previews what a click actually
      // does — and it means the outline under the pointer responds everywhere,
      // rather than only in the gaps between dots.
      setHover({ code: dot.node.code, els: [dot.el].concat(enclosingOutlines(dot.node)),
                 label: dot.node.name, sub: ancestry(dot.node) }, evt);
      return;
    }

    var path = evt.target.closest ? evt.target.closest(".map-county") : null;
    if (path && path.dataset.place) {
      var owner = DATA.byCode[path.dataset.place];
      setHover({ code: owner.code, els: [path], label: owner.name,
                 sub: ancestry(owner) + " · click for a " +
                      DATA.levelName(owner) + "-wide scope" }, evt);
      return;
    }

    clearHover();
  });

  svg.addEventListener("pointerleave", clearHover);

  // The nearest drawn shapes a place sits inside, which is what should light up
  // when its dot is hovered. Not necessarily its parent: a level can pass
  // through without claiming a shape of its own, and one that does claim may
  // hold several — the North Bay is four counties.
  function enclosingOutlines(node) {
    for (var i = node.trail.length - 1; i >= 0; i--) {
      if (outlineEls[node.trail[i]]) { return outlineEls[node.trail[i]]; }
    }
    return outlineEls[node.code] || [];
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
    for (var i = 0; i < points.length; i++) {
      if (points[i].node.code === code) { return points[i].el; }
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
    if (label) { window.SettingsState.select(label.dataset.place); return; }

    var at = svgPoint(evt);
    var dot = nearestDot(at.x, at.y);
    if (dot) { window.SettingsState.select(dot.node.code); return; }

    var path = evt.target.closest ? evt.target.closest(".map-county") : null;
    if (path && path.dataset.place) { window.SettingsState.select(path.dataset.place); }
  });

  function hitLabel(evt) {
    return evt.target.closest ? evt.target.closest(".map-label") : null;
  }

  /* ---------- reflecting the current selection ----------
   * Read straight off the picks app.js already keeps in sync, so the map
   * follows a selection made by search, by the picker, or by a connected
   * repeater without app.js needing to know the map exists.
   */

  // Every pick is marked with whatever it has to be marked with, rather than
  // one rule per level — and everything ticked is marked, not just the first,
  // or a site bridging two places would show one dot.
  function refresh() {
    clearMarks("is-on");
    clearMarks("is-in-region");

    window.SettingsState.picked().forEach(function (pick) {
      (outlineEls[pick.code] || []).forEach(function (el) { el.classList.add("is-on"); });

      var dot = dotEl(pick.code);
      if (dot) { dot.classList.add("is-on"); }

      var label = gLabels.querySelector('[data-place="' + pick.code + '"]');
      if (label) { label.classList.add("is-on"); }

      // Tint every shape inside it, so picking something with no outline of its
      // own — a region, today — still shows its extent.
      var inside = gCounties.querySelectorAll('[data-trail~="' + pick.code + '"]');
      for (var i = 0; i < inside.length; i++) { inside[i].classList.add("is-in-region"); }
    });
  }

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
});
