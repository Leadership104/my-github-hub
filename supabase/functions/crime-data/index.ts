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
  // Box: ~150 km square around point. FIRMS returns CSV.
  const dLat = 1.35; // ~150 km
  const dLon = 1.35 / Math.max(0.2, Math.cos(lat * Math.PI / 180));
  const west = (lon - dLon).toFixed(3);
  const south = (lat - dLat).toFixed(3);
  const east = (lon + dLon).toFixed(3);
  const north = (lat + dLat).toFixed(3);
  const area = `${west},${south},${east},${north}`;
  // VIIRS_SNPP_NRT, last 1 day
  const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${key}/VIIRS_SNPP_NRT/${area}/1`;
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) return { activeFires: 0, maxConfidence: 0, nearestKm: 9999 };
    const text = await r.text();
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) return { activeFires: 0, maxConfidence: 0, nearestKm: 9999 };
    const header = lines[0].split(",").map((s) => s.trim().toLowerCase());
    const li = header.indexOf("latitude");
    const lo = header.indexOf("longitude");
    const ci = header.indexOf("confidence");
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
      const c = cols[ci];
      const conf = c === "h" ? 90 : c === "n" ? 60 : c === "l" ? 30 : Number(c) || 0;
      if (conf > maxConf) maxConf = conf;
    }
    return { activeFires: count, maxConfidence: maxConf, nearestKm: Math.round(nearest) };
  } catch { return { activeFires: 0, maxConfidence: 0, nearestKm: 9999 }; }
}

interface EonetSignals { activeEvents: number; categories: string[] }
async function fetchNasaEonet(lat: number, lon: number): Promise<EonetSignals> {
  try {
    const r = await fetch(
      "https://eonet.gsfc.nasa.gov/api/v3/events?status=open&days=14",
      { signal: AbortSignal.timeout(7000) },
    );
    if (!r.ok) return { activeEvents: 0, categories: [] };
    const j = await r.json();
    const cats = new Set<string>();
    let count = 0;
    for (const ev of j.events ?? []) {
      const geom = ev.geometry?.[ev.geometry.length - 1];
      const coords = geom?.coordinates;
      if (!Array.isArray(coords) || coords.length < 2) continue;
      const [eLon, eLat] = coords;
      if (typeof eLat !== "number" || typeof eLon !== "number") continue;
      if (distKm(lat, lon, eLat, eLon) > 400) continue;
      count++;
      for (const c of ev.categories ?? []) {
        if (c?.title) cats.add(String(c.title));
      }
    }
    return { activeEvents: count, categories: [...cats].slice(0, 6) };
  } catch { return { activeEvents: 0, categories: [] }; }
}

interface ConflictSignals { events30d: number; fatalities30d: number; severity: number }
async function fetchAcled(country: string): Promise<ConflictSignals> {
  // ACLED public dashboard JSON (no key, country-level).
  // Maps ISO2 → ACLED country slug for the most-requested ones; falls back to 0.
  const ISO2_TO_ACLED: Record<string, string> = {
    UA: "Ukraine", RU: "Russia", IL: "Israel", PS: "Palestine", LB: "Lebanon",
    SY: "Syria", IQ: "Iraq", IR: "Iran", YE: "Yemen", AF: "Afghanistan",
    PK: "Pakistan", MM: "Myanmar", SD: "Sudan", SS: "South Sudan", SO: "Somalia",
    ET: "Ethiopia", LY: "Libya", ML: "Mali", BF: "Burkina Faso", NE: "Niger",
    NG: "Nigeria", CD: "Democratic Republic of Congo", CF: "Central African Republic",
    CM: "Cameroon", MZ: "Mozambique", VE: "Venezuela", CO: "Colombia", MX: "Mexico",
    HT: "Haiti", EC: "Ecuador",
  };
  const name = ISO2_TO_ACLED[country];
  if (!name) return { events30d: 0, fatalities30d: 0, severity: 0 };
  try {
    // ACLED Conflict Index API (public, no key required for basic dashboard data)
    const url = `https://acleddata.com/api/conflict_index/read/?country=${encodeURIComponent(name)}&limit=1`;
    const r = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) return { events30d: 0, fatalities30d: 0, severity: 0 };
    const j = await r.json();
    const row = Array.isArray(j?.data) ? j.data[0] : null;
    if (!row) {
      // Country in conflict map but no recent data: assume baseline severity.
      return { events30d: 0, fatalities30d: 0, severity: 1 };
    }
    const events = Number(row.events ?? row.event_count ?? 0);
    const fatal = Number(row.fatalities ?? 0);
    // Severity 0..3 from ACLED's published index (Extreme/High/Turbulent/Low)
    const cat = String(row.overall_score_category ?? row.category ?? "").toLowerCase();
    const severity = cat.includes("extreme") ? 3
      : cat.includes("high") ? 2
      : cat.includes("turbulent") ? 1
      : events > 50 || fatal > 20 ? 1
      : 0;
    return { events30d: events, fatalities30d: fatal, severity };
  } catch {
    // If ACLED is unreachable but the country is in our conflict list,
    // still flag baseline severity so the score reacts.
    return { events30d: 0, fatalities30d: 0, severity: 1 };
  }
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
  };
  variance: number; // -1..1 from city seed
}): CrimeRates {
  const { fbiPartial, signals, variance } = opts;
  // National rates skew high because a small number of high-crime cities
  // dominate the mean. For a "typical" city/suburb we calibrate the baseline
  // to ~55% of the national average so the engine doesn't flag every
  // location as ELEVATED. When real CDE data is available it overrides.
  const TYPICAL_BIAS = 0.55;
  const biased: CrimeRates = { ...FBI_NATIONAL_PER_100K };
  for (const k of Object.keys(biased) as (keyof CrimeRates)[]) {
    biased[k] = Math.round(biased[k] * TYPICAL_BIAS);
  }
  const base: CrimeRates = { ...biased, ...(fbiPartial ?? {}) };

  // City-seeded variance ±25% so different cities aren't identical when
  // we only have national data.
  const v = 1 + Math.max(-1, Math.min(1, variance)) * 0.25;

  // Police density discount (more police nearby → lower rates, capped at -35%).
  const policeDiscount = Math.max(0.65, 1 - Math.min(signals.overpass.policeNearby, 12) * 0.03);

  // Environmental risk projector — affects "traffic", "public_disorder",
  // "vandalism" categories proportional to live hazards.
  const stormFactor =
    1 +
    Math.min(signals.weather.severe, 3) * 0.35 +
    Math.min(signals.gdacs.maxScore, 3) * 0.25 +
    (signals.meteo.windKph >= 60 ? 0.4 : signals.meteo.windKph >= 35 ? 0.15 : 0) +
    (signals.meteo.precipMm >= 10 ? 0.25 : signals.meteo.precipMm >= 3 ? 0.1 : 0);

  const quakeFactor =
    1 +
    (signals.quakes.maxMag >= 5 ? 0.5 : signals.quakes.maxMag >= 3 ? 0.15 : 0) +
    Math.min(signals.quakes.count, 10) * 0.02;

  const out: CrimeRates = { ...base };
  for (const k of Object.keys(out) as (keyof CrimeRates)[]) {
    let f = v * policeDiscount;
    if (k === "traffic_incident") f *= stormFactor;
    if (k === "public_disorder" || k === "vandalism") f *= 1 + (stormFactor - 1) * 0.5;
    if (k === "home_invasion" || k === "burglary") f *= quakeFactor; // post-disaster looting risk
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

    // Run all live sources concurrently.
    const [quakes, weather, gdacs, meteo, overpass, fbiAgency] = await Promise.all([
      fetchQuakes(coords.lat, coords.lon),
      fetchNwsAlerts(coords.lat, coords.lon, country),
      fetchGdacs(coords.lat, coords.lon),
      fetchOpenMeteo(coords.lat, coords.lon),
      fetchOverpass(coords.lat, coords.lon),
      fbiResolveAgency(city, state),
    ]);

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
      signals: { quakes, weather, gdacs, meteo, overpass },
      variance: cityVariance(`${city}|${state ?? ""}|${country}`),
    });

    return new Response(JSON.stringify({
      source: "LIVE_AGGREGATE",
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
      },
      fbi: fbiInfo,
      city, state, country,
      fetchedAt: new Date().toISOString(),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({
      source: "FALLBACK", error: msg, rates: FBI_NATIONAL_PER_100K, signals: null,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});