/**
 * Live destination search using Wikipedia REST API + Open-Meteo geocoding.
 * No API key required. Returns city/country + real photo + summary.
 */

export interface DestinationResult {
  name: string;        // "Tokyo"
  country: string;     // "Japan"
  region?: string;     // "Tokyo Prefecture" / state
  lat?: number;
  lng?: number;
  photo?: string;      // real photo URL
  summary?: string;    // short paragraph
  population?: number;
}

/* ── Search cities by typed query (live, debounced from caller) ── */
export async function searchDestinations(query: string): Promise<DestinationResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  try {
    // Open-Meteo geocoding: fast, returns city + country + coords
    const r = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=8&language=en&format=json`
    );
    const d = await r.json();
    const results: DestinationResult[] = (d.results || []).map((it: any) => ({
      name: it.name,
      country: it.country || '',
      region: it.admin1 || undefined,
      lat: it.latitude,
      lng: it.longitude,
      population: it.population,
    }));
    return results;
  } catch {
    return [];
  }
}

/* ── Hydrate a destination with Wikipedia photo + summary ── */
export async function getDestinationDetails(
  cityName: string,
  countryName?: string
): Promise<{ photo?: string; summary?: string }> {
  // Try "City, Country" first then fall back to just city
  const candidates = countryName ? [`${cityName}, ${countryName}`, cityName] : [cityName];
  for (const title of candidates) {
    try {
      const res = await fetch(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`
      );
      if (!res.ok) continue;
      const j = await res.json();
      if (j.type === 'disambiguation') continue;
      return {
        photo: j.thumbnail?.source || j.originalimage?.source,
        summary: j.extract,
      };
    } catch {
      // try next
    }
  }
  return {};
}
