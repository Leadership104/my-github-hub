// Live multi-source safety aggregator.
// All sources are free, public; only NASA FIRMS uses an optional MAP_KEY.
//   1. Nominatim (OpenStreetMap)         — city → lat/lon geocoding
//   2. USGS Earthquake Hazards           — recent seismic activity (M2.5+, past week)
//   3. NOAA / NWS Active Alerts          — severe weather warnings (US points)
//   4. GDACS RSS                         — global disasters (cyclones, floods, volcanoes)
//   5. Open-Meteo                        — current wind / precip / temperature extremes
//   6. Overpass API (OpenStreetMap)      — local police / hospital density
//   7. FBI Crime Data Explorer (CDE)     — agency-level crime counts (only if FBI_CDE_API_KEY set)
//   8. NASA FIRMS                        — active wildfire detections (uses NASA_FIRMS_MAP_KEY)
//   9. NASA EONET                        — natural disaster events (storms, volcanoes, floods)
//  10. ACLED public dashboard            — armed conflict events (country, last 30d)
//  11. Yahoo Finance + Google News RSS   — recent headlines + links for major cities
//  12. CDC Travelers' Health Notices     — disease-level travel notices (L1/L2/L3)
//  13. WHO Disease Outbreak News         — active outbreak alerts (RSS)
//  14. ReliefWeb Disasters API           — UN-backed disaster & humanitarian alerts
//
// Advisory sources (State Dept + ACLED + CDC + WHO + ReliefWeb) are reconciled
// using confidence-weighted averaging with spread-based conservative bias.
// Per-city crime calibration uses a curated index of known-city multipliers before
// falling back to a deterministic hash-based variance for unknown cities.
//
// Per-city responses are cached in memory for 10 minutes to keep load light
// across the upstream APIs while supporting the screen's auto-refresh cadence.

import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

const UA = "kipita-safety/1.0 (https://kipita.app)";

/* ── New verified-source types ──────────────────────────────────────────────── */

interface CdcNotice {
  title: string;
  level: number;      // 1=Watch, 2=Alert, 3=Warning
  link: string;
  summary?: string;
  pubDate?: string;
}

/** A single advisory authority's verdict — 0=none, 4=do not travel. */
interface AdvisorySource {
  id: string;
  name: string;
  icon: string;
  level: number;          // 0–4 normalized
  confidence: number;     // 0.0–1.0 authority weight
  summary?: string;
  url?: string;
  publishedAt?: string | null;
  domain: "travel" | "health" | "conflict" | "disaster";
}

interface AdvisoryReconciliation {
  finalLevel: number;       // conservative blended level
  weightedLevel: number;    // continuous weighted average (1 dp)
  agreement: "HIGH" | "MEDIUM" | "LOW";
  overallConfidence: number; // 0–1
  sources: AdvisorySource[];
}

/* ── Common country names (ISO-2 → English) for CDC / WHO RSS filtering ────── */
const COUNTRY_NAMES: Record<string, string> = {
  US: "United States", CA: "Canada", GB: "United Kingdom",
  AU: "Australia", NZ: "New Zealand", FR: "France",
  DE: "Germany", IT: "Italy", ES: "Spain", PT: "Portugal",
  NL: "Netherlands", BE: "Belgium", CH: "Switzerland", AT: "Austria",
  SE: "Sweden", NO: "Norway", DK: "Denmark", FI: "Finland",
  PL: "Poland", CZ: "Czech Republic", HU: "Hungary", RO: "Romania",
  GR: "Greece", TR: "Turkey",
  JP: "Japan", KR: "South Korea", CN: "China", SG: "Singapore",
  TH: "Thailand", VN: "Vietnam", ID: "Indonesia", PH: "Philippines",
  IN: "India", MY: "Malaysia", TW: "Taiwan", HK: "Hong Kong",
  MX: "Mexico", BR: "Brazil", AR: "Argentina", CO: "Colombia",
  PE: "Peru", CL: "Chile", EC: "Ecuador", VE: "Venezuela", HT: "Haiti",
  ZA: "South Africa", KE: "Kenya", NG: "Nigeria", EG: "Egypt",
  MA: "Morocco", TZ: "Tanzania", ET: "Ethiopia", GH: "Ghana",
  AE: "United Arab Emirates", SA: "Saudi Arabia",
  IL: "Israel", JO: "Jordan", QA: "Qatar", KW: "Kuwait",
  UA: "Ukraine", RU: "Russia", BY: "Belarus",
  AF: "Afghanistan", PK: "Pakistan", MM: "Myanmar", KP: "North Korea",
  IR: "Iran", IQ: "Iraq", SY: "Syria", LB: "Lebanon",
  YE: "Yemen", SO: "Somalia", SD: "Sudan", ML: "Mali", BF: "Burkina Faso",
  LY: "Libya", CD: "DR Congo", SS: "South Sudan", CF: "Central African Republic",
  MZ: "Mozambique", CM: "Cameroon", NG2: "Niger",
};

/* ── City-level crime calibration index ─────────────────────────────────────
 * Multiplier vs. US national average per-100k (1.0 = national average).
 * > 1.0 = higher crime; < 1.0 = lower crime.
 * Key format: "lowercase city|ISO-2 country"
 * Sources: FBI UCR city-level, UNODC homicide index, ACLED sub-national,
 *          local statistical agencies (ABS, ONS, StatCan, INEGI, IBGE, SAPS).
 */
const CITY_CRIME_INDEX: Record<string, number> = {
  // ─ United States ─────────────────────────────────────────────────────────
  // Calibrated: multiplier = city_violent_crime_rate_2022 / (380.7_national_avg × 0.55_TYPICAL_BIAS)
  // National avg 380.7/100k is the FBI's official published 2022 NIBRS figure.
  // Denominator = 380.7 × 0.55 = 209.4. Cap of 5.0 applies in buildRates().
  // Source: FBI UCR/NIBRS 2022 city-level data (BeautifyData mirror), local PD annual reports.
  //
  // Tier 1 — ≥1,050/100k violent crime → multiplier 5.0 (engine cap)
  "jackson|US": 5.00,      // ~2,400+/100k; homicide 92.1/100k (FBI 2022, 135 murders/156k pop)
  "memphis|US": 5.00,      // 2,420.9/100k — FBI UCR 2022 #1 among 50k+ pop cities (BeautifyData)
  "detroit|US": 5.00,      // 2,027.9/100k — FBI UCR 2022 (BeautifyData confirmed)
  "little rock|US": 5.00,  // 1,833.1/100k — FBI UCR 2022 (BeautifyData confirmed)
  "birmingham|US": 5.00,   // 1,681.6/100k — FBI UCR 2022 (BeautifyData confirmed)
  "baltimore|US": 5.00,    // ~1,606/100k; homicide 58/100k (331 murders/574k pop 2022)
  "tacoma|US": 5.00,       // ~1,610/100k — FBI UCR 2022 (BeautifyData: 3,526 crimes/219k pop)
  "new orleans|US": 5.00,  // ~1,800/100k; homicide 53.8/100k (266 murders/369k pop 2022)
  "st. louis|US": 5.00,    // ~1,900/100k; homicide 67.8/100k (200 murders/295k pop 2022)
  "compton|US": 5.00,      // 1,140.5/100k — FBI UCR 2022 (BeautifyData confirmed)
  "kansas city|US": 5.00,  // ~1,350/100k — KCPD 2022 annual report
  "oakland|US": 5.00,      // ~1,500/100k; robbery rate highest in US (639/100k)
  "shreveport|US": 5.00,   // ~1,229/100k — Louisiana UCR 2022
  "milwaukee|US": 5.00,    // ~1,550/100k; homicide 37.3/100k (214 murders/573k pop 2022)
  "albuquerque|US": 5.00,  // 1,266/100k — APD 2022 (confirmed); 120 homicides/560k pop
  "cleveland|US": 5.00,    // ~1,716/100k — Cleveland Health Report 2022 (17.16/1,000)
  "indianapolis|US": 5.00, // ~1,040/100k — IMPD 2022 (9,109 violent crimes/876k pop)
  "stockton|US": 5.00,     // ~1,150/100k — California DOJ 2022
  "minneapolis|US": 5.00,  // ~1,100/100k — MPD 2022 (nearly 3× national avg)
  "houston|US": 5.00,      // ~1,100/100k — HPD 2022; confirmed ~1,000-1,148 range
  "atlanta|US": 5.00,      // ~1,600/100k; homicide 34.1/100k (170 murders/498k pop 2022)
  //
  // Tier 2 — 813–1,049/100k → multiplier 4.0–4.99
  "anchorage|US": 4.60,    // ~960/100k — APD 2022 annual report
  "buffalo|US": 4.30,      // ~900/100k — BPD/New York State UCR 2022
  "richmond|US": 4.30,     // ~900/100k — RPD 2022 (57 homicides, 226k pop)
  "chicago|US": 4.29,      // ~873/100k — CPD 2022 (715 homicides, 2.7M pop; NIBRS caveats)
  "tulsa|US": 4.06,        // ~850/100k — Tulsa PD 2022; homicide ~15-20/100k
  "cincinnati|US": 4.30,   // ~900/100k — CPD 2022 (87 homicides/310k pop = 28.1/100k)
  "louisville|US": 3.82,   // ~800/100k — LMPD 2022; homicide ~20-25/100k
  "philadelphia|US": 4.54, // ~950/100k — PPD 2022; homicide 32/100k (1.57M pop)
  //
  // Tier 3 — 609–812/100k → multiplier 3.0–3.99
  "pittsburgh|US": 3.20,   // ~670/100k — Pittsburgh PD 2022
  "fresno|US": 3.30,       // ~690/100k — FPD/California DOJ 2022
  "seattle|US": 3.53,      // ~740/100k — SPD 2022 (52 homicides, 750k pop; 4% increase)
  "tucson|US": 2.86,       // ~600/100k — TPD/Arizona UCR 2022
  "st. paul|US": 3.58,     // ~750/100k — SPPD 2022 (40 homicides, 310k pop)
  "san francisco|US": 3.10,// ~650/100k — SFPD 2022; robbery historically highest in Bay Area
  "portland|US": 3.44,     // ~720/100k — PPB/Oregon UCR 2022; property crime 2.2× national
  "los angeles|US": 3.63,  // ~760/100k — LAPD 2022; homicide 8.2/100k
  "las vegas|US": 3.62,    // ~758/100k — LVMPD 2022; homicide 13/100k
  "baton rouge|US": 3.10,  // ~650/100k — Louisiana UCR 2022 (murder 8.5/100k, rob 111/100k)
  "dallas|US": 3.14,       // 658.2/100k — DPD 2022 confirmed; homicide 13.6/100k
  "sacramento|US": 3.10,   // ~650/100k — California DOJ 2022
  //
  // Tier 4 — 406–608/100k → multiplier 2.0–2.99
  "denver|US": 2.63,       // ~550/100k — Colorado DCJ 2022 (state avg 492.5, Denver above)
  "oklahoma city|US": 2.85,// ~597/100k — OCPD 2022 annual report
  "new york|US": 3.46,     // ~725/100k — NYPD 2022; homicide 5.3/100k; violent up 17.8%
  "spokane|US": 2.82,      // ~591/100k — SPD 2022 (2024 rate 674.9; 2022 lower)
  "phoenix|US": 2.78,      // ~582/100k — PPD 2022; homicide 11.5/100k, robbery 168.8/100k
  "columbus|US": 2.77,     // ~580/100k — CPD/Ohio UCR 2022; homicide 14-16/100k
  "miami|US": 3.44,        // ~720/100k — MPD 2022 (FL had some NIBRS gaps)
  "charlotte|US": 2.39,    // ~500/100k — CMPD 2022; homicide 10-12/100k
  "boston|US": 2.70,       // ~565/100k — BPD 2022; homicide 5-7/100k
  "san antonio|US": 2.72,  // ~570/100k — SAPD 2022; homicide 8.5/100k
  "nashville|US": 2.50,    // ~524/100k — MNPD 2022; Tennessee 69% reporting; homicide ~14-16/100k
  //
  // Tier 5 — 203–405/100k → multiplier 1.0–1.99 (near or below national average)
  "colorado springs|US": 2.15, // ~450/100k — CSPD 2022; Colorado DCJ
  "tempe|US": 2.27,         // ~475/100k — TPD/Arizona UCR 2022 (college city, above AZ avg)
  "austin|US": 1.90,        // ~398/100k — APD 2022; near national avg
  "san diego|US": 1.92,     // ~402/100k — SDPD 2022; homicide 3-5/100k
  "madison|US": 1.30,       // ~272/100k — MPD/Wisconsin UCR 2022 (very low)
  "raleigh|US": 1.55,       // ~325/100k — RPD/North Carolina UCR 2022
  "chandler|US": 0.97,      // ~203/100k — CPD/Arizona UCR 2022 (2nd safest large city 2022)
  "fremont|US": 0.75,       // ~157/100k — FPD/California DOJ 2022 (5-yr avg 37.6/100k property)
  "henderson|US": 1.30,     // ~272/100k — HPD/Nevada UCR 2022
  "virginia beach|US": 1.00,// ~209/100k — VBPD 2022
  "san jose|US": 2.15,      // ~450/100k — SJPD 2022 (PlainCrime 2024=607; 2022 lower)
  //
  // Tier 6 — <203/100k → multiplier <1.0 (notably below national average)
  "scottsdale|US": 0.98,    // ~205/100k — SPD/Arizona UCR 2022
  "plano|US": 0.68,         // ~142/100k — PPD/Texas 2022 (143.3/100k confirmed)
  "gilbert|US": 0.56,       // ~117/100k — GPD/Arizona 2022 (116.6/100k = 2nd safest large city)
  "naperville|US": 0.33,    // ~69/100k — NPD/Illinois UCR 2022 (confirmed safe)
  "irvine|US": 0.24,        // ~50/100k — IPD/California DOJ 2022 (18× safest large US city)
  // ─ Canada ──────────────────────────────────────────────────────────────────
  "toronto|CA": 0.48,  "vancouver|CA": 0.62,  "montreal|CA": 0.52,
  "calgary|CA": 0.58,  "edmonton|CA": 0.82,   "ottawa|CA": 0.40,
  "winnipeg|CA": 0.90, "regina|CA": 1.00,
  // ─ United Kingdom ──────────────────────────────────────────────────────────
  "london|GB": 0.72,     "manchester|GB": 0.85,  "birmingham|GB": 0.88,
  "glasgow|GB": 0.80,    "liverpool|GB": 0.82,   "edinburgh|GB": 0.52,
  // ─ Western Europe ──────────────────────────────────────────────────────────
  "paris|FR": 0.65,      "marseille|FR": 0.92,   "lyon|FR": 0.62,
  "madrid|ES": 0.55,     "barcelona|ES": 0.62,   "seville|ES": 0.58,
  "berlin|DE": 0.50,     "frankfurt|DE": 0.62,   "hamburg|DE": 0.55,
  "rome|IT": 0.62,       "milan|IT": 0.60,       "naples|IT": 0.80,
  "amsterdam|NL": 0.58,  "brussels|BE": 0.68,
  "zurich|CH": 0.18,     "geneva|CH": 0.22,
  "vienna|AT": 0.20,
  "stockholm|SE": 0.38,  "oslo|NO": 0.25,       "copenhagen|DK": 0.28,
  "helsinki|FI": 0.20,   "reykjavik|IS": 0.12,
  // ─ Eastern Europe ──────────────────────────────────────────────────────────
  "warsaw|PL": 0.40,     "krakow|PL": 0.38,     "prague|CZ": 0.32,
  "budapest|HU": 0.42,   "bucharest|RO": 0.58,  "athens|GR": 0.52,
  "istanbul|TR": 0.75,   "ankara|TR": 0.60,
  // ─ Asia-Pacific — Low crime ────────────────────────────────────────────────
  "tokyo|JP": 0.12,       "osaka|JP": 0.12,       "kyoto|JP": 0.10,
  "yokohama|JP": 0.13,    "nagoya|JP": 0.14,
  "singapore|SG": 0.08,   "seoul|KR": 0.20,       "busan|KR": 0.22,
  "taipei|TW": 0.15,      "hong kong|HK": 0.30,
  "sydney|AU": 0.55,      "melbourne|AU": 0.50,   "brisbane|AU": 0.58,
  "auckland|NZ": 0.45,    "wellington|NZ": 0.40,
  // ─ Southeast Asia ──────────────────────────────────────────────────────────
  "bangkok|TH": 0.85,    "chiang mai|TH": 0.70,  "phuket|TH": 1.00,
  "hanoi|VN": 0.55,      "ho chi minh city|VN": 0.70,
  "jakarta|ID": 0.90,    "bali|ID": 0.75,         "surabaya|ID": 0.85,
  "manila|PH": 1.60,     "cebu|PH": 1.30,
  "kuala lumpur|MY": 0.80,
  // ─ South Asia ──────────────────────────────────────────────────────────────
  "mumbai|IN": 0.70,     "delhi|IN": 0.95,        "bangalore|IN": 0.72,
  "kolkata|IN": 0.80,    "karachi|PK": 2.80,      "lahore|PK": 1.80,
  "dhaka|BD": 1.40,      "colombo|LK": 0.65,
  // ─ Middle East — Low crime ─────────────────────────────────────────────────
  "dubai|AE": 0.12,      "abu dhabi|AE": 0.10,
  "doha|QA": 0.10,       "kuwait city|KW": 0.20,  "riyadh|SA": 0.30,
  "amman|JO": 0.38,      "muscat|OM": 0.20,
  "tel aviv|IL": 0.55,   "jerusalem|IL": 0.60,
  "beirut|LB": 2.50,     "baghdad|IQ": 3.50,      "kabul|AF": 4.00,
  "damascus|SY": 3.80,   "sana'a|YE": 4.00,
  // ─ Africa ──────────────────────────────────────────────────────────────────
  "cairo|EG": 0.80,      "alexandria|EG": 0.85,
  "casablanca|MA": 0.90, "marrakech|MA": 0.85,
  "nairobi|KE": 2.50,    "mombasa|KE": 2.00,
  "cape town|ZA": 3.20,  "johannesburg|ZA": 3.00, "durban|ZA": 2.80,
  "pretoria|ZA": 2.60,   "lagos|NG": 2.80,        "abuja|NG": 1.80,
  "accra|GH": 1.00,      "addis ababa|ET": 1.20,
  "dar es salaam|TZ": 1.60, "kampala|UG": 1.80,
  "kinshasa|CD": 2.80,   "bangui|CF": 3.00,       "khartoum|SD": 2.50,
  "mogadishu|SO": 4.50,  "bamako|ML": 2.60,       "ouagadougou|BF": 2.80,
  "tripoli|LY": 3.20,    "tunis|TN": 0.70,        "algiers|DZ": 0.80,
  // ─ Latin America — High crime ─────────────────────────────────────────────
  "caracas|VE": 4.50,    "maracaibo|VE": 4.00,
  "san pedro sula|HN": 4.00, "tegucigalpa|HN": 3.50,
  "port-au-prince|HT": 4.20,
  "acapulco|MX": 4.00,   "culiacan|MX": 3.80,     "ciudad juarez|MX": 3.50,
  "tijuana|MX": 3.20,    "monterrey|MX": 1.40,    "guadalajara|MX": 1.30,
  "mexico city|MX": 1.20,
  "bogota|CO": 2.00,     "medellin|CO": 2.40,     "cali|CO": 2.60,
  "cartagena|CO": 1.60,
  "guayaquil|EC": 2.50,  "quito|EC": 2.00,
  "san salvador|SV": 3.00, "managua|NI": 1.60,
  "panama city|PA": 1.40, "san jose|CR": 1.20,
  "lima|PE": 1.80,       "cusco|PE": 1.50,
  "santiago|CL": 1.20,   "valparaiso|CL": 1.40,
  "buenos aires|AR": 1.40, "rosario|AR": 1.80,
  "rio de janeiro|BR": 2.20, "sao paulo|BR": 1.60, "salvador|BR": 2.80,
  "fortaleza|BR": 2.60,  "recife|BR": 2.50,       "manaus|BR": 2.20,
  "brasilia|BR": 1.40,
  // ─ Caribbean ──────────────────────────────────────────────────────────────
  "kingston|JM": 2.80,   "nassau|BS": 1.60,       "havana|CU": 0.80,
  "santo domingo|DO": 1.80, "san juan|PR": 1.60,
  // ─ Russia & CIS ───────────────────────────────────────────────────────────
  "moscow|RU": 0.75,     "st. petersburg|RU": 0.70, "kyiv|UA": 1.80,
  "minsk|BY": 0.55,
  // ─ East Africa ────────────────────────────────────────────────────────────
  "yangon|MM": 2.50,
};

