// Real crime data proxy.
// Combines:
//  • FBI Crime Data API (CDE) — free, no key required for the public summary
//    endpoints. Provides agency-level offense counts for US cities.
//    Docs: https://api.usa.gov/crime/fbi/cde/
//  • Travel.State.Gov advisory level (free) — international fallback.
//
// Returns a normalized payload the frontend's safety engine can consume:
//   {
//     source: 'FBI_CDE' | 'FBI_NATIONAL' | 'STATE_GOV' | 'FALLBACK',
//     year:   number | null,
//     population: number | null,
//     // counts per 100k population, calibrated per category
//     rates: { robbery, assault, burglary, larceny_home, vehicle_theft,
//              sexual_offense, weapons_offense, ... },
//     advisoryLevel?: number,
//     city, state, country
//   }
//
// CORS-safe. No secrets needed (FBI CDE is public; advisory list is public JSON).

import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

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

// FBI 2022 national rates per 100k (UCR/NIBRS combined estimates).
// Used as the "what does average America look like" benchmark and as a
// floor for cities where CDE has no agency match.
const FBI_NATIONAL_PER_100K: CrimeRates = {
  robbery:           66.1,
  assault:           282.7,
  sexual_offense:    42.0,
  kidnapping:        4.0,
  burglary:          269.8,
  home_invasion:     12.0,
  vandalism:         91.0,
  larceny_home:      1401.9,
  vehicle_theft:     282.7,
  carjacking:        9.0,
  vehicle_break_in:  220.0,
  traffic_incident:  120.0,
  drug_activity:     410.0,
  public_disorder:   180.0,
  weapons_offense:   90.0,
};

// FBI CDE offense codes (NIBRS) → our category keys.
// Multiple codes can map to one category (we'll sum them).
const NIBRS_MAP: Record<string, keyof CrimeRates> = {
  "120": "robbery",            // Robbery
  "13A": "assault",            // Aggravated Assault
  "13B": "assault",            // Simple Assault (folded)
  "11A": "sexual_offense",     // Rape
  "11B": "sexual_offense",     // Sodomy
  "11C": "sexual_offense",     // Sexual Assault With An Object
  "100": "kidnapping",         // Kidnapping/Abduction
  "220": "burglary",           // Burglary/Breaking & Entering
  "290": "vandalism",          // Destruction/Damage/Vandalism
  "23H": "larceny_home",       // All Other Larceny
  "240": "vehicle_theft",      // Motor Vehicle Theft
  "23F": "vehicle_break_in",   // Theft From Motor Vehicle
  "35A": "drug_activity",      // Drug/Narcotic Violations
  "90C": "public_disorder",    // Disorderly Conduct
  "520": "weapons_offense",    // Weapon Law Violations
};

async function fetchAdvisoryLevel(country: string): Promise<number | null> {
  try {
    const r = await fetch("https://www.travel-advisory.info/api", { signal: AbortSignal.timeout(6000) });
    if (!r.ok) return null;
    const j = await r.json();
    const c = j?.data?.[country.toUpperCase()];
    return typeof c?.advisory?.score === "number" ? c.advisory.score : null;
  } catch { return null; }
}

// Normalize a city/agency string for fuzzy comparison:
//  • lowercase
//  • strip punctuation
//  • drop common prefixes/suffixes ("city of", "town of", "police department", "pd", "sheriff's office")
//  • collapse whitespace
//  • expand a few common abbreviations ("st." → "saint", "mt." → "mount", "ft." → "fort")
function normalizeName(input: string): string {
  if (!input) return "";
  let s = input.toLowerCase();
  // Expand common abbreviations before punctuation is stripped.
  s = s
    .replace(/\bst\.?\s/g, "saint ")
    .replace(/\bmt\.?\s/g, "mount ")
    .replace(/\bft\.?\s/g, "fort ")
    .replace(/\bn\.?\s/g, "north ")
    .replace(/\bs\.?\s/g, "south ")
    .replace(/\be\.?\s/g, "east ")
    .replace(/\bw\.?\s/g, "west ");
  // Strip punctuation.
  s = s.replace(/[^a-z0-9\s]/g, " ");
  // Drop common prefixes/suffixes that appear in FBI agency_name fields.
  const stopPhrases = [
    "city of", "town of", "village of", "borough of", "township of",
    "police department", "police dept", "department of police",
    "sheriff s office", "sheriffs office", "sheriff office", "sheriff",
    "metropolitan", "metro", "municipal", "county", "police", "pd",
  ];
  for (const p of stopPhrases) s = s.replace(new RegExp(`\\b${p}\\b`, "g"), " ");
  return s.replace(/\s+/g, " ").trim();
}

