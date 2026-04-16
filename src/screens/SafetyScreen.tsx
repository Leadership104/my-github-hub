import { useState, useEffect, useCallback } from 'react';
import {
  computeSafetyScore, advisoryToBaseRates, detectTimeOfDay, safetyLevel,
  CRIME_CATEGORIES, CONTEXT_WEIGHTS, SITUATIONAL_MULTIPLIERS,
  type SafetyContext, type SafetyResult,
} from '../lib/safetyEngine';

const CONTEXTS: { id: SafetyContext; label: string; icon: string; desc: string }[] = [
  { id: 'HOME', label: 'At Home', icon: '🏠', desc: 'In your residence' },
  { id: 'AWAY', label: 'Traveling', icon: '✈️', desc: 'Away from home' },
  { id: 'TRANSIT', label: 'In Transit', icon: '🚗', desc: 'Driving or commuting' },
];

const TIER_COLORS: Record<string, string> = {
  personal: '#ef4444', property: '#f97316', transit: '#a855f7', environ: '#3b82f6',
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

  /* SVG gauge */
  const gaugeR = 70, cx = 90, cy = 90;
  const startA = 210, endA = -30;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const arcX = (a: number, r: number) => cx + r * Math.cos(toRad(a));
  const arcY = (a: number, r: number) => cy + r * Math.sin(toRad(a));
  const sweep = (startA - endA) * (result.score / 100);
  const needleA = startA - sweep;

  const bgPath = `M ${arcX(startA, gaugeR)} ${arcY(startA, gaugeR)} A ${gaugeR} ${gaugeR} 0 1 1 ${arcX(endA, gaugeR)} ${arcY(endA, gaugeR)}`;
  const scorePath = `M ${arcX(startA, gaugeR)} ${arcY(startA, gaugeR)} A ${gaugeR} ${gaugeR} 0 ${sweep > 180 ? 1 : 0} 1 ${arcX(needleA, gaugeR)} ${arcY(needleA, gaugeR)}`;

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
              ['Multiplier', `${result.sitMul}×`],
              ['Time', detectTimeOfDay()],
            ].map(([k, v]) => (
              <div key={k} className="bg-muted rounded-lg px-2.5 py-1 text-center">
                <div className="text-[8px] text-muted-foreground uppercase tracking-wider">{k}</div>
                <div className="text-xs font-bold text-foreground">{v}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Risk Factors */}
        <div className="bg-card border border-border rounded-kipita p-4">
          <p className="text-[10px] font-semibold text-muted-foreground tracking-widest mb-1">TOP RISK FACTORS</p>
          <p className="text-[9px] text-muted-foreground mb-3">
            Weights adjusted for <span className="font-bold" style={{ color: sl.color }}>
              {CONTEXTS.find(c => c.id === context)?.label}
            </span> context
          </p>

          <div className="space-y-3">
            {topRisks.map(([key, val]) => {
              const barW = Math.min((val.pts / 15) * 100, 100);
              const tc = TIER_COLORS[val.tier] ?? '#64748b';
              return (
                <div key={key}>
                  <div className="flex justify-between mb-1">
                    <span className="text-xs text-foreground">{val.icon} {val.label}</span>
                    <span className="text-[10px] font-bold" style={{ color: tc }}>−{val.pts} pts</span>
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
                ● {t}
              </span>
            ))}
          </div>
        </div>

        {/* Context Weight Comparison */}
        <div className="bg-card border border-border rounded-kipita p-4">
          <p className="text-[10px] font-semibold text-muted-foreground tracking-widest mb-3">
            HOME vs AWAY vs TRANSIT — WEIGHT COMPARISON
          </p>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(CRIME_CATEGORIES).slice(0, 8).map(([k, cat]) => {
              const hw = CONTEXT_WEIGHTS.HOME[k] ?? 0;
              const aw = CONTEXT_WEIGHTS.AWAY[k] ?? 0;
              const tw = CONTEXT_WEIGHTS.TRANSIT[k] ?? 0;
              return (
                <div key={k} className="bg-muted rounded-lg p-2">
                  <p className="text-[10px] text-foreground font-medium mb-1 truncate">{cat.icon} {cat.label}</p>
                  {[
                    { icon: '🏠', id: 'HOME' as SafetyContext, w: hw, c: '#3b82f6' },
                    { icon: '✈️', id: 'AWAY' as SafetyContext, w: aw, c: '#a855f7' },
                    { icon: '🚗', id: 'TRANSIT' as SafetyContext, w: tw, c: '#f59e0b' },
                  ].map(r => (
                    <div key={r.id} className="flex items-center gap-1 mb-0.5">
                      <span className="text-[8px] text-muted-foreground w-5">{r.icon}</span>
                      <div className="flex-1 h-1 bg-background rounded-full">
                        <div className="h-full rounded-full transition-all"
                          style={{
                            width: `${r.w * 100}%`,
                            backgroundColor: r.c,
                            opacity: context === r.id ? 1 : 0.3,
                          }} />
                      </div>
                      <span className="text-[8px] w-5 text-right"
                        style={{ color: context === r.id ? r.c : '#64748b', fontWeight: context === r.id ? 700 : 400 }}>
                        {(r.w * 100).toFixed(0)}
                      </span>
                    </div>
                  ))}
                </div>
              );
            })}
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
