/*
 * California MeshCore repeater settings generator. No dependencies.
 *
 * The whole file runs inside RegionData.ready: the tree is a JSON file the page
 * fetches, so there is nothing to configure until it arrives. That callback is
 * also this module's scope — it does the job the usual wrapping IIFE would.
 *
 * Nothing below knows what a "county" is. Places nest as deep as the data says,
 * and level names come from the data too, so a tree with four levels or two
 * needs no change here.
 */
window.RegionData.ready(function (DATA) {
  "use strict";

  var ROOT = DATA.root;
  var MAX_LINE = DATA.maxLineLength;
  // MAX_REGION_ENTRIES in the firmware's RegionMap.h. It is a build-time
  // #ifndef, so a custom build could differ, but 32 is what ships.
  var MAX_REGIONS = DATA.maxRegionNames;

  var $ = function (id) { return document.getElementById(id); };

  var els = {
    search: $("search"),
    results: $("results"),
    picker: $("picker"),
    outputPanel: $("output-panel"),
    clientPanel: $("client-panel"),
    chain: $("chain"),
    commands: $("commands"),
    copy: $("copy"),
    lineNote: $("line-note"),
    verifyBlock: $("verify-block"),
    explain: $("explain"),
    scopeList: $("scope-list"),
    duty: $("opt-duty"),
    hash: $("opt-hash"),
    home: $("opt-home"),
    verify: $("opt-verify"),
    fw: $("opt-fw"),
    fwHint: $("fw-hint"),
    dutyHint: $("duty-hint"),
    hashHint: $("hash-hint"),
    loop: $("opt-loop"),
    loopHint: $("loop-hint"),
    flood: $("opt-flood"),
    floodHint: $("flood-hint"),
    owner: $("opt-owner"),
    ownerHint: $("owner-hint"),
    commandsEdit: $("commands-edit"),
    editBtn: $("edit-cmds"),
    editNote: $("edit-note"),
    editNoteText: $("edit-note-text"),
    resetBtn: $("reset-cmds"),
    pickNote: $("pick-note"),
    pickScope: $("pick-scope"),
    clearPicks: $("clear-picks"),
    expandPicks: $("expand-picks")
  };

  /* ---------- small helpers ---------- */

  // Every list on this page is built the same way — an element, a class, some
  // text — and textContent throughout, since these strings come from a data file
  // contributors edit.
  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) { node.className = className; }
    if (text != null) { node.textContent = text; }
    return node;
  }

  function clamp(v, lo, hi) { return Math.min(Math.max(v, lo), hi); }

  function haversineKm(lat1, lon1, lat2, lon2) {
    var R = 6371;
    var toRad = function (d) { return (d * Math.PI) / 180; };
    var dLat = toRad(lat2 - lat1);
    var dLon = toRad(lon2 - lon1);
    var s = Math.pow(Math.sin(dLat / 2), 2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.pow(Math.sin(dLon / 2), 2);
    return 2 * R * Math.asin(Math.sqrt(s));
  }

  /* ---------- firmware capabilities ---------- */

  // Version gates, from the MeshCore CLI reference:
  //   1.10  region put / allowf / save
  //   1.12  region list {allowed|denied}, set owner.info
  //   1.14  set path.hash.mode, set loop.detect
  //   1.15  set dutycycle (set af deprecated), region put allows flooding by default
  //   1.16  region def
  function caps() {
    var v = parseInt(els.fw.value, 10);
    return {
      version: v,
      regionDef: v >= 116,
      dutycycle: v >= 115,
      // 1.15+ flood-allows a region as it is put, so allowf is redundant there.
      explicitAllowf: v < 115,
      hashMode: v >= 114,
      regionList: v >= 112,
      // Long-standing repeater setting, present across every version this site
      // offers.
      floodAdvert: true,
      // Same release as path.hash.mode, and not by coincidence: loop detection
      // counts how often this repeater's own hash appears in a packet's path,
      // and multibyte path hashes landed in the same version.
      loopDetect: v >= 114,
      // set owner.info landed in 1.12, which sits *inside* the 1.10-1.13 tier.
      // Nothing here can tell 1.13 from 1.11, so rather than withhold it from
      // the two versions that do have it, it is offered everywhere and the
      // oldest tier says plainly that it might come back unknown.
      ownerInfo: true,
      ownerInfoUncertain: v < 114
    };
  }

  var FW_HINTS = {
    116: "Everything current: the whole chain goes in one region def line.",
    115: "region def landed in 1.16, so each name is placed with its own region put. Flooding is allowed as they are created.",
    114: "Predates set dutycycle (1.15), so the duty cycle uses the older set af airtime factor, and each region needs an explicit region allowf.",
    110: "Predates set dutycycle (1.15), and set path.hash.mode and set loop.detect (both 1.14), so those are handled differently or skipped."
  };

  var HASH_WHY = {
    "0": "1-byte advert path hash: 256 unique ids, up to 64 flood hops. This is the firmware default and the safest for meshes still running 1.13 or older.",
    "1": "2-byte advert path hash: 65,536 unique ids instead of 256, so repeaters stay distinguishable as the mesh grows. Costs a little flood range (32 hops) and needs firmware 1.14+.",
    "2": "3-byte advert path hash: 16.7 million unique ids, but only 21 flood hops, and nodes older than 1.14 drop these adverts. Only worth it in very dense meshes."
  };

  // Thresholds are per the CLI reference. They key off the path hash size of the
  // packet being judged — not this node's path.hash.mode, which only governs the
  // hashes it stamps on its own adverts.
  var LOOP_WHY = {
    off: "No loop detection: a flood packet is forwarded again even if this repeater's own id is already in its path. This is the firmware default.",
    minimal: "Rejects a flood packet once this repeater's own id already appears 4 times in a 1-byte path, twice in a 2-byte path, or once in a 3-byte path. The most forgiving setting.",
    moderate: "Rejects a flood packet once this repeater's own id already appears twice in a 1-byte path, or once in a 2- or 3-byte path. A packet that has been through here and come back is dropped rather than repeated.",
    strict: "Rejects a flood packet the moment this repeater's own id appears in its path at all, whatever the hash size. The least likely to let a loop through, and the most likely to drop a legitimate re-flood."
  };

  /* ---------- index ---------- */

  // Flat, searchable list of every place, however deep it sits.
  var index = [];
  var byCode = {};

  DATA.nodes.forEach(function (node) {
    index.push({
      node: node,
      code: node.code,
      name: node.name,
      depth: node.depth,
      context: contextFor(node),
      terms: (node.aliases || []).slice()
    });
  });

  // Nearest ancestor first, which is the order that tells two same-named places
  // apart. A top-level place has no ancestor inside the tree, so it borrows the
  // last root token: "California region" rather than a blank.
  function contextFor(node) {
    if (node.trail.length) {
      return node.trail.slice().reverse().map(function (code) {
        return DATA.byCode[code].name;
      }).join(" · ");
    }
    var top = ROOT.length ? ROOT[ROOT.length - 1].name + " " : "";
    return top + DATA.levelName(node);
  }

  index.forEach(function (e) {
    e.haystack = [e.name, e.code, e.context].concat(e.terms).join(" ").toLowerCase();
    byCode[e.code] = e;
  });

  /* ---------- selection state ---------- */

  var current = null;
  var settingsListeners = [];

  // Listeners are handed what will actually be sent, edits included — which is
  // why this goes through SettingsState.get() rather than the built commands.
  function notify() {
    var state = window.SettingsState.get();
    settingsListeners.forEach(function (fn) { fn(state); });
  }

  // Consumed by push.js so the over-the-air flow sends exactly what the
  // copy block shows, and so a connected repeater can drive the selections.
  window.SettingsState = {
    // What is on screen, which is not always what the generator produced — see
    // the edit block below. Everything downstream (copy, the over-the-air push)
    // reads this, so an edited command list is the one that actually gets sent.
    get: function () {
      if (!current) { return null; }
      var built = buildCommands(current);
      if (edited !== null) { built.lines = editedLines(); built.edited = true; }
      return built;
    },
    onChange: function (fn) { settingsListeners.push(fn); },

    // Places closest to a position, nearest first, for "where is this
    // repeater?". Only places that carry a point are candidates, at whatever
    // level they sit. The points are approximate and can be a few km apart, so
    // callers offer a shortlist rather than a single answer. `spreadKm` drops a
    // runner-up that is further than that beyond the winner — past which it is no
    // longer a plausible alternative reading of the same position.
    nearestPlaces: function (lat, lon, count, spreadKm) {
      var hits = [];
      index.forEach(function (e) {
        if (typeof e.node.lat !== "number" || typeof e.node.lon !== "number") { return; }
        hits.push({ entry: e, km: haversineKm(lat, lon, e.node.lat, e.node.lon) });
      });
      hits.sort(function (a, b) { return a.km - b.km; });
      if (!hits.length) { return []; }
      var limit = hits[0].km + (spreadKm == null ? Infinity : spreadKm);
      return hits.filter(function (h) { return h.km <= limit; }).slice(0, count || 3);
    },

    select: function (code) {
      var entry = byCode[code];
      if (!entry) { return false; }
      els.search.value = entry.name;
      selectEntry(entry);
      return true;
    },

    setFirmware: function (tier) {
      if (!els.fw.querySelector('option[value="' + tier + '"]')) { return false; }
      els.fw.value = tier;
      render();
      return true;
    },

    firmwareTier: function () { return els.fw.value; },

    // Everything currently ticked, so the map can mark all of it rather than
    // reaching into the picker's markup. Codes only — the map looks the places
    // themselves up in RegionData, which keeps this free of anything that
    // would have to change when the tree gains a level.
    picked: function () {
      return chosen().map(function (e) { return { code: e.code, depth: e.depth }; });
    }
  };

  /* ---------- editing the commands ----------
   *
   * `edited` is null while the block is just showing what the generator made.
   * Once someone types, it holds their text and becomes the source of truth for
   * copying and for the over-the-air push.
   *
   * Changing the selection or the options after that does NOT overwrite it.
   * Throwing away something a person typed is never worth the tidiness — the
   * generated version is one click away, and until then a note says plainly
   * that the two have diverged.
   */

  var edited = null;

  function editedLines() {
    return edited.split("\n")
      .map(function (l) { return l.trim(); })
      .filter(function (l) { return l.length > 0; });
  }

  function isEditing() { return !els.commandsEdit.hidden; }

  function setEditing(on) {
    els.commandsEdit.hidden = !on;
    els.commands.hidden = on;
    els.editBtn.textContent = on ? "Done" : "Edit";
    els.editBtn.setAttribute("aria-pressed", String(on));
    if (on) {
      els.commandsEdit.value = edited === null ? els.commands.textContent : edited;
      autoGrow();
      els.commandsEdit.focus();
    }
  }

  // The textarea has no scrollbar of its own: the command list is short, and a
  // box that scrolls inside a page that scrolls is a nuisance.
  function autoGrow() {
    els.commandsEdit.style.height = "auto";
    els.commandsEdit.style.height = els.commandsEdit.scrollHeight + "px";
  }

  function renderEditNote() {
    if (edited === null) {
      els.editNote.hidden = true;
      return;
    }
    var lines = editedLines();
    // The 160-character serial limit applies to whatever is actually sent, not
    // just to what the generator wrote, so it is checked here too.
    var longest = lines.reduce(function (a, b) { return b.length > a.length ? b : a; }, "");
    els.editNote.hidden = false;
    els.editNote.className = "edit-note" + (longest.length > MAX_LINE ? " over" : "");

    if (!lines.length) {
      els.editNoteText.textContent = "The command list is empty, so there is nothing to copy or send.";
    } else if (longest.length > MAX_LINE) {
      els.editNoteText.textContent =
        "Your longest line is " + longest.length + " characters, over the " + MAX_LINE +
        "-character serial limit. Split it across two commands.";
    } else {
      els.editNoteText.textContent =
        "These are your edits, not the generated commands — " + lines.length +
        (lines.length === 1 ? " line" : " lines") + " will be copied and sent.";
    }
  }

  function stopEditing() {
    edited = null;
    if (isEditing()) { setEditing(false); }
    render();
  }

  els.editBtn.addEventListener("click", function () { setEditing(!isEditing()); });

  els.commandsEdit.addEventListener("input", function () {
    edited = els.commandsEdit.value;
    autoGrow();
    renderEditNote();
    // The push panel watches this to keep its own state honest.
    notify();
  });

  els.resetBtn.addEventListener("click", stopEditing);

  function selectEntry(entry, opts) {
    selectEntries([entry], opts);
  }

  // Selecting replaces what was picked rather than adding to it: search, the
  // map and a connected repeater all mean "this one", and the multi-selects are
  // where a set is built up deliberately.
  function selectEntries(entries, opts) {
    if (!entries.length) { return; }
    current = entries[0];

    picked = {};
    entries.forEach(function (e) {
      // The levels above have to be ticked too, or the chain would be missing
      // its middle, and opened, or the row would exist nowhere on screen.
      e.node.trail.forEach(function (code) {
        picked[code] = true;
        expanded[code] = true;
      });
      picked[e.code] = true;
      if (e.node.children.length) { expanded[e.code] = true; }
    });

    renderPicker();
    revealPick();
    render();

    if (!opts || !opts.keepHash) {
      var hash = "#" + entries.map(function (e) { return e.code; }).join(",");
      if (location.hash !== hash) { history.replaceState(null, "", hash); }
    }
  }

  /* ---------- the picker ----------
   *
   * A tree of checkboxes rather than one list per level. The tags form a
   * hierarchy, so showing it as one makes the shape of what you are configuring
   * visible, and it needs no modifier keys: tick what the repeater covers,
   * untick what it does not.
   *
   * Opening a place and choosing it are separate gestures. They used not to be —
   * ticking was the only way to see inside something — which meant looking a code
   * up required selecting two places you did not want and then unselecting them.
   * So each place with children has its own disclosure control, and the tree can
   * be read end to end without touching a checkbox.
   *
   * Ticking still opens what it ticks, because that cascade is a good way to work
   * downwards. Unticking deliberately does not close anything: you may still want
   * to look at what you just decided against.
   *
   * You carry exactly what you tick, plus the ancestry each pick implies. There
   * is no "deepest level wins" rule to learn: ticking a place and something
   * inside it is not a contradiction, because the inner chain already contains
   * the outer, and the redundant chain is dropped when the commands are built.
   */

  var picked = {};     // code -> true, what the repeater will carry
  var expanded = {};   // code -> true, purely what is on screen

  function isPicked(code) { return picked[code] === true; }
  function isExpanded(code) { return expanded[code] === true; }

  // Places carry different kinds of description at different levels: a region has
  // a blurb, a local area has the towns inside it, a county has neither and needs
  // neither. Take whichever exists — nothing here is written for one level.
  function describe(place) {
    if (place.blurb) { return place.blurb; }
    if (place.aliases && place.aliases.length) { return place.aliases.join(", "); }
    return "";
  }

  // Everything with children, which is what "expand all" acts on and what its
  // label has to be counted against.
  function openable() {
    return DATA.nodes.filter(function (node) { return node.children.length; });
  }

  // How many places sit at each level under `places`, outermost first — used for
  // the toggle's accessible label and the scope line.
  function tally(places) {
    var counts = [];
    (function walk(list, d) {
      if (!list.length) { return; }
      counts[d] = (counts[d] || 0) + list.length;
      list.forEach(function (p) { walk(p.children, d + 1); });
    })(places, 0);
    return counts;
  }

  // "5 counties and 8 local areas", in the data's own words for each level.
  function countsFrom(places, depth, join) {
    var parts = tally(places).map(function (count, i) {
      var at = depth + i;
      return count + " " + (count === 1 ? DATA.levelNameAt(at) : DATA.levelPluralAt(at));
    });
    if (parts.length < 2) { return parts.join(""); }
    return parts.slice(0, -1).join(", ") + join + parts[parts.length - 1];
  }

  function chosen() {
    return index.filter(function (e) { return isPicked(e.code); });
  }

  function row(entry) {
    var place = entry.node;
    // Depth, not a level name: the styling is "how far in is this", which is a
    // question any tree can answer.
    var rowEl = el("div", "pick-row lvl-" + entry.depth);

    rowEl.appendChild(place.children.length ? toggle(place) : spacer());

    // The checkbox lives in its own label rather than the label wrapping the
    // whole row: a <button> inside a <label> is activated by that label, so a
    // row-wide label would tick the box every time the disclosure was clicked.
    var main = el("label", "pick-main");

    var box = document.createElement("input");
    box.type = "checkbox";
    box.checked = isPicked(entry.code);
    box.dataset.code = entry.code;
    box.addEventListener("change", function () {
      if (box.checked) {
        picked[entry.code] = true;
        // Choosing something is also a statement of interest in what is inside
        // it, and this is the cascade the tree has always had.
        expanded[entry.code] = true;
      } else {
        delete picked[entry.code];
        // Whatever sat under it goes too, since it is no longer reachable.
        index.forEach(function (e) {
          if (e.node.trail.indexOf(entry.code) !== -1) { delete picked[e.code]; }
        });
        // Note it stays open: unticking is not a reason to hide what you were
        // just looking at.
      }
      renderPicker();
      onPicked();
    });

    // Code and name are one unit that never breaks between them: a wrapping
    // flex line breaks on an item's max-content width before it will shrink one,
    // which otherwise drops a long name onto the line below its own code.
    var title = el("span", "pick-title");
    title.appendChild(el("span", "pick-code", entry.code));
    title.appendChild(el("span", "pick-name", entry.name));

    main.appendChild(box);
    main.appendChild(title);

    var text = describe(place);
    if (text) {
      var desc = el("span", "pick-desc", text);
      // Clipped to one line so the list stays scannable, so the whole of it has
      // to be available some other way.
      desc.title = text;
      main.appendChild(desc);
    }

    rowEl.appendChild(main);
    return rowEl;
  }

  function toggle(place) {
    var btn = el("button", "pick-toggle");
    btn.type = "button";
    btn.dataset.code = place.code;
    btn.setAttribute("aria-expanded", String(isExpanded(place.code)));
    // The count has nowhere to go visually — the description has that space —
    // but it is exactly what someone deciding whether to open this wants, so it
    // goes to anyone listening rather than nobody.
    btn.setAttribute("aria-label",
      (isExpanded(place.code) ? "Hide the " : "Show the ") +
      countsFrom(place.children, place.depth + 1, " and ") + " in " + place.name);
    btn.addEventListener("click", function () {
      if (isExpanded(place.code)) {
        delete expanded[place.code];
      } else {
        expanded[place.code] = true;
      }
      renderPicker();
    });
    return btn;
  }

  // Keeps the names of childless rows in line with their siblings'.
  function spacer() {
    return el("span", "pick-toggle is-leaf");
  }

  function renderPicker() {
    // Rebuilt wholesale, which is simple and fast enough at this size — but the
    // scroll position has to survive it or ticking something halfway down jumps
    // the list back to the top.
    var scroll = els.picker.scrollTop;
    els.picker.textContent = "";
    els.picker.appendChild(branch(DATA.places));

    els.picker.scrollTop = scroll;
    els.clearPicks.hidden = !chosen().length;
    relabelExpand();
  }

  // One level of the tree, plus whatever sits under anything opened. Recursive
  // because the data is: nothing here decides how deep it goes.
  function branch(places) {
    var frag = document.createDocumentFragment();
    places.forEach(function (place) {
      frag.appendChild(row(byCode[place.code]));
      if (!isExpanded(place.code) || !place.children.length) { return; }
      var kids = el("div", "pick-children");
      kids.appendChild(branch(place.children));
      frag.appendChild(kids);
    });
    return frag;
  }

  /* ---------- expand all ---------- */

  function allOpen() {
    return openable().every(function (node) { return isExpanded(node.code); });
  }

  function relabelExpand() {
    els.expandPicks.textContent = allOpen() ? "Collapse all" : "Expand all";
  }

  els.expandPicks.addEventListener("click", function () {
    if (allOpen()) {
      expanded = {};
    } else {
      openable().forEach(function (node) { expanded[node.code] = true; });
    }
    renderPicker();
  });

  // Where the chain starts and how much of it there is. Both come from the data,
  // so a differently shaped tree describes itself correctly.
  function renderScope() {
    var root = DATA.root.map(function (r) { return r.code; }).join(" \u203a ");
    els.pickScope.textContent =
      (root ? root + " prefixes every chain \u00b7 " : "") +
      countsFrom(DATA.places, 0, " and ") + " to choose from.";
  }

  /* ---------- the resize handle ----------
   *
   * `resize` writes an inline height as you drag, but `max-height` still clamps
   * what that height renders as — so the handle could not pass the cap, which is
   * exactly the point at which someone reaches for it.
   *
   * Grabbing the handle is a statement that the person wants to choose the
   * height, so the automatic cap gets out of the way at that moment. The height
   * is pinned first so the box does not jump, and both are put back if the grab
   * turned out to be a click that never dragged anywhere.
   */

  var GRAB_PX = 18;   // the corner the browser draws its grip in

  els.picker.addEventListener("pointerdown", function (evt) {
    if (getComputedStyle(els.picker).resize === "none") { return; }

    var box = els.picker.getBoundingClientRect();
    if (evt.clientX < box.right - GRAB_PX || evt.clientY < box.bottom - GRAB_PX) { return; }

    var from = box.height;
    els.picker.style.height = from + "px";
    els.picker.style.maxHeight = "none";

    window.addEventListener("pointerup", function restore() {
      window.removeEventListener("pointerup", restore);
      if (Math.abs(els.picker.getBoundingClientRect().height - from) < 1) {
        els.picker.style.height = "";
        els.picker.style.maxHeight = "";
      }
    });
  });

  els.clearPicks.addEventListener("click", function () {
    picked = {};
    els.search.value = "";
    renderPicker();
    onPicked();
    if (location.hash) { history.replaceState(null, "", location.pathname + location.search); }
  });

  // A pick made by search, the map or a connected repeater can land below the
  // fold of a scrolling list, which looks like nothing happened.
  function revealPick() {
    var deepest = els.picker.querySelectorAll(".pick-row input:checked");
    if (!deepest.length) { return; }
    var row = deepest[deepest.length - 1].closest(".pick-row");
    var top = row.offsetTop - els.picker.offsetTop;
    if (top < els.picker.scrollTop || top > els.picker.scrollTop + els.picker.clientHeight - 40) {
      els.picker.scrollTop = Math.max(0, top - els.picker.clientHeight / 2);
    }
  }

  function onPicked() {
    var picks = chosen();
    current = picks[0] || null;
    render();
    var hash = picks.length ? "#" + picks.map(function (e) { return e.code; }).join(",") : "";
    if (hash && location.hash !== hash) { history.replaceState(null, "", hash); }
  }

  /* ---------- search ---------- */

  function score(entry, q) {
    if (entry.code === q) { return 0; }
    var name = entry.name.toLowerCase();
    if (name === q) { return 1; }
    if (name.indexOf(q) === 0) { return 2; }

    for (var i = 0; i < entry.terms.length; i++) {
      var t = entry.terms[i].toLowerCase();
      if (t === q) { return 1; }
      if (t.indexOf(q) === 0) { return 3; }
    }
    if (entry.haystack.indexOf(q) !== -1) { return 5; }
    return -1;
  }

  function search(q) {
    q = q.trim().toLowerCase();
    if (q.length < 2) { return []; }

    var hits = [];
    index.forEach(function (e) {
      var s = score(e, q);
      if (s < 0) { return; }
      // Prefer the most specific level when scores tie.
      hits.push({ entry: e, sort: s * 100 + (DATA.depth - e.depth) });
    });
    hits.sort(function (a, b) {
      return a.sort - b.sort || a.entry.name.localeCompare(b.entry.name);
    });
    return hits.slice(0, 12).map(function (h) { return h.entry; });
  }

  var active = -1;
  var shown = [];

  function matchedCity(entry, q) {
    q = q.trim().toLowerCase();
    for (var i = 0; i < entry.terms.length; i++) {
      if (entry.terms[i].toLowerCase().indexOf(q) === 0) { return entry.terms[i]; }
    }
    return null;
  }

  function renderResults(q) {
    shown = search(q);
    active = -1;
    els.results.textContent = "";

    if (q.trim().length < 2) {
      closeResults();
      return;
    }

    if (!shown.length) {
      els.results.appendChild(el("li", "empty",
        'No match for "' + q.trim() + '". Try a ' +
        DATA.levelNameAt(1) + ' or a nearby place name.'));
    }

    shown.forEach(function (entry, i) {
      var li = document.createElement("li");
      li.setAttribute("role", "option");
      li.id = "result-" + i;

      var city = matchedCity(entry, q);
      li.appendChild(el("span", "r-name", entry.name));
      li.appendChild(el("span", "r-code", "  " + entry.code));
      li.appendChild(el("span", "r-ctx", city ? city + " — " + entry.context : entry.context));

      li.addEventListener("mousedown", function (ev) {
        ev.preventDefault();
        choose(entry);
      });
      els.results.appendChild(li);
    });

    openResults();
  }

  function openResults() {
    els.results.hidden = false;
    els.search.setAttribute("aria-expanded", "true");
  }

  function closeResults() {
    els.results.hidden = true;
    els.search.setAttribute("aria-expanded", "false");
    els.search.removeAttribute("aria-activedescendant");
    active = -1;
  }

  function highlight(i) {
    var items = els.results.querySelectorAll('li[role="option"]');
    for (var n = 0; n < items.length; n++) {
      items[n].setAttribute("aria-selected", n === i ? "true" : "false");
    }
    if (i >= 0 && items[i]) {
      els.search.setAttribute("aria-activedescendant", items[i].id);
      items[i].scrollIntoView({ block: "nearest" });
    }
  }

  function choose(entry) {
    els.search.value = entry.name;
    closeResults();
    selectEntry(entry);
    els.outputPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  els.search.addEventListener("input", function () { renderResults(els.search.value); });

  els.search.addEventListener("focus", function () {
    if (els.search.value.trim().length >= 2) { renderResults(els.search.value); }
  });

  els.search.addEventListener("blur", function () {
    setTimeout(closeResults, 120);
  });

  els.search.addEventListener("keydown", function (ev) {
    if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
      if (els.results.hidden || !shown.length) { return; }
      ev.preventDefault();
      active += ev.key === "ArrowDown" ? 1 : -1;
      if (active < 0) { active = shown.length - 1; }
      if (active >= shown.length) { active = 0; }
      highlight(active);
    } else if (ev.key === "Enter") {
      if (!els.results.hidden && shown.length) {
        ev.preventDefault();
        choose(shown[active >= 0 ? active : 0]);
      }
    } else if (ev.key === "Escape") {
      closeResults();
    }
  });

  /* ---------- command generation ---------- */

  function chainOf(entry) {
    var chain = ROOT.map(function (r) {
      return { code: r.code, label: r.name };
    });
    return chain.concat(DATA.chain(entry.code).map(function (node) {
      return { code: node.code, label: node.name };
    }));
  }

  function dutyValue() {
    var v = parseInt(els.duty.value, 10);
    return isNaN(v) ? 1 : clamp(v, 1, 100);
  }

  // Older firmware sets duty cycle indirectly: after each transmission the node
  // stays silent for airtime * af, giving a long-term duty of about 1/(1+af).
  function afValue() {
    return clamp(Math.round(100 / dutyValue() - 1), 0, 9);
  }

  function afDuty() {
    return Math.round(100 / (1 + afValue()));
  }

  // Hours between flood adverts. The firmware takes 3-168, or 0 to stop sending
  // them; 1 and 2 are rejected outright. An empty box means "don't touch it",
  // which is a different thing from 0.
  function floodValue() {
    if (els.flood.value.trim() === "") { return null; }
    var v = parseInt(els.flood.value, 10);
    return isNaN(v) ? null : clamp(v, 0, 168);
  }

  /* ---------- what this repeater carries ----------
   *
   * One chain per thing selected at the deepest chosen level. Usually that is
   * one; a high site that covers several areas simply picks several, and the
   * PNW region strategy's point stands either way — RF reach is not a scope
   * boundary, so a repeater only forwards traffic matching a tag it actually
   * holds, and what it holds is exactly this.
   */
  function chainsFor() {
    var all = chosen().map(chainOf);
    // A chain that is a prefix of another says nothing extra: `region def west
    // ca centralcoast slo slonorth` already creates centralcoast and slo on the
    // way past. So ticking a place and something inside it is not a contradiction
    // to resolve, it is a duplicate to drop — which is why the picker needs no
    // "deepest wins" rule.
    return all.filter(function (chain) {
      return !all.some(function (other) {
        return other.length > chain.length && chain.every(function (t, i) {
          return other[i].code === t.code;
        });
      });
    });
  }

  // Whatever the owner typed, as one serial-safe line's worth of text. Empty
  // means "don't send the command", which leaves any existing owner info on the
  // repeater alone — there is no way here to deliberately blank it out, and
  // sending an empty value by accident would do exactly that.
  function ownerValue() {
    // A single-line input, but a paste can still smuggle in line breaks and tabs.
    // "|" is the firmware's own newline marker, so that is what they become.
    return els.owner.value
      .replace(/[\r\n]+/g, " | ")
      .replace(/\t/g, " ")
      .trim();
  }

  /* ---------- region def, with branches ----------
   *
   * `region def` walks a cursor: each token becomes a child of the one before
   * it. The `name|jump` form creates `name` under the cursor and then moves the
   * cursor to `jump`, which lets one line define several branches instead of
   * repeating the shared ancestry in a second command.
   *
   *   region def west ca centralcoast slo slonorth|ca bayarea eastbay oakland
   *
   * builds the North County chain, hops the cursor back up to `ca`, and carries
   * on into Oakland's. The 160-character serial limit still applies, so a line
   * that would overflow starts a new command from the root instead.
   */
  function defLines(chains) {
    var lines = [];
    var tokens = null;    // what the current line has emitted
    var at = null;        // the chain the cursor is currently sitting in

    chains.forEach(function (ch) {
      var codes = ch.map(function (x) { return x.code; });
      if (!tokens) { tokens = codes.slice(); at = codes; return; }

      // Hop back to the deepest name this chain shares with where the cursor is.
      var i = 0;
      while (i < at.length && i < codes.length && at[i] === codes[i]) { i += 1; }
      var rest = codes.slice(i);
      // Wholly contained in what is already built — nothing left to say.
      if (!rest.length) { return; }

      var joined = tokens.slice();
      joined[joined.length - 1] += "|" + codes[i - 1];
      joined = joined.concat(rest);

      if (("region def " + joined.join(" ")).length <= MAX_LINE) {
        tokens = joined;
      } else {
        lines.push("region def " + tokens.join(" "));
        tokens = codes.slice();
      }
      at = codes;
    });

    if (tokens) { lines.push("region def " + tokens.join(" ")); }
    return lines;
  }

  // A tag is a region name that is not a level — see the header of regions.yaml.
  // It becomes its own short chain from the root, which is all a node needs to
  // carry the name and match traffic scoped to it. Building it as a chain rather
  // than a special case means line splitting, `region put` on old firmware and
  // the region-name count all handle it without knowing what a tag is.
  function tagChainsFor(chains) {
    var seen = [];
    chains.forEach(function (ch) {
      ch.forEach(function (t) {
        var node = DATA.byCode[t.code];
        if (!node) { return; }
        DATA.tagsFor(node).forEach(function (code) {
          if (seen.indexOf(code) === -1) { seen.push(code); }
        });
      });
    });
    return seen.map(function (code) {
      var tag = DATA.tag(code);
      return ROOT.map(function (r) { return { code: r.code, label: r.name }; })
                 .concat([{ code: code, label: (tag && tag.name) || code, isTag: true }]);
    });
  }

  function buildCommands(entry) {
    var c = caps();
    var chains = chainsFor();
    var chain = chains[0];
    var codes = chain.map(function (x) { return x.code; });
    var leaf = codes[codes.length - 1];
    // Tags go last, so the picked places lead the command block and `chains[0]`
    // is still what the operator chose.
    var tagChains = tagChainsFor(chains);
    var allChains = chains.concat(tagChains);

    var lines = [];

    lines.push(c.dutycycle ? "set dutycycle " + dutyValue() : "set af " + afValue());
    if (c.hashMode) { lines.push("set path.hash.mode " + els.hash.value); }
    if (c.floodAdvert && floodValue() !== null) {
      lines.push("set flood.advert.interval " + floodValue());
    }
    if (c.loopDetect && els.loop.value) {
      lines.push("set loop.detect " + els.loop.value);
    }
    if (c.ownerInfo && ownerValue()) {
      lines.push("set owner.info " + ownerValue());
    }

    // The region block, in whichever form this firmware understands. One chain
    // normally; a bridge site emits a second, and shares the ancestry the two
    // have in common rather than repeating it.
    var regionLines = [];
    if (c.regionDef) {
      regionLines = defLines(chains);
      // A tag is one extra name, not a chain, so it is placed with `region put`
      // even here where `region def` is available. Three reasons: `def` walking
      // a chain overstates what a tag is, a second `def` would re-assert west
      // and ca that the line above just placed — each re-put resetting their
      // flags — and this way the tag looks the same on every firmware, where
      // only the chain form differs. `put` flood-allows as it creates on 1.15+,
      // so no allowf is needed at this tier.
      tagChains.forEach(function (ch) {
        regionLines.push("region put " + ch[ch.length - 1].code + " " + ch[ch.length - 2].code);
      });
    } else {
      // One `region put` per name, with any ancestry two chains share placed
      // once — the same tree, built a name at a time.
      var placed = {};
      allChains.forEach(function (ch) {
        ch.map(function (x) { return x.code; }).forEach(function (code, i, chCodes) {
          if (placed[code]) { return; }
          placed[code] = true;
          // No parent argument on the first token, so it lands under the reserved
          // root entry `*`. That root is not a wildcard: it does not match
          // configured names, it is the bucket the firmware uses for unscoped
          // flood traffic. Scoped traffic only matches regions the node carries.
          regionLines.push(i === 0 ? "region put " + code : "region put " + code + " " + chCodes[i - 1]);
          if (c.explicitAllowf) { regionLines.push("region allowf " + code); }
        });
      });
    }
    lines = lines.concat(regionLines);

    if (els.home.checked) {
      lines.push("region home " + leaf);
      lines.push("region default " + leaf);
    }
    lines.push("region save");

    return { lines: lines, regionLines: regionLines, chain: chain, chains: allChains,
             picks: chains, tagChains: tagChains, leaf: leaf, caps: c };
  }

  /* ---------- render ---------- */

  // Carrying several tags is the thing people need told, and it belongs next to
  // where they picked them rather than in a panel further down.
  function renderPickNote() {
    // Count what is actually carried, not what is ticked: ticking a place and
    // something inside it is one place, because the redundant chain is dropped.
    var picks = chainsFor();
    if (picks.length < 2) {
      els.pickNote.textContent = picks.length === 1
        ? "Pick more than one and the repeater carries them all — that is how a high site " +
          "bridges the places it covers."
        : "";
      return;
    }
    els.pickNote.textContent =
      "Carrying " + picks.length + " places, so local traffic for all of them crosses this " +
      "repeater. The repeaters around each still won't re-forward the others', so it travels " +
      "one hop past you and stops. Worth keeping to what this site really covers — the point " +
      "of local scoping is that local traffic stays local.";
  }

  function render() {
    renderPickNote();
    renderFirmwareHints();

    if (!current) {
      els.outputPanel.hidden = true;
      els.clientPanel.hidden = true;
      return;
    }

    var built = buildCommands(current);

    els.outputPanel.hidden = false;
    els.clientPanel.hidden = false;

    renderChain(built.chain);
    // Only the generated view is refreshed. An edit in progress is left exactly
    // as typed, and the note explains that it no longer matches the selection.
    els.commands.textContent = built.lines.join("\n");
    if (edited === null && isEditing()) {
      els.commandsEdit.value = built.lines.join("\n");
      autoGrow();
    }
    renderEditNote();
    renderLineNote(built);
    renderVerify(built);
    renderExplain(built);
    renderScopes(built.chain, built.tagChains);

    els.copy.classList.remove("done");
    els.copy.textContent = "Copy";

    notify();
  }

  function renderFirmwareHints() {
    var c = caps();

    els.fwHint.textContent = FW_HINTS[c.version] || "";

    els.duty.disabled = false;
    if (c.dutycycle) {
      els.dutyHint.textContent =
        "The US 902–928 MHz ISM band has no duty cycle restriction, so 100 (no limit) is " +
        "the normal California setting. Default is 50.";
    } else {
      els.dutyHint.textContent =
        "On this firmware the duty cycle is set indirectly with set af, which allows only " +
        "1/(1+af) steps. " + dutyValue() + "% rounds to set af " + afValue() +
        " (about " + afDuty() + "%).";
    }

    els.hash.disabled = !c.hashMode;
    els.hashHint.textContent = c.hashMode
      ? "2 bytes is recommended so repeaters stay uniquely identifiable as the mesh grows. " +
        "Nodes on 1.13 and older drop adverts with multi-byte hashes."
      : "set path.hash.mode arrived in firmware 1.14, so it is left out entirely on this " +
        "version. Adverts use the 1-byte hash.";

    els.loop.disabled = !c.loopDetect;
    els.loopHint.textContent = c.loopDetect
      ? "Rejects a flood packet that already carries this repeater's own id in its path — " +
        "the signature of one going round in circles. Without it, a single node re-forwarding " +
        "mangled packets can start a storm that runs to the 64-hop limit. The firmware " +
        "default is off; how many repeats each mode tolerates depends on the path hash size " +
        "of the packet being judged, not on the setting above."
      : "set loop.detect arrived in firmware 1.14, so it is left out entirely on this version.";

    var flood = floodValue();
    els.floodHint.textContent = flood === null
      ? "Blank, so the repeater's existing interval is left alone."
      : flood === 0
        ? "0 stops flood adverts entirely. The repeater will still answer, but it won't " +
          "announce itself to the whole mesh."
        : (flood < 3 || flood > 168)
          ? "The firmware only accepts 3–168 hours, or 0 to turn flood adverts off. " +
            flood + " will be rejected."
          : "How often the repeater floods an advert to the whole mesh. The firmware's own " +
            "default is 12 hours and it accepts 3–168; 24 halves that traffic while still " +
            "keeping the node discoverable.";

    renderOwnerHint(c);
  }

  function renderOwnerHint(c) {
    var owner = ownerValue();

    var what =
      "Free text the repeater carries so whoever finds it on the mesh can work out who runs " +
      "it — an email address, a Discord handle, a callsign, a URL. Anyone who can query the " +
      "node reads it back, so treat it as public.";

    if (!owner) {
      els.ownerHint.textContent = what +
        " Blank, so nothing is sent and the repeater keeps whatever it already has.";
      return;
    }

    els.ownerHint.textContent = what +
      " A | becomes a line break where it is displayed. Up to " + els.owner.maxLength +
      " characters here, which keeps the command inside the " + MAX_LINE +
      "-character serial line." +
      (c.ownerInfoUncertain
        ? " set owner.info arrived in firmware 1.12, so on 1.10 or 1.11 it comes back unknown —" +
          " drop that line if it does."
        : "");
  }

  function renderChain(chain) {
    els.chain.textContent = "";
    chain.forEach(function (c) {
      var tok = el("span", "tok", c.code);
      tok.title = c.label;
      var li = document.createElement("li");
      li.appendChild(tok);
      els.chain.appendChild(li);
    });
  }

  function renderLineNote(built) {
    var longest = built.regionLines.reduce(function (a, b) {
      return b.length > a.length ? b : a;
    }, "");
    var over = longest.length > MAX_LINE;

    // A node holds MAX_REGIONS names, full stop. Going over does not fail
    // cleanly: region put/def places names until the table is full and then
    // replies "Err - put failed", leaving the node half configured. Easy to
    // reach now that several places can be picked — ten picks three levels
    // deep, in ten separate branches, is already past it.
    var names = {};
    built.chains.forEach(function (chain) {
      chain.forEach(function (t) { names[t.code] = true; });
    });
    var count = Object.keys(names).length;

    if (count > MAX_REGIONS) {
      els.lineNote.className = "line-note over";
      els.lineNote.textContent =
        "This needs " + count + " region names, and a node holds " + MAX_REGIONS +
        ". The repeater will place what fits and then reject the rest, leaving it " +
        "half configured — pick fewer places.";
      return;
    }

    els.lineNote.className = "line-note" + (over ? " over" : "");

    if (over) {
      els.lineNote.textContent =
        "The region def line is " + longest.length + " characters, over the " + MAX_LINE +
        "-character serial limit. Split it across two commands.";
    } else if (built.caps.regionDef) {
      els.lineNote.textContent =
        "region def line: " + longest.length + " of " + MAX_LINE + " characters, " +
        count + " of " + MAX_REGIONS + " region names.";
    } else {
      els.lineNote.textContent =
        built.regionLines.length + " region commands, longest " + longest.length +
        " of " + MAX_LINE + " characters. Paste them in order — each name needs its " +
        "parent to already exist.";
    }
  }

  function renderVerify(built) {
    els.verifyBlock.textContent = "";
    if (!els.verify.checked) { return; }

    var lines = ["ver"];
    lines.push(built.caps.regionList ? "region list allowed" : "region");
    built.chains.forEach(function (ch) {
      lines.push("region get " + ch[ch.length - 1].code);
    });
    lines.push(built.caps.dutycycle ? "get dutycycle" : "get af");
    if (built.caps.hashMode) { lines.push("get path.hash.mode"); }
    if (built.caps.floodAdvert && floodValue() !== null) { lines.push("get flood.advert.interval"); }
    if (built.caps.loopDetect && els.loop.value) { lines.push("get loop.detect"); }
    if (built.caps.ownerInfo && ownerValue()) { lines.push("get owner.info"); }

    var block = el("div", "code-block");
    block.style.marginTop = "14px";

    var head = el("div", "code-head");
    head.appendChild(el("span", "code-title", "Check it worked"));
    block.appendChild(head);

    var pre = el("pre", null, lines.join("\n"));
    pre.tabIndex = 0;
    block.appendChild(pre);

    els.verifyBlock.appendChild(block);
    els.verifyBlock.appendChild(el("p", "line-note",
      (built.caps.regionList
        ? "region list allowed prints every region that may flood. "
        : "region prints the whole tree (serial only on this firmware). ") +
      "region get " + built.leaf + " confirms the leaf exists and is flood-allowed (F)."));
  }

  function renderExplain(built) {
    var chainCodes = built.chain.map(function (c) { return c.code; });
    var items = [];

    if (built.caps.dutycycle) {
      items.push(["set dutycycle " + dutyValue(),
        dutyValue() === 100
          ? "Removes the transmit duty cycle cap. The US 902–928 MHz ISM band has no duty cycle limit, unlike EU 868 MHz. Default is 50."
          : "Caps transmit airtime at " + dutyValue() + "%. Default is 50."]);
    } else {
      items.push(["set af " + afValue(),
        afValue() === 0
          ? "Airtime factor 0 — no enforced silent period after transmitting, so no duty cycle limit. This is the pre-1.15 equivalent of set dutycycle 100."
          : "Airtime factor " + afValue() + " — after each transmission the node stays silent for " +
            afValue() + "× the airtime, giving roughly a " + afDuty() + "% duty cycle."]);
    }

    if (built.caps.hashMode) {
      items.push(["set path.hash.mode " + els.hash.value,
        HASH_WHY[els.hash.value] || HASH_WHY["1"]]);
    }

    if (built.caps.floodAdvert && floodValue() !== null) {
      items.push(["set flood.advert.interval " + floodValue(),
        floodValue() === 0
          ? "Stops the repeater flooding adverts to the whole mesh. It still answers and still repeats, but nothing outside its immediate neighbours learns it exists on its own."
          : "Floods an advert to the whole mesh every " + floodValue() + " hours, so distant nodes can " +
            "discover it and build a path. Every repeater rebroadcasts these, so the cost is paid mesh-wide. " +
            "The firmware defaults to 12 hours and accepts 3–168."]);
    }

    if (built.caps.loopDetect && els.loop.value) {
      items.push(["set loop.detect " + els.loop.value, LOOP_WHY[els.loop.value]]);
    }

    if (built.caps.ownerInfo && ownerValue()) {
      items.push(["set owner.info " + ownerValue(),
        "Stores your contact details on the repeater, so someone seeing it on the mesh can " +
        "reach you about it. It is readable by anyone who can query the node, and a | is " +
        "shown as a line break." +
        (built.caps.ownerInfoUncertain
          ? " This command needs firmware 1.12; 1.10 and 1.11 will reject it."
          : "")]);
    }

    if (built.caps.regionDef) {
      items.push([built.regionLines[0],
        "Builds the region chain " + chainCodes.join(" → ") +
        ", each name a child of the one before it. The repeater replies with the resulting tree — read it before saving."]);
    } else {
      items.push(["region put <name> [parent]  ×" + chainCodes.length,
        "Builds the same chain " + chainCodes.join(" → ") + " one name at a time. " +
        "The first, " + chainCodes[0] + ", takes no parent argument, so it lands under the reserved root *." +
        (built.caps.explicitAllowf ? "" : " Each region is flood-allowed as it is created.")]);
      if (built.caps.explicitAllowf) {
        items.push(["region allowf <name>  ×" + chainCodes.length,
          "Permits flooding for each name. On this firmware region put does not do it for you, so without these the regions exist but drop scoped traffic."]);
      }
    }

    if (els.home.checked) {
      items.push(["region home " + built.leaf,
        "Tells the node which of its regions it physically sits in."]);
      items.push(["region default " + built.leaf,
        "The scope stamped on traffic this node originates when none is specified."]);
    }

    items.push(["region save",
      "Persists the region tree. Without this, everything above is lost on reboot."]);

    var dl = document.createElement("dl");
    items.forEach(function (pair) {
      dl.appendChild(el("dt", null, pair[0]));
      dl.appendChild(el("dd", null, pair[1]));
    });

    els.explain.textContent = "";
    els.explain.appendChild(dl);
  }

  function renderScopes(chain, tagChains) {
    els.scopeList.textContent = "";

    var scopeRow = function (code, text) {
      var li = document.createElement("li");
      li.appendChild(el("span", "s-code", code));
      li.appendChild(document.createTextNode(" — " + text));
      els.scopeList.appendChild(li);
    };

    // A tag is not part of the chain and is wider than any one level of it, so
    // it goes above rather than being slotted in by depth.
    (tagChains || []).forEach(function (ch) {
      var tag = ch[ch.length - 1];
      scopeRow(tag.code, tag.label + " (carried alongside, not part of the chain)");
    });

    // Widest first reads more naturally as "how far do you want this to go".
    chain.slice().reverse().forEach(function (c, i) {
      scopeRow(c.code, c.label + (i === 0 ? " (your immediate area)" : ""));
    });
  }

  /* ---------- copy ---------- */

  els.copy.addEventListener("click", function () {
    // Copy what is on screen, which is the edited text when there is one.
    var built = window.SettingsState.get();
    var text = built ? built.lines.join("\n") : els.commands.textContent;
    var done = function () {
      els.copy.textContent = "Copied";
      els.copy.classList.add("done");
      setTimeout(function () {
        els.copy.textContent = "Copy";
        els.copy.classList.remove("done");
      }, 1600);
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, fallbackCopy);
    } else {
      fallbackCopy();
    }

    function fallbackCopy() {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); done(); } catch (e) { /* user can select manually */ }
      document.body.removeChild(ta);
    }
  });

  /* ---------- options ---------- */

  [els.duty, els.hash, els.home, els.verify, els.fw, els.loop, els.flood, els.owner]
    .forEach(function (input) { input.addEventListener("change", render); });
  // The typed fields re-render as you go, rather than waiting for a blur.
  [els.duty, els.flood, els.owner]
    .forEach(function (input) { input.addEventListener("input", render); });

  /* ---------- boot ---------- */

  renderScope();
  renderPicker();
  render();

  // The hash carries every pick, comma separated, so a link to a bridging site
  // restores the whole set rather than just its first tag.
  function fromHash() {
    return decodeURIComponent(location.hash.replace(/^#/, ""))
      .split(",")
      .map(function (c) { return byCode[c.trim()]; })
      .filter(Boolean);
  }

  function applyHash(entries) {
    if (!entries.length) { return; }
    els.search.value = entries.length === 1 ? entries[0].name : "";
    selectEntries(entries, { keepHash: true });
  }

  applyHash(fromHash());

  window.addEventListener("hashchange", function () {
    var entries = fromHash();
    // Ignore the hash we just wrote ourselves.
    if (entries.length && entries.map(function (e) { return e.code; }).join(",") !==
        chosen().map(function (e) { return e.code; }).join(",")) {
      applyHash(entries);
    }
  });
});
