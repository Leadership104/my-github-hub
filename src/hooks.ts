import { useState, useEffect, useCallback, useRef } from 'react';
import type { CryptoPrice, BTCMerchant, MetalPrice, RecreationSpot, RecreationCategory } from './types';
import { supabase } from '@/integrations/supabase/client';

/**
 * Resolve precise street address for lat/lng. Prefers Google Geocoding (via
 * places-proxy edge function) which returns the postal city (e.g. "Herndon")
 * and a full street address. Falls back to BigDataCloud + Nominatim if Google
 * is unavailable.
 */
export async function preciseReverseGeocode(lat: number, lng: number): Promise<{
  name: string;
  fullAddress: string;
  countryCode: string;
}> {
  // Try Google via edge function first.
  try {
    const { data, error } = await supabase.functions.invoke('places-proxy', {
      body: { action: 'geocode', lat, lng },
    });
    if (!error && data && !data.error && data.formattedAddress) {
      const cc = (data.countryCode || '').toUpperCase();
      const cityState = [data.city, data.state].filter(Boolean).join(', ');
      const displayCountry = cc === 'US' ? 'USA' : cc;
      const name = cityState ? `${cityState}${displayCountry ? ', ' + displayCountry : ''}` : (data.formattedAddress || 'Current Location');
      return { name, fullAddress: data.formattedAddress, countryCode: cc };
    }
  } catch { /* fall through */ }

  // Fallback: BigDataCloud (postal city) + Nominatim (street address).
  const [bdcRes, nomRes] = await Promise.all([
    fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`),
    fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1&zoom=18`),
  ]);
  const bdc = await bdcRes.json().catch(() => ({} as any));
  const nom = await nomRes.json().catch(() => ({} as any));
  const city = bdc.city || bdc.locality || bdc.principalSubdivision || nom.address?.city || nom.address?.town || nom.address?.village || '';
  const country = (bdc.countryCode || nom.address?.country_code || '').toUpperCase();
  const state = bdc.principalSubdivisionCode?.split('-')[1] || nom.address?.state_code || '';
  const displayCountry = country === 'US' ? 'USA' : country;
  const locationParts = [city];
  if (country === 'US' && state && state !== city) locationParts.push(state);
  if (displayCountry) locationParts.push(displayCountry);
  const name = city ? locationParts.join(', ') : 'Current Location';
  const fullAddress = nom.display_name || [bdc.locality, bdc.principalSubdivision, bdc.countryName].filter(Boolean).join(', ') || name;
  return { name, fullAddress, countryCode: country };
}

export function useDragScroll<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let isDown = false;
    let startX = 0;
    let scrollLeft = 0;
    let moved = false;

    const resetDrag = () => {
      isDown = false;
      el.style.cursor = 'grab';
      document.body.style.removeProperty('user-select');
    };

    const onDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      isDown = true;
      moved = false;
      startX = e.pageX;
      scrollLeft = el.scrollLeft;
      el.style.cursor = 'grabbing';
      document.body.style.userSelect = 'none';
    };

    const onUp = () => {
      resetDrag();
    };

    const onMove = (e: MouseEvent) => {
      if (!isDown) return;
      e.preventDefault();
      const walk = (e.pageX - startX) * 1.5;
      if (Math.abs(walk) > 4) moved = true;
      el.scrollLeft = scrollLeft - walk;
    };

    // Prevent click on children after drag
    const onClick = (e: MouseEvent) => {
      if (moved) {
        e.stopPropagation();
        e.preventDefault();
        moved = false;
      }
    };

    const onDragStart = (e: DragEvent) => {
      e.preventDefault();
    };

    el.style.cursor = 'grab';
    el.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    el.addEventListener('click', onClick, true);
    el.addEventListener('dragstart', onDragStart);

    return () => {
      resetDrag();
      el.removeEventListener('mousedown', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      el.removeEventListener('click', onClick, true);
      el.removeEventListener('dragstart', onDragStart);
    };
  });

  return ref;
}

