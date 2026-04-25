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

// Resolve "Miami, FL" / "Miami" → an FBI ORI agency record via CDE search.
// Falls back to state-level if city match is poor.
async function resolveAgency(city: string, state: string | null): Promise<{ ori: string; population: number; agency_name: string } | null> {
  if (!city) return null;
  const apiKey = Deno.env.get("FBI_CDE_API_KEY");
  if (!apiKey) return null; // gracefully skip if not configured
  try {
    const url = `https://api.usa.gov/crime/fbi/cde/agencies/byStateAbbr/${encodeURIComponent((state ?? "").toUpperCase())}?API_KEY=${apiKey}`;
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;
    const list = await r.json();
    if (!Array.isArray(list)) return null;
    const cityLower = city.toLowerCase();
    const exact = list.find((a: any) =>
      typeof a?.agency_name === "string" &&
      a.agency_name.toLowerCase().includes(cityLower) &&
      /police/i.test(a.agency_name)
    );
    const any = exact ?? list.find((a: any) => a?.agency_name?.toLowerCase().includes(cityLower));
    if (!any?.ori) return null;
    return {
      ori: any.ori,
      population: Number(any.population ?? 0) || 0,
      agency_name: any.agency_name,
    };
  } catch { return null; }
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
