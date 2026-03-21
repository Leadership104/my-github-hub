import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import type { BTCMerchant } from '../types';

interface Props {
  lat: number;
  lng: number;
  merchants: BTCMerchant[];
  loading: boolean;
}

export default function MapsScreen({ lat, lng, merchants, loading }: Props) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState<'btc' | 'food' | 'cafe'>('btc');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(false);

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

  // Update markers when merchants change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || filter !== 'btc') return;
    merchants.slice(0, 60).forEach(m => {
      L.marker([m.lat, m.lng], {
        icon: L.divIcon({ html: '<div style="background:#F7931A;color:#fff;font-weight:800;font-size:14px;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.3)">₿</div>', className: '', iconSize: [28, 28], iconAnchor: [14, 14] }),
      }).addTo(map).bindPopup(`<b>${m.name}</b><br/>${m.type}`);
    });
  }, [merchants, filter]);

  const doSearch = async () => {
    if (!search.trim() || !mapRef.current) return;
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(search)}&format=json&limit=1`);
      const d = await r.json();
      if (d[0]) mapRef.current.setView([+d[0].lat, +d[0].lon], 14);
    } catch {}
  };

  const pills = [
    { id: 'btc' as const, label: '₿ Bitcoin', active: filter === 'btc' },
    { id: 'food' as const, label: '🍜 Food', active: filter === 'food' },
    { id: 'cafe' as const, label: '☕ Cafes', active: filter === 'cafe' },
  ];

  return (
    <div className="flex flex-col h-full relative">
      {/* Search bar overlay */}
      <div className="absolute top-3 left-3 right-3 z-[500] flex gap-2">
        <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && doSearch()}
          placeholder="Search location…"
          className="flex-1 bg-card/95 backdrop-blur-sm border border-border rounded-kipita-sm px-3 py-2.5 text-sm shadow-md outline-none focus:border-kipita-red" />
        <button onClick={doSearch} className="bg-kipita-red text-white px-4 rounded-kipita-sm font-semibold text-sm shadow-md">Go</button>
      </div>

      {/* Filter pills */}
      <div className="absolute top-14 left-3 z-[500] flex gap-2">
        {pills.map(p => (
          <button key={p.id} onClick={() => setFilter(p.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold shadow-md transition-colors ${p.active ? 'bg-kipita-red text-white' : 'bg-card/95 backdrop-blur-sm text-foreground border border-border'}`}>
            {p.label}
          </button>
        ))}
      </div>

      {/* Map */}
      <div ref={containerRef} className="flex-1 z-0" />

      {/* Bottom sheet */}
      <div className={`absolute bottom-0 left-0 right-0 bg-card rounded-t-3xl shadow-lg border-t border-border z-[500] transition-all duration-300 ${expanded ? 'h-[60%]' : 'h-[200px]'}`}>
        <button onClick={() => setExpanded(!expanded)} className="w-full flex justify-center py-2">
          <div className="w-10 h-1 bg-border rounded-full" />
        </button>
        <div className="px-4 pb-2 flex items-center justify-between">
          <h3 className="text-sm font-bold">
            {filter === 'btc' ? '₿ BTC Merchants Nearby' : filter === 'food' ? '🍜 Restaurants' : '☕ Cafes'}
          </h3>
          <span className="text-xs text-muted-foreground">{merchants.length} found</span>
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {loading ? (
            <div className="text-center text-sm text-muted-foreground py-4">Loading merchants…</div>
          ) : merchants.slice(0, 20).map((m, i) => (
            <button key={i} onClick={() => mapRef.current?.setView([m.lat, m.lng], 16, { animate: true })}
              className="w-full flex items-center gap-3 py-3 border-b border-border text-left">
              <div className="w-10 h-10 rounded-full bg-[#FFF3E0] flex items-center justify-center text-lg flex-shrink-0">₿</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">{m.name}</div>
                <div className="text-xs text-muted-foreground">{m.type}</div>
              </div>
              <a href={`https://www.google.com/maps/search/${encodeURIComponent(m.name)}`} target="_blank" rel="noopener noreferrer"
                onClick={e => e.stopPropagation()} className="ms text-muted-foreground text-lg">directions</a>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