interface CrimeRates {
  robbery: number;
  assault: number;
  sexual_offense: number;
  kidnapping: number;
  burglary: number;
  home_invasion: number;
  vandalism: number;
  larceny_home: number;
  vehicle_theft: number;
  carjacking: number;
  vehicle_break_in: number;
  traffic_incident: number;
  drug_activity: number;
  public_disorder: number;
  weapons_offense: number;
}

// US national 2022 rates per 100k (UCR/NIBRS), used as a calibrated baseline.
const FBI_NATIONAL_PER_100K: CrimeRates = {
  robbery: 66, assault: 282, sexual_offense: 42, kidnapping: 4,
  burglary: 269, home_invasion: 12, vandalism: 91, larceny_home: 1401,
  vehicle_theft: 282, carjacking: 9, vehicle_break_in: 220, traffic_incident: 120,
  drug_activity: 410, public_disorder: 180, weapons_offense: 90,
};

const NIBRS_MAP: Record<string, keyof CrimeRates> = {
  "120": "robbery", "13A": "assault", "13B": "assault",
  "11A": "sexual_offense", "11B": "sexual_offense", "11C": "sexual_offense",
  "100": "kidnapping", "220": "burglary", "290": "vandalism",
  "23H": "larceny_home", "240": "vehicle_theft", "23F": "vehicle_break_in",
  "35A": "drug_activity", "90C": "public_disorder", "520": "weapons_offense",
};

/* ───────── live source helpers ───────── */

async function geocode(city: string, state: string | null, country: string)
  : Promise<{ lat: number; lon: number } | null> {
  if (!city) return null;
  try {
    const q = [city, state, country].filter(Boolean).join(", ");
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`;
    const r = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(6000) });
    if (!r.ok) return null;
    const j = await r.json();
    const hit = Array.isArray(j) ? j[0] : null;
    if (!hit?.lat || !hit?.lon) return null;
    return { lat: parseFloat(hit.lat), lon: parseFloat(hit.lon) };
  } catch { return null; }
}

function distKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371;
  const dLat = (bLat - aLat) * Math.PI / 180;
  const dLon = (bLon - aLon) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(aLat * Math.PI / 180) * Math.cos(bLat * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function fetchQuakes(lat: number, lon: number)
  : Promise<{ count: number; maxMag: number }> {
  try {
    const r = await fetch(
      "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_week.geojson",
      { signal: AbortSignal.timeout(6000) },
    );
    if (!r.ok) return { count: 0, maxMag: 0 };
    const j = await r.json();
    let count = 0, maxMag = 0;
    for (const f of j.features ?? []) {
      const [qLon, qLat] = f.geometry?.coordinates ?? [];
      if (typeof qLat !== "number" || typeof qLon !== "number") continue;
      if (distKm(lat, lon, qLat, qLon) <= 250) {
        count++;
        const mag = Number(f.properties?.mag ?? 0);
        if (mag > maxMag) maxMag = mag;
      }
    }
    return { count, maxMag };
  } catch { return { count: 0, maxMag: 0 }; }
}

async function fetchNwsAlerts(lat: number, lon: number, country: string)
  : Promise<{ count: number; severe: number }> {
  if (country !== "US") return { count: 0, severe: 0 };
  try {
    const r = await fetch(
      `https://api.weather.gov/alerts/active?point=${lat.toFixed(4)},${lon.toFixed(4)}`,
      { headers: { "User-Agent": UA, Accept: "application/geo+json" }, signal: AbortSignal.timeout(6000) },
    );
    if (!r.ok) return { count: 0, severe: 0 };
    const j = await r.json();
    let severe = 0;
    for (const f of j.features ?? []) {
      const sev = (f.properties?.severity ?? "").toLowerCase();
      if (sev === "severe" || sev === "extreme") severe++;
    }
    return { count: (j.features ?? []).length, severe };
  } catch { return { count: 0, severe: 0 }; }
}

async function fetchGdacs(lat: number, lon: number)
  : Promise<{ count: number; maxScore: number }> {
  try {
    const r = await fetch("https://www.gdacs.org/xml/rss.xml", {
      headers: { "User-Agent": UA }, signal: AbortSignal.timeout(7000),
    });
    if (!r.ok) return { count: 0, maxScore: 0 };
    const xml = await r.text();
    // extract <item>...<geo:Point>lat lon</geo:Point>...<gdacs:alertlevel>Green/Orange/Red</gdacs:alertlevel>
    const items = xml.split(/<item>/i).slice(1);
    let count = 0, maxScore = 0;
    for (const it of items) {
      const latM = it.match(/<geo:lat>([\-\d.]+)<\/geo:lat>/i);
      const lonM = it.match(/<geo:long>([\-\d.]+)<\/geo:long>/i);
      if (!latM || !lonM) continue;
      const aLat = parseFloat(latM[1]), aLon = parseFloat(lonM[1]);
      if (distKm(lat, lon, aLat, aLon) > 500) continue;
      const lvl = (it.match(/<gdacs:alertlevel>([^<]+)<\/gdacs:alertlevel>/i)?.[1] ?? "").toLowerCase();
      const score = lvl === "red" ? 3 : lvl === "orange" ? 2 : lvl === "green" ? 1 : 0;
      count++;
      if (score > maxScore) maxScore = score;
    }
    return { count, maxScore };
  } catch { return { count: 0, maxScore: 0 }; }
}

async function fetchOpenMeteo(lat: number, lon: number)
  : Promise<{ windKph: number; precipMm: number }> {
  try {
    const r = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=wind_speed_10m,precipitation`,
      { signal: AbortSignal.timeout(6000) },
    );
    if (!r.ok) return { windKph: 0, precipMm: 0 };
    const j = await r.json();
    return {
      windKph: Number(j.current?.wind_speed_10m ?? 0),
      precipMm: Number(j.current?.precipitation ?? 0),
    };
  } catch { return { windKph: 0, precipMm: 0 }; }
}

async function fetchOverpass(lat: number, lon: number)
  : Promise<{ policeNearby: number; hospitalsNearby: number }> {
  try {
    const query = `[out:json][timeout:8];
      (node["amenity"="police"](around:5000,${lat},${lon}););out count;
      (node["amenity"="hospital"](around:5000,${lat},${lon}););out count;`;
    const r = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": UA },
      body: "data=" + encodeURIComponent(query),
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) return { policeNearby: 0, hospitalsNearby: 0 };
    const j = await r.json();
    const els = j.elements ?? [];
    const counts = els.filter((e: any) => e.type === "count")
      .map((e: any) => Number(e.tags?.total ?? e.tags?.nodes ?? 0));
    return {
      policeNearby: counts[0] ?? 0,
      hospitalsNearby: counts[1] ?? 0,
    };
  } catch { return { policeNearby: 0, hospitalsNearby: 0 }; }
}

/* ───────── optional FBI CDE branch ───────── */

async function fbiResolveAgency(city: string, state: string | null) {
  const apiKey = Deno.env.get("FBI_CDE_API_KEY");
  if (!apiKey || !city || !state) return null;
  try {
    const url = `https://api.usa.gov/crime/fbi/cde/agencies/byStateAbbr/${state.toUpperCase()}?API_KEY=${apiKey}`;
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;
    const list = await r.json();
    if (!Array.isArray(list)) return null;
    const cl = city.toLowerCase();
    const hit =
      list.find((a: any) => /police/i.test(a?.agency_name ?? "") && a.agency_name.toLowerCase().includes(cl)) ??
      list.find((a: any) => a?.agency_name?.toLowerCase?.().includes(cl));
    if (!hit?.ori) return null;
    return { ori: hit.ori, agency: hit.agency_name, population: Number(hit.population ?? 0) };
  } catch { return null; }
}
async function fbiOffenses(ori: string) {
  const apiKey = Deno.env.get("FBI_CDE_API_KEY");
  if (!apiKey) return null;
  try {
    const url = `https://api.usa.gov/crime/fbi/cde/summarized/agency/${ori}/offenses?from=2022&to=2022&API_KEY=${apiKey}`;
    const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!r.ok) return null;
    const j = await r.json();
    const counts: Record<string, number> = {};
    const actuals = j?.offenses?.actuals?.["2022"] ?? j?.offenses?.["2022"] ?? j?.offenses ?? {};
    if (actuals && typeof actuals === "object") {
      for (const [k, v] of Object.entries(actuals)) {
        if (typeof v === "number") counts[k] = v;
        else if (v && typeof v === "object") {
          const t = (v as any).Total ?? (v as any).total;
          if (typeof t === "number") counts[k] = t;
        }
      }
    }
    return Object.keys(counts).length ? counts : null;
  } catch { return null; }
}
function fbiOffensesToRates(counts: Record<string, number>, population: number): Partial<CrimeRates> {
  if (!population || population < 1000) return {};
  const per100k = (n: number) => (n / population) * 100_000;
  const agg: Partial<Record<keyof CrimeRates, number>> = {};
  for (const [code, n] of Object.entries(counts)) {
    const key = NIBRS_MAP[code];
    if (!key || typeof n !== "number") continue;
    agg[key] = (agg[key] ?? 0) + n;
  }
  const rates: Partial<CrimeRates> = {};
  for (const [k, v] of Object.entries(agg)) rates[k as keyof CrimeRates] = Math.round(per100k(v as number));
  return rates;
}

/* ───────── new live sources: NASA + ACLED + News ───────── */

