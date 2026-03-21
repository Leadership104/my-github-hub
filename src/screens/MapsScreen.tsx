import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import L from 'leaflet';
import { getCategories, CATEGORY_SUBS } from '../data';
import { generateCashAppMerchants, haversine } from '../hooks';
import type { BTCMerchant, CashAppMerchant } from '../types';

interface NearbyPlace {
  lat: number;
  lng: number;
  name: string;
  type: string;
  icon: string;
  address?: string;
  distance?: number;
}

interface Props {
  lat: number;
  lng: number;
  merchants: BTCMerchant[];
  loading: boolean;
}

const OVERPASS_CFGS: Record<string, { tag: string; ico: string; bg: string; label: string }> = {
  food:      { tag: '"amenity"~"restaurant|fast_food|food_court"', ico: '🍜', bg: '#E53E3E', label: 'Restaurant' },
  cafe:      { tag: '"amenity"~"cafe|coffee_shop"',                ico: '☕', bg: '#D69E2E', label: 'Café' },
  shop:      { tag: '"shop"~"supermarket|convenience|mall"',       ico: '🛍', bg: '#805AD5', label: 'Shop' },
  hotel:     { tag: '"tourism"~"hotel|hostel|guest_house"',        ico: '🏨', bg: '#3182CE', label: 'Hotel' },
  transport: { tag: '"public_transport"~"station|stop_position"',  ico: '🚇', bg: '#2D3748', label: 'Transit' },
  gym:       { tag: '"leisure"~"fitness_centre|sports_centre"',    ico: '💪', bg: '#DD6B20', label: 'Fitness' },
  beach:     { tag: '"natural"="beach"',                           ico: '🏖️', bg: '#38B2AC', label: 'Beach' },
  nightlife: { tag: '"amenity"~"bar|nightclub|pub"',               ico: '🎵', bg: '#9B2C2C', label: 'Nightlife' },
  atm:       { tag: '"amenity"="atm"',                             ico: '🏧', bg: '#38A169', label: 'ATM' },
  hospital:  { tag: '"amenity"~"hospital|clinic"',                 ico: '🏥', bg: '#E53E3E', label: 'Medical' },
  pharmacy:  { tag: '"amenity"="pharmacy"',                        ico: '💊', bg: '#38A169', label: 'Pharmacy' },
};

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  return haversine(lat1, lng1, lat2, lng2);
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

  const cashAppMerchants = useMemo(() => generateCashAppMerchants(lat, lng), [lat, lng]);

  const allFilters = [
    { id: 'btc', label: '₿ BTC', emoji: '₿' },
    { id: 'cashapp', label: '💚 Cash App', emoji: '💚' },
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
    }).addTo(map).bindPopup(popup, { maxWidth: 240 });
    markersRef.current.push(marker);
  }, []);

  // Fetch Overpass data
  const fetchOverpassPlaces = useCallback(async (filterId: string) => {
    const cfg = OVERPASS_CFGS[filterId];
    if (!cfg || !lat) return;
    setPlacesLoading(true);
    setNearbyPlaces([]);
    clearMarkers();
    try {
      const q = `[out:json][timeout:15];node[${cfg.tag}](around:2000,${lat},${lng});out 12;`;
      const r = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(q)}`);
      const d = await r.json();
      const elements = (d.elements || []).filter((e: any) => e.tags?.name);
      const places: NearbyPlace[] = elements.map((e: any) => ({
        lat: e.lat, lng: e.lon, name: e.tags.name, type: cfg.label, icon: cfg.ico,
        address: e.tags['addr:street'] ? `${e.tags['addr:housenumber'] || ''} ${e.tags['addr:street']}`.trim() : '',
        distance: haversineKm(lat, lng, e.lat, e.lon),
      }));
      setNearbyPlaces(places);
      places.forEach(p => {
        addLabeledMarker(p.lat, p.lng, cfg.ico, cfg.bg, p.name,
          `<div style="font-weight:700">${p.name}</div><div style="font-size:12px;color:#666">${cfg.label}${p.address ? ' · ' + p.address : ''}</div><a href="https://www.google.com/maps/search/${encodeURIComponent(p.name)}" target="_blank" style="font-size:12px;color:#E53935">📍 Directions</a>`);
      });
    } catch { setNearbyPlaces([]); }
    setPlacesLoading(false);
  }, [lat, lng, clearMarkers, addLabeledMarker]);

  // Render BTC markers
  const renderBtcMarkers = useCallback(() => {
    clearMarkers();
    const places: NearbyPlace[] = merchants.slice(0, 60).map(m => ({
      lat: m.lat, lng: m.lng, name: m.name, type: m.type, icon: '₿',
      distance: lat ? haversineKm(lat, lng, m.lat, m.lng) : undefined,
    }));
    setNearbyPlaces(places);
    merchants.slice(0, 60).forEach(m => {
      addLabeledMarker(m.lat, m.lng, '₿', '#F7931A', m.name,
        `<div style="font-weight:700">${m.name}</div><div style="font-size:12px;color:#666">${m.type}</div><a href="https://www.google.com/maps/search/${encodeURIComponent(m.name)}" target="_blank" style="font-size:12px;color:#E53935">📍 Directions</a>`);
    });
  }, [merchants, lat, lng, clearMarkers, addLabeledMarker]);

  // Render Cash App markers
  const renderCashAppMarkers = useCallback(() => {
    clearMarkers();
    const places: NearbyPlace[] = cashAppMerchants.map((m: CashAppMerchant) => ({
      lat: m.lat, lng: m.lng, name: m.name, type: 'Cash App Pay', icon: '💚',
      distance: lat ? haversineKm(lat, lng, m.lat, m.lng) : undefined,
    }));
    setNearbyPlaces(places);
    cashAppMerchants.forEach((m: CashAppMerchant) => {
      addLabeledMarker(m.lat, m.lng, '$', '#00D632', m.name,
        `<div style="font-weight:700">${m.name}</div><div style="font-size:12px;color:#00D632">Cash App Pay</div>`);
    });
  }, [cashAppMerchants, lat, lng, clearMarkers, addLabeledMarker]);

  // React to filter changes
  useEffect(() => {
    setSubFilter(null);
    if (filter === 'btc') renderBtcMarkers();
    else if (filter === 'cashapp') renderCashAppMarkers();
    else if (filter === 'btcatm') {
      clearMarkers();
      setNearbyPlaces([]);
    } else fetchOverpassPlaces(filter);
  }, [filter]);

  // Re-render BTC markers when merchants load
  useEffect(() => {
    if (filter === 'btc' && merchants.length > 0) renderBtcMarkers();
  }, [merchants]);

  const doSearch = async () => {
    if (!search.trim() || !mapRef.current) return;
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(search)}&format=json&limit=1`);
      const d = await r.json();
      if (d[0]) mapRef.current.setView([+d[0].lat, +d[0].lon], 14);
    } catch {}
  };

  const subs = CATEGORY_SUBS[filter] || [];
  const sheetTitle = filter === 'btc' ? '₿ BTC Merchants Nearby'
    : filter === 'cashapp' ? '💚 Cash App Merchants'
    : `${allFilters.find(f => f.id === filter)?.emoji || ''} ${allFilters.find(f => f.id === filter)?.label?.split(' ').slice(1).join(' ') || 'Places'} Nearby`;

  return (
    <div className="flex flex-col h-full relative">
      {/* Search bar */}
      <div className="absolute top-3 left-3 right-3 z-[500] flex gap-2">
        <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && doSearch()}
          placeholder="Search location…"
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
              window.open(`https://www.google.com/maps/search/${encodeURIComponent(s.query)}${lat ? `/@${lat},${lng},14z` : ''}`, '_blank');
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
          <span className="text-xs text-muted-foreground">{nearbyPlaces.length} found</span>
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-4" style={{ maxHeight: expanded ? 'calc(100% - 80px)' : '120px' }}>
          {(loading && filter === 'btc') || placesLoading ? (
            <div className="text-center text-sm text-muted-foreground py-4">Finding real places nearby…</div>
          ) : nearbyPlaces.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-4">No places found nearby.</div>
          ) : nearbyPlaces.slice(0, 25).map((p, i) => (
            <button key={i} onClick={() => mapRef.current?.setView([p.lat, p.lng], 16, { animate: true })}
              className="w-full flex items-center gap-3 py-3 border-b border-border text-left">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-lg flex-shrink-0">{p.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">{p.name}</div>
                <div className="text-xs text-muted-foreground">
                  {p.type}{p.address ? ` · ${p.address}` : ''}
                  {p.distance !== undefined ? ` · ${p.distance < 1 ? Math.round(p.distance * 1000) + 'm' : p.distance.toFixed(1) + 'km'}` : ''}
                </div>
              </div>
              <a href={`https://www.google.com/maps/search/${encodeURIComponent(p.name)}`} target="_blank" rel="noopener noreferrer"
                onClick={e => e.stopPropagation()} className="ms text-muted-foreground text-lg">directions</a>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
