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
            { code: "cre", name: "Crescent City", cities: ["Crescent City", "Smith River", "Klamath", "Gasquet"], lat: 41.756, lon: -124.202 },
          ],
        },
        {
          code: "hum",
          name: "Humboldt County",
          areas: [
            { code: "eka", name: "Humboldt Bay", cities: ["Eureka", "Arcata", "McKinleyville", "Fortuna", "Ferndale", "Trinidad"], lat: 40.802, lon: -124.163 },
            { code: "shu", name: "Southern Humboldt", cities: ["Garberville", "Redway", "Miranda", "Shelter Cove"], lat: 40.106, lon: -123.793 },
            { code: "hoo", name: "Hoopa / Willow Creek", cities: ["Hoopa", "Willow Creek", "Orleans"], lat: 41.050, lon: -123.674 },
          ],
        },
        {
          code: "trn",
          name: "Trinity County",
          areas: [
            { code: "wvl", name: "Weaverville", cities: ["Weaverville", "Hayfork", "Lewiston", "Trinity Center"], lat: 40.731, lon: -122.941 },
          ],
        },
        {
          code: "men",
          name: "Mendocino County",
          areas: [
            { code: "ukh", name: "Ukiah Valley", cities: ["Ukiah", "Willits", "Hopland", "Redwood Valley"], lat: 39.150, lon: -123.208 },
            { code: "fbg", name: "Mendocino Coast", cities: ["Fort Bragg", "Mendocino", "Point Arena", "Albion"], lat: 39.446, lon: -123.805 },
          ],
        },
        {
          code: "lak",
          name: "Lake County",
          areas: [
            { code: "clk", name: "Clear Lake", cities: ["Clearlake", "Lakeport", "Kelseyville", "Middletown"], lat: 38.958, lon: -122.626 },
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
            { code: "yrk", name: "Yreka", cities: ["Yreka", "Montague", "Fort Jones", "Happy Camp"], lat: 41.735, lon: -122.634 },
            { code: "mts", name: "Mount Shasta", cities: ["Mount Shasta", "Weed", "Dunsmuir", "McCloud"], lat: 41.310, lon: -122.312 },
            { code: "tul2", name: "Tulelake Basin", cities: ["Tulelake", "Dorris", "Macdoel"], lat: 41.955, lon: -121.478 },
          ],
        },
        {
          code: "mdc",
          name: "Modoc County",
          areas: [
            { code: "alt", name: "Alturas", cities: ["Alturas", "Cedarville", "Adin", "Canby"], lat: 41.487, lon: -120.542 },
          ],
        },
        {
          code: "sha",
          name: "Shasta County",
          areas: [
            { code: "rdg", name: "Redding Area", cities: ["Redding", "Anderson", "Shasta Lake", "Palo Cedro", "Cottonwood"], lat: 40.586, lon: -122.391 },
            { code: "bur", name: "Intermountain", cities: ["Burney", "Fall River Mills", "McArthur", "Round Mountain"], lat: 40.885, lon: -121.661 },
          ],
        },
        {
          code: "las",
          name: "Lassen County",
          areas: [
            { code: "sus", name: "Susanville", cities: ["Susanville", "Janesville", "Bieber", "Herlong"], lat: 40.416, lon: -120.653 },
          ],
        },
        {
          code: "teh",
          name: "Tehama County",
          areas: [
            { code: "rbf", name: "Red Bluff / Corning", cities: ["Red Bluff", "Corning", "Los Molinos", "Mineral"], lat: 40.178, lon: -122.236 },
          ],
        },
        {
          code: "plu",
          name: "Plumas County",
          areas: [
            { code: "qcy", name: "Quincy / Portola", cities: ["Quincy", "Portola", "Chester", "Graeagle", "Lake Almanor"], lat: 39.937, lon: -120.947 },
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
            { code: "chi", name: "Chico", cities: ["Chico", "Durham", "Hamilton City"], lat: 39.729, lon: -121.837 },
            { code: "orv", name: "Oroville", cities: ["Oroville", "Palermo", "Thermalito", "Gridley", "Biggs"], lat: 39.514, lon: -121.556 },
            { code: "par", name: "Paradise Ridge", cities: ["Paradise", "Magalia", "Concow", "Stirling City"], lat: 39.759, lon: -121.622 },
          ],
        },
        {
          code: "gle",
          name: "Glenn County",
          areas: [
            { code: "wil", name: "Willows / Orland", cities: ["Willows", "Orland", "Hamilton"], lat: 39.524, lon: -122.194 },
          ],
        },
        {
          code: "col",
          name: "Colusa County",
          areas: [
            { code: "clu", name: "Colusa / Williams", cities: ["Colusa", "Williams", "Arbuckle", "Maxwell"], lat: 39.214, lon: -122.009 },
          ],
        },
        {
          code: "sut",
          name: "Sutter County",
          areas: [
            { code: "ycy", name: "Yuba City", cities: ["Yuba City", "Live Oak", "Sutter"], lat: 39.140, lon: -121.617 },
          ],
        },
        {
          code: "yub",
          name: "Yuba County",
          areas: [
            { code: "mrv", name: "Marysville", cities: ["Marysville", "Linda", "Olivehurst", "Wheatland", "Brownsville"], lat: 39.146, lon: -121.591 },
          ],
        },
        {
          code: "yol",
          name: "Yolo County",
          areas: [
            { code: "dav", name: "Davis", cities: ["Davis", "Winters"], lat: 38.545, lon: -121.741 },
            { code: "wds", name: "Woodland", cities: ["Woodland", "Esparto", "Knights Landing"], lat: 38.679, lon: -121.773 },
            { code: "wsc", name: "West Sacramento", cities: ["West Sacramento", "Clarksburg"], lat: 38.581, lon: -121.530 },
          ],
        },
        {
          code: "sac",
          name: "Sacramento County",
          areas: [
            { code: "sct", name: "Sacramento Central", cities: ["Sacramento", "Midtown", "Land Park", "Natomas"], lat: 38.582, lon: -121.494 },
            { code: "ctp", name: "North Area", cities: ["Citrus Heights", "Carmichael", "Fair Oaks", "Orangevale", "Antelope"], lat: 38.707, lon: -121.281 },
            { code: "fol", name: "Folsom / Rancho Cordova", cities: ["Folsom", "Rancho Cordova", "Gold River"], lat: 38.678, lon: -121.176 },
            { code: "elk", name: "South County", cities: ["Elk Grove", "Galt", "Laguna", "Isleton"], lat: 38.409, lon: -121.372 },
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
            { code: "gvl", name: "Grass Valley / Nevada City", cities: ["Grass Valley", "Nevada City", "Penn Valley", "Rough and Ready"], lat: 39.219, lon: -121.061 },
            { code: "trk", name: "Truckee", cities: ["Truckee", "Donner", "Soda Springs"], lat: 39.328, lon: -120.183 },
          ],
        },
        {
          code: "sie",
          name: "Sierra County",
          areas: [
            { code: "loy", name: "Loyalton / Downieville", cities: ["Loyalton", "Downieville", "Sierra City", "Sierraville"], lat: 39.677, lon: -120.240 },
          ],
        },
        {
          code: "pla",
          name: "Placer County",
          areas: [
            { code: "rsv", name: "Roseville / Rocklin", cities: ["Roseville", "Rocklin", "Lincoln", "Loomis"], lat: 38.752, lon: -121.288 },
            { code: "aub", name: "Auburn", cities: ["Auburn", "Colfax", "Foresthill", "Newcastle"], lat: 38.897, lon: -121.077 },
            { code: "tah", name: "North Lake Tahoe", cities: ["Tahoe City", "Kings Beach", "Tahoe Vista", "Olympic Valley", "Northstar"], lat: 39.167, lon: -120.144 },
          ],
        },
        {
          code: "eld",
          name: "El Dorado County",
          areas: [
            { code: "plv", name: "Placerville", cities: ["Placerville", "Diamond Springs", "Pollock Pines", "Georgetown"], lat: 38.730, lon: -120.798 },
            { code: "edh", name: "El Dorado Hills", cities: ["El Dorado Hills", "Cameron Park", "Shingle Springs"], lat: 38.686, lon: -121.082 },
            { code: "slt", name: "South Lake Tahoe", cities: ["South Lake Tahoe", "Meyers", "Tahoma"], lat: 38.933, lon: -119.977 },
          ],
        },
        {
          code: "amd",
          name: "Amador County",
          areas: [
            { code: "jck", name: "Jackson / Sutter Creek", cities: ["Jackson", "Sutter Creek", "Ione", "Plymouth", "Pine Grove"], lat: 38.349, lon: -120.774 },
          ],
        },
        {
          code: "clv",
          name: "Calaveras County",
          areas: [
            { code: "snd", name: "San Andreas / Angels Camp", cities: ["San Andreas", "Angels Camp", "Murphys", "Arnold", "Valley Springs"], lat: 38.196, lon: -120.681 },
          ],
        },
        {
          code: "tuo",
          name: "Tuolumne County",
          areas: [
            { code: "sra", name: "Sonora", cities: ["Sonora", "Jamestown", "Twain Harte", "Groveland", "Columbia"], lat: 37.984, lon: -120.382 },
          ],
        },
        {
          code: "alp",
          name: "Alpine County",
          areas: [
            { code: "mkv", name: "Markleeville", cities: ["Markleeville", "Bear Valley", "Kirkwood"], lat: 38.694, lon: -119.779 },
          ],
        },
        {
          code: "mps",
          name: "Mariposa County",
          areas: [
            { code: "yos", name: "Mariposa / Yosemite", cities: ["Mariposa", "Yosemite Valley", "El Portal", "Coulterville"], lat: 37.485, lon: -119.966 },
          ],
        },
        {
          code: "mno",
          name: "Mono County",
          areas: [
            { code: "mml", name: "Mammoth Lakes", cities: ["Mammoth Lakes", "June Lake", "Crowley Lake"], lat: 37.649, lon: -118.972 },
            { code: "brg", name: "Bridgeport / Lee Vining", cities: ["Bridgeport", "Lee Vining", "Mono Lake", "Walker"], lat: 38.256, lon: -119.231 },
          ],
        },
        {
          code: "iny",
          name: "Inyo County",
          areas: [
            { code: "bsp", name: "Bishop", cities: ["Bishop", "Big Pine", "Round Valley"], lat: 37.364, lon: -118.395 },
            { code: "lnp", name: "Lone Pine / Owens Valley", cities: ["Lone Pine", "Independence", "Death Valley", "Furnace Creek", "Tecopa"], lat: 36.606, lon: -118.063 },
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
            { code: "sfe", name: "East SF", cities: ["Downtown", "SoMa", "Mission", "Potrero Hill", "Bayview", "North Beach"], lat: 37.779, lon: -122.409 },
            { code: "sfw", name: "West SF", cities: ["Sunset", "Richmond", "Golden Gate Park", "Twin Peaks", "Ingleside"], lat: 37.760, lon: -122.482 },
          ],
        },
        {
          code: "mrn",
          name: "Marin County",
          areas: [
            { code: "srf", name: "Central Marin", cities: ["San Rafael", "Novato", "Larkspur", "San Anselmo", "Fairfax"], lat: 37.974, lon: -122.531 },
            { code: "smr", name: "Southern Marin", cities: ["Sausalito", "Mill Valley", "Tiburon", "Marin City"], lat: 37.877, lon: -122.499 },
            { code: "wmr", name: "West Marin", cities: ["Point Reyes Station", "Bolinas", "Stinson Beach", "Inverness", "Tomales"], lat: 38.066, lon: -122.807 },
          ],
        },
        {
          code: "son",
          name: "Sonoma County",
          areas: [
            { code: "str", name: "Santa Rosa", cities: ["Santa Rosa", "Rohnert Park", "Cotati", "Windsor"], lat: 38.440, lon: -122.714 },
            { code: "ptl", name: "Petaluma", cities: ["Petaluma", "Penngrove"], lat: 38.232, lon: -122.637 },
            { code: "hbg", name: "Northern Sonoma", cities: ["Healdsburg", "Cloverdale", "Geyserville"], lat: 38.610, lon: -122.869 },
            { code: "rvr", name: "Russian River / Coast", cities: ["Guerneville", "Sebastopol", "Bodega Bay", "Jenner", "Monte Rio"], lat: 38.502, lon: -122.996 },
            { code: "svl", name: "Sonoma Valley", cities: ["Sonoma", "Glen Ellen", "Kenwood"], lat: 38.292, lon: -122.458 },
          ],
        },
        {
          code: "nap",
          name: "Napa County",
          areas: [
            { code: "npc", name: "Napa City", cities: ["Napa", "American Canyon", "Yountville"], lat: 38.297, lon: -122.287 },
            { code: "upv", name: "Upvalley", cities: ["St. Helena", "Calistoga", "Angwin"], lat: 38.505, lon: -122.470 },
          ],
        },
        {
          code: "sol",
          name: "Solano County",
          areas: [
            { code: "fld", name: "Fairfield / Vacaville", cities: ["Fairfield", "Vacaville", "Suisun City", "Dixon"], lat: 38.249, lon: -122.040 },
            { code: "vjo", name: "Vallejo / Benicia", cities: ["Vallejo", "Benicia", "Rio Vista"], lat: 38.104, lon: -122.256 },
          ],
        },
        {
          code: "ccc",
          name: "Contra Costa County",
          areas: [
            { code: "wcc", name: "West County", cities: ["Richmond", "El Cerrito", "San Pablo", "Pinole", "Hercules"], lat: 37.936, lon: -122.348 },
            { code: "wcr", name: "Central County", cities: ["Walnut Creek", "Concord", "Pleasant Hill", "Martinez", "Lafayette", "Orinda"], lat: 37.906, lon: -122.065 },
            { code: "srm", name: "San Ramon Valley", cities: ["San Ramon", "Danville", "Alamo", "Blackhawk"], lat: 37.780, lon: -121.978 },
            { code: "ecc", name: "East County", cities: ["Antioch", "Pittsburg", "Brentwood", "Oakley", "Discovery Bay"], lat: 38.005, lon: -121.806 },
          ],
        },
        {
          code: "ala",
          name: "Alameda County",
          areas: [
            { code: "oak", name: "Oakland / Berkeley", cities: ["Oakland", "Berkeley", "Emeryville", "Alameda", "Piedmont", "Albany"], lat: 37.804, lon: -122.271 },
            { code: "hay", name: "Hayward / San Leandro", cities: ["Hayward", "San Leandro", "Castro Valley", "San Lorenzo"], lat: 37.669, lon: -122.081 },
            { code: "frm", name: "Southern Alameda", cities: ["Fremont", "Newark", "Union City"], lat: 37.548, lon: -121.989 },
            { code: "tri", name: "Tri-Valley", cities: ["Pleasanton", "Livermore", "Dublin", "Sunol"], lat: 37.662, lon: -121.876 },
          ],
        },
        {
          code: "smt",
          name: "San Mateo County",
          areas: [
            { code: "dly", name: "North County", cities: ["Daly City", "South San Francisco", "Pacifica", "Brisbane", "Colma"], lat: 37.688, lon: -122.470 },
            { code: "smc", name: "Mid-Peninsula", cities: ["San Mateo", "Burlingame", "Millbrae", "San Bruno", "Foster City"], lat: 37.563, lon: -122.326 },
            { code: "rwc", name: "South County", cities: ["Redwood City", "Menlo Park", "San Carlos", "Belmont", "Atherton"], lat: 37.485, lon: -122.236 },
            { code: "hmb", name: "Coastside", cities: ["Half Moon Bay", "El Granada", "Pescadero", "Montara", "La Honda"], lat: 37.463, lon: -122.429 },
          ],
        },
        {
          code: "scl",
          name: "Santa Clara County",
          areas: [
            { code: "sjc", name: "San Jose", cities: ["San Jose", "Milpitas", "Alviso", "Willow Glen", "Almaden"], lat: 37.339, lon: -121.895 },
            { code: "pav", name: "North County", cities: ["Palo Alto", "Mountain View", "Los Altos", "Stanford"], lat: 37.442, lon: -122.143 },
            { code: "snv", name: "Sunnyvale / Santa Clara", cities: ["Sunnyvale", "Santa Clara"], lat: 37.369, lon: -122.036 },
            { code: "cup", name: "West Valley", cities: ["Cupertino", "Saratoga", "Los Gatos", "Campbell", "Monte Sereno"], lat: 37.323, lon: -122.032 },
            { code: "gil", name: "South County", cities: ["Gilroy", "Morgan Hill", "San Martin"], lat: 37.006, lon: -121.568 },
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
            { code: "scc", name: "Santa Cruz City", cities: ["Santa Cruz", "Capitola", "Soquel", "Live Oak", "Aptos"], lat: 36.974, lon: -122.031 },
            { code: "slv", name: "San Lorenzo Valley", cities: ["Scotts Valley", "Felton", "Ben Lomond", "Boulder Creek"], lat: 37.061, lon: -122.070 },
            { code: "wat", name: "Pajaro Valley", cities: ["Watsonville", "Freedom", "Corralitos", "La Selva Beach"], lat: 36.910, lon: -121.757 },
          ],
        },
        {
          code: "mry",
          name: "Monterey County",
          areas: [
            { code: "mtp", name: "Monterey Peninsula", cities: ["Monterey", "Pacific Grove", "Carmel", "Seaside", "Marina", "Del Rey Oaks"], lat: 36.600, lon: -121.894 },
            { code: "sal", name: "Salinas Valley", cities: ["Salinas", "Gonzales", "Soledad", "Greenfield", "Castroville"], lat: 36.678, lon: -121.655 },
            { code: "kgc", name: "South County", cities: ["King City", "San Ardo", "Bradley", "Parkfield"], lat: 36.213, lon: -121.126 },
            { code: "big", name: "Big Sur", cities: ["Big Sur", "Lucia", "Gorda", "Pfeiffer"], lat: 36.270, lon: -121.808 },
          ],
        },
        {
          code: "ben",
          name: "San Benito County",
          areas: [
            { code: "hol", name: "Hollister", cities: ["Hollister", "San Juan Bautista", "Tres Pinos", "Pinnacles"], lat: 36.852, lon: -121.402 },
          ],
        },
        {
          code: "slo",
          name: "San Luis Obispo County",
          areas: [
            { code: "prb", name: "North County", cities: ["Paso Robles", "Atascadero", "Templeton", "San Miguel", "Shandon", "Creston", "Santa Margarita"], lat: 35.627, lon: -120.691 },
            { code: "slc", name: "SLO City / Central", cities: ["San Luis Obispo", "Los Osos", "Avila Beach", "Edna Valley"], lat: 35.283, lon: -120.660 },
            { code: "mbc", name: "North Coast", cities: ["Morro Bay", "Cayucos", "Cambria", "San Simeon", "Harmony"], lat: 35.366, lon: -120.850 },
            { code: "fvc", name: "South County", cities: ["Arroyo Grande", "Pismo Beach", "Grover Beach", "Oceano", "Nipomo"], lat: 35.119, lon: -120.591 },
          ],
        },
        {
          code: "sba",
          name: "Santa Barbara County",
          areas: [
            { code: "sbc", name: "South Coast", cities: ["Santa Barbara", "Goleta", "Carpinteria", "Montecito", "Isla Vista"], lat: 34.421, lon: -119.698 },
            { code: "syv", name: "Santa Ynez Valley", cities: ["Solvang", "Buellton", "Santa Ynez", "Los Olivos", "Ballard"], lat: 34.596, lon: -120.138 },
            { code: "lmp", name: "Lompoc", cities: ["Lompoc", "Vandenberg", "Mission Hills"], lat: 34.639, lon: -120.458 },
            { code: "smv", name: "Santa Maria Valley", cities: ["Santa Maria", "Orcutt", "Guadalupe", "Los Alamos"], lat: 34.953, lon: -120.436 },
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
            { code: "stk", name: "Stockton", cities: ["Stockton", "Lincoln Village", "Morada"], lat: 37.958, lon: -121.291 },
            { code: "lod", name: "Lodi", cities: ["Lodi", "Galt Junction", "Woodbridge", "Lockeford"], lat: 38.130, lon: -121.272 },
            { code: "trc", name: "South County", cities: ["Tracy", "Manteca", "Lathrop", "Ripon", "Escalon"], lat: 37.740, lon: -121.426 },
          ],
        },
        {
          code: "stn",
          name: "Stanislaus County",
          areas: [
            { code: "mod", name: "Modesto", cities: ["Modesto", "Ceres", "Riverbank", "Oakdale", "Salida"], lat: 37.639, lon: -120.997 },
            { code: "trl", name: "Turlock", cities: ["Turlock", "Patterson", "Newman", "Hughson", "Denair"], lat: 37.495, lon: -120.847 },
          ],
        },
        {
          code: "mer",
          name: "Merced County",
          areas: [
            { code: "mcd", name: "Merced", cities: ["Merced", "Atwater", "Livingston", "Winton"], lat: 37.302, lon: -120.483 },
            { code: "lgr", name: "West Merced", cities: ["Los Banos", "Dos Palos", "Gustine", "Santa Nella"], lat: 37.058, lon: -120.850 },
          ],
        },
        {
          code: "mad",
          name: "Madera County",
          areas: [
            { code: "mdr", name: "Madera", cities: ["Madera", "Chowchilla", "Madera Ranchos"], lat: 36.961, lon: -120.061 },
            { code: "okh", name: "Foothills", cities: ["Oakhurst", "Coarsegold", "Bass Lake", "North Fork"], lat: 37.328, lon: -119.649 },
          ],
        },
        {
          code: "fre",
          name: "Fresno County",
          areas: [
            { code: "frc", name: "Fresno / Clovis", cities: ["Fresno", "Clovis", "Fowler", "Kerman"], lat: 36.746, lon: -119.772 },
            { code: "sng", name: "East County", cities: ["Sanger", "Reedley", "Selma", "Dinuba Junction", "Shaver Lake"], lat: 36.708, lon: -119.556 },
            { code: "clg", name: "West County", cities: ["Coalinga", "Firebaugh", "Mendota", "Huron", "San Joaquin"], lat: 36.140, lon: -120.360 },
          ],
        },
        {
          code: "kng",
          name: "Kings County",
          areas: [
            { code: "hnf", name: "Hanford / Lemoore", cities: ["Hanford", "Lemoore", "Corcoran", "Avenal"], lat: 36.327, lon: -119.646 },
          ],
        },
        {
          code: "tul",
          name: "Tulare County",
          areas: [
            { code: "vis", name: "Visalia", cities: ["Visalia", "Exeter", "Farmersville", "Goshen"], lat: 36.330, lon: -119.292 },
            { code: "tlc", name: "Tulare City", cities: ["Tulare", "Dinuba", "Woodlake", "Lindsay"], lat: 36.208, lon: -119.347 },
            { code: "prt", name: "Porterville", cities: ["Porterville", "Terra Bella", "Springville"], lat: 36.065, lon: -119.017 },
            { code: "thr", name: "Sierra Foothills", cities: ["Three Rivers", "Sequoia", "Kings Canyon", "Mineral King"], lat: 36.439, lon: -118.906 },
          ],
        },
        {
          code: "krn",
          name: "Kern County",
          areas: [
            { code: "bak", name: "Bakersfield", cities: ["Bakersfield", "Oildale", "Rosedale", "Lamont", "Arvin"], lat: 35.373, lon: -119.019 },
            { code: "dlk", name: "North County", cities: ["Delano", "Wasco", "Shafter", "McFarland", "Taft"], lat: 35.769, lon: -119.247 },
            { code: "tch", name: "Tehachapi", cities: ["Tehachapi", "Mojave", "California City", "Frazier Park", "Lebec"], lat: 35.132, lon: -118.449 },
            { code: "rdc", name: "Indian Wells Valley", cities: ["Ridgecrest", "Inyokern", "China Lake", "Trona"], lat: 35.622, lon: -117.671 },
            { code: "kvl", name: "Kern River Valley", cities: ["Lake Isabella", "Kernville", "Wofford Heights", "Bodfish"], lat: 35.628, lon: -118.474 },
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
            { code: "oxn", name: "Oxnard Plain", cities: ["Oxnard", "Ventura", "Camarillo", "Port Hueneme"], lat: 34.198, lon: -119.177 },
            { code: "tho", name: "Conejo Valley", cities: ["Thousand Oaks", "Newbury Park", "Westlake Village", "Agoura"], lat: 34.170, lon: -118.838 },
            { code: "smi", name: "Simi Valley", cities: ["Simi Valley", "Moorpark"], lat: 34.269, lon: -118.781 },
            { code: "ojv", name: "Ojai Valley", cities: ["Ojai", "Oak View", "Meiners Oaks", "Santa Paula", "Fillmore"], lat: 34.448, lon: -119.243 },
          ],
        },
        {
          code: "la",
          name: "Los Angeles County",
          areas: [
            { code: "dtla", name: "Central LA", cities: ["Downtown", "Hollywood", "Koreatown", "Echo Park", "Silver Lake", "Boyle Heights"], lat: 34.048, lon: -118.253 },
            { code: "wla", name: "Westside", cities: ["Santa Monica", "Venice", "Culver City", "Westwood", "Brentwood", "Marina del Rey"], lat: 34.019, lon: -118.470 },
            { code: "sfv", name: "San Fernando Valley", cities: ["Van Nuys", "Burbank", "Glendale", "Sherman Oaks", "Northridge", "Woodland Hills"], lat: 34.187, lon: -118.451 },
            { code: "sgv", name: "San Gabriel Valley", cities: ["Pasadena", "Alhambra", "El Monte", "West Covina", "Arcadia", "Monrovia"], lat: 34.148, lon: -118.144 },
            { code: "pom", name: "Pomona Valley", cities: ["Pomona", "Claremont", "La Verne", "San Dimas", "Diamond Bar"], lat: 34.055, lon: -117.752 },
            { code: "sbay", name: "South Bay", cities: ["Torrance", "Redondo Beach", "Hermosa Beach", "Manhattan Beach", "El Segundo", "San Pedro"], lat: 33.836, lon: -118.341 },
            { code: "lbc", name: "Long Beach", cities: ["Long Beach", "Signal Hill", "Lakewood", "Cerritos"], lat: 33.770, lon: -118.194 },
            { code: "seg", name: "Southeast LA", cities: ["Downey", "Whittier", "Norwalk", "Compton", "Bellflower", "Paramount"], lat: 33.940, lon: -118.133 },
            { code: "mal", name: "Santa Monica Mountains", cities: ["Malibu", "Topanga", "Calabasas", "Agoura Hills"], lat: 34.026, lon: -118.780 },
            { code: "scv", name: "Santa Clarita Valley", cities: ["Santa Clarita", "Valencia", "Newhall", "Castaic", "Stevenson Ranch"], lat: 34.391, lon: -118.542 },
            { code: "ant", name: "Antelope Valley", cities: ["Lancaster", "Palmdale", "Quartz Hill", "Acton", "Rosamond"], lat: 34.687, lon: -118.154 },
            { code: "cat", name: "Catalina Island", cities: ["Avalon", "Two Harbors", "Santa Catalina"], lat: 33.343, lon: -118.328 },
          ],
        },
        {
          code: "oc",
          name: "Orange County",
          areas: [
            { code: "anh", name: "North OC", cities: ["Anaheim", "Fullerton", "Buena Park", "Orange", "Brea", "Yorba Linda"], lat: 33.836, lon: -117.914 },
            { code: "sna", name: "Central OC", cities: ["Santa Ana", "Irvine", "Tustin", "Costa Mesa", "Garden Grove", "Westminster"], lat: 33.746, lon: -117.868 },
            { code: "hbh", name: "Coastal OC", cities: ["Huntington Beach", "Newport Beach", "Seal Beach", "Laguna Beach", "Fountain Valley"], lat: 33.660, lon: -117.999 },
            { code: "mvo", name: "South OC", cities: ["Mission Viejo", "Lake Forest", "San Clemente", "Dana Point", "Laguna Niguel", "Rancho Santa Margarita"], lat: 33.600, lon: -117.672 },
          ],
        },
        {
          code: "sbd",
          name: "San Bernardino County",
          areas: [
            { code: "ont", name: "West Valley", cities: ["Ontario", "Rancho Cucamonga", "Chino", "Upland", "Fontana", "Montclair"], lat: 34.064, lon: -117.649 },
            { code: "sbn", name: "Inland Valley", cities: ["San Bernardino", "Redlands", "Rialto", "Colton", "Highland", "Yucaipa", "Loma Linda"], lat: 34.108, lon: -117.290 },
            { code: "bbl", name: "Mountains", cities: ["Big Bear Lake", "Lake Arrowhead", "Running Springs", "Crestline", "Wrightwood"], lat: 34.244, lon: -116.911 },
            { code: "vv", name: "Victor Valley", cities: ["Victorville", "Apple Valley", "Hesperia", "Adelanto", "Phelan"], lat: 34.536, lon: -117.291 },
            { code: "mrb", name: "Morongo Basin", cities: ["Yucca Valley", "Joshua Tree", "Twentynine Palms", "Landers", "Pioneertown"], lat: 34.114, lon: -116.432 },
            { code: "bar", name: "Barstow", cities: ["Barstow", "Newberry Springs", "Yermo", "Baker"], lat: 34.896, lon: -117.017 },
            { code: "ndl", name: "Needles", cities: ["Needles", "Havasu Lake", "Big River"], lat: 34.848, lon: -114.614 },
          ],
        },
        {
          code: "riv",
          name: "Riverside County",
          areas: [
            { code: "rvc", name: "Western Riverside", cities: ["Riverside", "Corona", "Norco", "Jurupa Valley", "Eastvale"], lat: 33.953, lon: -117.396 },
            { code: "mvy", name: "Moreno Valley / Perris", cities: ["Moreno Valley", "Perris", "Menifee", "Lake Elsinore", "Wildomar"], lat: 33.937, lon: -117.230 },
            { code: "tmc", name: "Temecula Valley", cities: ["Temecula", "Murrieta", "Winchester", "Anza"], lat: 33.494, lon: -117.148 },
            { code: "hem", name: "San Jacinto Valley", cities: ["Hemet", "San Jacinto", "Beaumont", "Banning", "Cabazon"], lat: 33.748, lon: -116.972 },
            { code: "idw", name: "Idyllwild", cities: ["Idyllwild", "Pine Cove", "Mountain Center"], lat: 33.740, lon: -116.719 },
            { code: "cch", name: "Coachella Valley", cities: ["Palm Springs", "Palm Desert", "Indio", "La Quinta", "Cathedral City", "Coachella"], lat: 33.830, lon: -116.545 },
            { code: "blh", name: "Palo Verde Valley", cities: ["Blythe", "Ripley", "Desert Center"], lat: 33.610, lon: -114.596 },
          ],
        },
        {
          code: "sd",
          name: "San Diego County",
          areas: [
            { code: "sdc", name: "Central San Diego", cities: ["San Diego", "La Jolla", "Pacific Beach", "Point Loma", "Mission Valley", "North Park"], lat: 32.716, lon: -117.161 },
            { code: "ncc", name: "North County Coastal", cities: ["Oceanside", "Carlsbad", "Encinitas", "Del Mar", "Solana Beach", "Vista"], lat: 33.166, lon: -117.323 },
            { code: "nci", name: "North County Inland", cities: ["Escondido", "San Marcos", "Poway", "Rancho Bernardo", "Fallbrook", "Valley Center"], lat: 33.119, lon: -117.086 },
            { code: "ecs", name: "East County", cities: ["El Cajon", "Santee", "La Mesa", "Lakeside", "Alpine", "Spring Valley"], lat: 32.795, lon: -116.962 },
            { code: "sbo", name: "South Bay", cities: ["Chula Vista", "National City", "Imperial Beach", "Bonita", "San Ysidro"], lat: 32.640, lon: -117.084 },
            { code: "ram", name: "Backcountry", cities: ["Ramona", "Julian", "Borrego Springs", "Descanso", "Campo", "Warner Springs"], lat: 33.042, lon: -116.868 },
          ],
        },
        {
          code: "imp",
          name: "Imperial County",
          areas: [
            { code: "elc", name: "El Centro", cities: ["El Centro", "Imperial", "Holtville", "Seeley"], lat: 32.792, lon: -115.563 },
            { code: "bwl", name: "North Valley", cities: ["Brawley", "Westmorland", "Calipatria", "Niland", "Salton Sea"], lat: 32.979, lon: -115.530 },
            { code: "clx", name: "Calexico", cities: ["Calexico", "Heber"], lat: 32.679, lon: -115.499 },
            { code: "wnh", name: "Winterhaven", cities: ["Winterhaven", "Bard", "Felicity", "Ogilby"], lat: 32.739, lon: -114.622 },
          ],
        },
      ],
    },
  ],
};
