import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import L from 'leaflet';
import { getCategories, CATEGORY_SUBS } from '../data';
import { haversine } from '../hooks';
import type { BTCMerchant } from '../types';

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
}

interface Props {
  lat: number;
  lng: number;
  merchants: BTCMerchant[];
  loading: boolean;
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

const SEARCH_RADIUS = 3500; // meters
const MAX_RESULTS_PER_QUERY = 30;

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

export default function MapsScreen({ lat, lng, merchants, loading }: Props) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const categories = getCategories();

  const [filter, setFilter] = useState('btc');
  const [subFilter, setSubFilter] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [nearbyPlaces, setNearbyPlaces] = useState<NearbyPlace[]>([]);
  const [placesLoading, setPlacesLoading] = useState(false);

  const allFilters = [
    { id: 'btc', label: '₿ BTC', emoji: '₿' },
    ...categories.map(c => ({ id: c.id, label: `${c.emoji} ${c.label}`, emoji: c.emoji })),
  ];

  // Init map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const center: [number, number] = [lat || 13.7563, lng || 100.5018];
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

  const buildPopup = (p: NearbyPlace, cfg: { ico: string; bg: string; label: string }) => {
    let popup = `<div style="font-weight:700;font-size:14px">${p.name}</div>`;
    popup += `<div style="font-size:12px;color:#666;margin:2px 0">${cfg.label}${p.address ? ' · ' + p.address : ''}</div>`;
    if (p.openingHours) popup += `<div style="font-size:11px;color:#888">🕐 ${p.openingHours}</div>`;
    if (p.phone) popup += `<div style="font-size:11px"><a href="tel:${p.phone}" style="color:#3182CE">📞 ${p.phone}</a></div>`;
    if (p.website) popup += `<div style="font-size:11px"><a href="${p.website}" target="_blank" style="color:#3182CE">🌐 Website</a></div>`;
    popup += `<div style="font-size:11px;color:#999;margin-top:2px">via ${p.source || 'OpenStreetMap'}</div>`;
    popup += `<a href="https://www.google.com/maps/search/${encodeURIComponent(p.name + ' ' + (p.address || ''))}/@${p.lat},${p.lng},17z" target="_blank" style="font-size:12px;color:#E53935;font-weight:600">📍 Directions</a>`;
    return popup;
  };