// Default to New York, USA instead of Bangkok
const DEFAULT_LOCATION = { lat: 40.7128, lng: -74.006, name: 'New York, US' };

export interface LocationState {
  lat: number;
  lng: number;
  name: string;
  fullAddress?: string;
  countryCode?: string;
}

/**
 * IP-based geolocation fallback. Tries multiple HTTPS providers in order so the
 * app still has a usable city/country when the browser geolocation API is
 * unavailable, denied, or times out. Returns null if every provider fails.
 */
async function fetchIpLocation(): Promise<LocationState | null> {
  const providers: Array<() => Promise<LocationState | null>> = [
    async () => {
      const r = await fetch('https://ipapi.co/json/');
      if (!r.ok) return null;
      const d = await r.json();
      if (!d?.latitude || !d?.longitude) return null;
      const city = d.city || d.region || '';
      const cc = (d.country_code || d.country || '').toUpperCase();
      return {
        lat: d.latitude,
        lng: d.longitude,
        name: city ? `${city}${cc ? ', ' + cc : ''}` : 'Approximate Location',
        fullAddress: [d.city, d.region, d.country_name].filter(Boolean).join(', '),
        countryCode: cc,
      };
    },
    async () => {
      const r = await fetch('https://get.geojs.io/v1/ip/geo.json');
      if (!r.ok) return null;
      const d = await r.json();
      if (!d?.latitude || !d?.longitude) return null;
      const cc = (d.country_code || '').toUpperCase();
      return {
        lat: parseFloat(d.latitude),
        lng: parseFloat(d.longitude),
        name: d.city ? `${d.city}, ${cc}` : 'Approximate Location',
        fullAddress: [d.city, d.region, d.country].filter(Boolean).join(', '),
        countryCode: cc,
      };
    },
  ];
  for (const p of providers) {
    try {
      const result = await p();
      if (result) return result;
    } catch { /* try next */ }
  }
  return null;
}

export function useLocation() {
  const [location, setLocation] = useState<LocationState>({ lat: 0, lng: 0, name: 'Detecting…' });
  const [detected, setDetected] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const useIpOrDefault = async () => {
      const ip = await fetchIpLocation();
      if (cancelled) return;
      setLocation(ip ?? DEFAULT_LOCATION);
      setDetected(true);
    };

    if (!navigator.geolocation) {
      useIpOrDefault();
      return () => { cancelled = true; };
    }

    const resolve = async (lat: number, lng: number) => {
      try {
        const result = await preciseReverseGeocode(lat, lng);
        if (!cancelled) {
          setLocation({ lat, lng, ...result });
          try { window.dispatchEvent(new CustomEvent('kip-location-detected', { detail: { name: result.name } })); } catch {}
        }
      } catch {
        const ip = await fetchIpLocation();
        if (!cancelled) setLocation(ip ?? { lat, lng, name: 'GPS Active' });
      }
      if (!cancelled) setDetected(true);
    };

    // Track last accepted fix; only re-resolve when the user has clearly moved
    // a meaningful distance AND enough time has passed. This avoids the address
    // flipping every few seconds while driving through small neighborhoods.
    let lastLat: number | null = null;
    let lastLng: number | null = null;
    let lastResolveAt = 0;
    const MIN_MOVE_METERS = 1500;       // ~1.5 km — ignore in-city drift while driving
    const MIN_INTERVAL_MS = 60_000;     // at most one update per minute
    const MAX_ACCURACY_M = 200;         // ignore very fuzzy fixes

    const maybeResolve = (lat: number, lng: number, accuracy: number) => {
      if (cancelled) return;
      if (accuracy && accuracy > MAX_ACCURACY_M && lastLat !== null) return;
      const now = Date.now();
      if (lastLat !== null && lastLng !== null) {
        const movedM = haversine(lastLat, lastLng, lat, lng) * 1000;
        if (movedM < MIN_MOVE_METERS) return;            // not far enough
        if (now - lastResolveAt < MIN_INTERVAL_MS) return; // too soon
      }
      lastLat = lat;
      lastLng = lng;
      lastResolveAt = now;
      resolve(lat, lng);
    };

    navigator.geolocation.getCurrentPosition(
      (pos) => maybeResolve(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy),
      async () => { await useIpOrDefault(); },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );

    // watchPosition only fires when the device reports a new fix; combined
    // with the movement threshold above, the address stays stable while the
    // user is stationary and updates promptly when they actually move.
    const watchId = navigator.geolocation.watchPosition(
      (pos) => maybeResolve(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy),
      () => { /* ignore */ },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 }
    );

    return () => {
      cancelled = true;
      navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  const updateLocation = useCallback((newLoc: LocationState) => {
    setLocation(newLoc);
  }, []);

  return { ...location, detected, updateLocation };
}

