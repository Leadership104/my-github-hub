import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import L from 'leaflet';
import { getCategories, CATEGORY_SUBS } from '../data';
import { haversine } from '../hooks';
import { supabase } from '@/integrations/supabase/client';
import type { BTCMerchant, Trip } from '../types';

interface NearbyPlace {
  lat: number;
  lng: number;
  name: string;
  type: string;
  icon: string;
  address?: string;
  distance?: number;
  source?: string;
  phone?: string;
  website?: string;
  openingHours?: string;
  rating?: number | null;
  reviewCount?: number;
  priceLevel?: string | null;
  photoUrl?: string | null;
  photos?: string[];
  openNow?: boolean | null;
  mapsUrl?: string | null;
  reviews?: { author: string; rating: number; text: string; time: string; photoUrl?: string | null }[];
  placeId?: string;
  summary?: string | null;
  typeLabel?: string;
}

interface Props {
  lat: number;
  lng: number;
  merchants: BTCMerchant[];
  loading: boolean;
  initialFilter?: string;
}

/* ── Overpass tag configs for every category ── */
const OVERPASS_CFGS: Record<string, { tag: string; ico: string; bg: string; label: string }[]> = {
  food: [
    { tag: '"amenity"~"restaurant|fast_food|food_court"', ico: '🍜', bg: '#E53E3E', label: 'Restaurant' },
    { tag: '"amenity"="cafe"',                             ico: '☕', bg: '#D69E2E', label: 'Café' },
    { tag: '"shop"~"bakery|pastry"',                       ico: '🥐', bg: '#ED8936', label: 'Bakery' },
  ],
  cafe: [
    { tag: '"amenity"~"cafe|coffee_shop"',     ico: '☕', bg: '#D69E2E', label: 'Café' },
    { tag: '"cuisine"~"coffee|tea"',           ico: '🍵', bg: '#805AD5', label: 'Tea House' },
  ],
  shop: [
    { tag: '"shop"~"supermarket|convenience|mall|department_store|general"', ico: '🛍', bg: '#805AD5', label: 'Shop' },
    { tag: '"shop"~"clothes|fashion"',                                      ico: '👗', bg: '#D53F8C', label: 'Fashion' },
    { tag: '"shop"~"electronics|mobile_phone"',                             ico: '📱', bg: '#3182CE', label: 'Electronics' },
  ],
  hotel: [
    { tag: '"tourism"~"hotel|hostel|guest_house|motel|apartment"', ico: '🏨', bg: '#3182CE', label: 'Hotel' },
  ],
  transport: [
    { tag: '"public_transport"~"station|stop_position|platform"', ico: '🚇', bg: '#2D3748', label: 'Transit' },
    { tag: '"amenity"~"bus_station|taxi|car_rental"',             ico: '🚕', bg: '#4A5568', label: 'Transport' },
    { tag: '"railway"="station"',                                  ico: '🚆', bg: '#2B6CB0', label: 'Train' },
    { tag: '"aeroway"="aerodrome"',                                ico: '✈️', bg: '#1A365D', label: 'Airport' },
  ],
  gym: [
    { tag: '"leisure"~"fitness_centre|sports_centre|swimming_pool"', ico: '💪', bg: '#DD6B20', label: 'Fitness' },
    { tag: '"sport"~"yoga|martial_arts|climbing"',                   ico: '🧘', bg: '#38A169', label: 'Studio' },
  ],
  beach: [
    { tag: '"natural"="beach"',            ico: '🏖️', bg: '#38B2AC', label: 'Beach' },
    { tag: '"leisure"~"park|garden"',      ico: '🌳', bg: '#48BB78', label: 'Park' },
    { tag: '"tourism"~"viewpoint|attraction"', ico: '📷', bg: '#ED64A6', label: 'Attraction' },
  ],
  nightlife: [
    { tag: '"amenity"~"bar|nightclub|pub|biergarten"', ico: '🎵', bg: '#9B2C2C', label: 'Nightlife' },
    { tag: '"leisure"~"adult_gaming_centre|dance"',     ico: '🎶', bg: '#744210', label: 'Club' },
  ],
  atm: [
    { tag: '"amenity"="atm"',             ico: '🏧', bg: '#38A169', label: 'ATM' },
    { tag: '"amenity"~"bank|bureau_de_change"', ico: '🏦', bg: '#2C7A7B', label: 'Bank' },
  ],
  hospital: [
    { tag: '"amenity"~"hospital|clinic|doctors"', ico: '🏥', bg: '#E53E3E', label: 'Medical' },
    { tag: '"amenity"="dentist"',                  ico: '🦷', bg: '#C53030', label: 'Dentist' },
  ],
  pharmacy: [
    { tag: '"amenity"="pharmacy"',         ico: '💊', bg: '#38A169', label: 'Pharmacy' },
    { tag: '"shop"~"optician|herbalist"',  ico: '👓', bg: '#2F855A', label: 'Optician' },
  ],
};

const SEARCH_RADIUS = 3500;
const MAX_RESULTS_PER_QUERY = 30;

function isValidUrl(url?: string): boolean {
  if (!url) return false;
  try { const u = new URL(url.startsWith('http') ? url : `https://${url}`); return !!u.hostname && u.hostname.includes('.'); } catch { return false; }
}
function isValidPhone(phone?: string): boolean {
  if (!phone) return false;
  return /[\d\+\-\(\)]{5,}/.test(phone);
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  return haversine(lat1, lng1, lat2, lng2);
}

function extractPlaceDetails(tags: Record<string, string>) {
  return {
    address: tags['addr:street']
      ? `${tags['addr:housenumber'] || ''} ${tags['addr:street']}`.trim()
      : tags['addr:full'] || '',
    phone: tags.phone || tags['contact:phone'] || '',
    website: tags.website || tags['contact:website'] || '',
    openingHours: tags.opening_hours || '',
  };
}

/* ── Google Places proxy helper ── */
async function fetchGooglePlaces(action: string, params: Record<string, unknown>): Promise<NearbyPlace[]> {
  try {
    const { data, error } = await supabase.functions.invoke('places-proxy', {
      body: { action, ...params },
    });
    if (error) throw error;
    const places = Array.isArray(data) ? data : [data];
    return places.map((p: any) => ({
      lat: p.lat,
      lng: p.lng,
      name: p.name || 'Unknown',
      type: p.typeLabel || p.types?.[0]?.replace(/_/g, ' ') || 'Place',
      icon: '📍',
      address: p.address || '',
      source: 'Google Places',
      phone: p.phone || '',
      website: p.website || '',
      openingHours: p.hours?.join(', ') || '',
      rating: p.rating,
      reviewCount: p.reviewCount || 0,
      priceLevel: p.priceLevel,
      photoUrl: p.photoUrl,
      photos: p.photos || [],
      openNow: p.openNow,
      mapsUrl: p.mapsUrl,
      reviews: p.reviews || [],
      placeId: p.placeId,
      summary: p.summary,
    }));
  } catch (e) {
    console.warn('Google Places proxy error:', e);
    return [];
  }
}

