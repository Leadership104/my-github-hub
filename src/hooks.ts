import { useState, useEffect, useCallback } from 'react';
import type { CryptoPrice, BTCMerchant, MetalPrice } from './types';

export function useLocation() {
  const [location, setLocation] = useState({ lat: 0, lng: 0, name: 'Detecting…' });
  useEffect(() => {
    if (!navigator.geolocation) { setLocation({ lat: 13.7563, lng: 100.5018, name: 'Bangkok' }); return; }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        try {
          const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`);
          const d = await r.json();
          const city = d.address?.city || d.address?.town || d.address?.village || d.address?.county || '';
          const country = d.address?.country_code?.toUpperCase() || '';
          const name = city ? `${city}${country ? ', ' + country : ''}` : 'Current Location';
          setLocation({ lat, lng, name });
        } catch { setLocation({ lat, lng, name: 'GPS Active' }); }
      },
      async () => {
        // IP-based fallback
        try {
          const r = await fetch('https://ip-api.com/json');
          const d = await r.json();
          if (d.status === 'success') {
            setLocation({ lat: d.lat, lng: d.lon, name: `${d.city}, ${d.countryCode}` });
          } else {
            setLocation({ lat: 13.7563, lng: 100.5018, name: 'Bangkok (default)' });
          }
        } catch {
          setLocation({ lat: 13.7563, lng: 100.5018, name: 'Bangkok (default)' });
        }
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, []);
  return location;
}

const WX_CODES: Record<number, [string, string]> = {
  0: ['☀️', 'Clear'], 1: ['🌤️', 'Mostly clear'], 2: ['⛅', 'Partly cloudy'], 3: ['☁️', 'Overcast'],
  45: ['🌫️', 'Foggy'], 48: ['🌫️', 'Icy fog'], 51: ['🌦️', 'Light drizzle'], 53: ['🌦️', 'Drizzle'],
  55: ['🌧️', 'Heavy drizzle'], 61: ['🌧️', 'Light rain'], 63: ['🌧️', 'Rain'], 65: ['🌧️', 'Heavy rain'],
  71: ['🌨️', 'Light snow'], 73: ['❄️', 'Snow'], 75: ['❄️', 'Heavy snow'], 80: ['🌦️', 'Showers'],
  95: ['⛈️', 'Thunderstorm'], 99: ['⛈️', 'Heavy storm'],
};

export function useWeather(lat: number, lng: number) {
  const [weather, setWeather] = useState({ emoji: '🌤️', temp: '--', desc: 'Loading…' });
  useEffect(() => {
    if (!lat || !lng) return;
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code&temperature_unit=fahrenheit`)
      .then(r => r.json())
      .then(d => {
        const temp = Math.round(d.current?.temperature_2m ?? 0);
        const code = d.current?.weather_code ?? 0;
        const [emoji, desc] = WX_CODES[code] || ['🌤️', 'Clear'];
        setWeather({ emoji, temp: temp + '°', desc });
      }).catch(() => {});
  }, [lat, lng]);
  return weather;
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
        setMetals([
          { symbol: 'XAU', label: 'Gold', price: '~$3,100 / oz' },
          { symbol: 'XAG', label: 'Silver', price: '~$34 / oz' },
          { symbol: 'XPT', label: 'Platinum', price: '~$990 / oz' },
        ]);
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
        // Fallback demo markers
        const baseLat = lat || 13.7563;
        const baseLng = lng || 100.5018;
        const demoNames = ['Lightning Café', 'Satoshi Market', 'BTC Corner Shop', 'Crypto Bistro', 'Bitcoin Hub', 'Digital Pay'];
        setMerchants(demoNames.map(name => ({
          lat: baseLat + (Math.random() - .5) * 0.05,
          lng: baseLng + (Math.random() - .5) * 0.05,
          name,
          type: 'BTC Merchant',
          source: 'btcmap' as const,
        })));
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

export function useCurrencyConverter() {
  const [rates, setRates] = useState<Record<string, number>>({});
  useEffect(() => {
    fetch('https://open.er-api.com/v6/latest/USD')
      .then(r => r.json())
      .then(d => setRates(d.rates || {}))
      .catch(() => {
        // Fallback approximate rates
        setRates({ USD: 1, EUR: 0.92, GBP: 0.78, JPY: 149.5, CNY: 7.25, CHF: 0.89, THB: 34.5, IDR: 16300, BRL: 5.85, AED: 3.67, SGD: 1.35 });
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
  const baseLat = lat || 13.7563, baseLng = lng || 100.5018;
  const names = ['Cash App Merchant', 'Local Shop', 'Street Market', 'Digital Café', 'Tech Store', 'Food Court', 'Book Store', 'BTC Bistro', 'Crypto Corner', 'Pay Market'];
  return Array.from({ length: 12 }, (_, i) => ({
    lat: baseLat + (Math.random() - .5) * .06,
    lng: baseLng + (Math.random() - .5) * .06,
    name: names[i % names.length] + ' ' + (i + 1),
  }));
}
