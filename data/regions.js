/*
 * California MeshCore region tree.
 *
 * Hierarchy: west > ca > <region> > <county> > <local area>
 *
 * Every `code` must be unique across the WHOLE file. MeshCore region names are
 * a flat namespace on the node -- two different places sharing a code will
 * collide on any repeater that carries both. `npm run validate` enforces this.
 *
 * Codes are lowercase, short (<= 4 chars where possible), and stable: once a
 * code is in use on real hardware, renaming it breaks every node that has it.
 *
 * `cities` are search aliases only. They never appear in the generated
 * commands -- they exist so someone can type "Paso Robles" and find `prb`.
 */
window.CA_REGIONS = {
  meta: {
    // Prefix applied to every generated chain.
    root: ["west", "ca"],
    rootLabels: { west: "Western US", ca: "California" },
    // Repeater serial accepts one line up to 160 characters.
    maxLineLength: 160,
  },

  regions: [
    {
      code: "nco",
      name: "North Coast",
      blurb: "Redwood coast from the Oregon line down to Lake County.",
      counties: [
        {
          code: "dnr",
          name: "Del Norte County",
          areas: [
            { code: "cre", name: "Crescent City", cities: ["Crescent City", "Smith River", "Klamath", "Gasquet"] },
          ],
        },
        {
          code: "hum",
          name: "Humboldt County",
          areas: [
            { code: "eka", name: "Humboldt Bay", cities: ["Eureka", "Arcata", "McKinleyville", "Fortuna", "Ferndale", "Trinidad"] },
            { code: "shu", name: "Southern Humboldt", cities: ["Garberville", "Redway", "Miranda", "Shelter Cove"] },
            { code: "hoo", name: "Hoopa / Willow Creek", cities: ["Hoopa", "Willow Creek", "Orleans"] },
          ],
        },
        {
          code: "trn",
          name: "Trinity County",
          areas: [
            { code: "wvl", name: "Weaverville", cities: ["Weaverville", "Hayfork", "Lewiston", "Trinity Center"] },
          ],
        },
        {
          code: "men",
          name: "Mendocino County",
          areas: [
            { code: "ukh", name: "Ukiah Valley", cities: ["Ukiah", "Willits", "Hopland", "Redwood Valley"] },
            { code: "fbg", name: "Mendocino Coast", cities: ["Fort Bragg", "Mendocino", "Point Arena", "Albion"] },
          ],
        },
        {
          code: "lak",
          name: "Lake County",
          areas: [
            { code: "clk", name: "Clear Lake", cities: ["Clearlake", "Lakeport", "Kelseyville", "Middletown"] },
          ],
        },
      ],
    },

    {
      code: "nor",
      name: "North State / Shasta Cascade",
      blurb: "The far northeast: Shasta, Siskiyou, Lassen, Modoc, Plumas, Tehama.",
      counties: [
        {
          code: "sis",
          name: "Siskiyou County",
          areas: [
            { code: "yrk", name: "Yreka", cities: ["Yreka", "Montague", "Fort Jones", "Happy Camp"] },
            { code: "mts", name: "Mount Shasta", cities: ["Mount Shasta", "Weed", "Dunsmuir", "McCloud"] },
            { code: "tul2", name: "Tulelake Basin", cities: ["Tulelake", "Dorris", "Macdoel"] },
          ],
        },
        {
          code: "mdc",
          name: "Modoc County",
          areas: [
            { code: "alt", name: "Alturas", cities: ["Alturas", "Cedarville", "Adin", "Canby"] },
          ],
        },
        {
          code: "sha",
          name: "Shasta County",
          areas: [
            { code: "rdg", name: "Redding Area", cities: ["Redding", "Anderson", "Shasta Lake", "Palo Cedro", "Cottonwood"] },
            { code: "bur", name: "Intermountain", cities: ["Burney", "Fall River Mills", "McArthur", "Round Mountain"] },
          ],
        },
        {
          code: "las",
          name: "Lassen County",
          areas: [
            { code: "sus", name: "Susanville", cities: ["Susanville", "Janesville", "Bieber", "Herlong"] },
          ],
        },
        {
          code: "teh",
          name: "Tehama County",
          areas: [
            { code: "rbf", name: "Red Bluff / Corning", cities: ["Red Bluff", "Corning", "Los Molinos", "Mineral"] },
          ],
        },
        {
          code: "plu",
          name: "Plumas County",
          areas: [
            { code: "qcy", name: "Quincy / Portola", cities: ["Quincy", "Portola", "Chester", "Graeagle", "Lake Almanor"] },
          ],
        },
      ],
    },

    {
      code: "sv",
      name: "Sacramento Valley",
      blurb: "Sacramento and the valley floor north of the Delta.",
      counties: [
        {
          code: "but",
          name: "Butte County",
          areas: [
            { code: "chi", name: "Chico", cities: ["Chico", "Durham", "Hamilton City"] },
            { code: "orv", name: "Oroville", cities: ["Oroville", "Palermo", "Thermalito", "Gridley", "Biggs"] },
            { code: "par", name: "Paradise Ridge", cities: ["Paradise", "Magalia", "Concow", "Stirling City"] },
          ],
        },
        {
          code: "gle",
          name: "Glenn County",
          areas: [
            { code: "wil", name: "Willows / Orland", cities: ["Willows", "Orland", "Hamilton"] },
          ],
        },
        {
          code: "col",
          name: "Colusa County",
          areas: [
            { code: "clu", name: "Colusa / Williams", cities: ["Colusa", "Williams", "Arbuckle", "Maxwell"] },
          ],
        },
        {
          code: "sut",
          name: "Sutter County",
          areas: [
            { code: "ycy", name: "Yuba City", cities: ["Yuba City", "Live Oak", "Sutter"] },
          ],
        },
        {
          code: "yub",
          name: "Yuba County",
          areas: [
            { code: "mrv", name: "Marysville", cities: ["Marysville", "Linda", "Olivehurst", "Wheatland", "Brownsville"] },
          ],
        },
        {
          code: "yol",
          name: "Yolo County",
          areas: [
            { code: "dav", name: "Davis", cities: ["Davis", "Winters"] },
            { code: "wds", name: "Woodland", cities: ["Woodland", "Esparto", "Knights Landing"] },
            { code: "wsc", name: "West Sacramento", cities: ["West Sacramento", "Clarksburg"] },
          ],
        },
        {
          code: "sac",
          name: "Sacramento County",
          areas: [
            { code: "sct", name: "Sacramento Central", cities: ["Sacramento", "Midtown", "Land Park", "Natomas"] },
            { code: "ctp", name: "North Area", cities: ["Citrus Heights", "Carmichael", "Fair Oaks", "Orangevale", "Antelope"] },
            { code: "fol", name: "Folsom / Rancho Cordova", cities: ["Folsom", "Rancho Cordova", "Gold River"] },
            { code: "elk", name: "South County", cities: ["Elk Grove", "Galt", "Laguna", "Isleton"] },
          ],
        },
      ],
    },

    {
      code: "sn",
      name: "Sierra Nevada",
      blurb: "Gold Country, Tahoe, the high Sierra and the Eastern Sierra.",
      counties: [
        {
          code: "nev",
          name: "Nevada County",
          areas: [
            { code: "gvl", name: "Grass Valley / Nevada City", cities: ["Grass Valley", "Nevada City", "Penn Valley", "Rough and Ready"] },
            { code: "trk", name: "Truckee", cities: ["Truckee", "Donner", "Soda Springs"] },
          ],
        },
        {
          code: "sie",
          name: "Sierra County",
          areas: [
            { code: "loy", name: "Loyalton / Downieville", cities: ["Loyalton", "Downieville", "Sierra City", "Sierraville"] },
          ],
        },
        {
          code: "pla",
          name: "Placer County",
          areas: [
            { code: "rsv", name: "Roseville / Rocklin", cities: ["Roseville", "Rocklin", "Lincoln", "Loomis"] },
            { code: "aub", name: "Auburn", cities: ["Auburn", "Colfax", "Foresthill", "Newcastle"] },
            { code: "tah", name: "North Lake Tahoe", cities: ["Tahoe City", "Kings Beach", "Tahoe Vista", "Olympic Valley", "Northstar"] },
          ],
        },
        {
          code: "eld",
          name: "El Dorado County",
          areas: [
            { code: "plv", name: "Placerville", cities: ["Placerville", "Diamond Springs", "Pollock Pines", "Georgetown"] },
            { code: "edh", name: "El Dorado Hills", cities: ["El Dorado Hills", "Cameron Park", "Shingle Springs"] },
            { code: "slt", name: "South Lake Tahoe", cities: ["South Lake Tahoe", "Meyers", "Tahoma"] },
          ],
        },
        {
          code: "amd",
          name: "Amador County",
          areas: [
            { code: "jck", name: "Jackson / Sutter Creek", cities: ["Jackson", "Sutter Creek", "Ione", "Plymouth", "Pine Grove"] },
          ],
        },
        {
          code: "clv",
          name: "Calaveras County",
          areas: [
            { code: "snd", name: "San Andreas / Angels Camp", cities: ["San Andreas", "Angels Camp", "Murphys", "Arnold", "Valley Springs"] },
          ],
        },
        {
          code: "tuo",
          name: "Tuolumne County",
          areas: [
            { code: "sra", name: "Sonora", cities: ["Sonora", "Jamestown", "Twain Harte", "Groveland", "Columbia"] },
          ],
        },
        {
          code: "alp",
          name: "Alpine County",
          areas: [
            { code: "mkv", name: "Markleeville", cities: ["Markleeville", "Bear Valley", "Kirkwood"] },
          ],
        },
        {
          code: "mps",
          name: "Mariposa County",
          areas: [
            { code: "yos", name: "Mariposa / Yosemite", cities: ["Mariposa", "Yosemite Valley", "El Portal", "Coulterville"] },
          ],
        },
        {
          code: "mno",
          name: "Mono County",
          areas: [
            { code: "mml", name: "Mammoth Lakes", cities: ["Mammoth Lakes", "June Lake", "Crowley Lake"] },
            { code: "brg", name: "Bridgeport / Lee Vining", cities: ["Bridgeport", "Lee Vining", "Mono Lake", "Walker"] },
          ],
        },
        {
          code: "iny",
          name: "Inyo County",
          areas: [
            { code: "bsp", name: "Bishop", cities: ["Bishop", "Big Pine", "Round Valley"] },
            { code: "lnp", name: "Lone Pine / Owens Valley", cities: ["Lone Pine", "Independence", "Death Valley", "Furnace Creek", "Tecopa"] },
          ],
        },
      ],
    },

    {
      code: "sfb",
      name: "San Francisco Bay Area",
      blurb: "The nine Bay Area counties.",
      counties: [
        {
          code: "sf",
          name: "San Francisco",
          areas: [
            { code: "sfe", name: "East SF", cities: ["Downtown", "SoMa", "Mission", "Potrero Hill", "Bayview", "North Beach"] },
            { code: "sfw", name: "West SF", cities: ["Sunset", "Richmond", "Golden Gate Park", "Twin Peaks", "Ingleside"] },
          ],
        },
        {
          code: "mrn",
          name: "Marin County",
          areas: [
            { code: "srf", name: "Central Marin", cities: ["San Rafael", "Novato", "Larkspur", "San Anselmo", "Fairfax"] },
            { code: "smr", name: "Southern Marin", cities: ["Sausalito", "Mill Valley", "Tiburon", "Marin City"] },
            { code: "wmr", name: "West Marin", cities: ["Point Reyes Station", "Bolinas", "Stinson Beach", "Inverness", "Tomales"] },
          ],
        },
        {
          code: "son",
          name: "Sonoma County",
          areas: [
            { code: "str", name: "Santa Rosa", cities: ["Santa Rosa", "Rohnert Park", "Cotati", "Windsor"] },
            { code: "ptl", name: "Petaluma", cities: ["Petaluma", "Penngrove"] },
            { code: "hbg", name: "Northern Sonoma", cities: ["Healdsburg", "Cloverdale", "Geyserville"] },
            { code: "rvr", name: "Russian River / Coast", cities: ["Guerneville", "Sebastopol", "Bodega Bay", "Jenner", "Monte Rio"] },
            { code: "svl", name: "Sonoma Valley", cities: ["Sonoma", "Glen Ellen", "Kenwood"] },
          ],
        },
        {
          code: "nap",
          name: "Napa County",
          areas: [
            { code: "npc", name: "Napa City", cities: ["Napa", "American Canyon", "Yountville"] },
            { code: "upv", name: "Upvalley", cities: ["St. Helena", "Calistoga", "Angwin"] },
          ],
        },
        {
          code: "sol",
          name: "Solano County",
          areas: [
            { code: "fld", name: "Fairfield / Vacaville", cities: ["Fairfield", "Vacaville", "Suisun City", "Dixon"] },
            { code: "vjo", name: "Vallejo / Benicia", cities: ["Vallejo", "Benicia", "Rio Vista"] },
          ],
        },
        {
          code: "ccc",
          name: "Contra Costa County",
          areas: [
            { code: "wcc", name: "West County", cities: ["Richmond", "El Cerrito", "San Pablo", "Pinole", "Hercules"] },
            { code: "wcr", name: "Central County", cities: ["Walnut Creek", "Concord", "Pleasant Hill", "Martinez", "Lafayette", "Orinda"] },
            { code: "srm", name: "San Ramon Valley", cities: ["San Ramon", "Danville", "Alamo", "Blackhawk"] },
            { code: "ecc", name: "East County", cities: ["Antioch", "Pittsburg", "Brentwood", "Oakley", "Discovery Bay"] },
          ],
        },
        {
          code: "ala",
          name: "Alameda County",
          areas: [
            { code: "oak", name: "Oakland / Berkeley", cities: ["Oakland", "Berkeley", "Emeryville", "Alameda", "Piedmont", "Albany"] },
            { code: "hay", name: "Hayward / San Leandro", cities: ["Hayward", "San Leandro", "Castro Valley", "San Lorenzo"] },
            { code: "frm", name: "Southern Alameda", cities: ["Fremont", "Newark", "Union City"] },
            { code: "tri", name: "Tri-Valley", cities: ["Pleasanton", "Livermore", "Dublin", "Sunol"] },
          ],
        },
        {
          code: "smt",
          name: "San Mateo County",
          areas: [
            { code: "dly", name: "North County", cities: ["Daly City", "South San Francisco", "Pacifica", "Brisbane", "Colma"] },
            { code: "smc", name: "Mid-Peninsula", cities: ["San Mateo", "Burlingame", "Millbrae", "San Bruno", "Foster City"] },
            { code: "rwc", name: "South County", cities: ["Redwood City", "Menlo Park", "San Carlos", "Belmont", "Atherton"] },
            { code: "hmb", name: "Coastside", cities: ["Half Moon Bay", "El Granada", "Pescadero", "Montara", "La Honda"] },
          ],
        },
        {
          code: "scl",
          name: "Santa Clara County",
          areas: [
            { code: "sjc", name: "San Jose", cities: ["San Jose", "Milpitas", "Alviso", "Willow Glen", "Almaden"] },
            { code: "pav", name: "North County", cities: ["Palo Alto", "Mountain View", "Los Altos", "Stanford"] },
            { code: "snv", name: "Sunnyvale / Santa Clara", cities: ["Sunnyvale", "Santa Clara"] },
            { code: "cup", name: "West Valley", cities: ["Cupertino", "Saratoga", "Los Gatos", "Campbell", "Monte Sereno"] },
            { code: "gil", name: "South County", cities: ["Gilroy", "Morgan Hill", "San Martin"] },
          ],
        },
      ],
    },

    {
      code: "cc",
      name: "Central Coast",
      blurb: "Santa Cruz down through Santa Barbara.",
      counties: [
        {
          code: "scz",
          name: "Santa Cruz County",
          areas: [
            { code: "scc", name: "Santa Cruz City", cities: ["Santa Cruz", "Capitola", "Soquel", "Live Oak", "Aptos"] },
            { code: "slv", name: "San Lorenzo Valley", cities: ["Scotts Valley", "Felton", "Ben Lomond", "Boulder Creek"] },
            { code: "wat", name: "Pajaro Valley", cities: ["Watsonville", "Freedom", "Corralitos", "La Selva Beach"] },
          ],
        },
        {
          code: "mry",
          name: "Monterey County",
          areas: [
            { code: "mtp", name: "Monterey Peninsula", cities: ["Monterey", "Pacific Grove", "Carmel", "Seaside", "Marina", "Del Rey Oaks"] },
            { code: "sal", name: "Salinas Valley", cities: ["Salinas", "Gonzales", "Soledad", "Greenfield", "Castroville"] },
            { code: "kgc", name: "South County", cities: ["King City", "San Ardo", "Bradley", "Parkfield"] },
            { code: "big", name: "Big Sur", cities: ["Big Sur", "Lucia", "Gorda", "Pfeiffer"] },
          ],
        },
        {
          code: "ben",
          name: "San Benito County",
          areas: [
            { code: "hol", name: "Hollister", cities: ["Hollister", "San Juan Bautista", "Tres Pinos", "Pinnacles"] },
          ],
        },
        {
          code: "slo",
          name: "San Luis Obispo County",
          areas: [
            { code: "prb", name: "North County", cities: ["Paso Robles", "Atascadero", "Templeton", "San Miguel", "Shandon", "Creston", "Santa Margarita"] },
            { code: "slc", name: "SLO City / Central", cities: ["San Luis Obispo", "Los Osos", "Avila Beach", "Edna Valley"] },
            { code: "mbc", name: "North Coast", cities: ["Morro Bay", "Cayucos", "Cambria", "San Simeon", "Harmony"] },
            { code: "fvc", name: "South County", cities: ["Arroyo Grande", "Pismo Beach", "Grover Beach", "Oceano", "Nipomo"] },
          ],
        },
        {
          code: "sba",
          name: "Santa Barbara County",
          areas: [
            { code: "sbc", name: "South Coast", cities: ["Santa Barbara", "Goleta", "Carpinteria", "Montecito", "Isla Vista"] },
            { code: "syv", name: "Santa Ynez Valley", cities: ["Solvang", "Buellton", "Santa Ynez", "Los Olivos", "Ballard"] },
            { code: "lmp", name: "Lompoc", cities: ["Lompoc", "Vandenberg", "Mission Hills"] },
            { code: "smv", name: "Santa Maria Valley", cities: ["Santa Maria", "Orcutt", "Guadalupe", "Los Alamos"] },
          ],
        },
      ],
    },

    {
      code: "sjv",
      name: "San Joaquin Valley",
      blurb: "Stockton down to Bakersfield.",
      counties: [
        {
          code: "sjq",
          name: "San Joaquin County",
          areas: [
            { code: "stk", name: "Stockton", cities: ["Stockton", "Lincoln Village", "Morada"] },
            { code: "lod", name: "Lodi", cities: ["Lodi", "Galt Junction", "Woodbridge", "Lockeford"] },
            { code: "trc", name: "South County", cities: ["Tracy", "Manteca", "Lathrop", "Ripon", "Escalon"] },
          ],
        },
        {
          code: "stn",
          name: "Stanislaus County",
          areas: [
            { code: "mod", name: "Modesto", cities: ["Modesto", "Ceres", "Riverbank", "Oakdale", "Salida"] },
            { code: "trl", name: "Turlock", cities: ["Turlock", "Patterson", "Newman", "Hughson", "Denair"] },
          ],
        },
        {
          code: "mer",
          name: "Merced County",
          areas: [
            { code: "mcd", name: "Merced", cities: ["Merced", "Atwater", "Livingston", "Winton"] },
            { code: "lgr", name: "West Merced", cities: ["Los Banos", "Dos Palos", "Gustine", "Santa Nella"] },
          ],
        },
        {
          code: "mad",
          name: "Madera County",
          areas: [
            { code: "mdr", name: "Madera", cities: ["Madera", "Chowchilla", "Madera Ranchos"] },
            { code: "okh", name: "Foothills", cities: ["Oakhurst", "Coarsegold", "Bass Lake", "North Fork"] },
          ],
        },
        {
          code: "fre",
          name: "Fresno County",
          areas: [
            { code: "frc", name: "Fresno / Clovis", cities: ["Fresno", "Clovis", "Fowler", "Kerman"] },
            { code: "sng", name: "East County", cities: ["Sanger", "Reedley", "Selma", "Dinuba Junction", "Shaver Lake"] },
            { code: "clg", name: "West County", cities: ["Coalinga", "Firebaugh", "Mendota", "Huron", "San Joaquin"] },
          ],
        },
        {
          code: "kng",
          name: "Kings County",
          areas: [
            { code: "hnf", name: "Hanford / Lemoore", cities: ["Hanford", "Lemoore", "Corcoran", "Avenal"] },
          ],
        },
        {
          code: "tul",
          name: "Tulare County",
          areas: [
            { code: "vis", name: "Visalia", cities: ["Visalia", "Exeter", "Farmersville", "Goshen"] },
            { code: "tlc", name: "Tulare City", cities: ["Tulare", "Dinuba", "Woodlake", "Lindsay"] },
            { code: "prt", name: "Porterville", cities: ["Porterville", "Terra Bella", "Springville"] },
            { code: "thr", name: "Sierra Foothills", cities: ["Three Rivers", "Sequoia", "Kings Canyon", "Mineral King"] },
          ],
        },
        {
          code: "krn",
          name: "Kern County",
          areas: [
            { code: "bak", name: "Bakersfield", cities: ["Bakersfield", "Oildale", "Rosedale", "Lamont", "Arvin"] },
            { code: "dlk", name: "North County", cities: ["Delano", "Wasco", "Shafter", "McFarland", "Taft"] },
            { code: "tch", name: "Tehachapi", cities: ["Tehachapi", "Mojave", "California City", "Frazier Park", "Lebec"] },
            { code: "rdc", name: "Indian Wells Valley", cities: ["Ridgecrest", "Inyokern", "China Lake", "Trona"] },
            { code: "kvl", name: "Kern River Valley", cities: ["Lake Isabella", "Kernville", "Wofford Heights", "Bodfish"] },
          ],
        },
      ],
    },

    {
      code: "soc",
      name: "Southern California",
      blurb: "LA, Orange County, the Inland Empire, San Diego and the deserts.",
      counties: [
        {
          code: "ven",
          name: "Ventura County",
          areas: [
            { code: "oxn", name: "Oxnard Plain", cities: ["Oxnard", "Ventura", "Camarillo", "Port Hueneme"] },
            { code: "tho", name: "Conejo Valley", cities: ["Thousand Oaks", "Newbury Park", "Westlake Village", "Agoura"] },
            { code: "smi", name: "Simi Valley", cities: ["Simi Valley", "Moorpark"] },
            { code: "ojv", name: "Ojai Valley", cities: ["Ojai", "Oak View", "Meiners Oaks", "Santa Paula", "Fillmore"] },
          ],
        },
        {
          code: "la",
          name: "Los Angeles County",
          areas: [
            { code: "dtla", name: "Central LA", cities: ["Downtown", "Hollywood", "Koreatown", "Echo Park", "Silver Lake", "Boyle Heights"] },
            { code: "wla", name: "Westside", cities: ["Santa Monica", "Venice", "Culver City", "Westwood", "Brentwood", "Marina del Rey"] },
            { code: "sfv", name: "San Fernando Valley", cities: ["Van Nuys", "Burbank", "Glendale", "Sherman Oaks", "Northridge", "Woodland Hills"] },
            { code: "sgv", name: "San Gabriel Valley", cities: ["Pasadena", "Alhambra", "El Monte", "West Covina", "Arcadia", "Monrovia"] },
            { code: "pom", name: "Pomona Valley", cities: ["Pomona", "Claremont", "La Verne", "San Dimas", "Diamond Bar"] },
            { code: "sbay", name: "South Bay", cities: ["Torrance", "Redondo Beach", "Hermosa Beach", "Manhattan Beach", "El Segundo", "San Pedro"] },
            { code: "lbc", name: "Long Beach", cities: ["Long Beach", "Signal Hill", "Lakewood", "Cerritos"] },
            { code: "seg", name: "Southeast LA", cities: ["Downey", "Whittier", "Norwalk", "Compton", "Bellflower", "Paramount"] },
            { code: "mal", name: "Santa Monica Mountains", cities: ["Malibu", "Topanga", "Calabasas", "Agoura Hills"] },
            { code: "scv", name: "Santa Clarita Valley", cities: ["Santa Clarita", "Valencia", "Newhall", "Castaic", "Stevenson Ranch"] },
            { code: "ant", name: "Antelope Valley", cities: ["Lancaster", "Palmdale", "Quartz Hill", "Acton", "Rosamond"] },
            { code: "cat", name: "Catalina Island", cities: ["Avalon", "Two Harbors", "Santa Catalina"] },
          ],
        },
        {
          code: "oc",
          name: "Orange County",
          areas: [
            { code: "anh", name: "North OC", cities: ["Anaheim", "Fullerton", "Buena Park", "Orange", "Brea", "Yorba Linda"] },
            { code: "sna", name: "Central OC", cities: ["Santa Ana", "Irvine", "Tustin", "Costa Mesa", "Garden Grove", "Westminster"] },
            { code: "hbh", name: "Coastal OC", cities: ["Huntington Beach", "Newport Beach", "Seal Beach", "Laguna Beach", "Fountain Valley"] },
            { code: "mvo", name: "South OC", cities: ["Mission Viejo", "Lake Forest", "San Clemente", "Dana Point", "Laguna Niguel", "Rancho Santa Margarita"] },
          ],
        },
        {
          code: "sbd",
          name: "San Bernardino County",
          areas: [
            { code: "ont", name: "West Valley", cities: ["Ontario", "Rancho Cucamonga", "Chino", "Upland", "Fontana", "Montclair"] },
            { code: "sbn", name: "Inland Valley", cities: ["San Bernardino", "Redlands", "Rialto", "Colton", "Highland", "Yucaipa", "Loma Linda"] },
            { code: "bbl", name: "Mountains", cities: ["Big Bear Lake", "Lake Arrowhead", "Running Springs", "Crestline", "Wrightwood"] },
            { code: "vv", name: "Victor Valley", cities: ["Victorville", "Apple Valley", "Hesperia", "Adelanto", "Phelan"] },
            { code: "mrb", name: "Morongo Basin", cities: ["Yucca Valley", "Joshua Tree", "Twentynine Palms", "Landers", "Pioneertown"] },
            { code: "bar", name: "Barstow", cities: ["Barstow", "Newberry Springs", "Yermo", "Baker"] },
            { code: "ndl", name: "Needles", cities: ["Needles", "Havasu Lake", "Big River"] },
          ],
        },
        {
          code: "riv",
          name: "Riverside County",
          areas: [
            { code: "rvc", name: "Western Riverside", cities: ["Riverside", "Corona", "Norco", "Jurupa Valley", "Eastvale"] },
            { code: "mvy", name: "Moreno Valley / Perris", cities: ["Moreno Valley", "Perris", "Menifee", "Lake Elsinore", "Wildomar"] },
            { code: "tmc", name: "Temecula Valley", cities: ["Temecula", "Murrieta", "Winchester", "Anza"] },
            { code: "hem", name: "San Jacinto Valley", cities: ["Hemet", "San Jacinto", "Beaumont", "Banning", "Cabazon"] },
            { code: "idw", name: "Idyllwild", cities: ["Idyllwild", "Pine Cove", "Mountain Center"] },
            { code: "cch", name: "Coachella Valley", cities: ["Palm Springs", "Palm Desert", "Indio", "La Quinta", "Cathedral City", "Coachella"] },
            { code: "blh", name: "Palo Verde Valley", cities: ["Blythe", "Ripley", "Desert Center"] },
          ],
        },
        {
          code: "sd",
          name: "San Diego County",
          areas: [
            { code: "sdc", name: "Central San Diego", cities: ["San Diego", "La Jolla", "Pacific Beach", "Point Loma", "Mission Valley", "North Park"] },
            { code: "ncc", name: "North County Coastal", cities: ["Oceanside", "Carlsbad", "Encinitas", "Del Mar", "Solana Beach", "Vista"] },
            { code: "nci", name: "North County Inland", cities: ["Escondido", "San Marcos", "Poway", "Rancho Bernardo", "Fallbrook", "Valley Center"] },
            { code: "ecs", name: "East County", cities: ["El Cajon", "Santee", "La Mesa", "Lakeside", "Alpine", "Spring Valley"] },
            { code: "sbo", name: "South Bay", cities: ["Chula Vista", "National City", "Imperial Beach", "Bonita", "San Ysidro"] },
            { code: "ram", name: "Backcountry", cities: ["Ramona", "Julian", "Borrego Springs", "Descanso", "Campo", "Warner Springs"] },
          ],
        },
        {
          code: "imp",
          name: "Imperial County",
          areas: [
            { code: "elc", name: "El Centro", cities: ["El Centro", "Imperial", "Holtville", "Seeley"] },
            { code: "bwl", name: "North Valley", cities: ["Brawley", "Westmorland", "Calipatria", "Niland", "Salton Sea"] },
            { code: "clx", name: "Calexico", cities: ["Calexico", "Heber"] },
            { code: "wnh", name: "Winterhaven", cities: ["Winterhaven", "Bard", "Felicity", "Ogilby"] },
          ],
        },
      ],
    },
  ],
};