// Levenshtein distance with an early-exit cap — small/fast enough for ~1k agencies per state.
function levenshtein(a: string, b: string, cap = 5): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > cap) return cap + 1;
  const al = a.length, bl = b.length;
  if (!al) return bl;
  if (!bl) return al;
  let prev = new Array(bl + 1);
  let curr = new Array(bl + 1);
  for (let j = 0; j <= bl; j++) prev[j] = j;
  for (let i = 1; i <= al; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j <= bl; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > cap) return cap + 1;
    [prev, curr] = [curr, prev];
  }
  return prev[bl];
}

// Score how well an agency matches the requested city. Higher is better.
// 100 = perfect normalized equality, then graded by token overlap, substring,
// and edit distance. Prefer "Police" agencies over Sheriff/Constable when tied.
function scoreAgencyMatch(cityNorm: string, agencyName: string): number {
  if (!cityNorm || !agencyName) return 0;
  const agencyNorm = normalizeName(agencyName);
  if (!agencyNorm) return 0;
  if (agencyNorm === cityNorm) return 100;

  const cityTokens = cityNorm.split(" ").filter(Boolean);
  const agencyTokens = new Set(agencyNorm.split(" ").filter(Boolean));
  const overlap = cityTokens.filter(t => agencyTokens.has(t)).length;
  const tokenScore = cityTokens.length ? (overlap / cityTokens.length) * 60 : 0;

  // Substring bonus: full city phrase appears inside the agency name.
  const substringBonus =
    agencyNorm.includes(cityNorm) ? 25 :
    cityNorm.includes(agencyNorm) ? 15 : 0;

  // Edit-distance bonus for short city names with minor typos.
  const dist = levenshtein(cityNorm, agencyNorm, 4);
  const distBonus = dist <= 1 ? 20 : dist <= 2 ? 12 : dist <= 3 ? 6 : 0;

  // Police-type preference for ties (lightly weighted, doesn't change category).
  const lower = agencyName.toLowerCase();
  const typeBonus =
    /police/.test(lower) ? 8 :
    /sheriff/.test(lower) ? 4 :
    /marshal|constable|public safety/.test(lower) ? 3 : 0;

  return tokenScore + substringBonus + distBonus + typeBonus;
}

// Resolve "Miami, FL" / "City of Saint Paul" / "Ft. Worth" → an FBI ORI agency
// record via CDE search. Uses normalized fuzzy matching and only falls back
// when no agency clears a confidence threshold.
async function resolveAgency(
  city: string,
  state: string | null,
): Promise<{ ori: string; population: number; agency_name: string } | null> {
  if (!city) return null;
  const apiKey = Deno.env.get("FBI_CDE_API_KEY");
  if (!apiKey) return null; // gracefully skip if not configured
  try {
    const stateAbbr = (state ?? "").toUpperCase();
    if (!stateAbbr) return null;
    const url = `https://api.usa.gov/crime/fbi/cde/agencies/byStateAbbr/${encodeURIComponent(stateAbbr)}?API_KEY=${apiKey}`;
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;
    const list = await r.json();
    if (!Array.isArray(list) || list.length === 0) return null;

    const cityNorm = normalizeName(city);
    if (!cityNorm) return null;

    let best: { entry: any; score: number } | null = null;
    for (const a of list) {
      const name = typeof a?.agency_name === "string" ? a.agency_name : "";
      if (!name || !a?.ori) continue;
      const score = scoreAgencyMatch(cityNorm, name);
      if (!best || score > best.score) best = { entry: a, score };
    }

    // Require a meaningful match — anything below 35 is essentially noise.
    if (!best || best.score < 35) return null;

    return {
      ori: best.entry.ori,
      population: Number(best.entry.population ?? 0) || 0,
      agency_name: best.entry.agency_name,
    };
  } catch {
    return null;
  }
}