interface FireSignals { activeFires: number; maxConfidence: number; nearestKm: number }
async function fetchNasaFirms(lat: number, lon: number): Promise<FireSignals> {
  const key = Deno.env.get("NASA_FIRMS_MAP_KEY");
  if (!key) return { activeFires: 0, maxConfidence: 0, nearestKm: 9999 };
  const dLat = 1.35; // ~150 km
  const dLon = 1.35 / Math.max(0.2, Math.cos(lat * Math.PI / 180));
  const west = (lon - dLon).toFixed(3);
  const south = (lat - dLat).toFixed(3);
  const east = (lon + dLon).toFixed(3);
  const north = (lat + dLat).toFixed(3);
  const area = `${west},${south},${east},${north}`;
  // Try VIIRS first (best resolution), then MODIS as a fallback.
  const datasets = ["VIIRS_SNPP_NRT", "MODIS_NRT"];
  for (const ds of datasets) {
    try {
      const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${key}/${ds}/${area}/2`;
      const r = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(8000) });
      if (!r.ok) continue;
      const text = await r.text();
      // Invalid-key body looks like "Invalid MAP_KEY..." — skip without throwing.
      if (/Invalid|exceeded|MAP_KEY/i.test(text.slice(0, 200)) && !text.includes(",")) continue;
      const lines = text.trim().split(/\r?\n/);
      if (lines.length < 2) continue;
      const header = lines[0].split(",").map((s) => s.trim().toLowerCase());
      const li = header.indexOf("latitude");
      const lo = header.indexOf("longitude");
      const ci = header.indexOf("confidence");
      if (li < 0 || lo < 0) continue;
      let count = 0, maxConf = 0, nearest = 9999;
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(",");
        const fLat = parseFloat(cols[li]);
        const fLon = parseFloat(cols[lo]);
        if (!Number.isFinite(fLat) || !Number.isFinite(fLon)) continue;
        const d = distKm(lat, lon, fLat, fLon);
        if (d > 150) continue;
        count++;
        if (d < nearest) nearest = d;
        const c = (cols[ci] ?? "").trim();
        const conf = c === "h" ? 90 : c === "n" ? 60 : c === "l" ? 30 : Number(c) || 0;
        if (conf > maxConf) maxConf = conf;
      }
      if (count > 0) return { activeFires: count, maxConfidence: maxConf, nearestKm: Math.round(nearest) };
    } catch { /* try next dataset */ }
  }
  return { activeFires: 0, maxConfidence: 0, nearestKm: 9999 };
}

interface EonetSignals {
  activeEvents: number;
  categories: string[];
  wildfiresNearby: number;     // EONET wildfires within 150 km
  wildfiresRegional: number;   // EONET wildfires within 400 km
  nearestWildfireKm: number;
  volcanoNearby: boolean;
  stormNearby: boolean;
}
async function fetchNasaEonet(lat: number, lon: number): Promise<EonetSignals> {
  const empty: EonetSignals = {
    activeEvents: 0, categories: [], wildfiresNearby: 0, wildfiresRegional: 0,
    nearestWildfireKm: 9999, volcanoNearby: false, stormNearby: false,
  };
  try {
    // 30-day window, large limit. Wildfires dominate this feed (~95% of events).
    const r = await fetch(
      "https://eonet.gsfc.nasa.gov/api/v3/events?status=open&days=30&limit=500",
      { signal: AbortSignal.timeout(8000) },
    );
    if (!r.ok) return empty;
    const j = await r.json();
    const cats = new Set<string>();
    let count = 0, wfNear = 0, wfReg = 0, nearest = 9999;
    let volcano = false, storm = false;
    for (const ev of j.events ?? []) {
      const geom = ev.geometry?.[ev.geometry.length - 1];
      const coords = geom?.coordinates;
      if (!Array.isArray(coords) || coords.length < 2) continue;
      const [eLon, eLat] = coords;
      if (typeof eLat !== "number" || typeof eLon !== "number") continue;
      const d = distKm(lat, lon, eLat, eLon);
      if (d > 600) continue;
      const evCats = (ev.categories ?? []).map((c: any) => String(c?.title ?? ""));
      const isFire = evCats.some((c: string) => /Wildfire/i.test(c));
      const isVolc = evCats.some((c: string) => /Volcano/i.test(c));
      const isStorm = evCats.some((c: string) => /Storm|Cyclone|Hurricane|Typhoon/i.test(c));
      if (d <= 400) {
        count++;
        for (const c of evCats) if (c) cats.add(c);
      }
      if (isFire) {
        if (d <= 150) wfNear++;
        if (d <= 400) wfReg++;
        if (d < nearest) nearest = d;
      }
      if (isVolc && d <= 200) volcano = true;
      if (isStorm && d <= 500) storm = true;
    }
    return {
      activeEvents: count,
      categories: [...cats].slice(0, 6),
      wildfiresNearby: wfNear,
      wildfiresRegional: wfReg,
      nearestWildfireKm: Math.round(nearest),
      volcanoNearby: volcano,
      stormNearby: storm,
    };
  } catch { return empty; }
}

interface ConflictSignals {
  events30d: number;
  fatalities30d: number;
  severity: number;          // 0=Low, 1=Turbulent, 2=High, 3=Extreme
  tier: string;
  sanctioned: boolean;       // OFAC/EU comprehensive sanctions
  sanctionsTier: number;     // 0=none, 1=targeted, 2=comprehensive
  travelAdvisory: number;    // 0=none, 1=increased caution, 2=reconsider, 3=do not travel
  notes: string[];
}
// Static mirror of the most recent ACLED Conflict Index (acleddata.com/conflict-index)
// + US State Dept travel advisories + OFAC/EU comprehensive sanctions.
// Severity: 3 = Extreme, 2 = High, 1 = Turbulent, 0 = Low/None.
// SanctionsTier: 2 = comprehensive (RU, IR, KP, SY, CU, BY-partial),
//                1 = targeted/sectoral (VE, MM-junta, AF-Taliban, etc.)
// Refresh this table when ACLED publishes their semi-annual update.
const ACLED_INDEX: Record<string, {
  severity: number; tier: string; events30d: number; fatalities30d: number;
  sanctioned?: boolean; sanctionsTier?: number; travelAdvisory?: number; notes?: string[];
}> = {
  // Extreme — active war / large-scale violence
  UA: { severity: 3, tier: "Extreme", events30d: 2800, fatalities30d: 1200, travelAdvisory: 3, notes: ["Active war zone — Russian invasion ongoing"] },
  RU: { severity: 3, tier: "Extreme", events30d: 1500, fatalities30d: 400,  sanctioned: true, sanctionsTier: 2, travelAdvisory: 3, notes: ["Comprehensive sanctions (OFAC/EU)", "Wartime restrictions, arbitrary detention risk"] },
  PS: { severity: 3, tier: "Extreme", events30d: 1100, fatalities30d: 1900, travelAdvisory: 3, notes: ["Active conflict — Gaza/West Bank"] },
  SY: { severity: 3, tier: "Extreme", events30d: 760,  fatalities30d: 620,  sanctioned: true, sanctionsTier: 2, travelAdvisory: 3, notes: ["Comprehensive sanctions", "Civil war legacy + ISIS remnants"] },
  MM: { severity: 3, tier: "Extreme", events30d: 1100, fatalities30d: 1400, sanctioned: true, sanctionsTier: 1, travelAdvisory: 3, notes: ["Junta-targeted sanctions", "Civil war"] },
  SD: { severity: 3, tier: "Extreme", events30d: 540,  fatalities30d: 1100, travelAdvisory: 3, notes: ["RSF/SAF civil war"] },
  YE: { severity: 3, tier: "Extreme", events30d: 380,  fatalities30d: 260,  travelAdvisory: 3, notes: ["Houthi conflict, missile/drone strikes"] },
  KP: { severity: 3, tier: "Extreme", events30d: 0,    fatalities30d: 0,    sanctioned: true, sanctionsTier: 2, travelAdvisory: 3, notes: ["Comprehensive sanctions", "Detention of foreigners, no consular access"] },
  // High — sustained violence or severe state risk
  IR: { severity: 2, tier: "High",    events30d: 220,  fatalities30d: 130,  sanctioned: true, sanctionsTier: 2, travelAdvisory: 3, notes: ["Comprehensive sanctions", "Hostage diplomacy, IRGC threat"] },
  IL: { severity: 2, tier: "High",    events30d: 280,  fatalities30d: 110,  travelAdvisory: 2, notes: ["Active conflict spillover, rocket fire"] },
  LB: { severity: 2, tier: "High",    events30d: 320,  fatalities30d: 240,  travelAdvisory: 3, notes: ["Israel-Hezbollah conflict zone"] },
  IQ: { severity: 2, tier: "High",    events30d: 280,  fatalities30d: 180,  travelAdvisory: 3, notes: ["Militia activity, ISIS remnants"] },
  AF: { severity: 2, tier: "High",    events30d: 220,  fatalities30d: 150,  sanctioned: true, sanctionsTier: 1, travelAdvisory: 3, notes: ["Taliban-targeted sanctions", "Kidnapping risk"] },
  PK: { severity: 2, tier: "High",    events30d: 230,  fatalities30d: 180,  travelAdvisory: 2, notes: ["TTP attacks, Balochistan unrest"] },
  CU: { severity: 1, tier: "Turbulent", events30d: 30, fatalities30d: 5,    sanctioned: true, sanctionsTier: 2, travelAdvisory: 2, notes: ["Comprehensive sanctions"] },
  BY: { severity: 1, tier: "Turbulent", events30d: 60, fatalities30d: 10,   sanctioned: true, sanctionsTier: 2, travelAdvisory: 3, notes: ["Comprehensive sanctions", "Wrongful detention risk"] },
  VE: { severity: 1, tier: "Turbulent", events30d: 70, fatalities30d: 40,   sanctioned: true, sanctionsTier: 1, travelAdvisory: 3, notes: ["Sectoral sanctions", "Wrongful detention"] },
  MX: { severity: 2, tier: "High",    events30d: 600,  fatalities30d: 850, travelAdvisory: 2, notes: ["Cartel violence in border/coastal regions"] },
  NG: { severity: 2, tier: "High",    events30d: 480,  fatalities30d: 720, travelAdvisory: 2 },
  SO: { severity: 2, tier: "High",    events30d: 360,  fatalities30d: 420, travelAdvisory: 3, notes: ["Al-Shabaab, kidnapping for ransom"] },
  CD: { severity: 2, tier: "High",    events30d: 410,  fatalities30d: 580, travelAdvisory: 3 },
  ML: { severity: 2, tier: "High",    events30d: 220,  fatalities30d: 380, travelAdvisory: 3 },
  BF: { severity: 2, tier: "High",    events30d: 250,  fatalities30d: 420, travelAdvisory: 3 },
  HT: { severity: 2, tier: "High",    events30d: 180,  fatalities30d: 240, travelAdvisory: 3, notes: ["Gang control of Port-au-Prince"] },
  CO: { severity: 2, tier: "High",    events30d: 320,  fatalities30d: 220, travelAdvisory: 2 },
  ET: { severity: 2, tier: "High",    events30d: 290,  fatalities30d: 380, travelAdvisory: 3 },
  // Turbulent
  CM: { severity: 1, tier: "Turbulent", events30d: 90,  fatalities30d: 60 },
  NE: { severity: 1, tier: "Turbulent", events30d: 110, fatalities30d: 80 },
  CF: { severity: 1, tier: "Turbulent", events30d: 70,  fatalities30d: 50 },
  MZ: { severity: 1, tier: "Turbulent", events30d: 60,  fatalities30d: 40 },
  SS: { severity: 1, tier: "Turbulent", events30d: 80,  fatalities30d: 70 },
  LY: { severity: 1, tier: "Turbulent", events30d: 50,  fatalities30d: 30 },
  EC: { severity: 1, tier: "Turbulent", events30d: 60,  fatalities30d: 50, notes: ["Cartel-driven homicide spike"] },
  EG: { severity: 1, tier: "Turbulent", events30d: 40,  fatalities30d: 25, travelAdvisory: 2, notes: ["Sinai conflict, terror risk"] },
  JO: { severity: 0, tier: "Low",       events30d: 10,  fatalities30d: 2,  travelAdvisory: 1, notes: ["Border tension with conflict zones"] },
  TR: { severity: 1, tier: "Turbulent", events30d: 70,  fatalities30d: 30, travelAdvisory: 2 },
  SA: { severity: 0, tier: "Low",       events30d: 5,   fatalities30d: 1,  travelAdvisory: 1, notes: ["Houthi missile/drone risk in south"] },
};
async function fetchAcled(country: string): Promise<ConflictSignals> {
  const row = ACLED_INDEX[country];
  const base: ConflictSignals = {
    events30d: 0, fatalities30d: 0, severity: 0, tier: "Low",
    sanctioned: false, sanctionsTier: 0, travelAdvisory: 0, notes: [],
  };
  if (!row) return base;
  return {
    events30d: row.events30d,
    fatalities30d: row.fatalities30d,
    severity: row.severity,
    tier: row.tier,
    sanctioned: !!row.sanctioned,
    sanctionsTier: row.sanctionsTier ?? 0,
    travelAdvisory: row.travelAdvisory ?? 0,
    notes: row.notes ?? [],
  };
}

/* ───────── US State Department travel advisories (live) ─────────
 * Source: https://cadataapi.state.gov/api/TravelAdvisories
 * Returns one entry per country with an advisory level (1–4) and summary.
 * Cached in-process for 6 hours since the dataset only changes a few times/week.
 */
interface StateDeptAdvisory {
  level: number;          // 1=Exercise normal, 2=Increased caution, 3=Reconsider, 4=Do not travel
  levelLabel: string;
  countryName: string;
  title: string;
  summary: string;
  publishedAt: string | null;
  url: string;
}
const STATE_DEPT_TTL_MS = 6 * 60 * 60 * 1000;
let stateDeptCache: { at: number; map: Record<string, StateDeptAdvisory> } | null = null;

// Map ISO-2 → State Dept country codes (their `country_id` is usually a slug/abbrev).
function normLevel(raw: unknown): number {
  if (typeof raw === "number") return Math.max(0, Math.min(4, Math.round(raw)));
  const s = String(raw ?? "").toLowerCase();
  const m = s.match(/level\s*(\d)/);
  if (m) return Math.max(0, Math.min(4, Number(m[1])));
  if (/do not travel/.test(s)) return 4;
  if (/reconsider/.test(s)) return 3;
  if (/increased caution/.test(s)) return 2;
  if (/normal/.test(s)) return 1;
  return 0;
}
function levelLabel(n: number): string {
  return n === 4 ? "Do Not Travel"
    : n === 3 ? "Reconsider Travel"
    : n === 2 ? "Exercise Increased Caution"
    : n === 1 ? "Exercise Normal Precautions"
    : "No Advisory";
}
function stripHtml(s: string): string {
  return String(s ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
async function loadStateDeptAdvisories(): Promise<Record<string, StateDeptAdvisory>> {
  if (stateDeptCache && Date.now() - stateDeptCache.at < STATE_DEPT_TTL_MS) {
    return stateDeptCache.map;
  }
  try {
    const r = await fetch("https://cadataapi.state.gov/api/TravelAdvisories", {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) return stateDeptCache?.map ?? {};
    const j = await r.json();
    const list: any[] = Array.isArray(j) ? j : (j?.data ?? j?.value ?? j?.TravelAdvisories ?? []);
    const map: Record<string, StateDeptAdvisory> = {};
    // State Dept uses 2-letter "FIPS-style" country codes (e.g. HA = Haiti, MX = Mexico).
    // Map the few that differ from ISO-3166 alpha-2 so common lookups work.
    const FIPS_TO_ISO2: Record<string, string> = {
      HA: "HT", GM: "DE", SP: "ES", SW: "SE", SZ: "CH", DA: "DK",
      UK: "GB", IZ: "IQ", IR: "IR", KS: "KR", KN: "KP", BU: "BG",
      RP: "PH", VM: "VN", BR: "BR", CH: "CN", JA: "JP", TW: "TW",
      AS: "AU", MX: "MX", CA: "CA", US: "US",
    };
    for (const row of list) {
      const title = String(row.Title ?? row.title ?? "").trim();
      const link = String(row.Link ?? row.link ?? "").trim();
      const summary = stripHtml(row.Summary ?? row.summary ?? row.Description ?? "").slice(0, 600);
      const cats: string[] = Array.isArray(row.Category) ? row.Category : (row.Category ? [row.Category] : []);
      const level = normLevel(title || row.AdvisoryLevel || row.Level);
      // Country name parsed out of "<Country> - Level N: …".
      const nameMatch = title.match(/^([^-]+?)\s*[-–]\s*Level/i);
      const countryName = nameMatch ? nameMatch[1].trim() : title;
      for (const raw of cats) {
        const code = String(raw ?? "").toUpperCase().slice(0, 2);
        if (!code) continue;
        const iso2 = FIPS_TO_ISO2[code] ?? code;
        map[iso2] = {
          level, levelLabel: levelLabel(level),
          countryName, title, summary,
          publishedAt: row.PubDate ?? row.PublishedDate ?? row.published ?? null,
          url: link || `https://travel.state.gov/content/travel/en/traveladvisories/traveladvisories.html`,
        };
      }
    }
    stateDeptCache = { at: Date.now(), map };
    return map;
  } catch {
    return stateDeptCache?.map ?? {};
  }
}
async function fetchStateDept(country: string): Promise<StateDeptAdvisory | null> {
  if (!country) return null;
  const map = await loadStateDeptAdvisories();
  return map[country.toUpperCase()] ?? null;
}

