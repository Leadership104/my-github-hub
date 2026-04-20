import { useState, useEffect, useCallback } from 'react';
import {
  computeSafetyScore, advisoryToBaseRates, detectTimeOfDay, safetyLevel,
  type SafetyContext, type SafetyResult,
} from '../lib/safetyEngine';

const CONTEXTS: { id: SafetyContext; label: string; icon: string; desc: string }[] = [
  { id: 'HOME', label: 'At Home', icon: '🏠', desc: 'In your residence' },
  { id: 'AWAY', label: 'Traveling', icon: '✈️', desc: 'Away from home' },
  { id: 'TRANSIT', label: 'In Transit', icon: '🚗', desc: 'Driving or commuting' },
];

// Friendlier plain-English headlines (ChatGPT-style: calm, direct, helpful)
const HEADLINES: Record<string, string> = {
  'LOW RISK': 'Looks safe right now',
  MODERATE: 'Generally okay — stay aware',
  ELEVATED: 'Be extra careful here',
  'HIGH RISK': 'High risk — take precautions',
  CRITICAL: 'Avoid if possible',
};

const TIER_COLORS: Record<string, string> = {
  personal: '#ef4444', property: '#f97316', transit: '#a855f7', environ: '#3b82f6',
};

const TIER_LABELS: Record<string, string> = {
  personal: 'Personal Safety', property: 'Property Crime',
  transit: 'Transit Risk', environ: 'Environment',
};

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

interface Props {
  locationName: string;
  countryCode?: string;
  advisoryScore?: number;
  onBack: () => void;
}