const WX_CODES: Record<number, [string, string]> = {
  0: ['☀️', 'Clear'], 1: ['🌤️', 'Mostly clear'], 2: ['⛅', 'Partly cloudy'], 3: ['☁️', 'Overcast'],
  45: ['🌫️', 'Foggy'], 48: ['🌫️', 'Icy fog'], 51: ['🌦️', 'Light drizzle'], 53: ['🌦️', 'Drizzle'],
  55: ['🌧️', 'Heavy drizzle'], 61: ['🌧️', 'Light rain'], 63: ['🌧️', 'Rain'], 65: ['🌧️', 'Heavy rain'],
  71: ['🌨️', 'Light snow'], 73: ['❄️', 'Snow'], 75: ['❄️', 'Heavy snow'], 80: ['🌦️', 'Showers'],
  95: ['⛈️', 'Thunderstorm'], 99: ['⛈️', 'Heavy storm'],
};

export interface ForecastDay {
  date: string;
  dayName: string;
  high: number;
  low: number;
  emoji: string;
  desc: string;
}

export function useWeather(lat: number, lng: number) {
  const [weather, setWeather] = useState({ emoji: '🌤️', temp: '--', desc: 'Loading…' });
  const [forecast, setForecast] = useState<ForecastDay[]>([]);
  useEffect(() => {
    if (!lat || !lng) return;
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min,weather_code&temperature_unit=fahrenheit&timezone=auto&forecast_days=7`)
      .then(r => r.json())
      .then(d => {
        const temp = Math.round(d.current?.temperature_2m ?? 0);
        const code = d.current?.weather_code ?? 0;
        const [emoji, desc] = WX_CODES[code] || ['🌤️', 'Clear'];
        setWeather({ emoji, temp: temp + '°', desc });
        if (d.daily) {
          const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
          const fc: ForecastDay[] = (d.daily.time || []).map((t: string, i: number) => {
            const dt = new Date(t + 'T12:00:00');
            const wc = d.daily.weather_code?.[i] ?? 0;
            const [em, ds] = WX_CODES[wc] || ['🌤️', 'Clear'];
            return { date: t, dayName: i === 0 ? 'Today' : days[dt.getDay()], high: Math.round(d.daily.temperature_2m_max[i]), low: Math.round(d.daily.temperature_2m_min[i]), emoji: em, desc: ds };
          });
          setForecast(fc);
        }
      }).catch(() => {});
  }, [lat, lng]);
  return { ...weather, forecast };
}

export function useCryptoPrices() {
  const [prices, setPrices] = useState<CryptoPrice[]>([]);
  const fetch_ = useCallback(() => {
    fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd&include_24hr_change=true')
      .then(r => r.json())
      .then(d => {
        setPrices([
          { symbol: 'BTC', name: 'Bitcoin', price: d.bitcoin?.usd || 0, change24h: d.bitcoin?.usd_24h_change || 0, icon: '₿' },
          { symbol: 'ETH', name: 'Ethereum', price: d.ethereum?.usd || 0, change24h: d.ethereum?.usd_24h_change || 0, icon: 'Ξ' },
          { symbol: 'SOL', name: 'Solana', price: d.solana?.usd || 0, change24h: d.solana?.usd_24h_change || 0, icon: '◎' },
        ]);
      }).catch(() => {});
  }, []);
  useEffect(() => { fetch_(); const i = setInterval(fetch_, 60000); return () => clearInterval(i); }, [fetch_]);
  return prices;
}

export function useMetalPrices() {
  const [metals, setMetals] = useState<MetalPrice[]>([]);
  useEffect(() => {
    fetch('https://api.metals.live/v1/spot')
      .then(r => r.json())
      .then(d => {
        const spot = Array.isArray(d) ? d[0] : d;
        const list: MetalPrice[] = [];
        if (spot?.gold) list.push({ symbol: 'XAU', label: 'Gold', price: '$' + Number(spot.gold).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' / oz' });
        if (spot?.silver) list.push({ symbol: 'XAG', label: 'Silver', price: '$' + Number(spot.silver).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' / oz' });
        if (spot?.platinum) list.push({ symbol: 'XPT', label: 'Platinum', price: '$' + Number(spot.platinum).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' / oz' });
        setMetals(list);
      }).catch(() => {
        setMetals([]);
      });
  }, []);
  return metals;
}

export function useBTCMerchants(lat: number, lng: number) {
  const [merchants, setMerchants] = useState<BTCMerchant[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    setLoading(true);
    const hasLoc = !!(lat && lng);
    const limit = hasLoc ? 500 : 100;
    fetch(`https://api.btcmap.org/v2/elements?limit=${limit}`)
      .then(r => r.json())
      .then(data => {
        let els = (data.elements || data || [])
          .filter((el: any) => el.osm_json?.lat && el.osm_json?.lon)
          .map((el: any) => ({
            lat: el.osm_json.lat,
            lng: el.osm_json.lon,
            name: el.osm_json.tags?.name || 'BTC Merchant',
            type: getPlaceTypeLabel(el.osm_json.tags),
            source: 'btcmap' as const,
            tags: el.osm_json.tags || {},
          }));
        if (hasLoc) {
          const nearby = els.filter((m: BTCMerchant) => haversine(lat, lng, m.lat, m.lng) <= 50);
          els = nearby.length >= 3 ? nearby : els.slice(0, 60);
        }
        els.sort((a: BTCMerchant, b: BTCMerchant) => haversine(lat, lng, a.lat, a.lng) - haversine(lat, lng, b.lat, b.lng));
        setMerchants(els.slice(0, 100));
      })
      .catch(() => {
        setMerchants([]);
      })
      .finally(() => setLoading(false));
  }, [lat, lng]);
  return { merchants, loading };
}