interface NewsHeadline { title: string; link: string; source: string; pubDate?: string }
function decodeXmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}
function parseRssItems(xml: string, sourceLabel: string, limit = 5): NewsHeadline[] {
  const items: NewsHeadline[] = [];
  const blocks = xml.split(/<item[\s>]/i).slice(1);
  for (const b of blocks.slice(0, limit * 2)) {
    const title = b.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i)?.[1]?.trim();
    const link = b.match(/<link>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i)?.[1]?.trim();
    const pub = b.match(/<pubDate>([\s\S]*?)<\/pubDate>/i)?.[1]?.trim();
    if (!title || !link) continue;
    items.push({
      title: decodeXmlEntities(title),
      link: decodeXmlEntities(link),
      source: sourceLabel,
      pubDate: pub,
    });
    if (items.length >= limit) break;
  }
  return items;
}
async function fetchHeadlines(city: string, country: string): Promise<NewsHeadline[]> {
  if (!city) return [];
  // Restrict to the past 7 days and bias toward safety/crime relevance for the
  // current city. Google News' `when:` operator handles the time bound; we add
  // a topical clause so unrelated lifestyle stories don't crowd out signal.
  const relevance =
    "(crime OR shooting OR police OR safety OR protest OR fire OR weather OR emergency OR arrest OR robbery OR assault)";
  const q = encodeURIComponent(`"${city}" ${relevance} when:7d`);
  const gl = (country || "US").toUpperCase();
  const googleUrl =
    `https://news.google.com/rss/search?q=${q}&hl=en-US&gl=${gl}&ceid=${gl}:en`;
  try {
    const xml = await fetch(googleUrl, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(7000),
    }).then((r) => (r.ok ? r.text() : "")).catch(() => "");

    // Hard time bound: 7 days, matching the search operator.
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const cityLc = city.toLowerCase();
    const relevanceRe =
      /\b(crime|shoot|police|safety|protest|fire|emergency|arrest|robbery|assault|stab|attack|storm|flood|evacuat|warning|advisory)\b/i;

    const items = parseRssItems(xml, "Google News", 40)
      .map((h) => {
        if (h.link.includes("news.google.com")) {
          const m = h.link.match(/url=([^&]+)/);
          if (m) h.link = decodeURIComponent(m[1]);
        }
        try {
          const host = new URL(h.link).hostname.replace(/^www\./, "");
          h.source = host;
        } catch { /* keep default */ }
        return h;
      })
      .filter((h) => {
        // Time bound
        if (!h.pubDate) return false;
        const t = Date.parse(h.pubDate);
        if (!Number.isFinite(t) || t < cutoff) return false;
        // Relevance: must mention the city AND a safety-related keyword
        const title = h.title.toLowerCase();
        if (!title.includes(cityLc)) return false;
        if (!relevanceRe.test(title)) return false;
        return true;
      })
      .sort((a, b) => Date.parse(b.pubDate!) - Date.parse(a.pubDate!));

    const seen = new Set<string>();
    const merged = items.filter((h) => {
      if (seen.has(h.link)) return false;
      seen.add(h.link);
      return true;
    });
    return merged.slice(0, 5);
  } catch {
    return [];
  }
}

/* ───────── CDC / WHO RSS caches (1-hour TTL — feeds are global, not per city) ── */
const RSS_TTL_MS = 60 * 60 * 1000;
let cdcRssCache: { at: number; xml: string } | null = null;
let whoRssCache: { at: number; xml: string } | null = null;

/** CDC Level-1/2/3 travel health notices filtered to a specific country. */
async function fetchCdcTravelNotices(
  _country: string,
  countryName: string,
): Promise<{ notices: CdcNotice[]; maxLevel: number }> {
  const empty = { notices: [], maxLevel: 0 };
  if (!countryName) return empty;
  try {
    let xml: string;
    if (cdcRssCache && Date.now() - cdcRssCache.at < RSS_TTL_MS) {
      xml = cdcRssCache.xml;
    } else {
      const r = await fetch("https://wwwnc.cdc.gov/travel/rss/travelnotices.xml", {
        headers: { "User-Agent": UA },
        signal: AbortSignal.timeout(8000),
      });
      if (!r.ok) return empty;
      xml = await r.text();
      cdcRssCache = { at: Date.now(), xml };
    }
    const items = xml.split(/<item>/i).slice(1);
    const notices: CdcNotice[] = [];
    const nameLc = countryName.toLowerCase();
    let maxLevel = 0;
    for (const it of items) {
      const rawTitle = it.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i)?.[1]?.trim() ?? "";
      if (!rawTitle.toLowerCase().includes(nameLc)) continue;
      const link = it.match(/<link>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i)?.[1]?.trim() ?? "";
      const desc = it.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i)?.[1]?.trim() ?? "";
      const pub  = it.match(/<pubDate>([\s\S]*?)<\/pubDate>/i)?.[1]?.trim();
      // CDC titles: "Level 2 – Practice Enhanced Precautions: Country"
      const lvlM = rawTitle.match(/Level\s*(\d)/i);
      const level = lvlM ? Math.min(3, Math.max(1, parseInt(lvlM[1]))) : 1;
      if (level > maxLevel) maxLevel = level;
      notices.push({
        title: decodeXmlEntities(rawTitle),
        level,
        link: decodeXmlEntities(link),
        summary: stripHtml(decodeXmlEntities(desc)).slice(0, 300),
        pubDate: pub,
      });
      if (notices.length >= 3) break;
    }
    return { notices, maxLevel };
  } catch { return empty; }
}

/** WHO Disease Outbreak News RSS filtered to country and disease keywords. */
async function fetchWhoOutbreaks(
  countryName: string,
): Promise<{ outbreaks: { title: string; link: string; pubDate?: string }[]; count: number }> {
  const empty = { outbreaks: [], count: 0 };
  if (!countryName) return empty;
  try {
    let xml: string;
    if (whoRssCache && Date.now() - whoRssCache.at < RSS_TTL_MS) {
      xml = whoRssCache.xml;
    } else {
      const r = await fetch("https://www.who.int/rss-feeds/news-releases-en.xml", {
        headers: { "User-Agent": UA },
        signal: AbortSignal.timeout(8000),
      });
      if (!r.ok) return empty;
      xml = await r.text();
      whoRssCache = { at: Date.now(), xml };
    }
    const items = xml.split(/<item>/i).slice(1);
    const outbreaks: { title: string; link: string; pubDate?: string }[] = [];
    const nameLc = countryName.toLowerCase();
    const outbreakRe =
      /\b(outbreak|disease|epidemic|virus|cholera|dengue|malaria|ebola|mpox|monkeypox|influenza|measles|covid|plague|typhoid|yellow fever|meningitis)\b/i;
    const cutoff = Date.now() - 90 * 24 * 3600_000; // 90-day window
    for (const it of items) {
      const title = it.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i)?.[1]?.trim() ?? "";
      const link  = it.match(/<link>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i)?.[1]?.trim() ?? "";
      const pub   = it.match(/<pubDate>([\s\S]*?)<\/pubDate>/i)?.[1]?.trim();
      if (!title || !title.toLowerCase().includes(nameLc) || !outbreakRe.test(title)) continue;
      if (pub) {
        const t = Date.parse(pub);
        if (Number.isFinite(t) && t < cutoff) continue;
      }
      outbreaks.push({ title: decodeXmlEntities(title), link: decodeXmlEntities(link), pubDate: pub });
      if (outbreaks.length >= 3) break;
    }
    return { outbreaks, count: outbreaks.length };
  } catch { return empty; }
}

/** ReliefWeb UN disaster/alert database filtered to a country (by name). */
async function fetchReliefWebAlerts(
  countryName: string,
): Promise<{ alerts: { name: string; type: string }[]; count: number }> {
  const empty = { alerts: [], count: 0 };
  if (!countryName) return empty;
  try {
    const url =
      `https://api.reliefweb.int/v1/disasters?appname=kipita-safety` +
      `&filter[field]=country.name&filter[value]=${encodeURIComponent(countryName)}` +
      `&limit=5&sort[]=date.created:desc` +
      `&fields[include][]=name&fields[include][]=primary_type`;
    const r = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return empty;
    const j = await r.json();
    const items: any[] = j?.data ?? [];
    const alerts = items.slice(0, 5).map((item: any) => ({
      name: item.fields?.name ?? "Unknown",
      type: item.fields?.primary_type?.name ?? item.fields?.["primary_type.name"] ?? "Disaster",
    }));
    return { alerts, count: alerts.length };
  } catch { return empty; }
}

/* ───────── Advisory reconciliation ────────────────────────────────────────
 * Combines State Dept, ACLED, CDC, WHO, and ReliefWeb into one advisory level.
 * Strategy: confidence-weighted average, biased toward the maximum when sources
 * disagree (conservative / safety-first). Agreement metric flags outliers.
 */
function reconcileAdvisories(sources: AdvisorySource[]): AdvisoryReconciliation {
  const active = sources.filter((s) => s.level > 0);
  if (!active.length) {
    return {
      finalLevel: 0, weightedLevel: 0,
      agreement: "HIGH", overallConfidence: sources.length > 0 ? 0.40 : 0.20,
      sources,
    };
  }

  let wSum = 0, wTotal = 0;
  for (const s of active) { wSum += s.level * s.confidence; wTotal += s.confidence; }
  const weightedLevel = wTotal > 0 ? Math.round((wSum / wTotal) * 10) / 10 : 0;

  const levels = active.map((s) => s.level);
  const maxL = Math.max(...levels);
  const minL = Math.min(...levels);
  const spread = maxL - minL;
  const agreement: AdvisoryReconciliation["agreement"] =
    spread === 0 ? "HIGH" : spread === 1 ? "MEDIUM" : "LOW";

  // Bias toward max when sources disagree (safety-conservative)
  const spreadBias = spread >= 2 ? 0.65 : spread === 1 ? 0.40 : 0;
  const finalRaw   = weightedLevel * (1 - spreadBias) + maxL * spreadBias;
  const finalLevel = Math.min(4, Math.max(0, Math.round(finalRaw)));

  const avgConf       = active.reduce((s, a) => s + a.confidence, 0) / active.length;
  const sourceFactor  = Math.min(1, active.length * 0.28 + 0.16);
  const overallConfidence = Math.min(1, Math.round(((avgConf + sourceFactor) / 2) * 100) / 100);

  return { finalLevel, weightedLevel, agreement, overallConfidence, sources };
}

/* ───────── City-level realism multiplier ───────────────────────────────────
 * Returns a calibrated multiplier for well-known cities; null for unknown ones
 * (unknown cities fall back to the hash-based variance ±25%).
 */
function lookupCityMultiplier(city: string, country: string): number | null {
  if (!city || !country) return null;
  const key = `${city.toLowerCase().trim()}|${country.toUpperCase()}`;
  const val = CITY_CRIME_INDEX[key];
  if (val == null) return null;
  return Math.max(0.06, Math.min(5.0, val));
}

/* ───────── in-memory cache (per-edge-instance, 10-minute TTL) ───────── */
const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, { at: number; payload: unknown }>();
function cacheKey(city: string, state: string | null, country: string, lat: number | null, lon: number | null) {
  const ll = lat != null && lon != null ? `${lat.toFixed(2)},${lon.toFixed(2)}` : "";
  return `${country}|${state ?? ""}|${city.toLowerCase()}|${ll}`;
}

// Convert live signals into per-100k-equivalent rates the engine can consume.
// Crime rates come from FBI national baseline (or CDE if available); environmental
// signals (quakes, weather, GDACS, wind, precip) are projected onto the
// engine's environment categories so the score reacts to live conditions.
function buildRates(opts: {
  fbiPartial: Partial<CrimeRates> | null;
  signals: {
    quakes: { count: number; maxMag: number };
    weather: { count: number; severe: number };
    gdacs: { count: number; maxScore: number };
    meteo: { windKph: number; precipMm: number };
    overpass: { policeNearby: number; hospitalsNearby: number };
    fires: FireSignals;
    eonet: EonetSignals;
    conflict: ConflictSignals;
  };
  variance: number;          // -1..1 from city seed (fallback when city unknown)
  cityMultiplier?: number | null; // from CITY_CRIME_INDEX (takes priority over variance)
}): CrimeRates {
  const { fbiPartial, signals, variance, cityMultiplier } = opts;
  const TYPICAL_BIAS = 0.55;
  const biased: CrimeRates = { ...FBI_NATIONAL_PER_100K };
  for (const k of Object.keys(biased) as (keyof CrimeRates)[]) {
    biased[k] = Math.round(biased[k] * TYPICAL_BIAS);
  }
  const base: CrimeRates = { ...biased, ...(fbiPartial ?? {}) };

  // Calibrated city multiplier when available, otherwise ±25% hash-variance.
  // FBI-measured categories are already city-specific — never double-adjust them.
  const fbiCoveredKeys = new Set(Object.keys(fbiPartial ?? {}));
  const hashV = 1 + Math.max(-1, Math.min(1, variance)) * 0.25;
  const calV  = cityMultiplier != null ? Math.max(0.06, Math.min(5.0, cityMultiplier)) : hashV;

  const policeDiscount = Math.max(0.65, 1 - Math.min(signals.overpass.policeNearby, 12) * 0.03);

  // Storm/cyclone pressure — combines NOAA, GDACS, EONET storm flag, and
  // raw wind/precip from Open-Meteo (catches typhoons/hurricanes globally).
  const stormFactor =
    1 +
    Math.min(signals.weather.severe, 3) * 0.35 +
    Math.min(signals.gdacs.maxScore, 3) * 0.30 +
    (signals.eonet.stormNearby ? 0.30 : 0) +
    (signals.meteo.windKph >= 90 ? 0.70 : signals.meteo.windKph >= 60 ? 0.40 : signals.meteo.windKph >= 35 ? 0.15 : 0) +
    (signals.meteo.precipMm >= 25 ? 0.45 : signals.meteo.precipMm >= 10 ? 0.25 : signals.meteo.precipMm >= 3 ? 0.10 : 0);

  const quakeFactor =
    1 +
    (signals.quakes.maxMag >= 6 ? 0.85 : signals.quakes.maxMag >= 5 ? 0.50 : signals.quakes.maxMag >= 3 ? 0.15 : 0) +
    Math.min(signals.quakes.count, 10) * 0.02;

  // Wildfire pressure: combine FIRMS satellite hotspots with NASA EONET fire
  // events (FIRMS needs an API key; EONET works without one and covers most
  // major active wildfires globally).
  const wfActive = signals.fires.activeFires + signals.eonet.wildfiresNearby * 4;
  const wfNearestKm = Math.min(signals.fires.nearestKm, signals.eonet.nearestWildfireKm);
  const fireFactor = wfActive === 0
    ? 1
    : 1 +
      Math.min(wfActive, 40) * 0.015 +
      (wfNearestKm < 25 ? 0.45 : wfNearestKm < 75 ? 0.20 : wfNearestKm < 150 ? 0.08 : 0.03);

  // Conflict factor: active armed conflict raises violent + weapons categories.
  // Sanctioned states (RU, IR, KP, SY, CU, BY) get an additional uplift on
  // weapons/kidnapping due to detention/wrongful-arrest risk and weak rule of law.
  // Travel-advisory level adds a baseline floor even where ACLED events are low.
  const advisoryUplift = signals.conflict.travelAdvisory * 0.20;
  const sanctionsUplift = signals.conflict.sanctionsTier * 0.30;
  const conflictFactor = 1 + signals.conflict.severity * 0.50 +
    (signals.conflict.fatalities30d >= 500 ? 0.50 : signals.conflict.fatalities30d >= 100 ? 0.30 : signals.conflict.fatalities30d >= 25 ? 0.15 : 0) +
    advisoryUplift;
  const detentionFactor = 1 + sanctionsUplift +
    (signals.conflict.travelAdvisory >= 3 ? 0.25 : 0);

  const out: CrimeRates = { ...base };
  for (const k of Object.keys(out) as (keyof CrimeRates)[]) {
    // FBI data for this category is already city-specific; skip city adjustment.
    const v = fbiCoveredKeys.has(k) ? hashV : calV;
    let f = v * policeDiscount;
    if (k === "traffic_incident") f *= stormFactor * (1 + (fireFactor - 1) * 0.6);
    if (k === "public_disorder" || k === "vandalism") f *= 1 + (stormFactor - 1) * 0.5 + (fireFactor - 1) * 0.5;
    if (k === "home_invasion" || k === "burglary") f *= quakeFactor * (1 + (fireFactor - 1) * 0.4);
    if (k === "robbery" || k === "assault" || k === "sexual_offense") {
      f *= conflictFactor;
    }
    if (k === "kidnapping" || k === "weapons_offense") {
      f *= conflictFactor * detentionFactor;
    }
    out[k] = Math.max(0, Math.round(out[k] * f));
  }
  return out;
}

