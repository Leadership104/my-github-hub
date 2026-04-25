import { useState, useEffect, useCallback, useRef } from 'react';
import type { CryptoPrice, BTCMerchant, MetalPrice } from './types';

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

export function useLocation() {
  const [location, setLocation] = useState<LocationState>({ lat: 0, lng: 0, name: 'Detecting…' });
  const [detected, setDetected] = useState(false);

  useEffect(() => {
    if (!navigator.geolocation) { setLocation(DEFAULT_LOCATION); setDetected(true); return; }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        try {
          const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`);
          const d = await r.json();
          const city = d.address?.city || d.address?.town || d.address?.village || d.address?.county || '';
          const country = d.address?.country_code?.toUpperCase() || '';
          const name = city ? `${city}${country ? ', ' + country : ''}` : 'Current Location';
          const fullAddress = d.display_name || name;
          setLocation({ lat, lng, name, fullAddress, countryCode: country });
        } catch { setLocation({ lat, lng, name: 'GPS Active' }); }
        setDetected(true);
      },
      async () => {
        try {
          const r = await fetch('https://ip-api.com/json');
          const d = await r.json();
          if (d.status === 'success') {
            setLocation({ lat: d.lat, lng: d.lon, name: `${d.city}, ${d.countryCode}` });
          } else {
            setLocation(DEFAULT_LOCATION);
          }
        } catch {
          setLocation(DEFAULT_LOCATION);
        }
        setDetected(true);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
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
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min,weather_code&temperature_unit=fahrenheit&timezone=auto&forecast_days=5`)
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

export function generateCashAppMerchants(lat: number, lng: number) {
  const baseLat = lat || 40.7128, baseLng = lng || -74.006;
  const names = ['Cash App Merchant', 'Local Shop', 'Street Market', 'Digital Café', 'Tech Store', 'Food Court', 'Book Store', 'BTC Bistro', 'Crypto Corner', 'Pay Market'];
  return Array.from({ length: 12 }, (_, i) => ({
    lat: baseLat + (Math.random() - .5) * .06,
    lng: baseLng + (Math.random() - .5) * .06,
    name: names[i % names.length] + ' ' + (i + 1),
  }));
}
