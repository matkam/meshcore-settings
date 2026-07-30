/* California MeshCore repeater settings generator. No dependencies. */
(function () {
  "use strict";

  var DATA = window.CA_REGIONS;
  var ROOT = DATA.meta.root;
  var ROOT_LABELS = DATA.meta.rootLabels || {};
  var MAX_LINE = DATA.meta.maxLineLength || 160;

  var $ = function (id) { return document.getElementById(id); };

  var els = {
    search: $("search"),
    results: $("results"),
    region: $("sel-region"),
    county: $("sel-county"),
    area: $("sel-area"),
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
    role: $("opt-role"),
    roleHint: $("role-hint"),
    bridge: $("opt-bridge"),
    bridgeField: $("bridge-field"),
    bridgeHint: $("bridge-hint")
  };

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

  /* ---------- index ---------- */

  // Flat, searchable list of everything selectable, at all three levels.
  var index = [];
  var byCode = {};

  DATA.regions.forEach(function (region) {
    var rEntry = { level: "region", code: region.code, name: region.name,
                   context: "California region", region: region, terms: [] };
    index.push(rEntry);

    region.counties.forEach(function (county) {
      index.push({ level: "county", code: county.code, name: county.name,
                   context: region.name, region: region, county: county, terms: [] });

      (county.areas || []).forEach(function (area) {
        index.push({ level: "area", code: area.code, name: area.name,
                     context: county.name + " · " + region.name,
                     region: region, county: county, area: area,
                     terms: (area.cities || []).slice() });
      });
    });
  });

  index.forEach(function (e) {
    e.haystack = [e.name, e.code, e.context].concat(e.terms).join(" ").toLowerCase();
    byCode[e.code] = e;
  });

  /* ---------- selection state ---------- */

  var current = null;
  var settingsListeners = [];

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

    // Local areas closest to a position, nearest first, for "where is this
    // repeater?". Centroids are approximate and areas can sit a few km apart, so
    // callers offer a shortlist rather than a single answer. `spreadKm` drops a
    // runner-up that is further than that beyond the winner — past which it is no
    // longer a plausible alternative reading of the same position.
    nearestAreas: function (lat, lon, count, spreadKm) {
      var hits = [];
      index.forEach(function (e) {
        if (e.level !== "area") { return; }
        hits.push({ entry: e, km: haversineKm(lat, lon, e.area.lat, e.area.lon) });
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

    firmwareTier: function () { return els.fw.value; }
  };

  /* ---------- editing the commands ----------
   *
   * `edited` is null while the block is just showing what the generator made.
   * Once someone types, it holds their text and becomes the source of truth for
   * copying and for the over-the-air push.
   *
   * Changing the area or the options after that does NOT overwrite it. Throwing
   * away something a person typed is never worth the tidiness — the generated
   * version is one click away, and until then a note says plainly that the two
   * have diverged.
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

  els.editBtn.addEventListener("click", function () {
    if (isEditing()) {
      setEditing(false);
    } else {
      setEditing(true);
    }
  });

  els.commandsEdit.addEventListener("input", function () {
    edited = els.commandsEdit.value;
    autoGrow();
    renderEditNote();
    // The push panel watches this to keep its own state honest.
    settingsListeners.forEach(function (fn) { fn(window.SettingsState.get()); });
  });

  els.resetBtn.addEventListener("click", stopEditing);

  function haversineKm(lat1, lon1, lat2, lon2) {
    var R = 6371;
    var toRad = function (d) { return (d * Math.PI) / 180; };
    var dLat = toRad(lat2 - lat1);
    var dLon = toRad(lon2 - lon1);
    var s = Math.pow(Math.sin(dLat / 2), 2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.pow(Math.sin(dLon / 2), 2);
    return 2 * R * Math.asin(Math.sqrt(s));
  }

  function selectEntry(entry, opts) {
    current = entry;
    syncSelects();
    render();
    if (!opts || !opts.keepHash) {
      var hash = "#" + entry.code;
      if (location.hash !== hash) history.replaceState(null, "", hash);
    }
  }

  /* ---------- selects ---------- */

  function option(value, label) {
    var o = document.createElement("option");
    o.value = value;
    o.textContent = label;
    return o;
  }

  // Every area in the state, grouped by county, for the bridge case. A second
  // tag is only ever a peer area — bridging is about two local communities, not
  // about reaching further up the tree.
  function fillBridge() {
    els.bridge.appendChild(option("", "Choose the other area…"));
    DATA.regions.forEach(function (region) {
      region.counties.forEach(function (county) {
        if (!county.areas || !county.areas.length) { return; }
        var group = document.createElement("optgroup");
        group.label = county.name + " · " + region.name;
        county.areas.forEach(function (a) {
          group.appendChild(option(a.code, a.name));
        });
        els.bridge.appendChild(group);
      });
    });
  }

  function fillRegions() {
    els.region.appendChild(option("", "Choose a region…"));
    DATA.regions.forEach(function (r) {
      els.region.appendChild(option(r.code, r.name));
    });
  }

  function fillCounties(region, selected) {
    els.county.textContent = "";
    els.county.disabled = !region;
    els.county.appendChild(option("", region ? "Region-wide" : "—"));
    if (!region) { return; }
    region.counties.forEach(function (c) {
      els.county.appendChild(option(c.code, c.name));
    });
    els.county.value = selected || "";
  }

  function fillAreas(county, selected) {
    els.area.textContent = "";
    els.area.disabled = !county;
    els.area.appendChild(option("", county ? "County-wide" : "—"));
    if (!county) { return; }
    (county.areas || []).forEach(function (a) {
      els.area.appendChild(option(a.code, a.name));
    });
    els.area.value = selected || "";
  }

  function syncSelects() {
    if (!current) { return; }
    els.region.value = current.region.code;
    fillCounties(current.region, current.county ? current.county.code : "");
    fillAreas(current.county, current.area ? current.area.code : "");
  }

  els.region.addEventListener("change", function () {
    var region = DATA.regions.filter(function (r) { return r.code === els.region.value; })[0];
    if (!region) {
      current = null;
      fillCounties(null);
      fillAreas(null);
      render();
      return;
    }
    selectEntry(byCode[region.code]);
  });

  els.county.addEventListener("change", function () {
    if (!current) { return; }
    var code = els.county.value;
    selectEntry(code ? byCode[code] : byCode[current.region.code]);
  });

  els.area.addEventListener("change", function () {
    if (!current || !current.county) { return; }
    var code = els.area.value;
    selectEntry(code ? byCode[code] : byCode[current.county.code]);
  });

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
      var depth = e.level === "area" ? 0 : e.level === "county" ? 1 : 2;
      hits.push({ entry: e, sort: s * 10 + depth });
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
      var none = document.createElement("li");
      none.className = "empty";
      none.textContent = 'No match for "' + q.trim() + '". Try a county or nearby town.';
      els.results.appendChild(none);
    }

    shown.forEach(function (entry, i) {
      var li = document.createElement("li");
      li.setAttribute("role", "option");
      li.id = "result-" + i;

      var name = document.createElement("span");
      name.className = "r-name";
      name.textContent = entry.name;
      li.appendChild(name);

      var code = document.createElement("span");
      code.className = "r-code";
      code.textContent = "  " + entry.code;
      li.appendChild(code);

      var ctx = document.createElement("span");
      ctx.className = "r-ctx";
      var city = matchedCity(entry, q);
      ctx.textContent = city ? city + " — " + entry.context : entry.context;
      li.appendChild(ctx);

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
    var chain = ROOT.map(function (code) {
      return { code: code, label: ROOT_LABELS[code] || code };
    });
    chain.push({ code: entry.region.code, label: entry.region.name });
    if (entry.county) { chain.push({ code: entry.county.code, label: entry.county.name }); }
    if (entry.area) { chain.push({ code: entry.area.code, label: entry.area.name }); }
    return chain;
  }

  function dutyValue() {
    var v = parseInt(els.duty.value, 10);
    if (isNaN(v) || v < 1) { v = 1; }
    if (v > 100) { v = 100; }
    return v;
  }

  // Older firmware sets duty cycle indirectly: after each transmission the node
  // stays silent for airtime * af, giving a long-term duty of about 1/(1+af).
  function afValue() {
    var af = Math.round(100 / dutyValue() - 1);
    if (af < 0) { af = 0; }
    if (af > 9) { af = 9; }
    return af;
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
    if (isNaN(v)) { return null; }
    if (v < 0) { v = 0; }
    if (v > 168) { v = 168; }
    return v;
  }

  /* ---------- site role ----------
   *
   * From the PNW region strategy's treatment of backbone and high-site
   * repeaters. The principle it turns on is that RF reach is not a scope
   * boundary: a mountaintop node is heard far past the areas it carries tags
   * for, but it only ever forwards traffic matching a tag it holds, and a
   * non-matching neighbour will not re-forward it. So the question a high site
   * has to answer is not where it is, but whose local traffic should cross it.
   *
   * Note what this deliberately does NOT do: it does not strip tags from small
   * nodes. Limited range is not a reason to carry less. A neighbourhood repeater
   * should hold the same full ancestry as a backbone one — omitting a tag only
   * cuts off the devices that reach the mesh through it, and the wide-scope
   * traffic it then relays is rare by design.
   */

  function role() { return els.role.value; }

  // The chains this node should carry. Usually one; a bridge carries two.
  function chainsFor(entry) {
    var primary = chainOf(entry);

    if (role() === "longhaul") {
      // Strategy 1: ancestry to the state level and no further, so state-wide
      // and mesh-wide traffic crosses the link but neither end's local chatter
      // does. ROOT is west + ca.
      return [primary.slice(0, ROOT.length)];
    }

    if (role() === "bridge") {
      var second = byCode[els.bridge.value];
      // An unset or nonsensical second area is just the ordinary case.
      if (second && second.code !== entry.code) {
        return [primary, chainOf(second)];
      }
    }

    return [primary];
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
      .replace(/\s+$/, "")
      .replace(/^\s+/, "");
  }

  function buildCommands(entry) {
    var c = caps();
    var chains = chainsFor(entry);
    var chain = chains[0];
    var codes = chain.map(function (x) { return x.code; });
    var leaf = codes[codes.length - 1];

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
    var placed = {};
    chains.forEach(function (ch) {
      var chCodes = ch.map(function (x) { return x.code; });
      if (c.regionDef) {
        // A separate def line per chain: the cursor resets to the root between
        // commands, and re-stating a name only updates its parent to the same
        // value, so the two lines compose without clobbering each other.
        regionLines.push("region def " + chCodes.join(" "));
        return;
      }
      chCodes.forEach(function (code, i) {
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
    lines = lines.concat(regionLines);

    if (els.home.checked) {
      lines.push("region home " + leaf);
      lines.push("region default " + leaf);
    }
    lines.push("region save");

    return { lines: lines, regionLines: regionLines, chain: chain, chains: chains,
             leaf: leaf, caps: c, role: role() };
  }

  /* ---------- render ---------- */

  function render() {
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
    renderScopes(built.chain);

    els.copy.classList.remove("done");
    els.copy.textContent = "Copy";

    // Listeners get what will actually be sent, edits included.
    var shown = window.SettingsState.get();
    settingsListeners.forEach(function (fn) { fn(shown); });
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

    els.bridgeField.hidden = role() !== "bridge";
    els.roleHint.textContent = role() === "longhaul"
      ? "Carries " + ROOT.join(" and ") + " only. State-wide and mesh-wide traffic crosses the " +
        "link; neither end's local chatter does. For a dedicated relay between distant areas, " +
        "not for a high site that serves somewhere."
      : role() === "bridge"
        ? "Carries a second area's chain as well, so local traffic crosses between the two. " +
          "Use it sparingly — if many high sites do this, local scoping stops meaning anything."
        : "The normal answer, and the right one for almost everything: carry the full chain. " +
          "A short-range node needs it as much as a mountaintop does — dropping a tag only cuts " +
          "off the devices that reach the mesh through you.";

    els.bridgeHint.textContent = els.bridge.value
      ? "Both areas' traffic will cross this repeater. The areas either side still won't " +
        "re-forward each other's, so it stops one hop past you."
      : "Pick the other area this site genuinely bridges. Until then it behaves as a normal site.";

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
      var li = document.createElement("li");
      var tok = document.createElement("span");
      tok.className = "tok";
      tok.textContent = c.code;
      tok.title = c.label;
      li.appendChild(tok);
      els.chain.appendChild(li);
    });
  }

  function renderLineNote(built) {
    var longest = built.regionLines.reduce(function (a, b) {
      return b.length > a.length ? b : a;
    }, "");
    var over = longest.length > MAX_LINE;

    els.lineNote.className = "line-note" + (over ? " over" : "");

    if (over) {
      els.lineNote.textContent =
        "The region def line is " + longest.length + " characters, over the " + MAX_LINE +
        "-character serial limit. Split it across two commands.";
    } else if (built.caps.regionDef) {
      els.lineNote.textContent =
        "region def line: " + longest.length + " of " + MAX_LINE + " characters.";
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

    var block = document.createElement("div");
    block.className = "code-block";
    block.style.marginTop = "14px";

    var head = document.createElement("div");
    head.className = "code-head";
    var title = document.createElement("span");
    title.className = "code-title";
    title.textContent = "Check it worked";
    head.appendChild(title);
    block.appendChild(head);

    var pre = document.createElement("pre");
    pre.tabIndex = 0;
    pre.textContent = lines.join("\n");
    block.appendChild(pre);

    els.verifyBlock.appendChild(block);

    var note = document.createElement("p");
    note.className = "line-note";
    note.textContent =
      (built.caps.regionList
        ? "region list allowed prints every region that may flood. "
        : "region prints the whole tree (serial only on this firmware). ") +
      "region get " + built.leaf + " confirms the leaf exists and is flood-allowed (F).";
    els.verifyBlock.appendChild(note);
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
      items.push(["set path.hash.mode " + els.hash.value, hashExplanation(els.hash.value)]);
    }

    if (built.role === "longhaul") {
      items.push(["(no local tags)",
        "This site is set up as a dedicated long-haul link, so the chain stops at " +
        ROOT.join(" / ") + ". It relays state-wide and mesh-wide traffic between distant areas " +
        "without carrying either end's local conversation. RF reach is not a scope boundary: a " +
        "local message forwarded into non-matching territory dies one hop later, because the next " +
        "repeater does not carry the tag."]);
    } else if (built.role === "bridge" && built.chains.length > 1) {
      var other = built.chains[1];
      items.push(["region " + (built.caps.regionDef ? "def" : "put") + " … " +
                  other[other.length - 1].code,
        "A second chain, so this site carries " + other[other.length - 1].label +
        " as well as " + built.chain[built.chain.length - 1].label +
        ". Local traffic for both crosses this repeater. The repeaters either side still won't " +
        "re-forward each other's, so it travels one hop into the neighbouring area and stops."]);
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
      // Thresholds are per the CLI reference. They key off the path hash size of
      // the packet being judged — not this node's path.hash.mode, which only
      // governs the hashes it stamps on its own adverts.
      var LOOP_WHY = {
        off: "No loop detection: a flood packet is forwarded again even if this repeater's own id is already in its path. This is the firmware default.",
        minimal: "Rejects a flood packet once this repeater's own id already appears 4 times in a 1-byte path, twice in a 2-byte path, or once in a 3-byte path. The most forgiving setting.",
        moderate: "Rejects a flood packet once this repeater's own id already appears twice in a 1-byte path, or once in a 2- or 3-byte path. A packet that has been through here and come back is dropped rather than repeated.",
        strict: "Rejects a flood packet the moment this repeater's own id appears in its path at all, whatever the hash size. The least likely to let a loop through, and the most likely to drop a legitimate re-flood."
      };
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
      var dt = document.createElement("dt");
      dt.textContent = pair[0];
      var dd = document.createElement("dd");
      dd.textContent = pair[1];
      dl.appendChild(dt);
      dl.appendChild(dd);
    });

    els.explain.textContent = "";
    els.explain.appendChild(dl);
  }

  function hashExplanation(mode) {
    if (mode === "0") {
      return "1-byte advert path hash: 256 unique ids, up to 64 flood hops. This is the firmware default and the safest for meshes still running 1.13 or older.";
    }
    if (mode === "2") {
      return "3-byte advert path hash: 16.7 million unique ids, but only 21 flood hops, and nodes older than 1.14 drop these adverts. Only worth it in very dense meshes.";
    }
    return "2-byte advert path hash: 65,536 unique ids instead of 256, so repeaters stay distinguishable as the mesh grows. Costs a little flood range (32 hops) and needs firmware 1.14+.";
  }

  function renderScopes(chain) {
    els.scopeList.textContent = "";
    // Widest first reads more naturally as "how far do you want this to go".
    chain.slice().reverse().forEach(function (c, i) {
      var li = document.createElement("li");
      var code = document.createElement("span");
      code.className = "s-code";
      code.textContent = c.code;
      li.appendChild(code);
      li.appendChild(document.createTextNode(
        " — " + c.label + (i === 0 ? " (your immediate area)" : "")
      ));
      els.scopeList.appendChild(li);
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

  [els.duty, els.hash, els.home, els.verify, els.fw, els.loop, els.flood, els.owner,
   els.role, els.bridge].forEach(function (el) { el.addEventListener("change", render); });
  els.duty.addEventListener("input", render);
  els.flood.addEventListener("input", render);
  els.owner.addEventListener("input", render);

  /* ---------- boot ---------- */

  fillRegions();
  fillBridge();
  fillCounties(null);
  fillAreas(null);
  render();

  var initial = byCode[decodeURIComponent(location.hash.replace(/^#/, ""))];
  if (initial) {
    els.search.value = initial.name;
    selectEntry(initial, { keepHash: true });
  }

  window.addEventListener("hashchange", function () {
    var entry = byCode[decodeURIComponent(location.hash.replace(/^#/, ""))];
    if (entry && entry !== current) {
      els.search.value = entry.name;
      selectEntry(entry, { keepHash: true });
    }
  });
})();
