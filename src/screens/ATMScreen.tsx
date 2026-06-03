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
  photoUrl?: string | null;
}

function formatDist(km: number): string {
  const miles = km * 0.621371;
  if (miles < 0.1) return `${Math.round(miles * 5280)}ft`;
  return `${miles.toFixed(1)}mi`;
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function ATMScreen({ lat, lng, merchants, onBack, onViewOnMap }: Props) {
  const [activeTab, setActiveTab] = useState<'atm' | 'bank' | 'btc'>('atm');
  const [atms, setAtms] = useState<ATMResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if ((activeTab !== 'atm' && activeTab !== 'bank') || !lat || !lng) return;
    let cancelled = false;
    const type = activeTab as 'atm' | 'bank';
    const cacheKey = `kip_atm_${type}_${lat.toFixed(3)}_${lng.toFixed(3)}`;

    // Serve cached results instantly if available (max 10 min old)
    try {
      const raw = sessionStorage.getItem(cacheKey);
      if (raw) {
        const { ts, data } = JSON.parse(raw);
        if (Date.now() - ts < 10 * 60 * 1000 && Array.isArray(data) && data.length) {
          setAtms(data);
          setLoading(false);
        } else {
          setAtms([]);
          setLoading(true);
        }
      } else {
        setAtms([]);
        setLoading(true);
      }
    } catch {
      setAtms([]);
      setLoading(true);
    }

    const fromGoogle = async (t: 'atm' | 'bank'): Promise<ATMResult[]> => {
      try {
        const base = (import.meta.env.VITE_SUPABASE_URL as string).replace(/\/$/, '');
        const qs = new URLSearchParams({ mode: 'nearby', lat: String(lat), lng: String(lng), type: t, radius: '5000' });
        const r = await fetch(`${base}/functions/v1/places-proxy?${qs}`, {
          headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string },
        });
        if (!r.ok) return [];
        const j = await r.json();
        const arr = Array.isArray(j) ? j : (j?.places || j?.results || []);
        return arr.map((p: any) => {
          const la = p?.lat ?? p?.location?.latitude ?? p?.geometry?.location?.lat;
          const ln = p?.lng ?? p?.location?.longitude ?? p?.geometry?.location?.lng;
          const rawName = p?.name || p?.displayName?.text || '';
          const name = rawName && !/^atm$/i.test(rawName.trim())
            ? rawName
            : (t === 'bank' ? 'Bank' : 'ATM');
          return {
            lat: la, lng: ln,
            name,
            address: p?.address || p?.formattedAddress || p?.vicinity,
            distance: la && ln ? haversineKm(lat, lng, la, ln) : undefined,
            type: t,
            photoUrl: p?.photoUrl || (Array.isArray(p?.photos) ? p.photos[0] : null) || null,
          } as ATMResult;
        }).filter((x: ATMResult) => Number.isFinite(x.lat) && Number.isFinite(x.lng));
      } catch { return []; }
    };

    const fromOverpass = async (radius: number, signal: AbortSignal): Promise<ATMResult[]> => {
      const tagPart = type === 'bank'
        ? `node["amenity"="bank"](around:${radius},${lat},${lng});way["amenity"="bank"](around:${radius},${lat},${lng});`
        : `node["amenity"="atm"](around:${radius},${lat},${lng});`;
      const query = `[out:json][timeout:8];(${tagPart});out center 60;`;
      const endpoints = [
        'https://overpass-api.de/api/interpreter',
        'https://overpass.kumi.systems/api/interpreter',
      ];
      for (const ep of endpoints) {
        try {
          const r = await fetch(`${ep}?data=${encodeURIComponent(query)}`, { signal });
          if (!r.ok) continue;
          const d = await r.json();
          const results: ATMResult[] = (d.elements || []).map((el: any) => {
            const la = el.lat ?? el.center?.lat;
            const ln = el.lon ?? el.center?.lon;
            const t = el.tags || {};
            const isBank = t.amenity === 'bank';
            const candidate = t.name || t['name:en'] || t.brand || t.operator || t.network || t['atm:operator'] || t.owner || '';
            const name = candidate && !/^atm$/i.test(candidate.trim())
              ? candidate
              : (isBank ? 'Bank' : 'ATM');
            return {
              lat: la, lng: ln,
              name,
              address: t['addr:street'] ? `${t['addr:housenumber'] || ''} ${t['addr:street']}`.trim() : undefined,
              distance: la && ln ? haversineKm(lat, lng, la, ln) : undefined,
              type: isBank ? 'bank' : 'atm',
            } as ATMResult;
          }).filter((x: ATMResult) => Number.isFinite(x.lat) && Number.isFinite(x.lng));
          if (results.length) return results;
        } catch { /* try next mirror */ }
      }
      return [];
    };

    const seen = new Set<string>();
    const merged: ATMResult[] = [];

    const ingest = (batch: ATMResult[]) => {
      let added = false;
      for (const r of batch) {
        const k = `${r.lat.toFixed(4)},${r.lng.toFixed(4)}`;
        if (seen.has(k)) continue;
        seen.add(k);
        merged.push(r);
        added = true;
      }
      if (!added) return;
      merged.sort((a, b) => (a.distance ?? 99) - (b.distance ?? 99));
      if (!cancelled) {
        const top = merged.slice(0, 50);
        setAtms([...top]);
        setLoading(false);
        try { sessionStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), data: top })); } catch {}
      }
    };

    const overpassCtl = new AbortController();

    // Primary: Google Places (fast). Clear spinner as soon as it returns.
    (async () => {
      const g = await fromGoogle(type);
      if (cancelled) return;
      if (g.length) {
        ingest(g);
      } else if (!merged.length) {
        // Google returned empty — still mark not-loading; Overpass may fill in
        setLoading(false);
      }
    })();

    // Secondary: Overpass in background, augments results
    (async () => {
      const o = await fromOverpass(5000, overpassCtl.signal);
      if (cancelled) return;
      ingest(o.filter(b => b.type === type));
      if (!merged.length) {
        const wider = await fromOverpass(20000, overpassCtl.signal);
        if (!cancelled) ingest(wider.filter(b => b.type === type));
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; overpassCtl.abort(); };
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
    <div className="flex flex-col h-full overflow-hidden screen-enter">
      {/* Header */}
      <div className="bg-card border-b border-border px-4 py-3 flex items-center gap-3 flex-shrink-0">
        <button onClick={onBack} className="p-2 -ml-1 rounded-full hover:bg-muted transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center">
          <span className="ms text-2xl text-foreground">arrow_back</span>
        </button>
        <div className="flex-1">
          <h1 className="text-base font-bold text-foreground">ATMs & Banks</h1>
          <p className="text-xs text-muted-foreground">Find cash & crypto nearby</p>
        </div>
        <button
          onClick={() => onViewOnMap(activeTab === 'btc' ? 'btc' : 'atm')}
          className="flex items-center gap-1 text-xs text-kipita-red font-semibold px-2 py-1 rounded-full hover:bg-kipita-red/10 transition-colors"
        >
          <span className="ms text-sm">map</span>
          Map
        </button>
      </div>

      {/* Tabs — 3 categories */}
      <div className="flex bg-muted/40 border-b border-border flex-shrink-0">
        <button
          onClick={() => setActiveTab('atm')}
          className={`flex-1 py-3 text-xs font-bold transition-colors border-b-2 ${
            activeTab === 'atm' ? 'text-kipita-red border-kipita-red bg-card' : 'text-muted-foreground border-transparent'
          }`}
        >
          🏧 ATMs
        </button>
        <button
          onClick={() => setActiveTab('bank')}
          className={`flex-1 py-3 text-xs font-bold transition-colors border-b-2 ${
            activeTab === 'bank' ? 'text-kipita-red border-kipita-red bg-card' : 'text-muted-foreground border-transparent'
          }`}
        >
          🏦 Banks
        </button>
        <button
          onClick={() => setActiveTab('btc')}
          className={`flex-1 py-3 text-xs font-bold transition-colors border-b-2 ${
            activeTab === 'btc' ? 'text-kipita-red border-kipita-red bg-card' : 'text-muted-foreground border-transparent'
          }`}
        >
          ₿ Bitcoin ATMs
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {(activeTab === 'atm' || activeTab === 'bank') && (
          <>
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <div className="w-8 h-8 border-2 border-kipita-red border-t-transparent rounded-full animate-spin" />
                <p className="text-muted-foreground text-sm">Finding {activeTab === 'atm' ? 'ATMs' : 'banks'} nearby…</p>
              </div>
            ) : atms.filter(a => a.type === activeTab).length === 0 ? (
              <div className="text-center py-16 text-muted-foreground text-sm">No {activeTab === 'atm' ? 'ATMs' : 'banks'} found nearby.</div>
            ) : (
              <div className="space-y-2 stagger">
                {atms.filter(a => a.type === activeTab).map((atm, i) => {
                  const dest = `${atm.lat},${atm.lng}`;
                  const url = `https://www.google.com/maps/dir/?api=1&origin=${lat},${lng}&destination=${dest}&travelmode=walking`;
                  return (
                    <a
                      key={i}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-outline-3d flex items-center gap-3 p-3 rounded-kipita-sm"
                      style={{ borderColor: activeTab === 'bank' ? '#2C7A7B' : '#38A169' }}
                    >
                      {atm.photoUrl ? (
                        <img src={atm.photoUrl} alt={atm.name} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-xl">{atm.type === 'bank' ? '🏦' : '🏧'}</span>
                        </div>
                      )}
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
                      <span className="ms text-kipita-red text-lg flex-shrink-0">directions</span>
                    </a>
                  );
                })}
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
                {btcAtms.map((atm, i) => {
                  const url = `https://www.google.com/maps/dir/?api=1&origin=${lat},${lng}&destination=${atm.lat},${atm.lng}&travelmode=walking`;
                  return (
                    <a
                      key={i}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 bg-card border border-border rounded-kipita-sm hover:bg-muted active:bg-muted transition-colors"
                    >
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
                      <span className="ms text-kipita-red text-lg flex-shrink-0">directions</span>
                    </a>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