function getPlaceTypeLabel(tags: Record<string, string> | undefined): string {
  if (!tags) return 'BTC Merchant';
  const amenity = (tags.amenity || '').toLowerCase();
  const shop = (tags.shop || '').toLowerCase();
  if (amenity === 'restaurant' || tags.cuisine) return 'Restaurant';
  if (amenity === 'cafe') return 'Café';
  if (amenity === 'bar' || amenity === 'pub') return 'Bar';
  if (amenity === 'fast_food') return 'Fast Food';
  if (shop === 'supermarket' || shop === 'convenience') return 'Grocery';
  if (shop) return 'Shop';
  return 'BTC Merchant';
}

export function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371, toRad = (x: number) => x * Math.PI / 180;
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/* Live travel safety score from travel-advisory.info API */
export function useTravelSafety(countryCode?: string) {
  const [safetyData, setSafetyData] = useState<{ score: number; advisory: string; source: string; rawScore: number } | null>(null);

  useEffect(() => {
    if (!countryCode || countryCode.length !== 2) { setSafetyData(null); return; }
    const cc = countryCode.toUpperCase();
    let cancelled = false;
    // Clear stale data immediately so UI reflects the country change while we refetch
    setSafetyData(null);
    fetch('https://www.travel-advisory.info/api')
      .then(r => r.json())
      .then(d => {
        if (cancelled) return;
        const entry = d?.data?.[cc];
        if (entry) {
          const rawScore = parseFloat(entry.advisory?.score) || 2.5;
          const normalizedScore = Math.max(0, Math.min(10, ((5 - rawScore) / 5) * 10));
          setSafetyData({
            score: Math.round(normalizedScore * 10) / 10,
            rawScore,
            advisory: entry.advisory?.message || '',
            source: entry.advisory?.source || 'travel-advisory.info',
          });
        } else {
          // No entry for this country — keep null instead of stale prior value
          setSafetyData(null);
        }
      })
      .catch(() => { if (!cancelled) setSafetyData(null); });
    return () => { cancelled = true; };
  }, [countryCode]);

  return safetyData;
}

