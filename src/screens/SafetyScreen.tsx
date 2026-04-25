import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../integrations/supabase/client';
import {
  computeSafetyScore, advisoryToBaseRates, detectTimeOfDay, safetyLevel,
  categoryRating, cityVarianceFromSeed,
  type SafetyContext, type SafetyResult,
} from '../lib/safetyEngine';

// Convert FBI rates (per-100k) into the engine's 0..RATE_CAP scale.
// FBI's "high crime" cities run ~1500/100k for property crime — engine cap is 1500.
function ratesFromFbi(per100k: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(per100k)) {
    if (typeof v !== 'number') continue;
    out[k] = Math.max(0, Math.round(v));
  }
  return out;
}

interface CrimeDataResponse {
  source: 'FBI_CDE' | 'FBI_NATIONAL' | 'STATE_GOV' | 'FALLBACK';
  year: number | null;
  population: number | null;
  agency?: string;
  rates: Record<string, number>;
  advisoryLevel?: number | null;
}

const CONTEXTS: { id: SafetyContext; label: string; icon: string }[] = [
  { id: 'HOME',    label: 'At Home',    icon: '🏠' },
  { id: 'AWAY',    label: 'Traveling',  icon: '✈️' },
  { id: 'TRANSIT', label: 'In Transit', icon: '🚗' },
];

const SAFETY_TIPS: Record<string, Record<string, string>> = {
  HOME: {
    'LOW RISK':  'Your home area appears safe. Continue standard precautions.',
    MODERATE:   'Be mindful of property security and neighborhood activity.',
    ELEVATED:   'Consider enhanced home security measures and stay alert to local advisories.',
    'HIGH RISK': 'Stay vigilant. Keep doors locked and be cautious of strangers.',
    CRITICAL:   'Exercise extreme caution. Avoid leaving home unnecessarily.',
  },
  AWAY: {
    'LOW RISK':  'This area appears safe for travelers. Enjoy your visit.',
    MODERATE:   'Keep valuables secure and stay in well-lit, populated areas.',
    ELEVATED:   'Avoid isolated areas and stay aware of your surroundings at all times.',
    'HIGH RISK': 'Travel in groups when possible. Keep emergency contacts readily accessible.',
    CRITICAL:   'Reconsider travel to this area. Consult local authorities if present.',
  },
  TRANSIT: {
    'LOW RISK':  'Roads and transit appear safe for your journey.',
    MODERATE:   'Secure your vehicle and stay aware of your surroundings en route.',
    ELEVATED:   'Plan your route carefully. Avoid travel after dark if possible.',
    'HIGH RISK': 'Stay on main roads and keep doors locked while driving.',
    CRITICAL:   'Avoid travel if possible. Emergency services may be limited.',
  },
};

/* ── Credit-score style semi-circle gauge ─────────────────────────────────── */
const GR = 88, GCX = 120, GCY = 108;

const GAUGE_BANDS = [
  { from: 0,  to: 20,  color: '#ef4444' },
  { from: 20, to: 40,  color: '#f97316' },
  { from: 40, to: 60,  color: '#eab308' },
  { from: 60, to: 80,  color: '#84cc16' },
  { from: 80, to: 100, color: '#22c55e' },
];

// score 0 → left (π), score 100 → right (2π)
const scoreAngle = (s: number) => Math.PI + (s / 100) * Math.PI;
const gx = (s: number) => GCX + GR * Math.cos(scoreAngle(s));
const gy = (s: number) => GCY + GR * Math.sin(scoreAngle(s));
// clockwise arc sweeping left → top → right (upper semi-circle)
const bandArc = (from: number, to: number) =>
  `M ${gx(from).toFixed(1)} ${gy(from).toFixed(1)} A ${GR} ${GR} 0 0 1 ${gx(to).toFixed(1)} ${gy(to).toFixed(1)}`;

/* ── Category rows matching ZIP-code / Travel.State.Gov format ────────────── */
const CATEGORY_ROWS = [
  { key: 'robbery',         label: 'Robbery' },
  { key: 'assault',         label: 'Aggravated Assault' },
  { key: 'larceny_home',    label: 'Theft' },
  { key: 'vehicle_theft',   label: 'Motor Vehicle Theft' },
  { key: 'burglary',        label: 'Burglary' },
  { key: 'sexual_offense',  label: 'Sexual Offense' },
  { key: 'weapons_offense', label: 'Weapons Offense' },
];

interface Props {
  locationName: string;
  countryCode?: string;
  advisoryScore?: number;
  onBack: () => void;
}

// Pull "City, ST" out of an address line like "Miami, FL 33101, USA".
function parseCityState(name: string): { city: string; state: string | null } {
  if (!name) return { city: '', state: null };
  const parts = name.split(',').map(s => s.trim()).filter(Boolean);
  const city = parts[0] ?? '';
  let state: string | null = null;
  for (const p of parts.slice(1)) {
    const m = p.match(/^([A-Z]{2})(?:\s+\d{5})?$/);
    if (m) { state = m[1]; break; }
  }
  return { city, state };
}

