import { useState, useEffect } from 'react';
import type { BTCMerchant } from '../types';

interface Props {
  lat: number;
  lng: number;
  merchants: BTCMerchant[];
  onBack: () => void;
  onViewOnMap: (filter: string) => void;
}

interface ATMResult {
  lat: number;
  lng: number;
  name: string;
  address?: string;
  distance?: number;
  type: 'atm' | 'bank';
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDist(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)}km`;
}

export default function ATMScreen({ lat, lng, merchants, onBack, onViewOnMap }: Props) {
  const [activeTab, setActiveTab] = useState<'atm' | 'btc'>('atm');
  const [atms, setAtms] = useState<ATMResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (activeTab !== 'atm' || !lat || !lng) return;
    let cancelled = false;
    setLoading(true);
    setAtms([]);

    const fromGoogle = async (type: 'atm' | 'bank'): Promise<ATMResult[]> => {
      try {
        const base = (import.meta.env.VITE_SUPABASE_URL as string).replace(/\/$/, '');
        const qs = new URLSearchParams({ mode: 'nearby', lat: String(lat), lng: String(lng), type, radius: '5000' });
        const r = await fetch(`${base}/functions/v1/places-proxy?${qs}`, {
          headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string },
        });
        if (!r.ok) return [];
        const j = await r.json();
        const arr = j?.places || j?.results || [];
        return arr.map((p: any) => {
          const la = p?.location?.latitude ?? p?.geometry?.location?.lat;
          const ln = p?.location?.longitude ?? p?.geometry?.location?.lng;
          return {
            lat: la, lng: ln,
            name: p?.displayName?.text || p?.name || (type === 'bank' ? 'Bank' : 'ATM'),
            address: p?.formattedAddress || p?.vicinity,
            distance: la && ln ? haversineKm(lat, lng, la, ln) : undefined,
            type,
          } as ATMResult;
        }).filter((x: ATMResult) => Number.isFinite(x.lat) && Number.isFinite(x.lng));
      } catch { return []; }
    };

    const fromOverpass = async (radius: number): Promise<ATMResult[]> => {
      const query = `[out:json][timeout:20];(node["amenity"="atm"](around:${radius},${lat},${lng});node["amenity"="bank"](around:${radius},${lat},${lng});way["amenity"="bank"](around:${radius},${lat},${lng}););out center 60;`;
      const endpoints = [
        'https://overpass-api.de/api/interpreter',
        'https://overpass.kumi.systems/api/interpreter',
        'https://overpass.openstreetmap.fr/api/interpreter',
      ];
      for (const ep of endpoints) {
        try {
          const r = await fetch(`${ep}?data=${encodeURIComponent(query)}`);
          if (!r.ok) continue;
          const d = await r.json();
          const results: ATMResult[] = (d.elements || []).map((el: any) => {
            const la = el.lat ?? el.center?.lat;
            const ln = el.lon ?? el.center?.lon;
            return {
              lat: la, lng: ln,
              name: el.tags?.name || (el.tags?.amenity === 'bank' ? 'Bank' : 'ATM'),
              address: el.tags?.['addr:street']
                ? `${el.tags['addr:housenumber'] || ''} ${el.tags['addr:street']}`.trim()
                : undefined,
              distance: la && ln ? haversineKm(lat, lng, la, ln) : undefined,
              type: el.tags?.amenity === 'bank' ? 'bank' : 'atm',
            } as ATMResult;
          }).filter(x => Number.isFinite(x.lat) && Number.isFinite(x.lng));
          if (results.length) return results;
        } catch { /* try next mirror */ }
      }
      return [];
    };

    (async () => {
      // Try Google first (ATMs + banks in parallel)
      const [gAtm, gBank] = await Promise.all([fromGoogle('atm'), fromGoogle('bank')]);
      let combined = [...gAtm, ...gBank];
      // Fallback to Overpass with progressively larger radii
      if (combined.length === 0) combined = await fromOverpass(2500);
      if (combined.length === 0) combined = await fromOverpass(8000);
      if (combined.length === 0) combined = await fromOverpass(20000);

      // De-dupe by rounded coords
      const seen = new Set<string>();
      const deduped = combined.filter(r => {
        const k = `${r.lat.toFixed(4)},${r.lng.toFixed(4)}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
      deduped.sort((a, b) => (a.distance ?? 99) - (b.distance ?? 99));
      if (!cancelled) {
        setAtms(deduped.slice(0, 50));
        setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [activeTab, lat, lng]);

  const btcAtms = merchants
    .filter(m =>
      m.type === 'atm' ||
      m.tags?.['currency:XBT'] === 'yes' ||
      m.tags?.['payment:bitcoin'] === 'yes' ||
      m.tags?.['payment:bitcoin_lightning'] === 'yes'
    )
    .map(m => ({
      lat: m.lat,
      lng: m.lng,
      name: m.name || 'Bitcoin ATM',
      distance: lat && lng ? haversineKm(lat, lng, m.lat, m.lng) : undefined,
    }))
    .sort((a, b) => (a.distance ?? 99) - (b.distance ?? 99))
    .slice(0, 30);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="bg-card border-b border-border px-4 py-3 flex items-center gap-3 flex-shrink-0">
        <button onClick={onBack} className="p-1 -ml-1 rounded-full hover:bg-muted transition-colors">
          <span className="ms text-xl text-foreground">arrow_back</span>
        </button>
        <div className="flex-1">
          <h1 className="text-base font-bold text-foreground">ATMs & Bitcoin ATMs</h1>
          <p className="text-xs text-muted-foreground">Find cash & crypto nearby</p>
        </div>
        <button
          onClick={() => onViewOnMap(activeTab === 'atm' ? 'atm' : 'btcatm')}
          className="flex items-center gap-1 text-xs text-kipita-red font-semibold px-2 py-1 rounded-full hover:bg-kipita-red/10 transition-colors"
        >
          <span className="ms text-sm">map</span>
          Map
        </button>
      </div>

      {/* Tabs */}
      <div className="flex bg-muted/40 border-b border-border flex-shrink-0">
        <button
          onClick={() => setActiveTab('atm')}
          className={`flex-1 py-3 text-sm font-bold transition-colors border-b-2 ${
            activeTab === 'atm' ? 'text-kipita-red border-kipita-red bg-card' : 'text-muted-foreground border-transparent'
          }`}
        >
          🏧 ATMs
        </button>
        <button
          onClick={() => setActiveTab('btc')}
          className={`flex-1 py-3 text-sm font-bold transition-colors border-b-2 ${
            activeTab === 'btc' ? 'text-kipita-red border-kipita-red bg-card' : 'text-muted-foreground border-transparent'
          }`}
        >
          ₿ Bitcoin ATMs
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'atm' && (
          <>
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <div className="w-8 h-8 border-2 border-kipita-red border-t-transparent rounded-full animate-spin" />
                <p className="text-muted-foreground text-sm">Finding ATMs nearby…</p>
              </div>
            ) : atms.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground text-sm">No ATMs found nearby.</div>
            ) : (
              <div className="space-y-2">
                {atms.map((atm, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-card border border-border rounded-kipita-sm">
                    <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-xl">{atm.type === 'bank' ? '🏦' : '🏧'}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-foreground truncate">{atm.name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {atm.address || (atm.type === 'bank' ? 'Bank' : 'ATM')}
                      </div>
                    </div>
                    {atm.distance != null && (
                      <span className="text-xs font-semibold text-muted-foreground flex-shrink-0 bg-muted px-2 py-0.5 rounded-full">
                        {formatDist(atm.distance)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === 'btc' && (
          <>
            {/* Info banner */}
            <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-kipita-sm mb-4">
              <span className="text-xl flex-shrink-0">₿</span>
              <p className="text-xs text-amber-800 font-medium">
                Bitcoin ATMs sourced from BTCMap — the global Bitcoin merchant directory.
              </p>
            </div>

            {btcAtms.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">
                <div className="text-3xl mb-3">₿</div>
                <p>No Bitcoin ATMs found in this area.</p>
                <p className="text-xs mt-1">Try a larger city or check BTCMap.org</p>
              </div>
            ) : (
              <div className="space-y-2">
                {btcAtms.map((atm, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-card border border-border rounded-kipita-sm">
                    <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-xl">₿</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-foreground truncate">{atm.name}</div>
                      <div className="text-xs text-muted-foreground">Bitcoin ATM</div>
                    </div>
                    {atm.distance != null && (
                      <span className="text-xs font-semibold text-muted-foreground flex-shrink-0 bg-muted px-2 py-0.5 rounded-full">
                        {formatDist(atm.distance)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