export function useCurrencyConverter() {
  const [rates, setRates] = useState<Record<string, number>>({});
  useEffect(() => {
    fetch('https://open.er-api.com/v6/latest/USD')
      .then(r => r.json())
      .then(d => setRates(d.rates || {}))
      .catch(() => {
        setRates({});
      });
  }, []);
  const convert = useCallback((amount: number, from: string, to: string, btcPrice?: number) => {
    const toUSD = (amt: number, cur: string) => {
      if (cur === 'BTC') return amt * (btcPrice || 95000);
      return rates[cur] ? amt / rates[cur] : amt;
    };
    const fromUSD = (usd: number, cur: string) => {
      if (cur === 'BTC') return usd / (btcPrice || 95000);
      return rates[cur] ? usd * rates[cur] : usd;
    };
    return fromUSD(toUSD(amount, from), to);
  }, [rates]);
  return { rates, convert, currencies: Object.keys(rates) };
}

// ── Recreation / Outdoor ──────────────────────────────────────────────────────

function osmTagsToRecCategory(tags: Record<string, string>): RecreationCategory {
  const leisure = (tags.leisure || '').toLowerCase();
  const sport   = (tags.sport   || '').toLowerCase();
  const tourism = (tags.tourism || '').toLowerCase();
  const natural = (tags.natural || '').toLowerCase();
  if (tourism === 'camp_site' || leisure === 'campsite') return 'camping';
  if (['skiing', 'snowboard', 'ice_skating', 'biathlon', 'sledding'].some(s => sport.includes(s))) return 'winter';
  if (['swimming', 'kayaking', 'surfing', 'kitesurfing', 'sailing', 'diving', 'fishing', 'canoeing', 'rowing'].some(s => sport.includes(s))) return 'water';
  if (['cycling', 'mountain_biking', 'bmx'].some(s => sport.includes(s))) return 'cycling';
  if (['climbing', 'bouldering', 'via_ferrata', 'zipline', 'paragliding', 'hang_gliding'].some(s => sport.includes(s))) return 'adventure';
  if (['bird_watching', 'wildlife_hide'].some(s => leisure.includes(s)) || natural === 'wetland') return 'wildlife';
  if (['fitness', 'gymnastics', 'yoga', 'crossfit'].some(s => sport.includes(s)) || leisure === 'fitness_centre') return 'fitness';
  return 'hiking';
}

function osmExtractAmenities(tags: Record<string, string>): string[] {
  const out: string[] = [];
  if (tags.toilets === 'yes' || tags['amenity:toilets'] === 'yes') out.push('Restrooms');
  if (tags.drinking_water === 'yes') out.push('Drinking Water');
  if (tags.shower === 'yes') out.push('Showers');
  if (tags.picnic_table === 'yes' || tags['leisure'] === 'picnic_table') out.push('Picnic Tables');
  if (tags.fire_pit === 'yes') out.push('Fire Pit');
  if (tags.electricity === 'yes') out.push('Electricity');
  if (tags.dog === 'yes' || tags['dog'] === 'yes') out.push('Dog Friendly');
  if (tags.parking === 'yes' || tags['amenity'] === 'parking') out.push('Parking');
  return out;
}

