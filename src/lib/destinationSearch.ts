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

export interface DestinationDetails {
  photo?: string;
  summary?: string;
  history?: string;
  areaOverview?: string;
  gallery?: string[];   // 3-4 supplemental real photos
  news?: NewsItem[];    // latest live news for the area
}

export interface NewsItem {
  title: string;
  url: string;
  source?: string;
  publishedAt?: string;
}

/* ── Search cities by typed query (live, debounced from caller) ── */
export async function searchDestinations(query: string): Promise<DestinationResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  try {
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

/* ── Light-weight: just hero photo + short summary (used for cards) ── */
export async function getDestinationDetails(
  cityName: string,
  countryName?: string
): Promise<{ photo?: string; summary?: string }> {
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

/* ── Rich detail: hero + 3-4 gallery + summary + history + area overview ── */
export async function getRichDestinationDetails(
  cityName: string,
  countryName?: string
): Promise<DestinationDetails> {
  const out: DestinationDetails = {};
  const candidates = countryName ? [`${cityName}, ${countryName}`, cityName] : [cityName];

  // 1. Hero summary + HD photo (Wikipedia REST)
  let resolvedTitle: string | undefined;
  for (const title of candidates) {
    try {
      const res = await fetch(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`
      );
      if (!res.ok) continue;
      const j = await res.json();
      if (j.type === 'disambiguation') continue;
      // Prefer the original (full-resolution) image — typically 1920px+ wide → HD/4K class
      out.photo = j.originalimage?.source || j.thumbnail?.source;
      out.summary = j.extract;
      resolvedTitle = j.title || title;
      break;
    } catch { /* try next */ }
  }

  if (!resolvedTitle) return out;

  // 2. HD Gallery — pull pageimages from Wikipedia API (1600px thumbs ≈ HD)
  try {
    const galleryRes = await fetch(
      `https://en.wikipedia.org/w/api.php?` +
      `action=query&format=json&origin=*&prop=images&imlimit=40&titles=${encodeURIComponent(resolvedTitle)}`
    );
    const gj = await galleryRes.json();
    const pages = gj.query?.pages || {};
    const page: any = Object.values(pages)[0];
    const imageTitles: string[] = (page?.images || [])
      .map((i: any) => i.title as string)
      .filter((t: string) =>
        /\.(jpg|jpeg|png)$/i.test(t) &&
        !/(commons-logo|wiki|edit-icon|flag of|coat of arms|location|map|svg|seal of|emblem)/i.test(t)
      )
      .slice(0, 12);

    if (imageTitles.length) {
      const infoRes = await fetch(
        `https://en.wikipedia.org/w/api.php?` +
        `action=query&format=json&origin=*&prop=imageinfo&iiprop=url|size&iiurlwidth=1600&titles=${encodeURIComponent(imageTitles.join('|'))}`
      );
      const ij = await infoRes.json();
      const infoPages = ij.query?.pages || {};
      const urls: string[] = Object.values(infoPages)
        .map((p: any) => p.imageinfo?.[0]?.thumburl || p.imageinfo?.[0]?.url)
        .filter(Boolean) as string[];
      out.gallery = urls.filter(u => u !== out.photo).slice(0, 4);
    }
  } catch { /* gallery is optional */ }

  // 3. History + area overview — pull section extracts
  try {
    const sectionRes = await fetch(
      `https://en.wikipedia.org/w/api.php?` +
      `action=query&format=json&origin=*&prop=extracts&explaintext=1&exsectionformat=plain&titles=${encodeURIComponent(resolvedTitle)}`
    );
    const sj = await sectionRes.json();
    const sPages = sj.query?.pages || {};
    const sPage: any = Object.values(sPages)[0];
    const fullText: string = sPage?.extract || '';
    if (fullText) {
      const historyMatch = fullText.match(/History[\s\S]{20,800}/i);
      if (historyMatch) {
        out.history = historyMatch[0].slice(0, 600).replace(/\s+/g, ' ').trim() + '…';
      }
      const geoMatch = fullText.match(/(Geography|Climate|Demographics)[\s\S]{20,500}/i);
      if (geoMatch) {
        out.areaOverview = geoMatch[0].slice(0, 400).replace(/\s+/g, ' ').trim() + '…';
      }
    }
  } catch { /* optional */ }

  // 4. Live news for the destination — GDELT DOC API (free, CORS-enabled, no key)
  try {
    out.news = await getDestinationNews(cityName, countryName);
  } catch { /* optional */ }

  return out;
}

/* ── Live news for the destination via GDELT DOC API (no key, CORS-enabled) ── */
export async function getDestinationNews(
  cityName: string,
  countryName?: string
): Promise<NewsItem[]> {
  const query = countryName ? `"${cityName}" "${countryName}"` : `"${cityName}"`;
  try {
    const res = await fetch(
      `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(query)}&mode=ArtList&maxrecords=8&format=json&sort=DateDesc&sourcelang=eng`
    );
    if (!res.ok) return [];
    const j = await res.json();
    const arts: any[] = j.articles || [];
    return arts.slice(0, 6).map(a => ({
      title: a.title,
      url: a.url,
      source: a.domain,
      publishedAt: a.seendate,
    })).filter(n => n.title && n.url);
  } catch {
    return [];
  }
}
