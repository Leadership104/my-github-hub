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
//
// Per-city responses are cached in memory for 10 minutes to keep load light
// across the upstream APIs while supporting the screen's auto-refresh cadence.

import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

const UA = "kipita-safety/1.0 (https://kipita.app)";

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
  // Google News RSS filtered to Bloomberg + Yahoo Finance, plus Yahoo Finance topic RSS as a top-up.
  const q = encodeURIComponent(
    `(site:bloomberg.com OR site:finance.yahoo.com) "${city}"`,
  );
  const googleUrl = `https://news.google.com/rss/search?q=${q}&hl=en-US&gl=${country}&ceid=${country}:en`;
  const yahooUrl = "https://finance.yahoo.com/news/rssindex";
  try {
    const [g, y] = await Promise.all([
      fetch(googleUrl, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(7000) })
        .then((r) => r.ok ? r.text() : "").catch(() => ""),
      fetch(yahooUrl, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(7000) })
        .then((r) => r.ok ? r.text() : "").catch(() => ""),
    ]);
    const cityRe = new RegExp(city.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    const gItems = parseRssItems(g, "Bloomberg / Yahoo (via Google News)", 6)
      .map((h) => {
        // Strip Google News redirect prefix when present.
        if (h.link.includes("news.google.com")) {
          const m = h.link.match(/url=([^&]+)/);
          if (m) h.link = decodeURIComponent(m[1]);
        }
        const isBloomberg = /bloomberg\.com/i.test(h.link);
        h.source = isBloomberg ? "Bloomberg" : /finance\.yahoo\.com/i.test(h.link) ? "Yahoo Finance" : h.source;
        return h;
      });
    const yItems = parseRssItems(y, "Yahoo Finance", 8).filter((h) => cityRe.test(h.title));
    const seen = new Set<string>();
    const merged = [...gItems, ...yItems].filter((h) => {
      if (seen.has(h.link)) return false;
      seen.add(h.link);
      return true;
    });
    return merged.slice(0, 5);
  } catch {
    return [];
  }
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
  variance: number; // -1..1 from city seed
}): CrimeRates {
  const { fbiPartial, signals, variance } = opts;
  const TYPICAL_BIAS = 0.55;
  const biased: CrimeRates = { ...FBI_NATIONAL_PER_100K };
  for (const k of Object.keys(biased) as (keyof CrimeRates)[]) {
    biased[k] = Math.round(biased[k] * TYPICAL_BIAS);
  }
  const base: CrimeRates = { ...biased, ...(fbiPartial ?? {}) };

  const v = 1 + Math.max(-1, Math.min(1, variance)) * 0.25;
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

/* ───────── handler ───────── */

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

    // Run all live sources concurrently.
    const [quakes, weather, gdacs, meteo, overpass, fbiAgency, fires, eonet, conflictBase, headlines, stateDept] = await Promise.all([
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
    ]);

    // If the live State Dept advisory is more current/severe than our static
    // ACLED row, prefer it for `travelAdvisory` and append a note for transparency.
    const conflict: ConflictSignals = { ...conflictBase };
    if (stateDept && stateDept.level > 0) {
      conflict.travelAdvisory = Math.max(conflict.travelAdvisory, stateDept.level);
      const note = `US State Dept (Level ${stateDept.level}): ${stateDept.levelLabel}`;
      if (!conflict.notes.some((n) => n.startsWith("US State Dept"))) {
        conflict.notes = [...conflict.notes, note];
      }
    }

    let fbiPartial: Partial<CrimeRates> | null = null;
    let fbiInfo: { agency: string; year: number; population: number } | null = null;
    if (fbiAgency) {
      const offenses = await fbiOffenses(fbiAgency.ori);
      if (offenses) {
        fbiPartial = fbiOffensesToRates(offenses, fbiAgency.population);
        fbiInfo = { agency: fbiAgency.agency, year: 2022, population: fbiAgency.population };
      }
    }

    const rates = buildRates({
      fbiPartial,
      signals: { quakes, weather, gdacs, meteo, overpass, fires, eonet, conflict },
      variance: cityVariance(`${city}|${state ?? ""}|${country}`),
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