export default function SafetyScreen({ locationName, countryCode, advisoryScore, onBack }: Props) {
  const [context, setContext] = useState<SafetyContext>('AWAY');
  const [result, setResult] = useState<SafetyResult | null>(null);

  const compute = useCallback(() => {
    const baseRates = advisoryToBaseRates(advisoryScore ?? 2.5);
    const timeOfDay = detectTimeOfDay();
    const r = computeSafetyScore({
      context,
      incidents: [],
      situational: { timeOfDay, density: 'residential', events: 'none', weather: 'normal' },
      baseRates,
    });
    setResult(r);
  }, [context, advisoryScore]);

  useEffect(() => { compute(); }, [compute]);

  if (!result) return null;

  const sl = safetyLevel(result.score);
  const topRisks = Object.entries(result.breakdown)
    .sort((a, b) => b[1].pts - a[1].pts)
    .filter(([, v]) => v.pts > 0)
    .slice(0, 6);

  /* Credit-score style semicircle gauge (180° arc, left→right over the top) */
  const W = 260, H = 150;
  const cx = W / 2, cy = 130, R = 95;
  const polar = (deg: number) => {
    const rad = (deg * Math.PI) / 180;
    return { x: cx + R * Math.cos(rad), y: cy + R * Math.sin(rad) };
  };
  // Score 0..100 → angle 180° (left) sweeping to 360° (right), passing 270° (top)
  const pct = Math.max(0, Math.min(100, result.score)) / 100;
  const p0 = polar(180);
  const pScore = polar(180 + 180 * pct);
  const pFull = polar(360);
  const bgPath = `M ${p0.x} ${p0.y} A ${R} ${R} 0 0 1 ${pFull.x} ${pFull.y}`;
  const scorePath = `M ${p0.x} ${p0.y} A ${R} ${R} 0 0 1 ${pScore.x} ${pScore.y}`;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-br from-kipita-navy to-[#16213e] px-4 py-3 flex items-center gap-3 flex-shrink-0">
        <button onClick={onBack} className="text-white/70 hover:text-white">
          <span className="ms text-xl">arrow_back</span>
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-bold truncate">Safety — {locationName}</p>
          <p className="text-white/50 text-[10px]">Kipita Safety Intelligence Engine</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 pb-24 space-y-4">
        {/* Context Selector */}
        <div className="flex gap-2">
          {CONTEXTS.map(c => (
            <button key={c.id} onClick={() => setContext(c.id)}
              className={`flex-1 flex flex-col items-center gap-1 p-3 rounded-kipita border transition-all ${
                context === c.id
                  ? 'border-kipita-red bg-kipita-red/10'
                  : 'border-border bg-card'
              }`}>
              <span className="text-xl">{c.icon}</span>
              <span className="text-[10px] font-bold text-foreground">{c.label}</span>
            </button>
          ))}
        </div>

        {/* Score Gauge */}
        <div className="bg-card border border-border rounded-kipita p-5 flex flex-col items-center">
          <p className="text-[10px] font-semibold text-muted-foreground tracking-widest mb-2">COMPOSITE SAFETY INDEX</p>
          <svg width="180" height="120" className="mb-1">
            <path d={bgPath} fill="none" stroke="hsl(var(--muted))" strokeWidth={12} strokeLinecap="round" />
            <path d={scorePath} fill="none" stroke={sl.color} strokeWidth={12} strokeLinecap="round"
              style={{ filter: `drop-shadow(0 0 6px ${sl.color}88)`, transition: 'all 0.6s' }} />
            <text x={cx} y={cy + 6} textAnchor="middle" fill="currentColor" fontSize="30" fontWeight="800"
              className="text-foreground">{result.score}</text>
            <text x={cx} y={cy + 22} textAnchor="middle" fill={sl.color} fontSize="9" fontWeight="700"
              letterSpacing="2">{result.riskLevel}</text>
          </svg>

          {/* 5-level dots */}
          <div className="flex items-center gap-2 mt-1">
            {[
              { threshold: 0, color: '#ef4444', label: 'Unsafe' },
              { threshold: 1, color: '#f97316', label: 'Risky' },
              { threshold: 2, color: '#eab308', label: 'Moderate' },
              { threshold: 3, color: '#84cc16', label: 'Safer' },
              { threshold: 4, color: '#22c55e', label: 'Safe' },
            ].map((d, i) => (
              <div key={i} className="flex flex-col items-center gap-0.5">
                <span className="w-3 h-3 rounded-full transition-all"
                  style={{
                    backgroundColor: sl.level >= d.threshold ? d.color : `${d.color}30`,
                    boxShadow: sl.level === d.threshold ? `0 0 8px ${d.color}` : 'none',
                  }} />
                <span className="text-[7px] text-muted-foreground">{d.label}</span>
              </div>
            ))}
          </div>

          {/* Metadata chips */}
          <div className="flex gap-2 mt-3 flex-wrap justify-center">
            {[
              ['Confidence', result.confidence],
              ['Time of Day', detectTimeOfDay() === 'daytime' ? 'Daytime' : detectTimeOfDay() === 'evening' ? 'Evening' : 'Night'],
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
          <span className="text-base mt-0.5">
            {result.score >= 80 ? '✅' : result.score >= 60 ? '⚠️' : result.score >= 40 ? '🟠' : '🔴'}
          </span>
          <p className="text-xs text-foreground leading-relaxed">
            {SAFETY_TIPS[context]?.[result.riskLevel] ?? 'Stay aware of your surroundings.'}
          </p>
        </div>

        {/* Top Risk Factors */}
        <div className="bg-card border border-border rounded-kipita p-4">
          <p className="text-[10px] font-semibold text-muted-foreground tracking-widest mb-1">TOP RISK FACTORS</p>
          <p className="text-[9px] text-muted-foreground mb-3">
            For <span className="font-bold" style={{ color: sl.color }}>
              {CONTEXTS.find(c => c.id === context)?.label}
            </span> — higher bars indicate greater relative risk
          </p>

          <div className="space-y-3">
            {topRisks.map(([key, val]) => {
              const barW = Math.min((val.pts / 15) * 100, 100);
              const tc = TIER_COLORS[val.tier] ?? '#64748b';
              return (
                <div key={key}>
                  <div className="flex justify-between mb-1">
                    <span className="text-xs text-foreground">{val.icon} {val.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-muted rounded-full">
                      <div className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${barW}%`, backgroundColor: tc, boxShadow: `0 0 4px ${tc}66` }} />
                    </div>
                    <span className="text-[9px] text-muted-foreground w-8">
                      {(val.contextWeight * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Tier legend */}
          <div className="flex gap-2 mt-3 flex-wrap">
            {Object.entries(TIER_COLORS).map(([t, c]) => (
              <span key={t} className="text-[9px] font-medium rounded-md px-1.5 py-0.5"
                style={{ color: c, backgroundColor: `${c}18` }}>
                ● {TIER_LABELS[t] ?? t}
              </span>
            ))}
          </div>
        </div>

        {/* Data Source */}
        <div className="text-center text-[9px] text-muted-foreground/50 pb-4">
          Kipita Safety Engine v2.0 · Data: travel-advisory.info + contextual weighting
        </div>
      </div>
    </div>
  );
}
