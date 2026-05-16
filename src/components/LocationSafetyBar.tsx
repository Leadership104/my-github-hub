import { useState, useEffect } from 'react';
import { useTravelSafety } from '../hooks';
import { computeSafetyScore, advisoryToBaseRates, detectTimeOfDay, safetyLevel, cityVarianceFromSeed } from '../lib/safetyEngine';

interface Props {
  locationName: string;
  fullAddress?: string;
  countryCode?: string;
  lat?: number;
  lng?: number;
  onTap?: () => void;
}

const DOTS = [
  { min: 0, color: '#ef4444' },
  { min: 1, color: '#f97316' },
  { min: 2, color: '#eab308' },
  { min: 3, color: '#84cc16' },
  { min: 4, color: '#22c55e' },
];

/**
 * Persistent dark address + safety strip — kept consistent across every screen.
 * Shows the full address and safety dot indicator. Tapping opens the Safety screen.
 */
export default function LocationSafetyBar({ locationName, fullAddress, countryCode, lat, lng, onTap }: Props) {
  const liveSafety = useTravelSafety(countryCode);
  const [safetyResult, setSafetyResult] = useState<{ score: number; level: number; label: string; color: string } | null>(null);
  const [liveRates, setLiveRates] = useState<Record<string, number> | null>(null);
  const isDomestic = !countryCode || countryCode.toUpperCase() === 'US';

  useEffect(() => {
    if (!locationName) { setLiveRates(null); return; }
    let cancelled = false;
    setLiveRates(null);
    const cleaned = locationName.replace(/,\s*(USA|US)\s*$/i, '');
    const parts = cleaned.split(',').map(s => s.trim()).filter(Boolean);
    const city = parts[0] ?? '';
    let state: string | null = null;
    for (const p of parts.slice(1)) {
      const m = p.match(/^([A-Z]{2})(?:\s+\d{5})?$/);
      if (m) { state = m[1]; break; }
    }
    const country = (countryCode || 'US').toUpperCase();
    (async () => {
      try {
        const base = (import.meta.env.VITE_SUPABASE_URL as string).replace(/\/$/, '');
        const qs = new URLSearchParams({ city, state: state ?? '', country });
        if (Number.isFinite(lat)) qs.set('lat', String(lat));
        if (Number.isFinite(lng)) qs.set('lon', String(lng));
        const r = await fetch(`${base}/functions/v1/crime-data?${qs}`, {
          headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string },
        });
        if (!r.ok) return;
        const j = await r.json();
        if (!cancelled && j?.rates) setLiveRates(j.rates);
      } catch { /* fallback to heuristic */ }
    })();
    return () => { cancelled = true; };
  }, [locationName, countryCode, lat, lng]);

  useEffect(() => {
    if (!locationName) { setSafetyResult(null); return; }
    let baseRates: Record<string, number>;
    if (liveRates && Object.keys(liveRates).length) baseRates = liveRates;
    else {
      const rawScore = isDomestic ? 1.0 : (liveSafety?.rawScore ?? 2.0);
      const variance = cityVarianceFromSeed(`${locationName}|${countryCode ?? ''}`);
      baseRates = advisoryToBaseRates(rawScore, variance);
    }
    const result = computeSafetyScore({
      context: 'AWAY',
      situational: { timeOfDay: detectTimeOfDay(), density: 'residential', events: 'none', weather: 'normal' },
      baseRates,
    });
    const sl = safetyLevel(result.score);
    setSafetyResult({ score: result.score, ...sl });
  }, [liveSafety, countryCode, locationName, isDomestic, liveRates]);

  const level = safetyResult?.level ?? -1;
  const display = fullAddress || locationName || 'Detecting…';

  return (
    <div className="bg-gradient-to-br from-kipita-navy to-[#16213e] px-4 py-2 flex-shrink-0">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-white text-[11px] font-medium leading-snug break-words">{display}</p>
        </div>
        <button onClick={onTap} className="flex items-center gap-2 flex-shrink-0">
          <div className="flex items-center gap-1.5">
            {DOTS.map((dot, i) => (
              <span key={i} className="w-[9px] h-[9px] rounded-full transition-all"
                style={{
                  backgroundColor: level >= dot.min ? dot.color : `${dot.color}25`,
                  boxShadow: level === dot.min ? `0 0 6px ${dot.color}` : 'none',
                }} />
            ))}
          </div>
          <span className="text-[11px] font-bold ml-1" style={{ color: safetyResult?.color ?? '#64748b' }}>
            {safetyResult?.label ?? '…'}
          </span>
          <span className="text-white/40 text-xs">▸</span>
        </button>
      </div>
    </div>
  );
}
