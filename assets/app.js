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
    hashHint: $("hash-hint")
  };

  /* ---------- firmware capabilities ---------- */

  // Version gates, from the MeshCore CLI reference:
  //   1.10  region put / allowf / save
  //   1.12  region list {allowed|denied}
  //   1.14  set path.hash.mode
  //   1.15  set dutycycle (set af deprecated)
  //   1.16  region def
  function caps() {
    var v = parseInt(els.fw.value, 10);
    return {
      version: v,
      regionDef: v >= 116,
      dutycycle: v >= 115,
      hashMode: v >= 114,
      regionList: v >= 112
    };
  }

  var FW_HINTS = {
    116: "Everything current: the whole chain goes in one region def line.",
    115: "region def landed in 1.16, so the chain is built with region put / region allowf pairs instead.",
    114: "Predates set dutycycle (1.15), so the duty cycle is set with the older set af airtime factor.",
    110: "Predates set dutycycle (1.15) and set path.hash.mode (1.14), so both are handled differently or skipped."
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

  function buildCommands(entry) {
    var c = caps();
    var chain = chainOf(entry);
    var codes = chain.map(function (x) { return x.code; });
    var leaf = codes[codes.length - 1];

    var lines = [];

    lines.push(c.dutycycle ? "set dutycycle " + dutyValue() : "set af " + afValue());
    if (c.hashMode) { lines.push("set path.hash.mode " + els.hash.value); }

    // The region block, in whichever form this firmware understands.
    var regionLines = [];
    if (c.regionDef) {
      regionLines.push("region def " + codes.join(" "));
    } else {
      codes.forEach(function (code, i) {
        // No parent argument on the first token: region put defaults to the
        // wildcard root, which is exactly where the chain starts.
        regionLines.push(i === 0 ? "region put " + code : "region put " + code + " " + codes[i - 1]);
        regionLines.push("region allowf " + code);
      });
    }
    lines = lines.concat(regionLines);

    if (els.home.checked) {
      lines.push("region home " + leaf);
      lines.push("region default " + leaf);
    }
    lines.push("region save");

    return { lines: lines, regionLines: regionLines, chain: chain, leaf: leaf, caps: c };
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
    els.commands.textContent = built.lines.join("\n");
    renderLineNote(built);
    renderVerify(built);
    renderExplain(built);
    renderScopes(built.chain);

    els.copy.classList.remove("done");
    els.copy.textContent = "Copy";
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
    lines.push("region get " + built.leaf);
    lines.push(built.caps.dutycycle ? "get dutycycle" : "get af");
    if (built.caps.hashMode) { lines.push("get path.hash.mode"); }

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

    if (built.caps.regionDef) {
      items.push([built.regionLines[0],
        "Builds the region chain " + chainCodes.join(" → ") +
        ", each name a child of the one before it. The repeater replies with the resulting tree — read it before saving."]);
    } else {
      items.push(["region put <name> [parent]  ×" + chainCodes.length,
        "Builds the same chain " + chainCodes.join(" → ") + " one name at a time. " +
        "The first, " + chainCodes[0] + ", takes no parent argument, so it lands under the wildcard root."]);
      items.push(["region allowf <name>  ×" + chainCodes.length,
        "Permits flooding for each name. region put allows flooding by default, but setting it explicitly is harmless and makes the config self-documenting."]);
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
    var text = els.commands.textContent;
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

  [els.duty, els.hash, els.home, els.verify, els.fw].forEach(function (el) {
    el.addEventListener("change", render);
  });
  els.duty.addEventListener("input", render);

  /* ---------- boot ---------- */

  fillRegions();
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