export default function MapsScreen({ lat, lng, merchants, loading, initialFilter }: Props) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const categories = getCategories();

  const [filter, setFilter] = useState(initialFilter || 'food');
  const [showSafety, setShowSafety] = useState(false);
  const [safetyData, setSafetyData] = useState<{ aqi: number; aqiLabel: string; healthTips: string[]; securityTips: string[]; emergencyNumbers: { label: string; number: string }[]; pollutionLevel: string } | null>(null);
  const [safetyLoading, setSafetyLoading] = useState(false);
  const [subFilter, setSubFilter] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [nearbyPlaces, setNearbyPlaces] = useState<NearbyPlace[]>([]);
  const [placesLoading, setPlacesLoading] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<NearbyPlace | null>(null);
  const [suggestions, setSuggestions] = useState<{ name: string; address: string; lat: number; lng: number }[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showTripPicker, setShowTripPicker] = useState(false);
  const [tripAddSuccess, setTripAddSuccess] = useState<string | null>(null);

  // Load trips from localStorage
  const getTrips = useCallback((): Trip[] => {
    try { const s = localStorage.getItem('kip_trips'); return s ? JSON.parse(s) : []; } catch { return []; }
  }, []);

  const addPlaceToTrip = useCallback((tripId: string, place: NearbyPlace) => {
    const trips = getTrips();
    const trip = trips.find(t => t.id === tripId);
    if (!trip) return;
    const newItem = {
      id: `place-${Date.now()}`,
      day: 1,
      time: '12:00',
      title: `${place.icon || '📍'} ${place.name}${place.address ? ' – ' + place.address : ''}`,
      done: false,
    };
    trip.items = [...(trip.items || []), newItem];
    localStorage.setItem('kip_trips', JSON.stringify(trips));
    setTripAddSuccess(trip.dest);
    setShowTripPicker(false);
    setTimeout(() => setTripAddSuccess(null), 2500);
  }, [getTrips]);

  const btcAtmIds = new Set(['atm', 'btcatm']);
  const allFilters = [
    ...categories.filter(c => !btcAtmIds.has(c.id)).map(c => ({ id: c.id, label: `${c.emoji} ${c.label}`, emoji: c.emoji })),
    { id: 'safety', label: '🛡️ Safety', emoji: '🛡️' },
    { id: 'btc', label: '₿ BTC', emoji: '₿' },
    ...categories.filter(c => btcAtmIds.has(c.id)).map(c => ({ id: c.id, label: `${c.emoji} ${c.label}`, emoji: c.emoji })),
  ];

  // Init map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const center: [number, number] = [lat || 40.7128, lng || -74.006];
    const map = L.map(containerRef.current).setView(center, 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
    }).addTo(map);
    if (lat && lng) {
      L.marker(center, {
        icon: L.divIcon({ html: '📍', className: '', iconSize: [30, 30], iconAnchor: [15, 30] }),
      }).addTo(map).bindPopup('You are here');
    }
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  const locationChangeHandledRef = useRef(false);

  const clearMarkers = useCallback(() => {
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];
  }, []);

  const addLabeledMarker = useCallback((mlat: number, mlng: number, icon: string, bg: string, name: string, popup: string) => {
    const map = mapRef.current;
    if (!map) return;
    const shortName = name.length > 16 ? name.slice(0, 15) + '…' : name;
    const html = `<div style="display:flex;flex-direction:column;align-items:center;gap:2px">
      <div style="background:${bg};color:#fff;font-weight:800;font-size:14px;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.3)">${icon}</div>
      <div style="background:#fff;padding:1px 6px;border-radius:8px;font-size:9px;font-weight:700;box-shadow:0 1px 4px rgba(0,0,0,.15);white-space:nowrap;max-width:90px;overflow:hidden;text-overflow:ellipsis">${shortName}</div>
    </div>`;
    const marker = L.marker([mlat, mlng], {
      icon: L.divIcon({ html, className: '', iconSize: [90, 54], iconAnchor: [45, 17] }),
    }).addTo(map).bindPopup(popup, { maxWidth: 280 });
    markersRef.current.push(marker);
  }, []);

  const buildRichPopup = (p: NearbyPlace, cfg: { ico: string; bg: string; label: string }) => {
    let popup = `<div style="font-weight:700;font-size:14px">${p.name}</div>`;
    popup += `<div style="font-size:12px;color:#666;margin:2px 0">${p.type}${p.address ? ' · ' + p.address : ''}</div>`;
    if (p.rating) {
      popup += `<div style="font-size:12px;color:#F59E0B;font-weight:600">⭐ ${p.rating}${p.reviewCount ? ` (${p.reviewCount} reviews)` : ''}</div>`;
    }
    if (p.openNow !== null && p.openNow !== undefined) {
      popup += `<div style="font-size:11px;color:${p.openNow ? '#16A34A' : '#DC2626'};font-weight:600">${p.openNow ? '✅ Open now' : '❌ Closed'}</div>`;
    }
    if (p.priceLevel) popup += `<div style="font-size:11px;color:#888">💰 ${p.priceLevel}</div>`;
    if (p.openingHours) popup += `<div style="font-size:11px;color:#888">🕐 ${p.openingHours.slice(0, 60)}${p.openingHours.length > 60 ? '…' : ''}</div>`;
    if (p.phone) popup += `<div style="font-size:11px"><a href="tel:${p.phone}" style="color:#3182CE">📞 ${p.phone}</a></div>`;
    if (p.website) popup += `<div style="font-size:11px"><a href="${p.website}" target="_blank" style="color:#3182CE">🌐 Website</a></div>`;
    if (p.photoUrl) popup += `<img src="${p.photoUrl}" style="width:100%;max-height:100px;object-fit:cover;border-radius:8px;margin:4px 0" />`;
    if (p.reviews && p.reviews.length > 0) {
      const r = p.reviews[0];
      popup += `<div style="font-size:10px;color:#666;margin-top:4px;border-top:1px solid #eee;padding-top:4px">"${r.text.slice(0, 80)}${r.text.length > 80 ? '…' : ''}" — <b>${r.author}</b></div>`;
    }
    popup += `<div style="font-size:10px;color:#999;margin-top:2px">via ${p.source || 'OpenStreetMap'}</div>`;
    const dirUrl = p.mapsUrl || `https://www.google.com/maps/search/${encodeURIComponent(p.name + ' ' + (p.address || ''))}/@${p.lat},${p.lng},17z`;
    popup += `<a href="${dirUrl}" target="_blank" style="font-size:12px;color:#E53935;font-weight:600">📍 Directions</a>`;
    return popup;
  };

  // Fetch places: Overpass + Google Places proxy in parallel
  const fetchOverpassPlaces = useCallback(async (filterId: string) => {
    const cfgs = OVERPASS_CFGS[filterId];
    if (!cfgs || !lat) return;
    setPlacesLoading(true);
    setNearbyPlaces([]);
    clearMarkers();

    try {
      // Fire Overpass + Google Places proxy in parallel
      const overpassPromise = (async () => {
        const promises = cfgs.map(async (cfg) => {
          const q = `[out:json][timeout:20];node[${cfg.tag}](around:${SEARCH_RADIUS},${lat},${lng});out ${MAX_RESULTS_PER_QUERY};`;
          const r = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(q)}`);
          const d = await r.json();
          return { cfg, elements: (d.elements || []).filter((e: any) => e.tags?.name) };
        });
        return Promise.allSettled(promises);
      })();

      const googlePromise = fetchGooglePlaces('nearby', {
        lat, lng, category: filterId, radius: SEARCH_RADIUS,
      });

      const [overpassResults, googlePlaces] = await Promise.all([overpassPromise, googlePromise]);

      const allPlaces: NearbyPlace[] = [];
      const seen = new Set<string>();

      // Process Overpass results
      for (const result of overpassResults) {
        if (result.status !== 'fulfilled') continue;
        const { cfg, elements } = result.value;
        for (const e of elements) {
          const key = `${e.lat.toFixed(5)},${e.lon.toFixed(5)}`;
          if (seen.has(key)) continue;
          seen.add(key);
          const details = extractPlaceDetails(e.tags || {});
          const place: NearbyPlace = {
            lat: e.lat, lng: e.lon, name: e.tags.name,
            type: cfg.label, icon: cfg.ico, source: 'OpenStreetMap',
            distance: haversineKm(lat, lng, e.lat, e.lon),
            ...details,
          };
          allPlaces.push(place);
          addLabeledMarker(place.lat, place.lng, cfg.ico, cfg.bg, place.name, buildRichPopup(place, cfg));
        }
      }

      // Process Google Places results (enriched with ratings, photos, reviews)
      for (const gp of googlePlaces) {
        if (!gp.lat || !gp.lng) continue;
        const key = `${gp.lat.toFixed(5)},${gp.lng.toFixed(5)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        gp.distance = haversineKm(lat, lng, gp.lat, gp.lng);
        gp.icon = cfgs[0].ico;
        allPlaces.push(gp);
        addLabeledMarker(gp.lat, gp.lng, '⭐', cfgs[0].bg, gp.name, buildRichPopup(gp, cfgs[0]));
      }

      // Nominatim supplementary
      try {
        const primaryLabel = cfgs[0].label.toLowerCase();
        const nomQ = `${primaryLabel} near ${lat},${lng}`;
        const nomR = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(nomQ)}&format=json&limit=10&addressdetails=1`);
        const nomD = await nomR.json();
        for (const r of nomD) {
          const nLat = parseFloat(r.lat);
          const nLng = parseFloat(r.lon);
          const key = `${nLat.toFixed(5)},${nLng.toFixed(5)}`;
          if (seen.has(key) || haversineKm(lat, lng, nLat, nLng) > 5) continue;
          seen.add(key);
          const place: NearbyPlace = {
            lat: nLat, lng: nLng,
            name: r.display_name?.split(',')[0] || 'Unknown',
            type: cfgs[0].label, icon: cfgs[0].ico, source: 'Nominatim',
            address: r.display_name?.split(',').slice(1, 3).join(',').trim() || '',
            distance: haversineKm(lat, lng, nLat, nLng),
          };
          allPlaces.push(place);
          addLabeledMarker(place.lat, place.lng, cfgs[0].ico, cfgs[0].bg, place.name, buildRichPopup(place, cfgs[0]));
        }
      } catch { /* Nominatim supplementary — non-critical */ }

      allPlaces.sort((a, b) => (a.distance || 99) - (b.distance || 99));
      setNearbyPlaces(allPlaces);
    } catch {
      setNearbyPlaces([]);
    }
    setPlacesLoading(false);
  }, [lat, lng, clearMarkers, addLabeledMarker]);

  /* ── Fetch additional verified BTC merchants from Overpass (currency:XBT=yes) ── */
  const fetchOverpassBtcMerchants = useCallback(async (): Promise<NearbyPlace[]> => {
    if (!lat || !lng) return [];
    try {
      const q = `[out:json][timeout:15];node["currency:XBT"="yes"](around:15000,${lat},${lng});out 50;`;
      const r = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(q)}`);
      const d = await r.json();
      return (d.elements || [])
        .filter((e: any) => e.tags?.name)
        .map((e: any) => {
          const details = extractPlaceDetails(e.tags || {});
          const acceptsLN = e.tags['payment:lightning'] === 'yes';
          const acceptsOnchain = e.tags['payment:onchain'] === 'yes';
          return {
            lat: e.lat, lng: e.lon, name: e.tags.name,
            type: acceptsLN ? 'Lightning ⚡ + Onchain' : acceptsOnchain ? 'Onchain BTC' : 'Bitcoin Merchant',
            icon: '₿',
            source: 'OpenStreetMap ✓',
            distance: haversineKm(lat, lng, e.lat, e.lon),
            ...details,
          };
        });
    } catch { return []; }
  }, [lat, lng]);

  // Render BTC markers from BTCMap + Overpass verified BTC merchants
  const renderBtcMarkers = useCallback(async () => {
    clearMarkers();
    // BTCMap merchants - filter out unnamed/generic entries
    const btcPlaces: NearbyPlace[] = merchants
      .filter(m => m.name && m.name !== 'BTC Merchant' && m.name.trim().length > 1)
      .slice(0, 80)
      .map(m => {
        const details = extractPlaceDetails(m.tags || {});
        return {
          lat: m.lat, lng: m.lng, name: m.name, type: m.type, icon: '₿',
          source: 'BTCMap.org ✓',
          distance: lat ? haversineKm(lat, lng, m.lat, m.lng) : undefined,
          ...details,
        };
      });

    // Overpass verified BTC merchants (currency:XBT=yes)
    const overpassBtc = await fetchOverpassBtcMerchants();

    // Merge + deduplicate
    const seen = new Set<string>();
    const merged: NearbyPlace[] = [];
    for (const p of [...btcPlaces, ...overpassBtc]) {
      const key = `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(p);
    }
    merged.sort((a, b) => (a.distance || 99) - (b.distance || 99));

    setNearbyPlaces(merged);
    merged.forEach(p => {
      let popup = `<div style="font-weight:700">${p.name}</div>`;
      popup += `<div style="font-size:12px;color:#F7931A;font-weight:600">${p.type}</div>`;
      if (p.openingHours) popup += `<div style="font-size:11px;color:#888">🕐 ${p.openingHours}</div>`;
      if (p.phone) popup += `<div style="font-size:11px"><a href="tel:${p.phone}" style="color:#3182CE">📞 ${p.phone}</a></div>`;
      if (p.website) popup += `<div style="font-size:11px"><a href="${p.website}" target="_blank" style="color:#3182CE">🌐 Website</a></div>`;
      popup += `<div style="font-size:11px;color:#999;margin-top:2px">via ${p.source} (verified)</div>`;
      popup += `<a href="https://www.google.com/maps/search/${encodeURIComponent(p.name)}/@${p.lat},${p.lng},17z" target="_blank" style="font-size:12px;color:#E53935;font-weight:600">📍 Directions</a>`;
      addLabeledMarker(p.lat, p.lng, '₿', '#F7931A', p.name, popup);
    });
  }, [merchants, lat, lng, clearMarkers, addLabeledMarker, fetchOverpassBtcMerchants]);

  // Fetch safety info for current location
  const fetchSafetyInfo = useCallback(async () => {
    setSafetyLoading(true);
    setShowSafety(true);
    try {
      // Fetch AQI from Open-Meteo Air Quality API (free, no key)
      const aqiRes = await fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lng}&current=us_aqi,pm2_5,pm10,nitrogen_dioxide,ozone`);
      const aqiData = await aqiRes.json();
      const aqi = aqiData?.current?.us_aqi ?? 0;
      const pm25 = aqiData?.current?.pm2_5 ?? 0;
      const aqiLabel = aqi <= 50 ? 'Good' : aqi <= 100 ? 'Moderate' : aqi <= 150 ? 'Unhealthy for Sensitive Groups' : aqi <= 200 ? 'Unhealthy' : 'Very Unhealthy';
      const pollutionLevel = aqi <= 50 ? 'Low' : aqi <= 100 ? 'Moderate' : aqi <= 150 ? 'Elevated' : 'High';

      // Build health tips based on AQI
      const healthTips: string[] = [
        `Air Quality Index (AQI): ${aqi} — ${aqiLabel}`,
        `PM2.5: ${pm25.toFixed(1)} µg/m³`,
        aqi <= 50 ? 'Air quality is good. Enjoy outdoor activities!' : aqi <= 100 ? 'Air quality is acceptable. Sensitive individuals should limit prolonged outdoor exertion.' : 'Consider reducing outdoor activities, especially for children and those with respiratory conditions.',
        'Stay hydrated and carry water when exploring.',
        'Apply sunscreen (SPF 30+) if spending time outdoors.',
        'Pack any prescription medications you may need.',
      ];

      // General security awareness tips (PG-friendly)
      const securityTips: string[] = [
        'Keep your belongings close and use zippered bags in crowded areas.',
        'Be aware of your surroundings, especially at night.',
        'Use well-lit, populated routes when walking.',
        'Keep copies of important documents (passport, ID) stored digitally.',
        'Share your itinerary with a trusted contact.',
        'Use licensed transportation services.',
        'Avoid displaying expensive items openly.',
      ];

      // Emergency numbers (region-aware basic set)
      const emergencyNumbers = [
        { label: '🚔 Police', number: '911' },
        { label: '🚑 Ambulance', number: '911' },
        { label: '🚒 Fire', number: '911' },
        { label: '📞 Intl Emergency', number: '112' },
      ];

      setSafetyData({ aqi, aqiLabel, healthTips, securityTips, emergencyNumbers, pollutionLevel });
    } catch (e) {
      console.warn('Safety data fetch error:', e);
      setSafetyData({
        aqi: 0, aqiLabel: 'Unavailable',
        healthTips: ['Stay hydrated and carry water.', 'Apply sunscreen when outdoors.', 'Pack any prescription medications.'],
        securityTips: ['Keep belongings close.', 'Be aware of your surroundings.', 'Use well-lit routes at night.'],
        emergencyNumbers: [{ label: '📞 Emergency', number: '112' }],
        pollutionLevel: 'Unknown',
      });
    }
    setSafetyLoading(false);
  }, [lat, lng]);

  // React to filter changes
  useEffect(() => {
    setSubFilter(null);
    setSelectedPlace(null);
    if (filter === 'safety') {
      setShowSafety(true);
      clearMarkers();
      setNearbyPlaces([]);
      fetchSafetyInfo();
    } else {
      setShowSafety(false);
      if (filter === 'btc') renderBtcMarkers();
      else fetchOverpassPlaces(filter);
    }
  }, [filter]);

  // Re-render BTC markers when merchants load
  useEffect(() => {
    if (filter === 'btc' && merchants.length > 0) renderBtcMarkers();
  }, [merchants]);

  // Re-center map and reload data when location (lat/lng props) changes
  useEffect(() => {
    if (!locationChangeHandledRef.current) { locationChangeHandledRef.current = true; return; }
    if (mapRef.current) {
      mapRef.current.setView([lat, lng], 13, { animate: true });
    }
    if (filter === 'btc') renderBtcMarkers();
    else fetchOverpassPlaces(filter);
  }, [lat, lng]);


  const handleSearchInput = useCallback((val: string) => {
    setSearch(val);
    if (suggestTimerRef.current) clearTimeout(suggestTimerRef.current);
    if (val.trim().length < 3) { setSuggestions([]); setShowSuggestions(false); return; }
    suggestTimerRef.current = setTimeout(async () => {
      try {
        const r = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(val)}&format=json&limit=5&addressdetails=1`);
        const d = await r.json();
        const items = d.map((item: any) => ({
          name: item.display_name?.split(',')[0] || val,
          address: item.display_name?.split(',').slice(1, 3).join(',').trim() || '',
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lon),
        }));
        setSuggestions(items);
        setShowSuggestions(items.length > 0);
      } catch { setSuggestions([]); }
    }, 400);
  }, []);

  const selectSuggestion = useCallback((s: { name: string; address: string; lat: number; lng: number }) => {
    setSearch(s.name);
    setSuggestions([]);
    setShowSuggestions(false);
    if (mapRef.current) {
      mapRef.current.setView([s.lat, s.lng], 15, { animate: true });
    }
    // Trigger full search at that location
    (async () => {
      setPlacesLoading(true);
      clearMarkers();
      try {
        const googlePlaces = await fetchGooglePlaces('search', { query: s.name, lat: s.lat, lng: s.lng, radius: 5000 });
        const q = `[out:json][timeout:20];node["amenity"](around:2000,${s.lat},${s.lng});out 20;`;
        const or = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(q)}`);
        const od = await or.json();
        const overpassPlaces: NearbyPlace[] = (od.elements || []).filter((e: any) => e.tags?.name).map((e: any) => {
          const details = extractPlaceDetails(e.tags || {});
          return { lat: e.lat, lng: e.lon, name: e.tags.name, type: e.tags.amenity?.replace(/_/g, ' ') || 'Place', icon: '📌', source: 'OpenStreetMap', distance: haversineKm(s.lat, s.lng, e.lat, e.lon), ...details };
        });
        const seen = new Set<string>();
        const merged: NearbyPlace[] = [];
        for (const gp of googlePlaces) { if (!gp.lat || !gp.lng) continue; const key = `${gp.lat.toFixed(4)},${gp.lng.toFixed(4)}`; if (seen.has(key)) continue; seen.add(key); gp.distance = haversineKm(s.lat, s.lng, gp.lat, gp.lng); gp.icon = '⭐'; merged.push(gp); }
        for (const op of overpassPlaces) { const key = `${op.lat.toFixed(4)},${op.lng.toFixed(4)}`; if (seen.has(key)) continue; seen.add(key); merged.push(op); }
        merged.sort((a, b) => (a.distance || 99) - (b.distance || 99));
        setNearbyPlaces(merged);
        merged.forEach(p => { const popup = buildRichPopup(p, { ico: p.icon, bg: p.source === 'Google Places' ? '#4285F4' : '#6B46C1', label: p.type }); addLabeledMarker(p.lat, p.lng, p.icon, p.source === 'Google Places' ? '#4285F4' : '#6B46C1', p.name, popup); });
      } catch {}
      setPlacesLoading(false);
    })();
  }, [clearMarkers, addLabeledMarker]);

  const doSearch = async () => {
    if (!search.trim() || !mapRef.current) return;
    setShowSuggestions(false);
    setPlacesLoading(true);
    try {
      // Search via Google Places proxy for rich results
      const googlePlaces = await fetchGooglePlaces('search', {
        query: search, lat, lng, radius: 10000,
      });

      // Also Nominatim for geocoding
      const nomR = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(search)}&format=json&limit=5&addressdetails=1`);
      const nomD = await nomR.json();

      if (nomD[0]) {
        const sLat = parseFloat(nomD[0].lat);
        const sLng = parseFloat(nomD[0].lon);
        mapRef.current.setView([sLat, sLng], 14);
      } else if (googlePlaces.length > 0) {
        mapRef.current.setView([googlePlaces[0].lat, googlePlaces[0].lng], 14);
      }

      clearMarkers();

      // Overpass fallback
      const sLat = nomD[0] ? parseFloat(nomD[0].lat) : lat;
      const sLng = nomD[0] ? parseFloat(nomD[0].lon) : lng;
      const q = `[out:json][timeout:20];node["amenity"](around:2000,${sLat},${sLng});out 30;`;
      const or = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(q)}`);
      const od = await or.json();
      const overpassPlaces: NearbyPlace[] = (od.elements || [])
        .filter((e: any) => e.tags?.name)
        .map((e: any) => {
          const details = extractPlaceDetails(e.tags || {});
          return {
            lat: e.lat, lng: e.lon,
            name: e.tags.name,
            type: e.tags.amenity?.replace(/_/g, ' ') || 'Place',
            icon: '📌', source: 'OpenStreetMap',
            distance: haversineKm(sLat, sLng, e.lat, e.lon),
            ...details,
          };
        });

      // Merge: Google first (richer data), then Overpass
      const seen = new Set<string>();
      const merged: NearbyPlace[] = [];

      for (const gp of googlePlaces) {
        if (!gp.lat || !gp.lng) continue;
        const key = `${gp.lat.toFixed(4)},${gp.lng.toFixed(4)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        gp.distance = haversineKm(sLat, sLng, gp.lat, gp.lng);
        gp.icon = '⭐';
        merged.push(gp);
      }

      for (const op of overpassPlaces) {
        const key = `${op.lat.toFixed(4)},${op.lng.toFixed(4)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        merged.push(op);
      }

      merged.sort((a, b) => (a.distance || 99) - (b.distance || 99));
      setNearbyPlaces(merged);

      merged.forEach(p => {
        const popup = buildRichPopup(p, { ico: p.icon, bg: p.source === 'Google Places' ? '#4285F4' : '#6B46C1', label: p.type });
        addLabeledMarker(p.lat, p.lng, p.icon, p.source === 'Google Places' ? '#4285F4' : '#6B46C1', p.name, popup);
      });
    } catch {}
    setPlacesLoading(false);
  };

  const subs = CATEGORY_SUBS[filter] || [];
  const sheetTitle = filter === 'btc' ? '₿ BTC Merchants (Verified Multi-Source)'
    : `${allFilters.find(f => f.id === filter)?.emoji || ''} ${allFilters.find(f => f.id === filter)?.label?.split(' ').slice(1).join(' ') || 'Places'} Nearby`;

  const renderStars = (rating: number | null | undefined) => {
    if (!rating) return null;
    const full = Math.floor(rating);
    const half = rating - full >= 0.5;
    return (
      <span className="text-amber-400 text-xs">
        {'★'.repeat(full)}{half ? '½' : ''}
        <span className="text-muted-foreground ml-1">{rating.toFixed(1)}</span>
      </span>
    );
  };

  return (
    <div className="flex flex-col h-full relative" onClick={() => setShowSuggestions(false)}>
      {/* Search bar with autocomplete */}
      <div className="absolute top-3 left-3 right-3 z-[500]">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <input value={search} onChange={e => handleSearchInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { setShowSuggestions(false); doSearch(); } }}
              onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
              placeholder="Search any location or place…"
              className="w-full bg-card/95 backdrop-blur-sm border border-border rounded-kipita-sm px-3 py-2.5 text-sm shadow-md outline-none focus:border-kipita-red" />
            {search && (
              <button onClick={() => { setSearch(''); setSuggestions([]); setShowSuggestions(false); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">✕</button>
            )}
            {/* Autocomplete dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-kipita-sm shadow-xl overflow-hidden z-[600]">
                {suggestions.map((s, i) => (
                  <button key={i} onClick={() => selectSuggestion(s)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted transition-colors text-left border-b border-border last:border-0">
                    <span className="ms text-muted-foreground text-lg flex-shrink-0">location_on</span>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate">{s.name}</div>
                      {s.address && <div className="text-[11px] text-muted-foreground truncate">{s.address}</div>}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button onClick={() => { if (lat && mapRef.current) mapRef.current.setView([lat, lng], 14); }}
            className="bg-card/95 backdrop-blur-sm border border-border px-3 rounded-kipita-sm shadow-md flex-shrink-0">
            <span className="ms text-lg text-muted-foreground">my_location</span>
          </button>
          <button onClick={() => { setShowSuggestions(false); doSearch(); }} className="bg-kipita-red text-white px-3 rounded-kipita-sm font-semibold text-sm shadow-md flex-shrink-0">
            <span className="ms text-lg">search</span>
          </button>
        </div>
      </div>

      {/* Filter pills */}
      <div className="absolute top-14 left-3 right-3 z-[500] flex gap-2 overflow-x-auto scrollbar-hide pb-1">
        {allFilters.map(p => (
          <button key={p.id} onClick={() => setFilter(p.id)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold shadow-md transition-colors ${filter === p.id ? 'bg-kipita-red text-white' : 'bg-card/95 backdrop-blur-sm text-foreground border border-border'}`}>
            {p.label}
          </button>
        ))}
      </div>

      {/* Subcategory pills */}
      {subs.length > 0 && (
        <div className="absolute top-[88px] left-3 right-3 z-[500] flex gap-2 overflow-x-auto scrollbar-hide pb-1">
          {subs.map(s => (
            <button key={s.label} onClick={() => {
              setSubFilter(s.query);
              const subSearch = async () => {
                setPlacesLoading(true);
                clearMarkers();
                try {
                  // Parallel: Overpass + Google text search
                  const overpassP = (async () => {
                    const q = `[out:json][timeout:20];node["amenity"="${s.query}"](around:${SEARCH_RADIUS},${lat},${lng});out ${MAX_RESULTS_PER_QUERY};`;
                    const altQ = `[out:json][timeout:20];node["name"~"${s.label}",i](around:${SEARCH_RADIUS},${lat},${lng});out ${MAX_RESULTS_PER_QUERY};`;
                    return Promise.allSettled([
                      fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(q)}`).then(r => r.json()),
                      fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(altQ)}`).then(r => r.json()),
                    ]);
                  })();

                  const googleP = fetchGooglePlaces('search', {
                    query: s.label, lat, lng, radius: SEARCH_RADIUS,
                  });

                  const [overpassResults, googlePlaces] = await Promise.all([overpassP, googleP]);

                  const seen = new Set<string>();
                  const places: NearbyPlace[] = [];

                  for (const result of overpassResults) {
                    if (result.status !== 'fulfilled') continue;
                    for (const e of (result.value.elements || []).filter((e: any) => e.tags?.name)) {
                      const key = `${e.lat.toFixed(5)},${e.lon.toFixed(5)}`;
                      if (seen.has(key)) continue;
                      seen.add(key);
                      const details = extractPlaceDetails(e.tags || {});
                      places.push({
                        lat: e.lat, lng: e.lon, name: e.tags.name,
                        type: s.label, icon: s.emoji, source: 'OpenStreetMap',
                        distance: haversineKm(lat, lng, e.lat, e.lon),
                        ...details,
                      });
                    }
                  }

                  for (const gp of googlePlaces) {
                    if (!gp.lat || !gp.lng) continue;
                    const key = `${gp.lat.toFixed(5)},${gp.lng.toFixed(5)}`;
                    if (seen.has(key)) continue;
                    seen.add(key);
                    gp.distance = haversineKm(lat, lng, gp.lat, gp.lng);
                    gp.icon = s.emoji;
                    places.push(gp);
                  }

                  places.sort((a, b) => (a.distance || 99) - (b.distance || 99));
                  setNearbyPlaces(places);
                  places.forEach(p => {
                    const popup = buildRichPopup(p, { ico: s.emoji, bg: '#E53935', label: s.label });
                    addLabeledMarker(p.lat, p.lng, p.source === 'Google Places' ? '⭐' : s.emoji,
                      p.source === 'Google Places' ? '#4285F4' : '#E53935', p.name, popup);
                  });
                } catch { setNearbyPlaces([]); }
                setPlacesLoading(false);
              };
              subSearch();
            }}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-[11px] font-semibold shadow-sm transition-colors ${subFilter === s.query ? 'bg-kipita-navy text-white' : 'bg-white/90 backdrop-blur-sm text-foreground border border-border'}`}>
              {s.emoji} {s.label}
            </button>
          ))}
        </div>
      )}

      {/* Map */}
      <div ref={containerRef} className="flex-1 z-0" />

      {/* Enhanced Place detail card */}
      {selectedPlace && (
        <div className="absolute bottom-[210px] left-3 right-3 z-[501] bg-card rounded-2xl shadow-xl border border-border overflow-hidden animate-in slide-in-from-bottom-4 max-h-[55vh] flex flex-col">
          <button onClick={() => setSelectedPlace(null)} className="absolute top-2 right-2 z-10 bg-black/40 text-white w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold">✕</button>

          {/* Photo gallery */}
          {selectedPlace.photos && selectedPlace.photos.length > 0 ? (
            <div className="flex overflow-x-auto scrollbar-hide flex-shrink-0">
              {selectedPlace.photos.map((url, i) => (
                <img key={i} src={url} alt={`${selectedPlace.name} photo ${i + 1}`}
                  className="h-36 w-auto object-cover flex-shrink-0 first:rounded-tl-2xl last:rounded-tr-2xl" />
              ))}
            </div>
          ) : selectedPlace.photoUrl ? (
            <img src={selectedPlace.photoUrl} alt={selectedPlace.name} className="w-full h-36 object-cover flex-shrink-0" />
          ) : null}

          <div className="p-4 overflow-y-auto flex-1">
            <h4 className="font-extrabold text-base">{selectedPlace.name}</h4>
            {selectedPlace.typeLabel || selectedPlace.type ? (
              <span className="inline-block text-[10px] font-semibold bg-muted text-muted-foreground px-2 py-0.5 rounded-full mt-1">
                {selectedPlace.typeLabel || selectedPlace.type}
              </span>
            ) : null}

            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {selectedPlace.rating && (
                <span className="flex items-center gap-1 text-sm font-bold text-amber-500">
                  ⭐ {selectedPlace.rating.toFixed(1)}
                </span>
              )}
              {selectedPlace.reviewCount ? <span className="text-xs text-muted-foreground">({selectedPlace.reviewCount.toLocaleString()} reviews)</span> : null}
              {selectedPlace.openNow !== null && selectedPlace.openNow !== undefined && (
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${selectedPlace.openNow ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                  {selectedPlace.openNow ? '● Open Now' : '● Closed'}
                </span>
              )}
              {selectedPlace.priceLevel && (
                <span className="text-xs text-muted-foreground">💰 {selectedPlace.priceLevel.replace('PRICE_LEVEL_', '')}</span>
              )}
            </div>

            {selectedPlace.address && <p className="text-xs text-muted-foreground mt-2">📍 {selectedPlace.address}</p>}
            {selectedPlace.summary && <p className="text-xs text-muted-foreground/80 mt-1 italic">{selectedPlace.summary}</p>}

            {/* Opening hours */}
            {selectedPlace.openingHours && (
              <details className="mt-3">
                <summary className="text-xs font-semibold text-foreground cursor-pointer">🕐 Opening Hours</summary>
                <div className="mt-1 space-y-0.5">
                  {selectedPlace.openingHours.split(', ').map((h, i) => (
                    <div key={i} className="text-[10px] text-muted-foreground">{h}</div>
                  ))}
                </div>
              </details>
            )}

            {/* Contact */}
            {(isValidPhone(selectedPlace.phone) || isValidUrl(selectedPlace.website)) && (
              <div className="flex gap-3 mt-3">
                {isValidPhone(selectedPlace.phone) && (
                  <a href={`tel:${selectedPlace.phone}`} className="flex items-center gap-1 text-xs text-blue-600 font-semibold">
                    📞 {selectedPlace.phone}
                  </a>
                )}
              </div>
            )}

            {/* Reviews */}
            {selectedPlace.reviews && selectedPlace.reviews.length > 0 && (
              <div className="mt-3 border-t border-border pt-3">
                <p className="text-xs font-bold mb-2">Reviews</p>
                <div className="space-y-2">
                  {selectedPlace.reviews.map((r, i) => (
                    <div key={i} className="bg-muted rounded-lg p-2.5">
                      <div className="flex items-center gap-2 mb-1">
                        {r.photoUrl && <img src={r.photoUrl} alt="" className="w-5 h-5 rounded-full" />}
                        <span className="text-[11px] font-bold">{r.author}</span>
                        <span className="text-amber-400 text-[10px]">{'★'.repeat(r.rating)}</span>
                        {r.time && <span className="text-[9px] text-muted-foreground ml-auto">{r.time}</span>}
                      </div>
                      <p className="text-[10px] text-muted-foreground leading-relaxed">{r.text.slice(0, 200)}{r.text.length > 200 ? '…' : ''}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-2 mt-3 flex-wrap">
              {selectedPlace.mapsUrl && (
                <a href={selectedPlace.mapsUrl} target="_blank" rel="noopener noreferrer"
                  className="flex-1 text-center text-xs bg-kipita-red text-white px-3 py-2 rounded-full font-bold">📍 Directions</a>
              )}
              {isValidUrl(selectedPlace.website) ? (
                <a href={selectedPlace.website!.startsWith('http') ? selectedPlace.website! : `https://${selectedPlace.website}`} target="_blank" rel="noopener noreferrer"
                  className="flex-1 text-center text-xs bg-muted text-foreground px-3 py-2 rounded-full font-bold">🌐 Website</a>
              ) : (
                <span className="flex-1 text-center text-xs bg-muted text-muted-foreground/50 px-3 py-2 rounded-full font-medium italic">🌐 Website not available</span>
              )}
              <button onClick={() => setShowTripPicker(true)}
                className="flex-1 text-center text-xs bg-kipita-navy text-white px-3 py-2 rounded-full font-bold">✈️ Add to Trip</button>
            </div>
            <div className="text-[9px] text-muted-foreground/50 mt-2 text-center">via {selectedPlace.source}</div>
          </div>

          {/* Trip Picker Modal */}
          {showTripPicker && (
            <div className="absolute inset-0 bg-black/40 z-10 flex items-end rounded-2xl overflow-hidden">
              <div className="bg-card w-full rounded-t-2xl p-4 max-h-[60%] overflow-y-auto">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-extrabold text-sm">Add to Trip</h4>
                  <button onClick={() => setShowTripPicker(false)} className="text-muted-foreground text-lg leading-none">&times;</button>
                </div>
                {getTrips().filter(t => t.status === 'upcoming' || t.status === 'active').length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">No upcoming trips. Create a trip first!</p>
                ) : (
                  getTrips().filter(t => t.status === 'upcoming' || t.status === 'active').map(trip => (
                    <button key={trip.id} onClick={() => addPlaceToTrip(trip.id, selectedPlace)}
                      className="w-full flex items-center gap-3 py-3 border-b border-border text-left hover:bg-muted transition-colors rounded-lg px-2">
                      <span className="text-2xl">{trip.emoji}</span>
                      <div>
                        <div className="text-sm font-bold">{trip.dest}, {trip.country}</div>
                        <div className="text-[10px] text-muted-foreground">{trip.start} → {trip.end}</div>
                      </div>
                      <span className="ms text-muted-foreground ml-auto">add_circle</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Success toast */}
      {tripAddSuccess && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[600] bg-kipita-green text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg animate-in fade-in slide-in-from-top-2">
          ✅ Added to {tripAddSuccess} trip!
        </div>
      )}

      {/* Safety Info Panel */}
      {showSafety && (
        <div className={`absolute bottom-0 left-0 right-0 bg-card rounded-t-3xl shadow-lg border-t border-border z-[500] transition-all duration-300 ${expanded ? 'h-[75%]' : 'h-[280px]'}`}>
          <button onClick={() => setExpanded(!expanded)} className="w-full flex flex-col items-center py-2">
            <div className="w-10 h-1 bg-border rounded-full" />
            <span className="text-[10px] text-muted-foreground mt-1">{expanded ? '▼ collapse' : '▲ expand'}</span>
          </button>
          <div className="px-4 pb-2">
            <h3 className="text-sm font-extrabold flex items-center gap-2">🛡️ Safety & Health Information</h3>
          </div>
          <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4" style={{ maxHeight: expanded ? 'calc(100% - 60px)' : '200px' }}>
            {safetyLoading ? (
              <div className="text-center py-8 text-sm text-muted-foreground animate-pulse">Loading safety data…</div>
            ) : safetyData ? (
              <>
                {/* AQI / Pollution Card */}
                <div className={`rounded-2xl p-4 border ${safetyData.aqi <= 50 ? 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800' : safetyData.aqi <= 100 ? 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950/30 dark:border-yellow-800' : 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold">🌬️ Air Quality</span>
                    <span className={`text-xs font-extrabold px-2 py-0.5 rounded-full ${safetyData.aqi <= 50 ? 'bg-green-200 text-green-800' : safetyData.aqi <= 100 ? 'bg-yellow-200 text-yellow-800' : 'bg-red-200 text-red-800'}`}>
                      AQI {safetyData.aqi} · {safetyData.aqiLabel}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">Pollution level: <strong>{safetyData.pollutionLevel}</strong></p>
                </div>

                {/* Health Tips */}
                <div className="rounded-2xl p-4 bg-muted/50 border border-border">
                  <h4 className="text-xs font-bold mb-2">💚 Health Tips</h4>
                  <ul className="space-y-1.5">
                    {safetyData.healthTips.map((tip, i) => (
                      <li key={i} className="text-[11px] text-muted-foreground flex items-start gap-2">
                        <span className="text-muted-foreground/60 mt-0.5">•</span>
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Security Awareness */}
                <div className="rounded-2xl p-4 bg-muted/50 border border-border">
                  <h4 className="text-xs font-bold mb-2">🔒 Security Awareness</h4>
                  <ul className="space-y-1.5">
                    {safetyData.securityTips.map((tip, i) => (
                      <li key={i} className="text-[11px] text-muted-foreground flex items-start gap-2">
                        <span className="text-muted-foreground/60 mt-0.5">•</span>
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Emergency Numbers */}
                <div className="rounded-2xl p-4 bg-muted/50 border border-border">
                  <h4 className="text-xs font-bold mb-2">📞 Emergency Contacts</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {safetyData.emergencyNumbers.map((em, i) => (
                      <a key={i} href={`tel:${em.number}`} className="flex items-center gap-2 bg-card rounded-xl px-3 py-2 border border-border">
                        <span className="text-xs">{em.label}</span>
                        <span className="text-xs font-bold ml-auto text-kipita-red">{em.number}</span>
                      </a>
                    ))}
                  </div>
                </div>

                <p className="text-[9px] text-muted-foreground/50 text-center pt-1">Data: Open-Meteo Air Quality API · WHO Guidelines · General travel safety best practices</p>
              </>
            ) : null}
          </div>
        </div>
      )}

      {/* Bottom sheet */}
      <div className={`absolute bottom-0 left-0 right-0 bg-card rounded-t-3xl shadow-lg border-t border-border z-[500] transition-all duration-300 ${expanded ? 'h-[60%]' : 'h-[200px]'}`}>
        <button onClick={() => setExpanded(!expanded)} className="w-full flex flex-col items-center py-2">
          <div className="w-10 h-1 bg-border rounded-full" />
          <span className="text-[10px] text-muted-foreground mt-1">{expanded ? '▼ collapse' : '▲ expand'}</span>
        </button>
        <div className="px-4 pb-2 flex items-center justify-between">
          <h3 className="text-sm font-bold">{sheetTitle}</h3>
          <span className="text-xs text-muted-foreground">{nearbyPlaces.length} found · multi-source</span>
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-4" style={{ maxHeight: expanded ? 'calc(100% - 80px)' : '120px' }}>
          {(loading && filter === 'btc') || placesLoading ? (
            <div className="text-center text-sm text-muted-foreground py-4">
              <div className="animate-pulse">Aggregating real-time data from multiple sources…</div>
            </div>
          ) : nearbyPlaces.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-4">No places found nearby. Try searching a different location.</div>
          ) : nearbyPlaces.slice(0, 50).map((p, i) => (
            <button key={`${p.lat}-${p.lng}-${i}`} onClick={() => {
              mapRef.current?.setView([p.lat, p.lng], 16, { animate: true });
              if (p.source === 'Google Places') setSelectedPlace(p);
              else setSelectedPlace(p);
            }}
              className="w-full flex items-center gap-3 py-3 border-b border-border text-left">
              {p.photoUrl ? (
                <img src={p.photoUrl} alt={p.name} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-lg flex-shrink-0">{p.icon}</div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">{p.name}</div>
                {p.typeLabel && <div className="text-[10px] text-muted-foreground font-medium">{p.typeLabel}</div>}
                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                  {p.rating && renderStars(p.rating)}
                  {p.reviewCount ? <span className="text-[9px] text-muted-foreground">({p.reviewCount.toLocaleString()})</span> : null}
                  {p.openNow !== null && p.openNow !== undefined && (
                    <span className={`text-[9px] font-bold ${p.openNow ? 'text-green-600' : 'text-red-500'}`}>
                      {p.openNow ? '● Open' : '● Closed'}
                    </span>
                  )}
                  {p.priceLevel && <span className="text-[9px] text-muted-foreground">💰 {p.priceLevel.replace('PRICE_LEVEL_', '')}</span>}
                </div>
                {p.summary && <div className="text-[10px] text-muted-foreground/80 mt-0.5 line-clamp-2 italic">{p.summary}</div>}
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {p.type}{p.address ? ` · ${p.address}` : ''}
                  {p.distance !== undefined ? ` · ${p.distance < 1 ? Math.round(p.distance * 1000) + 'm' : p.distance.toFixed(1) + 'km'}` : ''}
                </div>
                {p.openingHours && <div className="text-[10px] text-muted-foreground/70">🕐 {p.openingHours.slice(0, 50)}{p.openingHours.length > 50 ? '…' : ''}</div>}
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {isValidPhone(p.phone) ? (
                    <a href={`tel:${p.phone}`} onClick={e => e.stopPropagation()} className="text-[10px] text-blue-500 font-medium inline-block">
                      📞 {p.phone}
                    </a>
                  ) : null}
                  {isValidUrl(p.website) ? (
                    <a href={p.website!.startsWith('http') ? p.website! : `https://${p.website}`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-[10px] text-blue-500 font-medium inline-block">
                      🌐 Website
                    </a>
                  ) : (
                    <span className="text-[10px] text-muted-foreground/50 italic">🌐 Website not available</span>
                  )}
                </div>
                {/* BTC verification badge for BTC filter */}
                {filter === 'btc' && (
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="text-[9px] font-bold text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-full">₿ Accepts Bitcoin</span>
                    <span className="text-[9px] text-muted-foreground/50">{p.source}</span>
                  </div>
                )}
                {filter !== 'btc' && <div className="text-[9px] text-muted-foreground/50 mt-0.5">{p.source}</div>}
              </div>
              <a href={p.mapsUrl || `https://www.google.com/maps/search/${encodeURIComponent(p.name)}/@${p.lat},${p.lng},17z`} target="_blank" rel="noopener noreferrer"
                onClick={e => e.stopPropagation()} className="ms text-muted-foreground text-lg">directions</a>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