  // Fetch real places from Overpass with parallel multi-tag queries
  const fetchOverpassPlaces = useCallback(async (filterId: string) => {
    const cfgs = OVERPASS_CFGS[filterId];
    if (!cfgs || !lat) return;
    setPlacesLoading(true);
    setNearbyPlaces([]);
    clearMarkers();

    try {
      // Fire all tag queries in parallel for maximum data coverage
      const promises = cfgs.map(async (cfg) => {
        const q = `[out:json][timeout:20];node[${cfg.tag}](around:${SEARCH_RADIUS},${lat},${lng});out ${MAX_RESULTS_PER_QUERY};`;
        const r = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(q)}`);
        const d = await r.json();
        return { cfg, elements: (d.elements || []).filter((e: any) => e.tags?.name) };
      });

      const results = await Promise.allSettled(promises);
      const allPlaces: NearbyPlace[] = [];
      const seen = new Set<string>();

      for (const result of results) {
        if (result.status !== 'fulfilled') continue;
        const { cfg, elements } = result.value;
        for (const e of elements) {
          const key = `${e.lat.toFixed(5)},${e.lon.toFixed(5)}`;
          if (seen.has(key)) continue;
          seen.add(key);

          const details = extractPlaceDetails(e.tags || {});
          const place: NearbyPlace = {
            lat: e.lat,
            lng: e.lon,
            name: e.tags.name,
            type: cfg.label,
            icon: cfg.ico,
            source: 'OpenStreetMap',
            distance: haversineKm(lat, lng, e.lat, e.lon),
            ...details,
          };
          allPlaces.push(place);
          addLabeledMarker(place.lat, place.lng, cfg.ico, cfg.bg, place.name, buildPopup(place, cfg));
        }
      }

      // Also search via Nominatim for additional real places
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
            type: cfgs[0].label,
            icon: cfgs[0].ico,
            source: 'Nominatim',
            address: r.display_name?.split(',').slice(1, 3).join(',').trim() || '',
            distance: haversineKm(lat, lng, nLat, nLng),
          };
          allPlaces.push(place);
          addLabeledMarker(place.lat, place.lng, cfgs[0].ico, cfgs[0].bg, place.name, buildPopup(place, cfgs[0]));
        }
      } catch { /* Nominatim supplementary — non-critical */ }

      allPlaces.sort((a, b) => (a.distance || 99) - (b.distance || 99));
      setNearbyPlaces(allPlaces);
    } catch {
      setNearbyPlaces([]);
    }
    setPlacesLoading(false);
  }, [lat, lng, clearMarkers, addLabeledMarker]);

  // Render BTC markers (real data from btcmap.org)
  const renderBtcMarkers = useCallback(() => {
    clearMarkers();
    const places: NearbyPlace[] = merchants.slice(0, 80).map(m => {
      const details = extractPlaceDetails(m.tags || {});
      return {
        lat: m.lat, lng: m.lng, name: m.name, type: m.type, icon: '₿',
        source: 'BTCMap.org',
        distance: lat ? haversineKm(lat, lng, m.lat, m.lng) : undefined,
        ...details,
      };
    });
    setNearbyPlaces(places);
    places.forEach(p => {
      let popup = `<div style="font-weight:700">${p.name}</div>`;
      popup += `<div style="font-size:12px;color:#F7931A;font-weight:600">${p.type}</div>`;
      if (p.openingHours) popup += `<div style="font-size:11px;color:#888">🕐 ${p.openingHours}</div>`;
      if (p.phone) popup += `<div style="font-size:11px"><a href="tel:${p.phone}" style="color:#3182CE">📞 ${p.phone}</a></div>`;
      if (p.website) popup += `<div style="font-size:11px"><a href="${p.website}" target="_blank" style="color:#3182CE">🌐 Website</a></div>`;
      popup += `<div style="font-size:11px;color:#999;margin-top:2px">via BTCMap.org (verified)</div>`;
      popup += `<a href="https://www.google.com/maps/search/${encodeURIComponent(p.name)}/@${p.lat},${p.lng},17z" target="_blank" style="font-size:12px;color:#E53935;font-weight:600">📍 Directions</a>`;
      addLabeledMarker(p.lat, p.lng, '₿', '#F7931A', p.name, popup);
    });
  }, [merchants, lat, lng, clearMarkers, addLabeledMarker]);

  // React to filter changes
  useEffect(() => {
    setSubFilter(null);
    if (filter === 'btc') renderBtcMarkers();
    else fetchOverpassPlaces(filter);
  }, [filter]);

  // Re-render BTC markers when merchants load
  useEffect(() => {
    if (filter === 'btc' && merchants.length > 0) renderBtcMarkers();
  }, [merchants]);

  const doSearch = async () => {
    if (!search.trim() || !mapRef.current) return;
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(search)}&format=json&limit=5&addressdetails=1`);
      const d = await r.json();
      if (d[0]) {
        const sLat = parseFloat(d[0].lat);
        const sLng = parseFloat(d[0].lon);
        mapRef.current.setView([sLat, sLng], 14);

        // Also search for POIs at the searched location
        clearMarkers();
        const q = `[out:json][timeout:20];node["amenity"](around:2000,${sLat},${sLng});out 30;`;
        const or = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(q)}`);
        const od = await or.json();
        const searchPlaces: NearbyPlace[] = (od.elements || [])
          .filter((e: any) => e.tags?.name)
          .map((e: any) => {
            const details = extractPlaceDetails(e.tags || {});
            return {
              lat: e.lat, lng: e.lon,
              name: e.tags.name,
              type: e.tags.amenity?.replace(/_/g, ' ') || 'Place',
              icon: '📌',
              source: 'OpenStreetMap',
              distance: haversineKm(sLat, sLng, e.lat, e.lon),
              ...details,
            };
          })
          .sort((a: NearbyPlace, b: NearbyPlace) => (a.distance || 99) - (b.distance || 99));

        setNearbyPlaces(searchPlaces);
        searchPlaces.forEach(p => {
          addLabeledMarker(p.lat, p.lng, '📌', '#6B46C1', p.name,
            `<div style="font-weight:700">${p.name}</div><div style="font-size:12px;color:#666">${p.type}${p.address ? ' · ' + p.address : ''}</div><a href="https://www.google.com/maps/search/${encodeURIComponent(p.name)}/@${p.lat},${p.lng},17z" target="_blank" style="font-size:12px;color:#E53935">📍 Directions</a>`);
        });
      }
    } catch {}
  };

  const subs = CATEGORY_SUBS[filter] || [];
  const sheetTitle = filter === 'btc' ? '₿ BTC Merchants Nearby'
    : `${allFilters.find(f => f.id === filter)?.emoji || ''} ${allFilters.find(f => f.id === filter)?.label?.split(' ').slice(1).join(' ') || 'Places'} Nearby`;

  return (
    <div className="flex flex-col h-full relative">
      {/* Search bar */}
      <div className="absolute top-3 left-3 right-3 z-[500] flex gap-2">
        <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && doSearch()}
          placeholder="Search any location or place…"
          className="flex-1 bg-card/95 backdrop-blur-sm border border-border rounded-kipita-sm px-3 py-2.5 text-sm shadow-md outline-none focus:border-kipita-red" />
        <button onClick={() => { if (lat && mapRef.current) mapRef.current.setView([lat, lng], 14); }}
          className="bg-card/95 backdrop-blur-sm border border-border px-3 rounded-kipita-sm shadow-md">
          <span className="ms text-lg text-muted-foreground">my_location</span>
        </button>
        <button onClick={doSearch} className="bg-kipita-red text-white px-3 rounded-kipita-sm font-semibold text-sm shadow-md">
          <span className="ms text-lg">search</span>
        </button>
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
              // Trigger specific Overpass search for this sub-filter
              const subSearch = async () => {
                setPlacesLoading(true);
                clearMarkers();
                try {
                  const q = `[out:json][timeout:20];node["amenity"="${s.query}"](around:${SEARCH_RADIUS},${lat},${lng});out ${MAX_RESULTS_PER_QUERY};`;
                  const altQ = `[out:json][timeout:20];node["name"~"${s.label}",i](around:${SEARCH_RADIUS},${lat},${lng});out ${MAX_RESULTS_PER_QUERY};`;

                  const [r1, r2] = await Promise.allSettled([
                    fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(q)}`).then(r => r.json()),
                    fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(altQ)}`).then(r => r.json()),
                  ]);

                  const seen = new Set<string>();
                  const places: NearbyPlace[] = [];

                  for (const result of [r1, r2]) {
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

                  places.sort((a, b) => (a.distance || 99) - (b.distance || 99));
                  setNearbyPlaces(places);
                  places.forEach(p => {
                    addLabeledMarker(p.lat, p.lng, s.emoji, '#E53935', p.name,
                      `<div style="font-weight:700">${p.name}</div><div style="font-size:12px;color:#666">${s.label}${p.address ? ' · ' + p.address : ''}</div>${p.openingHours ? `<div style="font-size:11px;color:#888">🕐 ${p.openingHours}</div>` : ''}<a href="https://www.google.com/maps/search/${encodeURIComponent(p.name)}/@${p.lat},${p.lng},17z" target="_blank" style="font-size:12px;color:#E53935">📍 Directions</a>`);
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

      {/* Bottom sheet */}
      <div className={`absolute bottom-0 left-0 right-0 bg-card rounded-t-3xl shadow-lg border-t border-border z-[500] transition-all duration-300 ${expanded ? 'h-[60%]' : 'h-[200px]'}`}>
        <button onClick={() => setExpanded(!expanded)} className="w-full flex flex-col items-center py-2">
          <div className="w-10 h-1 bg-border rounded-full" />
          <span className="text-[10px] text-muted-foreground mt-1">{expanded ? '▼ collapse' : '▲ expand'}</span>
        </button>
        <div className="px-4 pb-2 flex items-center justify-between">
          <h3 className="text-sm font-bold">{sheetTitle}</h3>
          <span className="text-xs text-muted-foreground">{nearbyPlaces.length} found · real-time</span>
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-4" style={{ maxHeight: expanded ? 'calc(100% - 80px)' : '120px' }}>
          {(loading && filter === 'btc') || placesLoading ? (
            <div className="text-center text-sm text-muted-foreground py-4">
              <div className="animate-pulse">Aggregating real-time data from multiple sources…</div>
            </div>
          ) : nearbyPlaces.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-4">No places found nearby. Try searching a different location.</div>
          ) : nearbyPlaces.slice(0, 50).map((p, i) => (
            <button key={`${p.lat}-${p.lng}-${i}`} onClick={() => mapRef.current?.setView([p.lat, p.lng], 16, { animate: true })}
              className="w-full flex items-center gap-3 py-3 border-b border-border text-left">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-lg flex-shrink-0">{p.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">{p.name}</div>
                <div className="text-xs text-muted-foreground">
                  {p.type}{p.address ? ` · ${p.address}` : ''}
                  {p.distance !== undefined ? ` · ${p.distance < 1 ? Math.round(p.distance * 1000) + 'm' : p.distance.toFixed(1) + 'km'}` : ''}
                </div>
                {p.openingHours && <div className="text-[10px] text-muted-foreground/70">🕐 {p.openingHours}</div>}
                <div className="text-[9px] text-muted-foreground/50">{p.source}</div>
              </div>
              <a href={`https://www.google.com/maps/search/${encodeURIComponent(p.name)}/@${p.lat},${p.lng},17z`} target="_blank" rel="noopener noreferrer"
                onClick={e => e.stopPropagation()} className="ms text-muted-foreground text-lg">directions</a>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