function cityVariance(seed: string): number {
  if (!seed) return 0;
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 2000) / 1000 - 1;
}

/* ───────── UK FCDO advisory table (ISO-2 → level 1–4) ──────────────────────
 * Source: gov.uk/foreign-travel-advice — verified 2025-Q4
 * 1=Normal, 2=High degree of caution, 3=Avoid non-essential, 4=Avoid all travel
 */
const UK_FCDO_ADVISORIES: Record<string, { level: number; summary: string }> = {
  // Do not travel / Avoid all travel
  AF: { level: 4, summary: "Advise against all travel due to extreme security risk and Taliban governance." },
  BY: { level: 4, summary: "Advise against all travel. Wrongful detention risk. Comprehensive sanctions." },
  CF: { level: 4, summary: "Advise against all travel. Armed groups active across territory." },
  CD: { level: 4, summary: "Advise against all travel to eastern provinces." },
  IQ: { level: 4, summary: "Advise against all travel. Militia activity, ISIS remnants." },
  IR: { level: 4, summary: "Advise against all travel. Hostage diplomacy and arbitrary detention risk." },
  KP: { level: 4, summary: "Advise against all travel. Detention of foreigners, no consular access." },
  LB: { level: 4, summary: "Advise against all travel. Active Hezbollah-Israel conflict zone." },
  LY: { level: 4, summary: "Advise against all travel. Armed factions control territory." },
  ML: { level: 4, summary: "Advise against all travel. Jihadist insurgency across north and centre." },
  MM: { level: 4, summary: "Advise against all travel. Civil war, military junta crackdowns." },
  PS: { level: 4, summary: "Advise against all travel. Active conflict in Gaza and West Bank." },
  RU: { level: 4, summary: "Advise against all travel. War with Ukraine, sanctions, detention risk." },
  SD: { level: 4, summary: "Advise against all travel. RSF/SAF civil war with mass civilian casualties." },
  SO: { level: 4, summary: "Advise against all travel. Al-Shabaab attacks, kidnapping for ransom." },
  SS: { level: 4, summary: "Advise against all travel. Widespread armed violence." },
  SY: { level: 4, summary: "Advise against all travel. Ongoing conflict, ISIS activity." },
  UA: { level: 4, summary: "Advise against all travel. Active war with Russia." },
  VE: { level: 4, summary: "Advise against all travel. Violent crime, political instability, arbitrary detention." },
  YE: { level: 4, summary: "Advise against all travel. Houthi conflict, missile and drone strikes." },
  // Avoid non-essential travel
  BF: { level: 3, summary: "Avoid non-essential travel. Jihadist insurgency spreading from the north." },
  CM: { level: 3, summary: "Avoid non-essential travel to north and anglophone west." },
  CU: { level: 3, summary: "Avoid non-essential travel. Economic instability and civil unrest." },
  ET: { level: 3, summary: "Avoid non-essential travel. Tigray conflict legacy, regional instability." },
  HT: { level: 3, summary: "Avoid non-essential travel. Gang control of Port-au-Prince and major routes." },
  IL: { level: 3, summary: "Avoid non-essential travel to northern areas and Gaza border zone." },
  MX: { level: 3, summary: "Avoid non-essential travel to cartel-affected states." },
  MZ: { level: 3, summary: "Avoid non-essential travel to Cabo Delgado." },
  NE: { level: 3, summary: "Avoid non-essential travel following military coup." },
  NG: { level: 3, summary: "Avoid non-essential travel to north and Niger Delta." },
  PK: { level: 3, summary: "Avoid non-essential travel to Balochistan, KPK, tribal areas." },
  // High degree of caution
  CO: { level: 2, summary: "Exercise a high degree of caution. FARC dissidents and drug cartel activity." },
  EC: { level: 2, summary: "Exercise a high degree of caution. Significant crime spike and gang violence." },
  EG: { level: 2, summary: "Exercise a high degree of caution. Sinai conflict zone, terrorism risk." },
  IN: { level: 2, summary: "Exercise a high degree of caution. Terrorism risk in some states." },
  JO: { level: 2, summary: "Exercise a high degree of caution. Regional spillover from conflict zones." },
  KE: { level: 2, summary: "Exercise a high degree of caution. Al-Shabaab threat, Nairobi crime." },
  MA: { level: 2, summary: "Exercise a high degree of caution. Terrorism risk, petty crime." },
  PE: { level: 2, summary: "Exercise a high degree of caution. High crime in Lima and mining regions." },
  PH: { level: 2, summary: "Exercise a high degree of caution. Southern Mindanao — avoid all travel." },
  TH: { level: 2, summary: "Exercise a high degree of caution. Unrest in southern provinces." },
  TR: { level: 2, summary: "Exercise a high degree of caution. Terrorism risk, regional instability." },
  TZ: { level: 2, summary: "Exercise a high degree of caution. Crime in Dar es Salaam, Zanzibar." },
  ZA: { level: 2, summary: "Exercise a high degree of caution. Very high violent crime and robbery rates." },
  // Normal precautions (level 1 — not stored; absence = level 1)
};

/* ───────── Canada IRCC travel advisories (ISO-2 → level 1–4) ───────────────
 * Source: travel.gc.ca — verified 2025-Q4
 * 1=Exercise normal precautions, 2=Exercise a high degree of caution,
 * 3=Avoid non-essential travel, 4=Avoid all travel
 */
const CANADA_ADVISORIES: Record<string, { level: number; summary: string }> = {
  AF: { level: 4, summary: "Avoid all travel. Extreme security threat, Taliban governance." },
  BY: { level: 4, summary: "Avoid all travel. Arbitrary detention risk." },
  CF: { level: 4, summary: "Avoid all travel. Armed conflict throughout." },
  CD: { level: 4, summary: "Avoid all travel to eastern DRC." },
  HT: { level: 4, summary: "Avoid all travel. Gang violence controls major areas." },
  IQ: { level: 4, summary: "Avoid all travel. Militia and ISIS threat." },
  IR: { level: 4, summary: "Avoid all travel. Arbitrary detention, nuclear-related tensions." },
  KP: { level: 4, summary: "Avoid all travel. Extreme state-sponsored detention risk." },
  LB: { level: 4, summary: "Avoid all travel. Active armed conflict." },
  LY: { level: 4, summary: "Avoid all travel. Armed factions, no effective government." },
  ML: { level: 4, summary: "Avoid all travel. Jihadist insurgency." },
  MM: { level: 4, summary: "Avoid all travel. Military coup and civil war." },
  PS: { level: 4, summary: "Avoid all travel. Active war zone." },
  RU: { level: 4, summary: "Avoid all travel. War in Ukraine, arbitrary detention risk." },
  SD: { level: 4, summary: "Avoid all travel. Civil war." },
  SO: { level: 4, summary: "Avoid all travel. Al-Shabaab and kidnapping risk." },
  SS: { level: 4, summary: "Avoid all travel. Widespread violence." },
  SY: { level: 4, summary: "Avoid all travel. Ongoing conflict." },
  UA: { level: 4, summary: "Avoid all travel. Active war zone." },
  VE: { level: 4, summary: "Avoid all travel. Very high crime, political instability." },
  YE: { level: 4, summary: "Avoid all travel. Armed conflict." },
  BF: { level: 3, summary: "Avoid non-essential travel. Jihadist insurgency." },
  CO: { level: 3, summary: "Avoid non-essential travel. High-risk areas include Cali, Pacific coast." },
  ET: { level: 3, summary: "Avoid non-essential travel. Ongoing regional conflict." },
  IL: { level: 3, summary: "Avoid non-essential travel to conflict border areas." },
  MX: { level: 3, summary: "Avoid non-essential travel to cartel-controlled regions." },
  NG: { level: 3, summary: "Avoid non-essential travel to north and delta." },
  PK: { level: 3, summary: "Avoid non-essential travel to tribal and border areas." },
  EC: { level: 2, summary: "Exercise a high degree of caution. Gang-driven crime surge." },
  EG: { level: 2, summary: "Exercise a high degree of caution. Terrorism risk." },
  IN: { level: 2, summary: "Exercise a high degree of caution." },
  KE: { level: 2, summary: "Exercise a high degree of caution. Crime and terrorism risk." },
  PE: { level: 2, summary: "Exercise a high degree of caution. High crime in Lima." },
  ZA: { level: 2, summary: "Exercise a high degree of caution. Very high violent crime." },
};

/* ───────── Australia Smartraveller advisories (ISO-2 → level 1–4) ───────────
 * Source: smartraveller.gov.au — verified 2025-Q4
 * 1=Exercise normal safety, 2=High degree of caution,
 * 3=Reconsider your need to travel, 4=Do not travel
 */
const AUSTRALIA_ADVISORIES: Record<string, { level: number; summary: string }> = {
  AF: { level: 4, summary: "Do not travel. Extreme security risk." },
  BY: { level: 4, summary: "Do not travel. Arbitrary detention risk, sanctions." },
  CF: { level: 4, summary: "Do not travel. Armed conflict." },
  HT: { level: 4, summary: "Do not travel. Gang violence." },
  IQ: { level: 4, summary: "Do not travel. Armed conflict and terrorism." },
  IR: { level: 4, summary: "Do not travel. Arbitrary detention risk." },
  KP: { level: 4, summary: "Do not travel. State detention risk." },
  LB: { level: 4, summary: "Do not travel. Armed conflict." },
  LY: { level: 4, summary: "Do not travel. Armed factions, lawlessness." },
  ML: { level: 4, summary: "Do not travel. Jihadist insurgency." },
  MM: { level: 4, summary: "Do not travel. Military junta, civil war." },
  PS: { level: 4, summary: "Do not travel. Active war." },
  RU: { level: 4, summary: "Do not travel. War, arbitrary detention." },
  SD: { level: 4, summary: "Do not travel. Civil war." },
  SO: { level: 4, summary: "Do not travel. Terrorism and kidnapping." },
  SS: { level: 4, summary: "Do not travel. Widespread armed violence." },
  SY: { level: 4, summary: "Do not travel. Ongoing war." },
  UA: { level: 4, summary: "Do not travel. Active war zone." },
  VE: { level: 4, summary: "Do not travel. Extreme violent crime, political instability." },
  YE: { level: 4, summary: "Do not travel. Armed conflict." },
  BF: { level: 3, summary: "Reconsider your need to travel. Jihadist violence." },
  CO: { level: 3, summary: "Reconsider your need to travel to high-risk areas." },
  ET: { level: 3, summary: "Reconsider your need to travel. Regional armed conflict." },
  IL: { level: 3, summary: "Reconsider your need to travel. Active conflict zones." },
  MX: { level: 3, summary: "Reconsider your need to travel to some states." },
  NG: { level: 3, summary: "Reconsider your need to travel. Boko Haram, oil-delta violence." },
  PK: { level: 3, summary: "Reconsider your need to travel to high-risk provinces." },
  EC: { level: 2, summary: "Exercise a high degree of caution. Gang crime surge." },
  EG: { level: 2, summary: "Exercise a high degree of caution. Terrorism risk in Sinai." },
  IN: { level: 2, summary: "Exercise a high degree of caution. Terrorism risk in some states." },
  KE: { level: 2, summary: "Exercise a high degree of caution. Crime and terrorism." },
  PE: { level: 2, summary: "Exercise a high degree of caution. High crime." },
  ZA: { level: 2, summary: "Exercise a high degree of caution. Very high violent crime rates." },
};

/* ───────── UNODC Homicide Statistics per 100k (2022–2024 data) ────────────
 * Primary source: UNODC Global Study on Homicide 2023, WHO mortality data.
 * Key: ISO-2 country code.
 */
const UNODC_COUNTRY_HOMICIDE: Record<string, { rate: number; year: number; percentile: number }> = {
  // 0–2 (very low)
  JP: { rate: 0.2, year: 2023, percentile: 2 },  SG: { rate: 0.2, year: 2023, percentile: 2 },
  IS: { rate: 0.3, year: 2023, percentile: 3 },  NO: { rate: 0.4, year: 2023, percentile: 4 },
  AT: { rate: 0.4, year: 2023, percentile: 4 },  CH: { rate: 0.4, year: 2023, percentile: 5 },
  FI: { rate: 0.6, year: 2023, percentile: 6 },  SE: { rate: 0.6, year: 2023, percentile: 7 },
  DK: { rate: 0.6, year: 2023, percentile: 7 },  NL: { rate: 0.6, year: 2023, percentile: 8 },
  DE: { rate: 0.8, year: 2023, percentile: 9 },  GB: { rate: 1.0, year: 2023, percentile: 12 },
  KR: { rate: 0.5, year: 2023, percentile: 5 },  AU: { rate: 0.9, year: 2023, percentile: 10 },
  NZ: { rate: 0.9, year: 2023, percentile: 10 }, TW: { rate: 0.7, year: 2023, percentile: 8 },
  HK: { rate: 0.3, year: 2023, percentile: 3 },
  // 2–5 (low–moderate)
  FR: { rate: 1.2, year: 2023, percentile: 14 }, IT: { rate: 0.5, year: 2023, percentile: 6 },
  ES: { rate: 0.6, year: 2023, percentile: 7 },  PT: { rate: 0.8, year: 2023, percentile: 9 },
  CA: { rate: 2.1, year: 2023, percentile: 22 }, PL: { rate: 0.7, year: 2023, percentile: 8 },
  CZ: { rate: 0.5, year: 2023, percentile: 5 },  HU: { rate: 1.3, year: 2023, percentile: 15 },
  GR: { rate: 0.8, year: 2023, percentile: 9 },  AE: { rate: 0.4, year: 2023, percentile: 4 },
  QA: { rate: 0.4, year: 2023, percentile: 4 },  SA: { rate: 1.5, year: 2023, percentile: 16 },
  OM: { rate: 0.5, year: 2023, percentile: 5 },  JO: { rate: 1.7, year: 2023, percentile: 18 },
  MY: { rate: 1.8, year: 2023, percentile: 19 }, TH: { rate: 2.6, year: 2023, percentile: 26 },
  CN: { rate: 0.5, year: 2023, percentile: 5 },  VN: { rate: 1.5, year: 2023, percentile: 16 },
  // 5–15 (moderate–high)
  US: { rate: 6.3, year: 2023, percentile: 55 }, TR: { rate: 4.3, year: 2023, percentile: 44 },
  IN: { rate: 3.0, year: 2023, percentile: 32 }, RO: { rate: 1.7, year: 2023, percentile: 18 },
  RU: { rate: 7.4, year: 2023, percentile: 62 }, BY: { rate: 4.3, year: 2023, percentile: 44 },
  UA: { rate: 6.2, year: 2023, percentile: 54 }, PH: { rate: 5.7, year: 2023, percentile: 51 },
  KE: { rate: 5.0, year: 2023, percentile: 48 }, TZ: { rate: 5.0, year: 2023, percentile: 48 },
  MA: { rate: 1.5, year: 2023, percentile: 16 }, EG: { rate: 3.5, year: 2023, percentile: 37 },
  MX: { rate: 16.8, year: 2023, percentile: 77 },CO: { rate: 26.0, year: 2023, percentile: 88 },
  BR: { rate: 21.0, year: 2023, percentile: 83 },AR: { rate: 5.5, year: 2023, percentile: 50 },
  CL: { rate: 6.4, year: 2023, percentile: 55 }, PE: { rate: 9.6, year: 2023, percentile: 68 },
  // 15+ (high)
  ZA: { rate: 34.4, year: 2023, percentile: 94 },NG: { rate: 34.3, year: 2023, percentile: 93 },
  HT: { rate: 38.0, year: 2023, percentile: 95 },VE: { rate: 40.0, year: 2023, percentile: 96 },
  JM: { rate: 49.0, year: 2023, percentile: 98 },HN: { rate: 35.8, year: 2023, percentile: 94 },
  EC: { rate: 44.5, year: 2024, percentile: 97 },SV: { rate: 7.8, year: 2024, percentile: 63 },
  GT: { rate: 17.1, year: 2023, percentile: 78 },PA: { rate: 11.0, year: 2023, percentile: 71 },
  CR: { rate: 17.3, year: 2023, percentile: 78 },DO: { rate: 13.9, year: 2023, percentile: 75 },
  TT: { rate: 26.0, year: 2023, percentile: 88 },
  // High-conflict (estimated from mortality data)
  AF: { rate: 40.0, year: 2022, percentile: 96 },IQ: { rate: 35.0, year: 2022, percentile: 94 },
  SY: { rate: 50.0, year: 2022, percentile: 98 },SD: { rate: 35.0, year: 2023, percentile: 94 },
  SO: { rate: 60.0, year: 2022, percentile: 99 },YE: { rate: 45.0, year: 2022, percentile: 97 },
  MM: { rate: 15.0, year: 2023, percentile: 76 },PK: { rate: 7.0, year: 2023, percentile: 61 },
  LB: { rate: 8.0, year: 2023, percentile: 64 },
  ET: { rate: 7.0, year: 2023, percentile: 61 }, CD: { rate: 13.0, year: 2023, percentile: 74 },
  CF: { rate: 20.0, year: 2023, percentile: 82 },ML: { rate: 10.0, year: 2023, percentile: 69 },
  BF: { rate: 12.0, year: 2023, percentile: 73 },SS: { rate: 17.0, year: 2023, percentile: 77 },
  LY: { rate: 12.0, year: 2023, percentile: 73 },
};

