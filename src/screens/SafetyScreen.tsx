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
          <p className="text-white/50 text-[10px]">Your safety, explained simply</p>
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

        {/* Score Gauge — credit-score style */}
        <div className="bg-card border border-border rounded-kipita p-5 flex flex-col items-center">
          <p className="text-[10px] font-semibold text-muted-foreground tracking-widest">SAFETY SCORE</p>
          <p className="text-[10px] text-muted-foreground mb-2">Higher is safer · 0–100</p>

          <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="mb-1">
            <path d={bgPath} fill="none" stroke="hsl(var(--muted))" strokeWidth={14} strokeLinecap="round" />
            <path d={scorePath} fill="none" stroke={sl.color} strokeWidth={14} strokeLinecap="round"
              style={{ filter: `drop-shadow(0 0 8px ${sl.color}aa)`, transition: 'all 0.7s ease' }} />
            <circle cx={pScore.x} cy={pScore.y} r={8} fill={sl.color}
              style={{ filter: `drop-shadow(0 0 4px ${sl.color})`, transition: 'all 0.7s ease' }} />
            <text x={cx} y={cy - 18} textAnchor="middle" fontSize="46" fontWeight="800"
              className="fill-foreground">{result.score}</text>
            <text x={cx} y={cy} textAnchor="middle" fontSize="10" fontWeight="700"
              fill={sl.color} letterSpacing="2">{result.riskLevel}</text>
            <text x={p0.x} y={p0.y + 18} textAnchor="middle" fontSize="9"
              className="fill-muted-foreground">0</text>
            <text x={pFull.x} y={pFull.y + 18} textAnchor="middle" fontSize="9"
              className="fill-muted-foreground">100</text>
          </svg>

          {/* 5-level scale legend */}
          <div className="flex items-center justify-between w-full mt-2 px-1">
            {[
              { threshold: 0, color: '#ef4444', label: 'Unsafe' },
              { threshold: 1, color: '#f97316', label: 'Risky' },
              { threshold: 2, color: '#eab308', label: 'Moderate' },
              { threshold: 3, color: '#84cc16', label: 'Safer' },
              { threshold: 4, color: '#22c55e', label: 'Safe' },
            ].map((d) => (
              <div key={d.threshold} className="flex flex-col items-center gap-1 flex-1">
                <span className="w-2.5 h-2.5 rounded-full transition-all"
                  style={{
                    backgroundColor: sl.level >= d.threshold ? d.color : `${d.color}30`,
                    boxShadow: sl.level === d.threshold ? `0 0 8px ${d.color}` : 'none',
                  }} />
                <span className="text-[8px] text-muted-foreground">{d.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Plain-English headline + advice (ChatGPT-style: calm, clear) */}
        <div className="bg-card border border-border rounded-kipita p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl mt-0.5">
              {result.score >= 80 ? '✅' : result.score >= 60 ? '⚠️' : result.score >= 40 ? '🟠' : '🔴'}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-foreground mb-1">
                {HEADLINES[result.riskLevel] ?? 'Stay aware'}
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {SAFETY_TIPS[context]?.[result.riskLevel] ?? 'Stay aware of your surroundings.'}
              </p>
            </div>
          </div>

          {/* Quick context chips */}
          <div className="flex gap-2 mt-3 flex-wrap">
            <span className="text-[10px] bg-muted text-foreground rounded-full px-2.5 py-1">
              📍 {CONTEXTS.find(c => c.id === result.context)?.label}
            </span>
            <span className="text-[10px] bg-muted text-foreground rounded-full px-2.5 py-1">
              🕒 {detectTimeOfDay() === 'daytime' ? 'Daytime' : detectTimeOfDay() === 'evening' ? 'Evening' : 'Night'}
            </span>
            <span className="text-[10px] bg-muted text-foreground rounded-full px-2.5 py-1">
              🎯 {result.confidence} confidence
            </span>
          </div>
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