function osmExtractActivities(tags: Record<string, string>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const addAct = (s: string) => {
    const key = s.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' '));
  };
  (tags.sport || '').split(';').map(s => s.trim()).filter(Boolean).forEach(addAct);
  if (tags.hiking === 'yes') addAct('hiking');
  if (tags.cycling === 'yes') addAct('cycling');
  if (tags.swimming === 'yes') addAct('swimming');
  if (tags.fishing === 'yes') addAct('fishing');
  return out.slice(0, 5);
}

/** Fetch recreation spots near a location via OpenStreetMap Overpass API (free, global, no key). */
export function useOSMRecreation(lat: number, lng: number) {
  const [spots, setSpots] = useState<RecreationSpot[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!lat || !lng) return;
    let cancelled = false;
    setLoading(true);

    const R = 20000; // 20 km radius
    const q = `
[out:json][timeout:30];
(
  node["tourism"="camp_site"]["name"](around:${R},${lat},${lng});
  node["leisure"="park"]["name"](around:${R},${lat},${lng});
  node["leisure"="nature_reserve"]["name"](around:${R},${lat},${lng});
  node["leisure"="sports_centre"]["name"](around:${R},${lat},${lng});
  node["sport"~"swimming|kayaking|surfing|climbing|skiing|cycling|fishing|sailing"]["name"](around:${R},${lat},${lng});
  node["leisure"="fitness_station"]["name"](around:${R},${lat},${lng});
  node["leisure"="bird_watching"]["name"](around:${R},${lat},${lng});
  way["tourism"="camp_site"]["name"](around:${R},${lat},${lng});
  way["leisure"="park"]["name"](around:${R},${lat},${lng});
  way["leisure"="nature_reserve"]["name"](around:${R},${lat},${lng});
  way["natural"="beach"]["name"](around:${R},${lat},${lng});
  way["natural"="water"]["sport"~"kayaking|rowing|sailing"]["name"](around:${R},${lat},${lng});
  relation["boundary"="national_park"]["name"](around:${R},${lat},${lng});
  relation["boundary"="protected_area"]["name"](around:${R},${lat},${lng});
  relation["leisure"="park"]["name"](around:${R},${lat},${lng});
);
out center tags qt;
`.trim();

    fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: 'data=' + encodeURIComponent(q),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        const elements: any[] = data.elements || [];
        const seen = new Set<string>();
        const results: RecreationSpot[] = [];

        for (const el of elements) {
          const elLat = el.lat ?? el.center?.lat;
          const elLng = el.lon ?? el.center?.lon;
          if (!elLat || !elLng) continue;
          const tags: Record<string, string> = el.tags || {};
          const name = tags.name;
          if (!name) continue;
          const key = name.toLowerCase().replace(/\s+/g, '');
          if (seen.has(key)) continue;
          seen.add(key);

          results.push({
            id: `osm-${el.id}`,
            name,
            category: osmTagsToRecCategory(tags),
            source: 'osm',
            lat: elLat,
            lng: elLng,
            distKm: haversine(lat, lng, elLat, elLng),
            description: tags['description:en'] || tags.description || undefined,
            amenities: osmExtractAmenities(tags),
            activities: osmExtractActivities(tags),
            cost: tags.fee === 'yes' ? 'Fee required' : tags.fee === 'no' ? 'Free' : undefined,
            reservable: false,
            website: tags.website || tags.url || undefined,
          });
        }

        results.sort((a, b) => (a.distKm ?? 0) - (b.distKm ?? 0));
        setSpots(results.slice(0, 60));
      })
      .catch(() => { if (!cancelled) setSpots([]); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [lat, lng]);

  return { spots, loading };
}