/* ───────── UNODC city-level homicide rates per 100k ────────────────────────
 * Source: UNODC city homicide database, local statistical agencies.
 * Key: "lowercase city|ISO-2"
 */
const UNODC_CITY_HOMICIDE: Record<string, { rate: number; year: number }> = {
  // Latin America — highest rates
  "caracas|VE": { rate: 115.0, year: 2022 }, "maracaibo|VE": { rate: 90.0, year: 2022 },
  "acapulco|MX": { rate: 111.0, year: 2023 }, "culiacan|MX": { rate: 82.0, year: 2023 },
  "ciudad juarez|MX": { rate: 73.0, year: 2023 }, "tijuana|MX": { rate: 68.0, year: 2023 },
  "zamora|MX": { rate: 96.0, year: 2023 }, "zacatecas|MX": { rate: 88.0, year: 2023 },
  "san pedro sula|HN": { rate: 94.0, year: 2023 }, "tegucigalpa|HN": { rate: 52.0, year: 2023 },
  "kingston|JM": { rate: 58.0, year: 2023 }, "port-au-prince|HT": { rate: 70.0, year: 2024 },
  "guayaquil|EC": { rate: 89.0, year: 2024 }, "manta|EC": { rate: 78.0, year: 2024 },
  "cali|CO": { rate: 47.0, year: 2023 },    "medellin|CO": { rate: 19.0, year: 2023 },
  "bogota|CO": { rate: 15.3, year: 2023 },   "barranquilla|CO": { rate: 22.0, year: 2023 },
  "fortaleza|BR": { rate: 58.0, year: 2023 },"salvador|BR": { rate: 50.0, year: 2023 },
  "recife|BR": { rate: 48.0, year: 2023 },   "manaus|BR": { rate: 38.0, year: 2023 },
  "rio de janeiro|BR": { rate: 24.0, year: 2023 }, "sao paulo|BR": { rate: 9.6, year: 2023 },
  "brasilia|BR": { rate: 16.0, year: 2023 }, "belem|BR": { rate: 42.0, year: 2023 },
  // Africa
  "cape town|ZA": { rate: 75.0, year: 2023 }, "johannesburg|ZA": { rate: 40.0, year: 2023 },
  "durban|ZA": { rate: 48.0, year: 2023 },    "pretoria|ZA": { rate: 32.0, year: 2023 },
  "lagos|NG": { rate: 42.0, year: 2022 },     "nairobi|KE": { rate: 12.0, year: 2022 },
  "kinshasa|CD": { rate: 30.0, year: 2022 },
  // US cities — source: FBI UCR/NIBRS 2022, local PD annual reports, CDC WISQARS
  // Where available, rates derived from confirmed murder counts / population (noted below).
  // Very high homicide (>30/100k)
  "jackson|US": { rate: 92.1, year: 2022 },   // 135 murders / 156k pop — confirmed FBI NIBRS 2022
  "st. louis|US": { rate: 67.8, year: 2022 }, // 200 murders / 295k pop — confirmed 2022
  "baltimore|US": { rate: 58.0, year: 2022 }, // 331 murders / 574k pop — confirmed 2022
  "new orleans|US": { rate: 53.8, year: 2022 },// 266 murders / 369k pop — confirmed 2022
  "compton|US": { rate: 51.0, year: 2022 },   // Los Angeles Sheriff district data 2022
  "birmingham|US": { rate: 42.0, year: 2022 },// estimated; Alabama UCR 2022; ~40-45 range
  "detroit|US": { rate: 38.9, year: 2022 },   // Detroit homicide counts 2022
  "milwaukee|US": { rate: 37.3, year: 2022 }, // 214 murders / 573k pop — confirmed 2022
  "shreveport|US": { rate: 35.0, year: 2022 },// 57 homicides reported; ~33-37 range
  "atlanta|US": { rate: 34.1, year: 2022 },   // 170 murders / 498k pop — confirmed (highest since 1996)
  "cleveland|US": { rate: 33.7, year: 2022 }, // Cleveland Health Report 2022 (confirmed)
  "philadelphia|US": { rate: 32.0, year: 2022 },// ~32/100k confirmed from PPD data 2022
  "kansas city|US": { rate: 30.2, year: 2022 },// KCPD 2022 annual report
  // High homicide (15–29/100k)
  "cincinnati|US": { rate: 28.1, year: 2022 }, // 87 murders / 310k pop — confirmed 2022
  "memphis|US": { rate: 27.5, year: 2022 },    // ~27.5/100k — FBI NIBRS 2022
  "chicago|US": { rate: 26.5, year: 2022 },    // 715 murders / 2.7M pop — confirmed 2022
  "richmond|US": { rate: 25.2, year: 2022 },   // 57 murders / 226k pop — confirmed 2022
  "little rock|US": { rate: 25.0, year: 2022 },// Arkansas UCR 2022
  "minneapolis|US": { rate: 23.5, year: 2022 },// estimated 22-25 range; MPD 2022
  "washington|US": { rate: 30.0, year: 2022 }, // MPD direct data; DC didn't submit NIBRS 2022
  "oakland|US": { rate: 22.5, year: 2022 },    // OPD 2022 annual report
  "baton rouge|US": { rate: 25.0, year: 2022 },// Louisiana UCR estimate; ~91 homicides/225k pop
  "louisville|US": { rate: 22.0, year: 2022 }, // estimated; LMPD 2022
  "pittsburgh|US": { rate: 14.5, year: 2022 }, // estimated 12-15 range; Allegheny County 2022
  "buffalo|US": { rate: 22.0, year: 2022 },    // estimated; NY DCJS 2022
  "houston|US": { rate: 21.0, year: 2022 },    // estimated ~19-22 range; HPD 2022
  "tacoma|US": { rate: 18.7, year: 2022 },     // 41 murders / 219k pop — confirmed BeautifyData FBI 2022
  "nashville|US": { rate: 15.5, year: 2022 },  // estimated ~14-16 range; Tennessee 69% reporting
  "stockton|US": { rate: 17.5, year: 2022 },   // 56 murders / 320k pop — confirmed 2022
  "tulsa|US": { rate: 17.0, year: 2022 },      // estimated 15-20 range; Tulsa PD 2022
  "albuquerque|US": { rate: 21.4, year: 2022 },// 120 murders / 560k pop — APD 2022 confirmed
  "las vegas|US": { rate: 13.0, year: 2022 },  // LVMPD 2022 (metro area; city-only higher)
  // Moderate homicide (6–14/100k)
  "dallas|US": { rate: 13.6, year: 2022 },     // confirmed DPD 2022
  "columbus|US": { rate: 15.0, year: 2022 },   // estimated 14-16; CPD/Ohio UCR 2022
  "sacramento|US": { rate: 11.0, year: 2022 }, // California DOJ 2022
  "anchorage|US": { rate: 9.4, year: 2022 },   // APD 2022 annual report
  "st. paul|US": { rate: 12.9, year: 2022 },   // 40 murders / 310k pop — confirmed 2022
  "miami|US": { rate: 10.5, year: 2022 },      // estimated; FL had NIBRS gaps 2022
  "fresno|US": { rate: 10.5, year: 2022 },     // California DOJ 2022
  "san antonio|US": { rate: 8.5, year: 2022 }, // SAPD 2022
  "oklahoma city|US": { rate: 8.0, year: 2022 },// OCPD 2022
  "los angeles|US": { rate: 8.2, year: 2022 }, // LAPD 2022 annual report
  "phoenix|US": { rate: 8.7, year: 2022 },     // PPD 2022; multiple sources confirmed
  "portland|US": { rate: 7.5, year: 2022 },    // Portland Bureau of Emergency Management 2022
  "san francisco|US": { rate: 7.5, year: 2022 },// SFPD 2022
  "denver|US": { rate: 6.4, year: 2022 },      // Colorado DCJ 2022 confirmed (state avg 6.4)
  "charlotte|US": { rate: 7.5, year: 2022 },   // estimated 7-9 range
  "boston|US": { rate: 6.5, year: 2022 },      // BPD 2022
  "spokane|US": { rate: 6.5, year: 2022 },     // estimated; Spokane PD 2022
  // Low homicide (<6/100k)
  "new york|US": { rate: 5.3, year: 2022 },    // confirmed NYPD 2022
  "seattle|US": { rate: 6.9, year: 2022 },     // 52 murders / 750k pop — confirmed SPD 2022
  "colorado springs|US": { rate: 5.5, year: 2022 },// estimated; Colorado DCJ 2022
  "austin|US": { rate: 4.5, year: 2022 },      // APD 2022; below national avg
  "san diego|US": { rate: 3.5, year: 2022 },   // SDPD 2022
  "raleigh|US": { rate: 3.5, year: 2022 },     // RPD 2022
  "madison|US": { rate: 2.5, year: 2022 },     // MPD 2022 (very low)
  "san jose|US": { rate: 3.2, year: 2022 },    // SJPD 2022 (26 murders/1.07M pop in 2024; 2022 similar)
  "virginia beach|US": { rate: 3.0, year: 2022 },// VBPD 2022
  // Europe (generally low)
  "london|GB": { rate: 1.5, year: 2023 },    "paris|FR": { rate: 2.1, year: 2023 },
  "berlin|DE": { rate: 1.0, year: 2023 },    "madrid|ES": { rate: 0.7, year: 2023 },
  "rome|IT": { rate: 0.6, year: 2023 },      "amsterdam|NL": { rate: 0.8, year: 2023 },
  "brussels|BE": { rate: 1.8, year: 2023 },  "stockholm|SE": { rate: 1.2, year: 2023 },
  "naples|IT": { rate: 1.5, year: 2023 },    "marseille|FR": { rate: 4.0, year: 2023 },
  // Asia-Pacific
  "tokyo|JP": { rate: 0.2, year: 2023 },     "osaka|JP": { rate: 0.2, year: 2023 },
  "singapore|SG": { rate: 0.2, year: 2023 }, "seoul|KR": { rate: 0.5, year: 2023 },
  "sydney|AU": { rate: 0.8, year: 2023 },    "melbourne|AU": { rate: 0.7, year: 2023 },
  "bangkok|TH": { rate: 3.5, year: 2023 },   "jakarta|ID": { rate: 1.8, year: 2022 },
  "manila|PH": { rate: 9.5, year: 2022 },    "karachi|PK": { rate: 12.0, year: 2022 },
  // Middle East
  "dubai|AE": { rate: 0.4, year: 2023 },     "doha|QA": { rate: 0.3, year: 2023 },
  "tel aviv|IL": { rate: 1.8, year: 2023 },  "beirut|LB": { rate: 5.0, year: 2023 },
};

/* ───────── Global Top 25 Most Dangerous Cities (homicide, 2023–2024) ─────
 * Source: UNODC, Seguridad, Igarapé Institute, local statistical agencies.
 * Ranking by homicide rate per 100k.
 */
const GLOBAL_TOP25_DANGEROUS_CITIES: Record<string, number> = {
  "mogadishu|SO": 1, "caracas|VE": 2, "port-au-prince|HT": 3,
  "acapulco|MX": 4,  "kingston|JM": 5, "zamora|MX": 6,
  "zacatecas|MX": 7, "manta|EC": 8,   "guayaquil|EC": 9,
  "san pedro sula|HN": 10, "maracaibo|VE": 11, "fortaleza|BR": 12,
  "ciudad juarez|MX": 13, "culiacan|MX": 14, "jackson|US": 15,
  "cape town|ZA": 16, "tijuana|MX": 17, "salvador|BR": 18,
  "baltimore|US": 19, "st. louis|US": 20, "durban|ZA": 21,
  "recife|BR": 22, "tegucigalpa|HN": 23, "manaus|BR": 24, "belem|BR": 25,
};

/* ───────── National Top 10 Dangerous Cities per country ─────────────────── */
const NATIONAL_TOP10_DANGEROUS: Record<string, string[]> = {
  // Ranked by homicide rate/100k (FBI UCR/NIBRS 2022): jackson 92.1, st. louis 67.8, baltimore 58.0,
  // new orleans 53.8, birmingham 42.0, detroit 38.9, milwaukee 37.3, shreveport 35.0, atlanta 34.1, cleveland 33.7
  US: ["jackson", "st. louis", "baltimore", "new orleans", "birmingham",
       "detroit", "milwaukee", "shreveport", "atlanta", "cleveland"],
  MX: ["acapulco", "culiacan", "zamora", "zacatecas", "ciudad juarez",
       "tijuana", "fresnillo", "celaya", "juarez", "irapuato"],
  BR: ["fortaleza", "salvador", "recife", "manaus", "belem",
       "maceio", "joao pessoa", "vitoria", "macapa", "natal"],
  CO: ["cali", "barranquilla", "medellin", "pereira", "bucaramanga",
       "bogota", "cucuta", "palmira", "ibague", "cartagena"],
  ZA: ["cape town", "durban", "johannesburg", "pretoria", "east london",
       "port elizabeth", "nelspruit", "polokwane", "bloemfontein", "kimberley"],
  VE: ["caracas", "maracaibo", "barquisimeto", "valencia", "maturin",
       "barcelona", "mérida", "san cristobal", "ciudad bolivar", "cumana"],
  HN: ["san pedro sula", "tegucigalpa", "la ceiba", "el progreso", "choloma",
       "comayagua", "choluteca", "danli", "juticalpa", "tela"],
  NG: ["lagos", "port harcourt", "kano", "maiduguri", "kaduna",
       "aba", "onitsha", "warri", "benin city", "ibadan"],
  PH: ["manila", "cebu", "davao", "quezon city", "zamboanga",
       "cotabato", "iligan", "cagayan de oro", "general santos", "tacloban"],
  PK: ["karachi", "lahore", "peshawar", "quetta", "rawalpindi",
       "islamabad", "hyderabad", "faisalabad", "multan", "gujranwala"],
};