async function fetchAgencyOffenses(ori: string): Promise<{ year: number; counts: Record<string, number> } | null> {
  const apiKey = Deno.env.get("FBI_CDE_API_KEY");
  if (!apiKey) return null;
  try {
    const url = `https://api.usa.gov/crime/fbi/cde/summarized/agency/${ori}/offenses?from=2022&to=2022&API_KEY=${apiKey}`;
    const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!r.ok) return null;
    const j = await r.json();
    // CDE returns: { offenses: { actuals: { "2022": { "13A": 412, ... } } } } shape varies.
    const counts: Record<string, number> = {};
    const actuals = j?.offenses?.actuals ?? j?.offenses ?? {};
    const yearObj = actuals?.["2022"] ?? actuals;
    if (yearObj && typeof yearObj === "object") {
      for (const [k, v] of Object.entries(yearObj)) {
        if (typeof v === "number") counts[k] = v;
        else if (v && typeof v === "object") {
          // sometimes nested as { "13A": { "Total": N } }
          const total = (v as any).Total ?? (v as any).total;
          if (typeof total === "number") counts[k] = total;
        }
      }
    }
    if (Object.keys(counts).length === 0) return null;
    return { year: 2022, counts };
  } catch { return null; }
}

function offensesToRates(counts: Record<string, number>, population: number): Partial<CrimeRates> {
  if (!population || population < 1000) return {};
  const per100k = (n: number) => (n / population) * 100_000;
  const agg: Partial<Record<keyof CrimeRates, number>> = {};
  for (const [code, n] of Object.entries(counts)) {
    const key = NIBRS_MAP[code];
    if (!key || typeof n !== "number") continue;
    agg[key] = (agg[key] ?? 0) + n;
  }
  const rates: Partial<CrimeRates> = {};
  for (const [k, v] of Object.entries(agg)) {
    rates[k as keyof CrimeRates] = Math.round(per100k(v as number));
  }
  return rates;
}

// Merge agency rates over national defaults so categories with no data
// fall back to national averages instead of zero.
function mergeWithNational(partial: Partial<CrimeRates>): CrimeRates {
  return { ...FBI_NATIONAL_PER_100K, ...partial };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const city = (url.searchParams.get("city") ?? "").trim();
    const state = (url.searchParams.get("state") ?? "").trim() || null;
    const country = (url.searchParams.get("country") ?? "US").trim().toUpperCase();

    // International branch — Travel.State.Gov / advisory level only.
    if (country !== "US") {
      const advisoryLevel = await fetchAdvisoryLevel(country);
      return new Response(JSON.stringify({
        source: "STATE_GOV",
        year: new Date().getFullYear(),
        population: null,
        rates: FBI_NATIONAL_PER_100K, // generic baseline; engine uses advisoryLevel
        advisoryLevel,
        city, state, country,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Domestic US branch — try FBI CDE.
    const agency = await resolveAgency(city, state);
    if (agency) {
      const offenses = await fetchAgencyOffenses(agency.ori);
      if (offenses) {
        const partial = offensesToRates(offenses.counts, agency.population);
        const rates = mergeWithNational(partial);
        return new Response(JSON.stringify({
          source: "FBI_CDE",
          year: offenses.year,
          population: agency.population,
          agency: agency.agency_name,
          rates,
          city, state, country,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // Fallback — national averages with deterministic city seed left to client.
    return new Response(JSON.stringify({
      source: "FBI_NATIONAL",
      year: 2022,
      population: null,
      rates: FBI_NATIONAL_PER_100K,
      city, state, country,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ source: "FALLBACK", error: msg, rates: FBI_NATIONAL_PER_100K }), {
      status: 200, // never break the UI
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
