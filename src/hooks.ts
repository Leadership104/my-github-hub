import { useState, useEffect, useCallback } from 'react';
import type { CryptoPrice, BTCMerchant } from './types';

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
          const city = d.address?.city || d.address?.town || d.address?.village || 'Unknown';
          setLocation({ lat, lng, name: city });
        } catch { setLocation({ lat, lng, name: 'Located' }); }
      },
      () => setLocation({ lat: 13.7563, lng: 100.5018, name: 'Bangkok (default)' }),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, []);
  return location;
}

export function useWeather(lat: number, lng: number) {
  const [weather, setWeather] = useState({ emoji: '🌤️', temp: '--', desc: 'Loading…' });
  useEffect(() => {
    if (!lat || !lng) return;
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true`)
      .then(r => r.json())
      .then(d => {
        const cw = d.current_weather;
        if (!cw) return;
        const code = cw.weathercode;
        const emoji = code <= 1 ? '☀️' : code <= 3 ? '⛅' : code <= 48 ? '🌫️' : code <= 67 ? '🌧️' : code <= 77 ? '❄️' : '⛈️';
        const descs: Record<number, string> = { 0: 'Clear', 1: 'Mostly Clear', 2: 'Partly Cloudy', 3: 'Overcast', 45: 'Foggy', 51: 'Light Drizzle', 61: 'Rain', 71: 'Snow', 80: 'Showers', 95: 'Thunderstorm' };
        const desc = descs[code] || 'Mixed';
        setWeather({ emoji, temp: Math.round(cw.temperature) + '°', desc });
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

export function useBTCMerchants(lat: number, lng: number) {
  const [merchants, setMerchants] = useState<BTCMerchant[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    setLoading(true);
    fetch('https://api.btcmap.org/v2/elements?limit=200')
      .then(r => r.json())
      .then(data => {
        const els = (data.elements || data || [])
          .filter((el: any) => el.osm_json?.lat && el.osm_json?.lon)
          .map((el: any) => ({
            lat: el.osm_json.lat,
            lng: el.osm_json.lon,
            name: el.osm_json.tags?.name || 'BTC Merchant',
            type: el.osm_json.tags?.amenity || el.osm_json.tags?.shop || 'merchant',
            source: 'btcmap' as const,
          }));
        // Sort by distance if we have location
        if (lat && lng) {
          els.sort((a: BTCMerchant, b: BTCMerchant) => haversine(lat, lng, a.lat, a.lng) - haversine(lat, lng, b.lat, b.lng));
        }
        setMerchants(els.slice(0, 100));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [lat, lng]);
  return { merchants, loading };
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
    fetch('https://api.exchangerate-api.com/v4/latest/USD')
      .then(r => r.json())
      .then(d => setRates(d.rates || {}))
      .catch(() => {});
  }, []);
  const convert = useCallback((amount: number, from: string, to: string) => {
    if (!rates[from] || !rates[to]) return 0;
    return (amount / rates[from]) * rates[to];
  }, [rates]);
  return { rates, convert, currencies: Object.keys(rates) };
}