/* ───────── Neighborhood risk data for major cities ─────────────────────── */
interface NeighborhoodRisk {
  warnings: { area: string; riskLevel: "Very High" | "High" | "Moderate"; crimeTypes: string[]; note?: string }[];
  safeAreas: string[];
}
const NEIGHBORHOOD_RISK: Record<string, NeighborhoodRisk> = {
  "new york|US": {
    warnings: [
      { area: "South Bronx", riskLevel: "High", crimeTypes: ["robbery", "assault"], note: "Highest crime precinct concentration in NYC" },
      { area: "East New York (Brooklyn)", riskLevel: "High", crimeTypes: ["robbery", "shooting"] },
      { area: "Brownsville (Brooklyn)", riskLevel: "High", crimeTypes: ["robbery", "assault", "shooting"] },
    ],
    safeAreas: ["Midtown Manhattan", "Upper East Side", "Astoria (Queens)", "Park Slope (Brooklyn)"],
  },
  "los angeles|US": {
    warnings: [
      { area: "Skid Row / Downtown East", riskLevel: "Very High", crimeTypes: ["robbery", "assault", "drug activity"], note: "High concentration of violent incidents" },
      { area: "Compton", riskLevel: "Very High", crimeTypes: ["robbery", "assault", "homicide", "shooting"], note: "~51 homicides/100k (2022); among highest in Southern California" },
      { area: "South Central", riskLevel: "High", crimeTypes: ["robbery", "gang activity"] },
    ],
    safeAreas: ["Santa Monica", "Beverly Hills", "Brentwood", "Century City"],
  },
  "chicago|US": {
    warnings: [
      { area: "Englewood", riskLevel: "Very High", crimeTypes: ["shooting", "robbery", "assault"] },
      { area: "Austin", riskLevel: "Very High", crimeTypes: ["shooting", "robbery"] },
      { area: "Garfield Park", riskLevel: "High", crimeTypes: ["robbery", "assault", "shooting"] },
      { area: "West Pullman", riskLevel: "High", crimeTypes: ["robbery", "assault"] },
    ],
    safeAreas: ["Lincoln Park", "Gold Coast", "Lakeview", "Wicker Park", "River North"],
  },
  "miami|US": {
    warnings: [
      { area: "Overtown", riskLevel: "High", crimeTypes: ["robbery", "assault"] },
      { area: "Liberty City", riskLevel: "High", crimeTypes: ["robbery", "shooting"] },
      { area: "Little Haiti", riskLevel: "Moderate", crimeTypes: ["robbery", "theft"] },
    ],
    safeAreas: ["South Beach", "Brickell", "Wynwood (daytime)", "Coconut Grove"],
  },
  "rio de janeiro|BR": {
    warnings: [
      { area: "Complexo do Alemão", riskLevel: "Very High", crimeTypes: ["armed conflict", "shooting"], note: "Favela complex with active gang/militia control" },
      { area: "Maré", riskLevel: "Very High", crimeTypes: ["armed conflict", "robbery"] },
      { area: "Rocinha", riskLevel: "High", crimeTypes: ["robbery", "drug activity"] },
      { area: "Centro / Lapa (night)", riskLevel: "High", crimeTypes: ["robbery", "assault"] },
    ],
    safeAreas: ["Ipanema", "Leblon", "Barra da Tijuca", "Jardim Botânico"],
  },
  "sao paulo|BR": {
    warnings: [
      { area: "Luz / Cracolândia", riskLevel: "Very High", crimeTypes: ["robbery", "assault", "drug activity"] },
      { area: "Capão Redondo", riskLevel: "High", crimeTypes: ["robbery", "homicide"] },
      { area: "Cidade Tiradentes", riskLevel: "High", crimeTypes: ["robbery", "assault"] },
    ],
    safeAreas: ["Jardins", "Itaim Bibi", "Pinheiros", "Moema"],
  },
  "johannesburg|ZA": {
    warnings: [
      { area: "Hillbrow", riskLevel: "Very High", crimeTypes: ["robbery", "assault", "homicide"], note: "One of the highest crime-density areas in Africa" },
      { area: "Berea", riskLevel: "Very High", crimeTypes: ["robbery", "assault"] },
      { area: "Johannesburg CBD", riskLevel: "High", crimeTypes: ["robbery", "scam", "assault"] },
      { area: "Alexandra", riskLevel: "High", crimeTypes: ["robbery", "homicide"] },
    ],
    safeAreas: ["Sandton", "Rosebank", "Melrose Arch", "Waterfall"],
  },
  "cape town|ZA": {
    warnings: [
      { area: "Cape Flats", riskLevel: "Very High", crimeTypes: ["gang violence", "homicide", "robbery"], note: "Highest homicide rate in South Africa" },
      { area: "Khayelitsha", riskLevel: "Very High", crimeTypes: ["homicide", "robbery", "assault"] },
      { area: "Mitchells Plain", riskLevel: "High", crimeTypes: ["robbery", "shooting"] },
    ],
    safeAreas: ["Green Point", "Sea Point", "Camps Bay", "City Bowl (daytime)"],
  },
  "mexico city|MX": {
    warnings: [
      { area: "Tepito", riskLevel: "Very High", crimeTypes: ["robbery", "assault", "organized crime"], note: "Black market hub with cartel presence" },
      { area: "Doctores", riskLevel: "High", crimeTypes: ["robbery", "assault"] },
      { area: "Iztapalapa", riskLevel: "High", crimeTypes: ["robbery", "assault"] },
    ],
    safeAreas: ["Polanco", "Condesa", "Roma Norte", "Santa Fe"],
  },
  "bogota|CO": {
    warnings: [
      { area: "Kennedy (south)", riskLevel: "High", crimeTypes: ["robbery", "assault"] },
      { area: "La Candelaria (night)", riskLevel: "High", crimeTypes: ["robbery", "assault"] },
      { area: "Bosa", riskLevel: "High", crimeTypes: ["robbery", "drug activity"] },
    ],
    safeAreas: ["Chapinero", "Zona Rosa", "Usaquén", "Parque 93"],
  },
  "nairobi|KE": {
    warnings: [
      { area: "Eastleigh", riskLevel: "Very High", crimeTypes: ["robbery", "kidnapping", "terrorism"], note: "Al-Shabaab historical recruitment area" },
      { area: "Mathare", riskLevel: "High", crimeTypes: ["robbery", "assault"] },
      { area: "Kibera", riskLevel: "High", crimeTypes: ["robbery", "assault"] },
      { area: "CBD (night)", riskLevel: "High", crimeTypes: ["robbery", "mugging"] },
    ],
    safeAreas: ["Westlands", "Karen", "Kilimani", "Gigiri (UN area)"],
  },
  "manila|PH": {
    warnings: [
      { area: "Tondo", riskLevel: "Very High", crimeTypes: ["robbery", "assault", "homicide"] },
      { area: "Binondo (night)", riskLevel: "High", crimeTypes: ["robbery", "assault"] },
      { area: "Quiapo", riskLevel: "High", crimeTypes: ["robbery", "pickpocketing"] },
    ],
    safeAreas: ["BGC (Bonifacio Global City)", "Makati CBD", "Ortigas", "Alabang"],
  },
  "portland|US": {
    warnings: [
      { area: "Old Town/Chinatown", riskLevel: "Very High", crimeTypes: ["drug activity", "robbery", "assault"], note: "Highest crime concentration in Portland; persistent open-air drug market" },
      { area: "Downtown (night)", riskLevel: "High", crimeTypes: ["theft", "assault", "public disorder"] },
      { area: "Lents/Pleasant Valley", riskLevel: "High", crimeTypes: ["vehicle theft", "robbery"] },
    ],
    safeAreas: ["Irvington", "Northwest Hills", "Sellwood-Moreland", "Pearl District (daytime)"],
  },
  "baltimore|US": {
    warnings: [
      { area: "Cherry Hill", riskLevel: "Very High", crimeTypes: ["homicide", "robbery", "assault"], note: "One of the highest homicide concentrations in any US city" },
      { area: "Park Heights", riskLevel: "Very High", crimeTypes: ["homicide", "robbery", "shooting"] },
      { area: "Sandtown-Winchester", riskLevel: "Very High", crimeTypes: ["homicide", "drug activity", "robbery"] },
      { area: "Perkins Homes", riskLevel: "High", crimeTypes: ["robbery", "assault"] },
    ],
    safeAreas: ["Inner Harbor", "Fells Point", "Canton", "Roland Park"],
  },
  "detroit|US": {
    warnings: [
      { area: "North End", riskLevel: "Very High", crimeTypes: ["homicide", "robbery", "carjacking"] },
      { area: "Brightmoor", riskLevel: "Very High", crimeTypes: ["homicide", "arson", "robbery"] },
      { area: "East English Village", riskLevel: "High", crimeTypes: ["robbery", "vehicle theft"] },
    ],
    safeAreas: ["Midtown", "Corktown", "Downtown", "Indian Village"],
  },
  "jackson|US": {
    warnings: [
      { area: "West Jackson", riskLevel: "Very High", crimeTypes: ["homicide", "robbery", "assault"], note: "Highest homicide rate of any US city over 25,000 population (2022)" },
      { area: "North Jackson", riskLevel: "Very High", crimeTypes: ["homicide", "carjacking", "robbery"] },
      { area: "South Jackson", riskLevel: "High", crimeTypes: ["robbery", "assault"] },
    ],
    safeAreas: ["Fondren", "Belhaven Heights", "Highland Village area"],
  },
  "new orleans|US": {
    warnings: [
      { area: "Central City", riskLevel: "Very High", crimeTypes: ["homicide", "robbery", "assault"] },
      { area: "Lower Ninth Ward", riskLevel: "High", crimeTypes: ["robbery", "assault"] },
      { area: "Treme (night)", riskLevel: "High", crimeTypes: ["robbery", "assault"] },
    ],
    safeAreas: ["Garden District", "Uptown", "Lakeview", "French Quarter (daytime)"],
  },
  "memphis|US": {
    warnings: [
      { area: "Frayser", riskLevel: "Very High", crimeTypes: ["homicide", "robbery", "assault"], note: "Consistently one of the highest crime neighborhoods in Tennessee" },
      { area: "Raleigh", riskLevel: "Very High", crimeTypes: ["homicide", "robbery", "shooting"] },
      { area: "Orange Mound", riskLevel: "Very High", crimeTypes: ["homicide", "robbery", "drug activity"] },
      { area: "North Memphis", riskLevel: "High", crimeTypes: ["robbery", "assault"] },
    ],
    safeAreas: ["East Memphis", "Germantown (suburb)", "Collierville", "Harbor Town"],
  },
  "st. louis|US": {
    warnings: [
      { area: "Dutchtown", riskLevel: "Very High", crimeTypes: ["homicide", "robbery", "assault"] },
      { area: "Walnut Park", riskLevel: "Very High", crimeTypes: ["homicide", "shooting", "robbery"] },
      { area: "Jeff-Vander-Lou", riskLevel: "Very High", crimeTypes: ["homicide", "robbery", "assault"], note: "Among the highest per-capita homicide tracts in the US" },
      { area: "Old North St. Louis", riskLevel: "High", crimeTypes: ["robbery", "assault"] },
    ],
    safeAreas: ["Central West End", "Clayton", "Webster Groves", "Ladue"],
  },
  "kansas city|US": {
    warnings: [
      { area: "Blue Hills", riskLevel: "Very High", crimeTypes: ["homicide", "robbery", "assault"] },
      { area: "East Side / Ivanhoe", riskLevel: "Very High", crimeTypes: ["homicide", "shooting", "robbery"] },
      { area: "Marlborough", riskLevel: "High", crimeTypes: ["robbery", "assault"] },
    ],
    safeAreas: ["Country Club Plaza", "Brookside", "Leawood (suburb)", "Overland Park (suburb)"],
  },
  "philadelphia|US": {
    warnings: [
      { area: "Kensington", riskLevel: "Very High", crimeTypes: ["drug activity", "robbery", "assault"], note: "Epicenter of US opioid crisis; extremely high street crime" },
      { area: "North Philadelphia", riskLevel: "Very High", crimeTypes: ["homicide", "robbery", "shooting"] },
      { area: "Strawberry Mansion", riskLevel: "Very High", crimeTypes: ["homicide", "robbery", "assault"] },
      { area: "Hunting Park", riskLevel: "High", crimeTypes: ["robbery", "assault"] },
    ],
    safeAreas: ["Center City", "Rittenhouse Square", "Society Hill", "Manayunk"],
  },
  "atlanta|US": {
    warnings: [
      { area: "Vine City", riskLevel: "Very High", crimeTypes: ["homicide", "robbery", "assault"] },
      { area: "English Avenue", riskLevel: "Very High", crimeTypes: ["homicide", "robbery", "shooting"] },
      { area: "Mechanicsville", riskLevel: "High", crimeTypes: ["robbery", "assault"] },
      { area: "Pittsburgh (Atlanta)", riskLevel: "High", crimeTypes: ["robbery", "drug activity"] },
    ],
    safeAreas: ["Buckhead", "Midtown", "Virginia-Highland", "Decatur"],
  },
  "houston|US": {
    warnings: [
      { area: "Sunnyside", riskLevel: "Very High", crimeTypes: ["homicide", "robbery", "assault"] },
      { area: "South Park / Hiram Clarke", riskLevel: "High", crimeTypes: ["homicide", "robbery", "assault"] },
      { area: "Fifth Ward", riskLevel: "High", crimeTypes: ["robbery", "assault", "homicide"] },
    ],
    safeAreas: ["The Woodlands", "Sugar Land", "River Oaks", "Memorial Park"],
  },
  "minneapolis|US": {
    warnings: [
      { area: "North Minneapolis (Jordan/Hawthorne)", riskLevel: "Very High", crimeTypes: ["homicide", "robbery", "shooting"], note: "Highest violent crime concentration in the Twin Cities" },
      { area: "Powderhorn Park", riskLevel: "High", crimeTypes: ["robbery", "assault", "shooting"] },
      { area: "Phillips", riskLevel: "High", crimeTypes: ["robbery", "drug activity", "assault"] },
    ],
    safeAreas: ["Edina", "Minnetonka", "St. Anthony", "Kenwood"],
  },
  "nashville|US": {
    warnings: [
      { area: "Antioch", riskLevel: "Very High", crimeTypes: ["homicide", "robbery", "assault"] },
      { area: "North Nashville", riskLevel: "High", crimeTypes: ["robbery", "assault", "shooting"] },
      { area: "Dickerson Road corridor", riskLevel: "High", crimeTypes: ["robbery", "drug activity", "assault"] },
    ],
    safeAreas: ["Belle Meade", "Green Hills", "Franklin (suburb)", "Brentwood (suburb)"],
  },
  "san francisco|US": {
    warnings: [
      { area: "Tenderloin", riskLevel: "Very High", crimeTypes: ["drug activity", "robbery", "assault"], note: "Highest concentration of drug-related crime in SF" },
      { area: "Civic Center / UN Plaza", riskLevel: "High", crimeTypes: ["robbery", "assault", "drug activity"] },
      { area: "Bayview-Hunters Point", riskLevel: "High", crimeTypes: ["homicide", "robbery", "assault"] },
    ],
    safeAreas: ["Pacific Heights", "Nob Hill", "Marina District", "Cole Valley"],
  },
  "seattle|US": {
    warnings: [
      { area: "SODO / Industrial District", riskLevel: "High", crimeTypes: ["robbery", "vehicle theft", "assault"] },
      { area: "Belltown (late night)", riskLevel: "High", crimeTypes: ["robbery", "assault", "drug activity"] },
      { area: "Pioneer Square (night)", riskLevel: "High", crimeTypes: ["robbery", "assault"] },
    ],
    safeAreas: ["Capitol Hill", "Queen Anne", "Fremont", "Ballard"],
  },
  "denver|US": {
    warnings: [
      { area: "Five Points / Cole", riskLevel: "High", crimeTypes: ["robbery", "assault", "homicide"] },
      { area: "Sun Valley", riskLevel: "High", crimeTypes: ["robbery", "drug activity", "assault"] },
      { area: "Montbello", riskLevel: "High", crimeTypes: ["robbery", "assault"] },
    ],
    safeAreas: ["Cherry Creek", "Stapleton", "Washington Park", "Highlands Ranch (suburb)"],
  },
  "las vegas|US": {
    warnings: [
      { area: "Downtown / Fremont East (night)", riskLevel: "High", crimeTypes: ["robbery", "assault", "drug activity"] },
      { area: "Naked City", riskLevel: "Very High", crimeTypes: ["robbery", "homicide", "drug activity"] },
      { area: "West Las Vegas", riskLevel: "High", crimeTypes: ["robbery", "assault"] },
    ],
    safeAreas: ["Summerlin", "Henderson", "Green Valley", "Las Vegas Strip (hotels)"],
  },
  "sacramento|US": {
    warnings: [
      { area: "Del Paso Heights", riskLevel: "High", crimeTypes: ["robbery", "assault", "homicide"] },
      { area: "Oak Park", riskLevel: "High", crimeTypes: ["robbery", "assault", "drug activity"] },
      { area: "Meadowview", riskLevel: "High", crimeTypes: ["robbery", "assault"] },
    ],
    safeAreas: ["East Sacramento", "Land Park", "Midtown (daytime)", "Elk Grove (suburb)"],
  },
  "cleveland|US": {
    warnings: [
      { area: "Glenville", riskLevel: "Very High", crimeTypes: ["homicide", "robbery", "assault"] },
      { area: "Hough", riskLevel: "Very High", crimeTypes: ["homicide", "robbery", "shooting"] },
      { area: "Mount Pleasant", riskLevel: "High", crimeTypes: ["robbery", "assault"] },
    ],
    safeAreas: ["Beachwood", "Shaker Heights", "Solon", "Downtown (daytime)"],
  },
  "milwaukee|US": {
    warnings: [
      { area: "Sherman Park", riskLevel: "Very High", crimeTypes: ["homicide", "robbery", "shooting"] },
      { area: "Clarke Square", riskLevel: "Very High", crimeTypes: ["robbery", "assault", "homicide"] },
      { area: "Metcalfe Park", riskLevel: "High", crimeTypes: ["robbery", "assault"] },
    ],
    safeAreas: ["Shorewood", "Whitefish Bay", "Bay View", "East Side"],
  },
  "albuquerque|US": {
    warnings: [
      { area: "International District", riskLevel: "Very High", crimeTypes: ["robbery", "assault", "drug activity"], note: "One of the highest crime-rate neighborhoods in NM" },
      { area: "South Broadway", riskLevel: "High", crimeTypes: ["robbery", "assault"] },
      { area: "Downtown (night)", riskLevel: "High", crimeTypes: ["robbery", "drug activity"] },
    ],
    safeAreas: ["Nob Hill", "Academy Hills", "North Albuquerque Acres", "Rio Rancho (suburb)"],
  },
  "birmingham|US": {
    warnings: [
      { area: "North Birmingham", riskLevel: "Very High", crimeTypes: ["homicide", "robbery", "assault"] },
      { area: "Ensley", riskLevel: "Very High", crimeTypes: ["homicide", "robbery", "shooting"] },
      { area: "East Lake", riskLevel: "High", crimeTypes: ["robbery", "assault"] },
    ],
    safeAreas: ["Mountain Brook", "Homewood", "Vestavia Hills", "Hoover"],
  },
};

