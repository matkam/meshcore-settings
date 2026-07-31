/*
 * The whole scheme, as a reference.
 *
 * The picker above only reveals what is inside a place once you tick it, which
 * is right for choosing but wrong for looking something up: there was no way to
 * read the tree without selecting your way through it. This is that — read
 * only, nothing here changes what the repeater gets.
 *
 * The balance it tries to strike: every code is reachable, but not all 228 at
 * once. Top-level places are always visible with their description and a count
 * of what is inside; opening one shows that whole subtree at once, rather than
 * making you click down a level at a time.
 *
 * Depth is not assumed anywhere. A place is a row, its children are rows
 * indented one step further, for as deep as the data goes.
 */
window.RegionData.ready(function (DATA) {
  "use strict";

  var host = document.getElementById("reference");
  if (!host) { return; }

  /* ---------- what to say about a place ---------- */

  // Places carry different kinds of description at different levels: a region
  // has a blurb, a local area has the towns inside it, a county has neither and
  // needs neither. Take whichever exists.
  function describe(place) {
    if (place.blurb) { return place.blurb; }
    if (place.aliases && place.aliases.length) { return place.aliases.join(", "); }
    return "";
  }

  // How many places sit at each level under `places`, outermost first. Dense by
  // construction: a level is only reached through one that has places in it.
  function tally(places) {
    var counts = [];
    (function walk(list, d) {
      if (!list.length) { return; }
      counts[d] = (counts[d] || 0) + list.length;
      list.forEach(function (p) { walk(p.children, d + 1); });
    })(places, 0);
    return counts;
  }

  // "5 counties · 8 local areas", using the data's own names for the levels.
  function countsFrom(places, depth) {
    return tally(places).map(function (n, i) {
      var at = depth + i;
      return n + " " + (n === 1 ? DATA.levelNameAt(at) : DATA.levelPluralAt(at));
    }).join(" · ");
  }

  /* ---------- pieces ---------- */

  function chip(text) {
    var el = document.createElement("span");
    el.className = "ref-code";
    el.textContent = text;
    return el;
  }

  function span(cls, text) {
    var el = document.createElement("span");
    el.className = cls;
    el.textContent = text;
    return el;
  }

  // Code and name travel together. They are wrapped rather than being two flex
  // items because a wrapping flex line breaks on an item's *max-content* width
  // before it will shrink one, which left a long name on the line below its own
  // code chip on a narrow screen.
  function title(place) {
    var el = span("ref-title", "");
    el.appendChild(chip(place.code));
    el.appendChild(span("ref-name", place.name));
    return el;
  }

  function row(place) {
    var el = document.createElement("div");
    // "Has something inside it" is a property of the place, not of its level,
    // so a ragged tree still gets the heavier row where the grouping happens.
    el.className = "ref-row" + (place.children.length ? " ref-parent" : "");
    // One rule indents every level, however many there turn out to be.
    el.style.setProperty("--depth", place.depth - 1);
    el.appendChild(title(place));
    var text = describe(place);
    if (text) { el.appendChild(span("ref-desc", text)); }
    return el;
  }

  // Flat, indented by depth rather than nested: the visual shape is the same,
  // the DOM stays shallow, and there is no wrapper to style at each level.
  function subtree(places, into) {
    places.forEach(function (place) {
      into.appendChild(row(place));
      subtree(place.children, into);
    });
    return into;
  }

  /* ---------- the root ----------
   * Every chain starts with these, and they are not selectable anywhere, so
   * without a line about them the tree below looks like it begins at a region.
   */

  if (DATA.root.length) {
    var root = document.createElement("p");
    root.className = "ref-root";
    DATA.root.forEach(function (token, i) {
      if (i) { root.appendChild(document.createTextNode(" › ")); }
      root.appendChild(chip(token.code));
      root.appendChild(span("ref-root-name", token.name));
    });
    root.appendChild(span("ref-root-note", "— prefixed to every chain below"));
    host.appendChild(root);
  }

  /* ---------- the summary line ---------- */

  var head = document.createElement("p");
  head.className = "ref-total";
  head.appendChild(span("", countsFrom(DATA.places, 0) + "."));

  var toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "link-btn";
  head.appendChild(toggle);
  host.appendChild(head);

  /* ---------- one group per top-level place ---------- */

  var groups = DATA.places.map(function (place) {
    var group = document.createElement("details");
    group.className = "ref-group";

    var summary = document.createElement("summary");
    var line = document.createElement("span");
    line.className = "ref-head";
    line.appendChild(title(place));
    if (place.children.length) {
      line.appendChild(span("ref-count", countsFrom(place.children, place.depth + 1)));
    }
    summary.appendChild(line);

    // The description stays visible while collapsed — it is the thing that
    // tells you whether this is the region you want to open.
    var text = describe(place);
    if (text) { summary.appendChild(span("ref-blurb", text)); }
    group.appendChild(summary);

    if (place.children.length) {
      var body = document.createElement("div");
      body.className = "ref-body";
      group.appendChild(subtree(place.children, body));
    }

    host.appendChild(group);
    return group;
  });

  /* ---------- expand all ---------- */

  function openCount() {
    return groups.filter(function (g) { return g.open; }).length;
  }

  function relabel() {
    var all = openCount() === groups.length;
    toggle.textContent = all ? "Collapse all" : "Expand all";
    // Opening one by hand has to move the button too, or it offers to expand
    // what is already expanded.
    toggle.setAttribute("aria-expanded", String(openCount() > 0));
  }

  toggle.addEventListener("click", function () {
    var open = openCount() < groups.length;
    groups.forEach(function (g) { g.open = open; });
    relabel();
  });

  groups.forEach(function (g) { g.addEventListener("toggle", relabel); });
  relabel();
});
