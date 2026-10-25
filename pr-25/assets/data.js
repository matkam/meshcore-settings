/*
 * Loads the region tree and the map outlines, and hands them to everything else
 * on the page.
 *
 * The data is JSON now, not JavaScript, so it arrives asynchronously — which is
 * the price of the tree being a plain data file that anything can read. This
 * module is the only place that knows that: app.js and map.js register through
 * `ready()` and are handed a tree that is already indexed.
 *
 * Because it is fetched, the site has to be *served* rather than opened as a
 * file:// URL — browsers block fetch from the filesystem. `npm run serve` is
 * enough locally, and the published site is served over HTTP anyway.
 *
 * Nothing here hard-codes a level. A place has children or it doesn't; how deep
 * the tree runs, and what each level is called, comes from the data.
 */
(function () {
  "use strict";

  var SOURCES = { regions: "data/regions.json", outlines: "data/outlines.json" };

  var loaded = null;
  var waiting = [];

  window.RegionData = {
    // Run `fn(data)` once the tree is in. Callbacks fire in the order they were
    // registered, so map.js still sees the state app.js sets up.
    ready: function (fn) {
      if (loaded) { fn(loaded); } else { waiting.push(fn); }
    },
    get: function () { return loaded; }
  };

  function get(url) {
    return fetch(url).then(function (res) {
      if (!res.ok) { throw new Error(url + " returned " + res.status); }
      return res.json();
    });
  }

  Promise.all([get(SOURCES.regions), get(SOURCES.outlines)])
    .then(function (both) {
      loaded = decorate(both[0], both[1]);
      var fns = waiting;
      waiting = [];
      fns.forEach(function (fn) { fn(loaded); });
    })
    .catch(failed);

  /* ---------- indexing ----------
   *
   * Walk once, and give every place the three things the rest of the site asks
   * for: an identity, how deep it sits, and what its ancestors are.
   *
   * `id` is the place's path — "socal/losangeles/southbay" — because a *code*
   * is not an identity. Two places far enough apart that no repeater will ever
   * carry both are allowed to share a code, so a code can name more than one
   * place while a path names exactly one.
   *
   * `trail` holds ancestor ids for the same reason, and `byId` turns one back
   * into a place. Keeping ids rather than objects in the trail means a place
   * stays a plain acyclic value that can be handed across a structured clone or
   * a test's page.evaluate().
   *
   * `byCode` is still here, for the places a person types a code rather than
   * walks to one: search and the URL hash. It holds the first place with that
   * code, and `allByCode` holds every one, so a caller that has to care can.
   */
  function decorate(regions, outlines) {
    var nodes = [];
    var byId = {};
    var byCode = {};
    var allByCode = {};

    (function walk(list, trail, depth) {
      (list || []).forEach(function (node) {
        node.id = trail.length ? trail[trail.length - 1] + "/" + node.code : node.code;
        node.depth = depth;
        node.trail = trail;
        node.children = node.children || [];
        nodes.push(node);
        byId[node.id] = node;
        if (!byCode[node.code]) { byCode[node.code] = node; }
        (allByCode[node.code] = allByCode[node.code] || []).push(node);
        walk(node.children, trail.concat([node.id]), depth + 1);
      });
    })(regions.places, [], 0);

    // Extra region names that are not levels. A place opts into one, and
    // everything beneath it carries it too, so this walks the trail rather than
    // reading the node alone.
    var tagsByCode = {};
    (regions.tags || []).forEach(function (t) { tagsByCode[t.code] = t; });

    var levels = regions.levels || [];
    var limits = regions.limits || {};

    function level(depth) { return levels[depth] || null; }
    function nameAt(depth) { var l = level(depth); return (l && l.name) || "place"; }

    return {
      regions: regions,
      outlines: outlines,

      root: regions.root || [],
      places: regions.places || [],
      nodes: nodes,
      byId: byId,
      byCode: byCode,

      // Every place with this code, in tree order. One entry for almost all of
      // them; more where a name is reused somewhere far enough away.
      allByCode: function (code) { return (allByCode[code] || []).slice(); },

      tags: regions.tags || [],
      tag: function (code) { return tagsByCode[code] || null; },

      // Every tag this place carries, its own and any inherited from above.
      tagsFor: function (node) {
        var out = [];
        node.trail.concat([node.id]).forEach(function (id) {
          var n = byId[id];
          if (!n || !n.tags) { return; }
          n.tags.forEach(function (t) { if (out.indexOf(t) === -1) { out.push(t); } });
        });
        return out;
      },

      maxLineLength: limits.maxLineLength || 160,
      maxRegionNames: limits.maxRegionNames || 32,
      maxDepth: limits.maxDepth || 8,

      // How deep the deepest branch runs, for anything that ranks by specificity.
      depth: nodes.reduce(function (d, n) { return Math.max(d, n.depth); }, 0) + 1,

      // A place, then everything above it, top down. Takes an id — a code would
      // be ambiguous, which is the whole reason ids exist.
      chain: function (id) {
        var node = byId[id];
        if (!node) { return []; }
        return node.trail.map(function (t) { return byId[t]; }).concat([node]);
      },

      // What this level is called. A place may override its own with `kind`,
      // for a branch that is deeper or shallower than its siblings.
      levelName: function (node) { return node.kind || nameAt(node.depth); },
      levelNameAt: nameAt,
      levelPluralAt: function (depth) {
        var l = level(depth);
        return (l && l.plural) || "places";
      }
    };
  }

  /* ---------- when it doesn't load ----------
   * Almost always one of two things: the page was opened as a file, or the
   * JSON is being rebuilt. Say which, in the panel where the tree should be,
   * rather than leaving an empty box and a console message nobody opens.
   */
  function failed(err) {
    var where = document.getElementById("picker");
    if (where) {
      where.textContent = "";
      var p = document.createElement("p");
      p.className = "line-note over";
      p.textContent = location.protocol === "file:"
        ? "The region data is a JSON file the page fetches, and browsers block that on " +
          "file:// URLs. Serve the folder instead — npm run serve, then open " +
          "http://localhost:8000/."
        : "Couldn't load the region data (" + err.message + "). If you are running this " +
          "locally, check that data/regions.json exists — npm run build:regions writes it.";
      where.appendChild(p);
    }
    if (window.console) { console.error("region data failed to load", err); }
  }
})();