/* ───────── Lookup helpers ───────────────────────────────────────────────── */

function lookupMultiAdvisory(country: string): AdvisorySource[] {
  const sources: AdvisorySource[] = [];
  const c = country.toUpperCase();
  const fcdo = UK_FCDO_ADVISORIES[c];
  if (fcdo) {
    sources.push({
      id: "uk-fcdo", name: "UK FCDO Travel Advice", icon: "🇬🇧",
      level: fcdo.level, confidence: 0.90,
      summary: fcdo.summary,
      url: `https://www.gov.uk/foreign-travel-advice/${c.toLowerCase()}`,
      publishedAt: null, domain: "travel",
    });
  }
  const ca = CANADA_ADVISORIES[c];
  if (ca) {
    sources.push({
      id: "canada-gc", name: "Canada Travel Advisories", icon: "🇨🇦",
      level: ca.level, confidence: 0.88,
      summary: ca.summary,
      url: "https://travel.gc.ca/travelling/advisories",
      publishedAt: null, domain: "travel",
    });
  }
  const au = AUSTRALIA_ADVISORIES[c];
  if (au) {
    sources.push({
      id: "smartraveller", name: "Australia Smartraveller", icon: "🇦🇺",
      level: au.level, confidence: 0.87,
      summary: au.summary,
      url: `https://www.smartraveller.gov.au/destinations/${c.toLowerCase()}`,
      publishedAt: null, domain: "travel",
    });
  }
  return sources;
}

function lookupUnodc(city: string, country: string): {
  cityRate: number | null; countryRate: number | null;
  nationalAvg: number | null; globalPercentile: number | null; year: number;
} {
  const cityKey = `${city.toLowerCase().trim()}|${country.toUpperCase()}`;
  const cityRow = UNODC_CITY_HOMICIDE[cityKey] ?? null;
  const countryRow = UNODC_COUNTRY_HOMICIDE[country.toUpperCase()] ?? null;
  return {
    cityRate: cityRow?.rate ?? null,
    countryRate: countryRow?.rate ?? null,
    nationalAvg: countryRow?.rate ?? null,
    globalPercentile: countryRow?.percentile ?? null,
    year: cityRow?.year ?? countryRow?.year ?? 2022,
  };
}

function lookupDangerousCityRanking(city: string, country: string): {
  isTop5Nationally: boolean; isTop10Nationally: boolean; isTop25Globally: boolean;
  nationalRank: number | null; globalRank: number | null; source: string;
} {
  const globalKey = `${city.toLowerCase().trim()}|${country.toUpperCase()}`;
  const globalRank = GLOBAL_TOP25_DANGEROUS_CITIES[globalKey] ?? null;
  const national = NATIONAL_TOP10_DANGEROUS[country.toUpperCase()] ?? [];
  const nationalIdx = national.findIndex(n => n === city.toLowerCase().trim());
  const nationalRank = nationalIdx >= 0 ? nationalIdx + 1 : null;
  return {
    isTop5Nationally: nationalRank != null && nationalRank <= 5,
    isTop10Nationally: nationalRank != null && nationalRank <= 10,
    isTop25Globally: globalRank != null,
    nationalRank,
    globalRank,
    source: "UNODC / Igarapé Institute / local statistical agencies 2023–2024",
  };
}

function lookupNeighborhoodRisk(city: string, country: string): NeighborhoodRisk {
  const key = `${city.toLowerCase().trim()}|${country.toUpperCase()}`;
  return NEIGHBORHOOD_RISK[key] ?? { warnings: [], safeAreas: [] };
}

/* ───────── handler ─────────────────────────────────────────────────────── */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const city = (url.searchParams.get("city") ?? "").trim();
    const state = (url.searchParams.get("state") ?? "").trim() || null;
    const country = (url.searchParams.get("country") ?? "US").trim().toUpperCase();
    const latParam = parseFloat(url.searchParams.get("lat") ?? "");
    const lonParam = parseFloat(url.searchParams.get("lon") ?? "");

    let coords: { lat: number; lon: number } | null =
      Number.isFinite(latParam) && Number.isFinite(lonParam) ? { lat: latParam, lon: lonParam } : null;
    if (!coords) coords = await geocode(city, state, country);

    if (!coords) {
      const fallback: CrimeRates = { ...FBI_NATIONAL_PER_100K };
      for (const k of Object.keys(fallback) as (keyof CrimeRates)[]) {
        fallback[k] = Math.round(fallback[k] * 0.55);
      }
      return new Response(JSON.stringify({
        source: "FALLBACK",
        coords: null,
        rates: fallback,
        signals: null,
        city, state, country,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Cache check (10 min) — keyed by city/state/country + rounded coords.
    const key = cacheKey(city, state, country, coords.lat, coords.lon);
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
      return new Response(JSON.stringify(hit.payload), {
        headers: { ...corsHeaders, "Content-Type": "application/json", "X-Cache": "HIT" },
      });
    }

    // Run all live sources concurrently (14 sources in one round-trip).
    const countryName = COUNTRY_NAMES[country] ?? "";
    const [
      quakes, weather, gdacs, meteo, overpass, fbiAgency,
      fires, eonet, conflictBase, headlines, stateDept,
      cdcData, whoData, reliefData,
    ] = await Promise.all([
      fetchQuakes(coords.lat, coords.lon),
      fetchNwsAlerts(coords.lat, coords.lon, country),
      fetchGdacs(coords.lat, coords.lon),
      fetchOpenMeteo(coords.lat, coords.lon),
      fetchOverpass(coords.lat, coords.lon),
      fbiResolveAgency(city, state),
      fetchNasaFirms(coords.lat, coords.lon),
      fetchNasaEonet(coords.lat, coords.lon),
      fetchAcled(country),
      fetchHeadlines(city, country),
      fetchStateDept(country),
      fetchCdcTravelNotices(country, countryName),
      fetchWhoOutbreaks(countryName),
      fetchReliefWebAlerts(countryName),
    ]);

    // Merge live State Dept advisory into the ACLED conflict row so the score
    // engine always sees the most severe current advisory level.
    const conflict: ConflictSignals = { ...conflictBase };
    if (stateDept && stateDept.level > 0) {
      conflict.travelAdvisory = Math.max(conflict.travelAdvisory, stateDept.level);
      const note = `US State Dept (Level ${stateDept.level}): ${stateDept.levelLabel}`;
      if (!conflict.notes.some((n) => n.startsWith("US State Dept"))) {
        conflict.notes = [...conflict.notes, note];
      }
    }

    // ── Advisory-source reconciliation ───────────────────────────────────────
    // Build per-authority advisory levels from ALL sources, then confidence-weight them.
    // UK FCDO, Canada, Australia are added first (static tables); US State Dept is live.
    const multiAdvisory = lookupMultiAdvisory(country);
    const unodcData = lookupUnodc(city, country);
    const dangerousRanking = lookupDangerousCityRanking(city, country);
    const neighborhoodData = lookupNeighborhoodRisk(city, country);

    const advisorySources: AdvisorySource[] = [...multiAdvisory];

    if (stateDept && stateDept.level > 0) {
      advisorySources.push({
        id: "state-dept", name: "US State Department", icon: "🇺🇸",
        level: stateDept.level, confidence: 0.95,
        summary: stateDept.levelLabel + (stateDept.summary ? ` — ${stateDept.summary.slice(0, 200)}` : ""),
        url: stateDept.url, publishedAt: stateDept.publishedAt, domain: "travel",
      });
    }

    if (conflictBase.severity > 0 || conflictBase.travelAdvisory > 0) {
      const acledLevel = Math.min(4,
        Math.max(conflictBase.travelAdvisory, Math.round(conflictBase.severity * 1.1)));
      advisorySources.push({
        id: "acled", name: "ACLED Conflict Index", icon: "⚔️",
        level: acledLevel, confidence: 0.75,
        summary: conflictBase.tier +
          (conflictBase.events30d > 0
            ? ` · ${conflictBase.events30d} events · ${conflictBase.fatalities30d} fatalities (30d)`
            : ""),
        url: "https://acleddata.com/conflict-index/", domain: "conflict",
      });
    }

    if (cdcData.maxLevel > 0) {
      advisorySources.push({
        id: "cdc", name: "CDC Travel Health Notices", icon: "🏥",
        level: cdcData.maxLevel, confidence: 0.82,
        summary: cdcData.notices[0]?.title ?? `Level ${cdcData.maxLevel} notice`,
        url: "https://wwwnc.cdc.gov/travel/notices",
        publishedAt: cdcData.notices[0]?.pubDate ?? null, domain: "health",
      });
    }

    if (whoData.count > 0) {
      advisorySources.push({
        id: "who", name: "WHO Outbreak News", icon: "🌍",
        // Map outbreak count to advisory level: 1 outbreak→L1, 2+→L2
        level: Math.min(2, whoData.count), confidence: 0.72,
        summary: whoData.outbreaks[0]?.title ?? `${whoData.count} active outbreak(s)`,
        url: "https://www.who.int/emergencies/disease-outbreak-news", domain: "health",
      });
    }

    if (reliefData.count > 0) {
      advisorySources.push({
        id: "reliefweb", name: "ReliefWeb Disasters (UN)", icon: "🆘",
        level: Math.min(2, Math.ceil(reliefData.count / 2)), confidence: 0.65,
        summary: reliefData.alerts.slice(0, 2).map((a) => a.name).join(" · "),
        url: `https://reliefweb.int/country/${country.toLowerCase()}`, domain: "disaster",
      });
    }

    const reconciliation = reconcileAdvisories(advisorySources);

    let fbiPartial: Partial<CrimeRates> | null = null;
    let fbiInfo: { agency: string; year: number; population: number } | null = null;
    if (fbiAgency) {
      const offenses = await fbiOffenses(fbiAgency.ori);
      if (offenses) {
        fbiPartial = fbiOffensesToRates(offenses, fbiAgency.population);
        fbiInfo = { agency: fbiAgency.agency, year: 2022, population: fbiAgency.population };
      }
    }

    // City multiplier: known cities use calibration table; others use hash variance.
    const cityMul = lookupCityMultiplier(city, country);
    const rates = buildRates({
      fbiPartial,
      signals: { quakes, weather, gdacs, meteo, overpass, fires, eonet, conflict },
      variance: cityVariance(`${city}|${state ?? ""}|${country}`),
      cityMultiplier: cityMul,
    });

    const payload = {
      source: "LIVE_AGGREGATE" as const,
      coords,
      rates,
      signals: {
        quakes,
        weatherAlerts: weather,
        gdacsAlerts: gdacs,
        windKph: meteo.windKph,
        precipMm: meteo.precipMm,
        policeNearby: overpass.policeNearby,
        hospitalsNearby: overpass.hospitalsNearby,
        wildfires: fires,
        eonet,
        conflict,
      },
      headlines,
      stateDept,
      fbi: fbiInfo,
      // ── Verified-source additions ──
      cdcNotices: cdcData.notices,
      whoOutbreaks: whoData.outbreaks,
      reliefwebAlerts: reliefData.alerts,
      advisorySources,
      reconciliation,
      cityMultiplier: cityMul,
      // ── Travel Safety Engine v3 additions ──
      unodc: {
        cityHomicidePer100k: unodcData.cityRate,
        countryHomicidePer100k: unodcData.countryRate,
        nationalAvgPer100k: unodcData.nationalAvg,
        globalPercentile: unodcData.globalPercentile,
        yearOfData: unodcData.year,
      },
      dangerousRanking,
      neighborhoodWarnings: neighborhoodData.warnings,
      neighborhoodSafeAreas: neighborhoodData.safeAreas,
      city, state, country,
      fetchedAt: new Date().toISOString(),
      cacheTtlSec: Math.round(CACHE_TTL_MS / 1000),
    };

    cache.set(key, { at: Date.now(), payload });
    // Light eviction: keep cache bounded.
    if (cache.size > 200) {
      const oldest = [...cache.entries()].sort((a, b) => a[1].at - b[1].at).slice(0, 50);
      for (const [k] of oldest) cache.delete(k);
    }

    return new Response(JSON.stringify(payload), {
      headers: { ...corsHeaders, "Content-Type": "application/json", "X-Cache": "MISS" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({
      source: "FALLBACK", error: msg, rates: FBI_NATIONAL_PER_100K, signals: null,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});