/** Fetch US National Park Service parks near a location (uses NPS DEMO_KEY — 50 req/hr). */
export function useNPSParks(lat: number, lng: number, countryCode?: string) {
  const [parks, setParks] = useState<RecreationSpot[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!lat || !lng || countryCode !== 'US') return;
    let cancelled = false;
    setLoading(true);

    const key = (import.meta as any).env?.VITE_NPS_API_KEY || 'DEMO_KEY';
    fetch(`https://developer.nps.gov/api/v1/parks?limit=10&api_key=${key}&sort=`)
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        const results: RecreationSpot[] = (data.data || [])
          .filter((p: any) => p.latitude && p.longitude)
          .map((p: any) => ({
            id: `nps-${p.parkCode}`,
            name: p.fullName,
            category: 'hiking' as RecreationCategory,
            source: 'nps' as const,
            lat: parseFloat(p.latitude),
            lng: parseFloat(p.longitude),
            distKm: haversine(lat, lng, parseFloat(p.latitude), parseFloat(p.longitude)),
            description: p.description?.slice(0, 200) || undefined,
            activities: (p.activities || []).slice(0, 5).map((a: any) => a.name),
            cost: p.entranceFees?.[0]?.cost ? `$${p.entranceFees[0].cost} entrance` : 'Free',
            reservationUrl: p.url,
            website: p.url,
            imageUrl: p.images?.[0]?.url,
            reservable: false,
          }));
        results.sort((a, b) => (a.distKm ?? 0) - (b.distKm ?? 0));
        setParks(results.slice(0, 10));
      })
      .catch(() => { if (!cancelled) setParks([]); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [lat, lng, countryCode]);

  return { parks, loading };
}

/** Fetch Recreation.gov RIDB campgrounds/facilities near a location.
 *  Requires VITE_RECREATION_GOV_API_KEY env var (free key from https://ridb.recreation.gov/landing). */
export function useRecreationGov(lat: number, lng: number, countryCode?: string) {
  const [facilities, setFacilities] = useState<RecreationSpot[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const apiKey = (import.meta as any).env?.VITE_RECREATION_GOV_API_KEY;
    if (!lat || !lng || countryCode !== 'US' || !apiKey) return;
    let cancelled = false;
    setLoading(true);

    fetch(`https://ridb.recreation.gov/api/v1/facilities?latitude=${lat}&longitude=${lng}&radius=50&limit=10&apikey=${apiKey}`)
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        const results: RecreationSpot[] = (data.RECDATA || []).map((f: any) => ({
          id: `recgov-${f.FacilityID}`,
          name: f.FacilityName,
          category: (f.FacilityTypeDescription?.toLowerCase().includes('camp') ? 'camping' : 'hiking') as RecreationCategory,
          source: 'recreation.gov' as const,
          lat: parseFloat(f.FacilityLatitude),
          lng: parseFloat(f.FacilityLongitude),
          distKm: haversine(lat, lng, parseFloat(f.FacilityLatitude), parseFloat(f.FacilityLongitude)),
          description: f.FacilityDescription?.replace(/<[^>]*>/g, '')?.slice(0, 200) || undefined,
          activities: (f.Activities || []).slice(0, 5).map((a: any) => a.ActivityName),
          reservable: f.Reservable === true,
          reservationUrl: f.FacilityReservationURL || `https://www.recreation.gov/camping/campgrounds/${f.FacilityID}`,
          website: f.FacilityReservationURL || undefined,
          phone: f.FacilityPhone || undefined,
        }));
        results.sort((a, b) => (a.distKm ?? 0) - (b.distKm ?? 0));
        setFacilities(results);
      })
      .catch(() => { if (!cancelled) setFacilities([]); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [lat, lng, countryCode]);

  return { facilities, loading };
}

export function generateCashAppMerchants(lat: number, lng: number) {
  const baseLat = lat || 40.7128, baseLng = lng || -74.006;
  const names = ['Cash App Merchant', 'Local Shop', 'Street Market', 'Digital Café', 'Tech Store', 'Food Court', 'Book Store', 'BTC Bistro', 'Crypto Corner', 'Pay Market'];
  return Array.from({ length: 12 }, (_, i) => ({
    lat: baseLat + (Math.random() - .5) * .06,
    lng: baseLng + (Math.random() - .5) * .06,
    name: names[i % names.length] + ' ' + (i + 1),
  }));
}