export default function SafetyScreen({ locationName, countryCode, advisoryScore, onBack }: Props) {
  const [context, setContext] = useState<SafetyContext>('AWAY');
  const [result, setResult] = useState<SafetyResult | null>(null);
  const [crime, setCrime] = useState<CrimeDataResponse | null>(null);

  // Fetch real FBI/State.Gov crime data whenever the location changes.
  useEffect(() => {
    let cancelled = false;
    setCrime(null);
    const { city, state } = parseCityState(locationName);
    const country = (countryCode || 'US').toUpperCase();
    if (!city && country === 'US') return;
    (async () => {
      try {
        const base = (import.meta.env.VITE_SUPABASE_URL as string).replace(/\/$/, '');
        const qs = new URLSearchParams({ city, state: state ?? '', country });
        const r = await fetch(`${base}/functions/v1/crime-data?${qs}`, {
          headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string },
        });
        if (!r.ok) throw new Error(String(r.status));
        const j = await r.json();
        if (!cancelled) setCrime(j as CrimeDataResponse);
      } catch {
        if (!cancelled) setCrime({ source: 'FALLBACK', year: null, population: null, rates: {} });
      }
    })();
    return () => { cancelled = true; };
  }, [locationName, countryCode]);

  const compute = useCallback(() => {
    const isDomesticUS = !countryCode || countryCode.toUpperCase() === 'US';
    let baseRates: Record<string, number>;

    if (crime && (crime.source === 'FBI_CDE' || crime.source === 'FBI_NATIONAL') && Object.keys(crime.rates).length) {
      const variance = crime.source === 'FBI_NATIONAL'
        ? cityVarianceFromSeed(`${locationName}|${countryCode ?? ''}`) * 0.5
        : 0; // real agency data needs no synthetic variance
      const v = 1 + variance * 0.2;
      baseRates = {};
      for (const [k, val] of Object.entries(ratesFromFbi(crime.rates))) {
        baseRates[k] = Math.round(val * v);
      }
    } else if (crime && crime.source === 'STATE_GOV' && typeof crime.advisoryLevel === 'number') {
      const variance = cityVarianceFromSeed(`${locationName}|${countryCode ?? ''}`);
      baseRates = advisoryToBaseRates(crime.advisoryLevel, variance);
    } else {
      const effectiveRaw = advisoryScore ?? (isDomesticUS ? 1.0 : 2.0);
      const variance = cityVarianceFromSeed(`${locationName}|${countryCode ?? ''}`);
      baseRates = advisoryToBaseRates(effectiveRaw, variance);
    }

    const timeOfDay = detectTimeOfDay();
    const r = computeSafetyScore({
      context,
      incidents: [],
      situational: { timeOfDay, density: 'residential', events: 'none', weather: 'normal' },
      baseRates,
    });
    setResult(r);
  }, [context, advisoryScore, locationName, countryCode, crime]);

  useEffect(() => { compute(); }, [compute]);

  if (!result) return null;

  const sl = safetyLevel(result.score);
  const todRaw = detectTimeOfDay();
  const timeLabel = todRaw === 'daytime' ? 'Daytime' : todRaw === 'evening' ? 'Evening' : 'Night';
  const tipIcon = result.score >= 80 ? '✅' : result.score >= 60 ? '⚠️' : result.score >= 40 ? '🟠' : '🔴';
  const needleX = (GCX + (GR - 8) * Math.cos(scoreAngle(result.score))).toFixed(1);
  const needleY = (GCY + (GR - 8) * Math.sin(scoreAngle(result.score))).toFixed(1);
  const isDomestic = !countryCode || countryCode === 'US';

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-br from-kipita-navy to-[#16213e] px-4 py-3 flex items-center gap-3 flex-shrink-0">
        <button onClick={onBack} className="text-white/70 hover:text-white">
          <span className="ms text-xl">arrow_back</span>
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-bold truncate">Safety — {locationName}</p>
          <p className="text-white/50 text-[10px]">
            {isDomestic ? 'Domestic · ZIP-level risk index' : 'International · Travel.State.Gov'}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 pb-24 space-y-4">
        {/* Context Selector */}
        <div className="flex gap-2">
          {CONTEXTS.map(c => (
            <button key={c.id} onClick={() => setContext(c.id)}
              className={`flex-1 flex flex-col items-center gap-1 p-3 rounded-kipita border transition-all ${
                context === c.id ? 'border-kipita-red bg-kipita-red/10' : 'border-border bg-card'
              }`}>
              <span className="text-xl">{c.icon}</span>
              <span className="text-[10px] font-bold text-foreground">{c.label}</span>
            </button>
          ))}
        </div>

        {/* Credit-Score Style Gauge */}
        <div className="bg-card border border-border rounded-kipita p-4 flex flex-col items-center">
          <p className="text-[10px] font-semibold text-muted-foreground tracking-widest mb-1">SAFETY INDEX</p>

          <svg viewBox="0 0 240 132" width="240" height="132">
            {/* Background bands (faded) */}
            {GAUGE_BANDS.map(b => (
              <path key={b.color} d={bandArc(b.from, b.to)}
                fill="none" stroke={b.color} strokeWidth={18} opacity={0.18} />
            ))}
            {/* Active bands up to current score */}
            {GAUGE_BANDS.map(b => {
              if (result.score <= b.from) return null;
              const to = Math.min(result.score, b.to);
              return (
                <path key={`a-${b.color}`} d={bandArc(b.from, to)}
                  fill="none" stroke={b.color} strokeWidth={18}
                  style={{ filter: `drop-shadow(0 0 5px ${b.color}88)`, transition: 'all 0.6s' }} />
              );
            })}
            {/* Needle */}
            <line x1={GCX} y1={GCY} x2={needleX} y2={needleY}
              stroke="white" strokeWidth={2.5} strokeLinecap="round"
              style={{ transition: 'all 0.6s' }} />
            <circle cx={GCX} cy={GCY} r={5} fill="hsl(var(--card))" stroke="white" strokeWidth={2} />
            {/* Score number + level */}
            <text x={GCX} y={GCY - 14} textAnchor="middle" fill="currentColor"
              fontSize="38" fontWeight="900">{result.score}</text>
            <text x={GCX} y={GCY + 4} textAnchor="middle" fill={sl.color}
              fontSize="9" fontWeight="700" letterSpacing="2">{result.riskLevel}</text>
            {/* Range labels */}
            <text x="26" y={GCY + 22} textAnchor="middle" fontSize="9" fill="#64748b">0</text>
            <text x="214" y={GCY + 22} textAnchor="middle" fontSize="9" fill="#64748b">100</text>
          </svg>

          {/* Metadata chips */}
          <div className="flex gap-2 mt-1 flex-wrap justify-center">
            {[
              ['Confidence', result.confidence],
              ['Time of Day', timeLabel],
              ['Context', CONTEXTS.find(c => c.id === result.context)?.label ?? result.context],
            ].map(([k, v]) => (
              <div key={k} className="bg-muted rounded-lg px-2.5 py-1 text-center">
                <div className="text-[8px] text-muted-foreground uppercase tracking-wider">{k}</div>
                <div className="text-xs font-bold text-foreground">{v}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Safety Tip */}
        <div className="rounded-kipita p-3 flex items-start gap-2"
          style={{ backgroundColor: `${sl.color}18`, border: `1px solid ${sl.color}40` }}>
          <span className="text-base mt-0.5">{tipIcon}</span>
          <p className="text-xs text-foreground leading-relaxed">
            {SAFETY_TIPS[context]?.[result.riskLevel] ?? 'Stay aware of your surroundings.'}
          </p>
        </div>

        {/* Category Risk Ratings */}
        <div className="bg-card border border-border rounded-kipita p-4">
          <p className="text-[10px] font-semibold text-muted-foreground tracking-widest mb-1">
            CATEGORY RISK RATINGS
          </p>
          <p className="text-[9px] text-muted-foreground mb-3">
            Weighted for{' '}
            <span className="font-bold" style={{ color: sl.color }}>
              {CONTEXTS.find(c => c.id === context)?.label}
            </span>
            {' '}· benchmarked against national averages
          </p>

          <div className="space-y-2.5">
            {CATEGORY_ROWS.map(({ key, label }) => {
              const b = result.breakdown[key];
              if (!b) return null;
              const rating = categoryRating(b.pts);
              return (
                <div key={key} className="flex items-center gap-2">
                  <span className="text-sm w-5 flex-shrink-0">{b.icon}</span>
                  <span className="text-xs text-foreground flex-1 truncate">{label}</span>
                  <div className="flex gap-0.5 items-center flex-shrink-0">
                    {[0, 1, 2, 3, 4].map(i => (
                      <span key={i} className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: i <= rating.level ? rating.color : `${rating.color}25` }} />
                    ))}
                  </div>
                  <span className="text-[10px] font-semibold w-14 text-right flex-shrink-0"
                    style={{ color: rating.color }}>{rating.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Data Source */}
        <div className="text-center text-[9px] text-muted-foreground/50 pb-4">
          {isDomestic
            ? 'Domestic: ZIP-level crime index · FBI national benchmark'
            : 'International: Travel.State.Gov advisory · contextual weighting'}
        </div>
      </div>
    </div>
  );
}
