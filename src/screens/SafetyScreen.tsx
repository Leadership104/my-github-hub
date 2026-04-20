import { useState, useEffect, useCallback } from 'react';
import {
  computeSafetyScore, advisoryToBaseRates, detectTimeOfDay, safetyLevel,
  getEmergencyContacts, getScamAlerts, getHealthInfo,
  type SafetyContext, type SafetyResult,
} from '../lib/safetyEngine';

const CONTEXTS: { id: SafetyContext; label: string; icon: string }[] = [
  { id: 'HOME',    label: 'At Home',   icon: '🏠' },
  { id: 'AWAY',    label: 'Traveling', icon: '✈️' },
  { id: 'TRANSIT', label: 'In Transit', icon: '🚗' },
];

const DENSITY_OPTIONS: { id: string; label: string }[] = [
  { id: 'tourist_heavy', label: 'Tourist area' },
  { id: 'commercial',    label: 'City center' },
  { id: 'residential',   label: 'Residential' },
  { id: 'rural',         label: 'Rural / remote' },
];

const HEADLINES: Record<string, string> = {
  'LOW RISK': 'Looks safe right now',
  MODERATE:   'Generally okay — stay aware',
  ELEVATED:   'Be extra careful here',
  'HIGH RISK': 'High risk — take precautions',
  CRITICAL:   'Avoid if possible',
};

const TIER_COLORS: Record<string, string> = {
  personal: '#ef4444',
  property: '#f97316',
  transit:  '#a855f7',
  environ:  '#3b82f6',
};
const TIER_LABELS: Record<string, string> = {
  personal: 'Personal Safety',
  property: 'Property Crime',
  transit:  'Transit Risk',
  environ:  'Environment',
};

const SAFETY_TIPS: Record<SafetyContext, Record<string, string>> = {
  HOME: {
    'LOW RISK':  'Your home area appears safe. Continue standard precautions.',
    MODERATE:    'Be mindful of property security and neighborhood activity.',
    ELEVATED:    'Consider enhanced home security. Stay alert to local advisories.',
    'HIGH RISK': 'Stay vigilant. Keep doors locked and be cautious of strangers.',
    CRITICAL:    'Exercise extreme caution. Avoid leaving home unnecessarily.',
  },
  AWAY: {
    'LOW RISK':  'This area appears safe for travelers. Enjoy your visit.',
    MODERATE:    'Keep valuables secure and stay in well-lit, populated areas.',
    ELEVATED:    'Avoid isolated areas and stay aware of surroundings at all times.',
    'HIGH RISK': 'Travel in groups when possible. Keep emergency contacts accessible.',
    CRITICAL:    'Reconsider travel to this area. Consult local authorities if present.',
  },
  TRANSIT: {
    'LOW RISK':  'Roads and transit appear safe for your journey.',
    MODERATE:    'Secure your vehicle and stay aware of surroundings en route.',
    ELEVATED:    'Plan your route carefully. Avoid travel after dark if possible.',
    'HIGH RISK': 'Stay on main roads and keep doors locked while driving.',
    CRITICAL:    'Avoid travel if possible. Emergency services may be limited.',
  },
};

interface Props {
  locationName: string;
  countryCode?: string;
  advisoryScore?: number;
  onBack: () => void;
}

const TREND_KEY = 'kip_safety_trend_v1';
type TrendEntry = { date: string; score: number };

function loadTrend(key: string): TrendEntry[] {
  try {
    const raw = localStorage.getItem(TREND_KEY);
    const all = raw ? JSON.parse(raw) : {};
    return Array.isArray(all[key]) ? all[key] : [];
  } catch { return []; }
}
function saveTrend(key: string, entries: TrendEntry[]) {
  try {
    const raw = localStorage.getItem(TREND_KEY);
    const all = raw ? JSON.parse(raw) : {};
    all[key] = entries.slice(-30);
    localStorage.setItem(TREND_KEY, JSON.stringify(all));
  } catch { /* ignore quota */ }
}

export default function SafetyScreen({ locationName, countryCode, advisoryScore, onBack }: Props) {
  const [context, setContext]     = useState<SafetyContext>('AWAY');
  const [density, setDensity]     = useState('residential');
  const [result, setResult]       = useState<SafetyResult | null>(null);
  const [trend, setTrend]         = useState<TrendEntry[]>([]);
  const [expandScams, setExpandScams] = useState(false);

  const trendKey = `${(countryCode || 'XX').toUpperCase()}|${locationName}|${context}`;

  const compute = useCallback(() => {
    const baseRates = advisoryToBaseRates(advisoryScore ?? 2.5);
    const timeOfDay = detectTimeOfDay();
    const r = computeSafetyScore({
      context,
      incidents: [],
      situational: { timeOfDay, density, events: 'none', weather: 'normal' },
      baseRates,
    });
    setResult(r);

    const today = new Date().toISOString().slice(0, 10);
    const existing = loadTrend(trendKey);
    const next = [...existing.filter(e => e.date !== today), { date: today, score: r.score }];
    saveTrend(trendKey, next);
    setTrend(next);
  }, [context, density, advisoryScore, trendKey]);

  useEffect(() => { compute(); }, [compute]);

  if (!result) return null;

  const sl           = safetyLevel(result.score);
  const emergency    = getEmergencyContacts(countryCode);
  const scams        = getScamAlerts(countryCode);
  const health       = getHealthInfo(countryCode);
  const topRisks     = Object.entries(result.breakdown)
    .sort((a, b) => b[1].pts - a[1].pts)
    .filter(([, v]) => v.pts > 0)
    .slice(0, 6);

  const prior       = trend.length > 1 ? trend[trend.length - 2] : null;
  const delta       = prior ? result.score - prior.score : 0;
  const trendLabel  = !prior
    ? 'First reading — building history'
    : delta > 1  ? `Safer than last reading (+${delta})`
    : delta < -1 ? `Less safe than last reading (${delta})`
    : 'Stable vs last reading';
  const trendColor  = delta > 1 ? '#22c55e' : delta < -1 ? '#ef4444' : '#64748b';

  // Sparkline
  const history = trend.slice(-14);
  const spW = 240, spH = 44, spPad = 4;
  const spPath = history.length > 1
    ? history.map((e, i) => {
        const x = spPad + (i / (history.length - 1)) * (spW - spPad * 2);
        const y = spPad + ((100 - e.score) / 100) * (spH - spPad * 2);
        return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      }).join(' ')
    : '';
  // Filled area under sparkline
  const spAreaPath = history.length > 1
    ? `${spPath} L ${(spPad + (spW - spPad * 2)).toFixed(1)} ${spH} L ${spPad} ${spH} Z`
    : '';

  // Gauge
  const W = 260, H = 150, cx = W / 2, cy = 130, R = 95;
  const polar = (deg: number) => {
    const rad = (deg * Math.PI) / 180;
    return { x: cx + R * Math.cos(rad), y: cy + R * Math.sin(rad) };
  };
  const pct    = Math.max(0, Math.min(100, result.score)) / 100;
  const p0     = polar(180);
  const pScore = polar(180 + 180 * pct);
  const pFull  = polar(360);
  const bgPath    = `M ${p0.x} ${p0.y} A ${R} ${R} 0 0 1 ${pFull.x} ${pFull.y}`;
  const scorePath = `M ${p0.x} ${p0.y} A ${R} ${R} 0 0 1 ${pScore.x} ${pScore.y}`;

  const medicalIcon = health?.medicalQuality === 'excellent' ? '🏥' : health?.medicalQuality === 'good' ? '🏥' : health?.medicalQuality === 'fair' ? '⚕️' : '⚠️';
  const medicalLabel = { excellent: 'World-class', good: 'Good quality', fair: 'Basic care', limited: 'Very limited' }[health?.medicalQuality ?? 'fair'];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-br from-kipita-navy to-[#16213e] px-4 py-3 flex items-center gap-3 flex-shrink-0">
        <button onClick={onBack} className="text-white/70 hover:text-white transition-colors">
          <span className="ms text-xl">arrow_back</span>
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-bold truncate">Safety — {locationName}</p>
          <p className="text-white/50 text-[10px]">
            Live · {countryCode || 'Global'} · Safety Engine v3.0
          </p>
        </div>
        {/* Advisory badge */}
        {advisoryScore != null && (
          <div className="flex-shrink-0 px-2 py-1 rounded-lg text-center"
            style={{ backgroundColor: `${sl.color}22`, border: `1px solid ${sl.color}55` }}>
            <div className="text-[9px] text-white/50 leading-none">Advisory</div>
            <div className="text-xs font-bold leading-tight" style={{ color: sl.color }}>
              {advisoryScore.toFixed(1)}/5
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 pb-24 space-y-3">

        {/* Context Selector */}
        <div className="flex gap-2">
          {CONTEXTS.map(c => (
            <button key={c.id} onClick={() => setContext(c.id)}
              className={`flex-1 flex flex-col items-center gap-1 p-3 rounded-kipita border transition-all ${
                context === c.id
                  ? 'border-kipita-red bg-kipita-red/10'
                  : 'border-border bg-card hover:bg-muted'
              }`}>
              <span className="text-xl">{c.icon}</span>
              <span className="text-[10px] font-bold text-foreground">{c.label}</span>
            </button>
          ))}
        </div>

        {/* Density selector */}
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
          {DENSITY_OPTIONS.map(d => (
            <button key={d.id} onClick={() => setDensity(d.id)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-[10px] font-semibold border transition-all ${
                density === d.id
                  ? 'bg-kipita-navy text-white border-kipita-navy'
                  : 'bg-card text-muted-foreground border-border hover:border-kipita-navy/40'
              }`}>
              {d.label}
            </button>
          ))}
        </div>

        {/* Score Gauge */}
        <div className="bg-card border border-border rounded-kipita p-5 flex flex-col items-center">
          <p className="text-[10px] font-semibold text-muted-foreground tracking-widest">SAFETY SCORE</p>
          <p className="text-[10px] text-muted-foreground mb-2">Higher is safer · 0–100</p>

          <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="mb-1">
            <path d={bgPath} fill="none" stroke="hsl(var(--muted))" strokeWidth={14} strokeLinecap="round" />
            <path d={scorePath} fill="none" stroke={sl.color} strokeWidth={14} strokeLinecap="round"
              style={{ filter: `drop-shadow(0 0 8px ${sl.color}aa)`, transition: 'all 0.8s ease' }} />
            <circle cx={pScore.x} cy={pScore.y} r={8} fill={sl.color}
              style={{ filter: `drop-shadow(0 0 6px ${sl.color})`, transition: 'all 0.8s ease' }} />
            <text x={cx} y={cy - 18} textAnchor="middle" fontSize="46" fontWeight="800"
              className="fill-foreground">{result.score}</text>
            <text x={cx} y={cy} textAnchor="middle" fontSize="10" fontWeight="700"
              fill={sl.color} letterSpacing="2">{result.riskLevel}</text>
            <text x={p0.x} y={p0.y + 18} textAnchor="middle" fontSize="9" className="fill-muted-foreground">0</text>
            <text x={pFull.x} y={pFull.y + 18} textAnchor="middle" fontSize="9" className="fill-muted-foreground">100</text>
          </svg>

          <div className="flex items-center justify-between w-full mt-2 px-1">
            {[
              { color: '#ef4444', label: 'Unsafe' },
              { color: '#f97316', label: 'Risky' },
              { color: '#eab308', label: 'Moderate' },
              { color: '#84cc16', label: 'Safer' },
              { color: '#22c55e', label: 'Safe' },
            ].map((d, i) => (
              <div key={i} className="flex flex-col items-center gap-1 flex-1">
                <span className="w-2.5 h-2.5 rounded-full transition-all"
                  style={{
                    backgroundColor: sl.level >= i ? d.color : `${d.color}30`,
                    boxShadow: sl.level === i ? `0 0 8px ${d.color}` : 'none',
                  }} />
                <span className="text-[8px] text-muted-foreground">{d.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Headline advice */}
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
          <div className="flex gap-2 mt-3 flex-wrap">
            <span className="text-[10px] bg-muted text-foreground rounded-full px-2.5 py-1">
              {CONTEXTS.find(c => c.id === result.context)?.icon} {CONTEXTS.find(c => c.id === result.context)?.label}
            </span>
            <span className="text-[10px] bg-muted text-foreground rounded-full px-2.5 py-1">
              🕒 {detectTimeOfDay() === 'daytime' ? 'Daytime' : detectTimeOfDay() === 'evening' ? 'Evening' : 'Night'}
            </span>
            <span className="text-[10px] bg-muted text-foreground rounded-full px-2.5 py-1">
              🎯 {result.confidence} confidence
            </span>
          </div>
        </div>

        {/* Emergency Contacts — prominent */}
        {emergency && (
          <div className="bg-card border-2 border-red-500/30 rounded-kipita p-4">
            <p className="text-[10px] font-semibold text-red-400 tracking-widest mb-3">🆘 EMERGENCY CONTACTS</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: '🚔 Police', number: emergency.police },
                { label: '🚑 Ambulance', number: emergency.ambulance },
                { label: '🚒 Fire', number: emergency.fire },
              ].map(({ label, number }) => (
                <a key={label} href={`tel:${number}`}
                  className="flex flex-col items-center gap-1 p-2 bg-red-500/10 border border-red-500/20 rounded-xl hover:bg-red-500/20 transition-colors active:scale-95">
                  <span className="text-xs font-bold text-foreground">{label}</span>
                  <span className="text-sm font-extrabold text-red-400">{number}</span>
                </a>
              ))}
            </div>
            {emergency.tourist && (
              <a href={`tel:${emergency.tourist}`}
                className="flex items-center justify-between mt-2 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-xl hover:bg-amber-500/20 transition-colors">
                <span className="text-xs font-semibold text-foreground">🎫 Tourist Police</span>
                <span className="text-sm font-bold text-amber-400">{emergency.tourist}</span>
              </a>
            )}
          </div>
        )}

        {/* Health & Medical */}
        {health && (
          <div className="bg-card border border-border rounded-kipita p-4">
            <p className="text-[10px] font-semibold text-muted-foreground tracking-widest mb-3">🏥 HEALTH & MEDICAL</p>
            <div className="flex items-start gap-3 mb-3">
              <span className="text-2xl">{medicalIcon}</span>
              <div>
                <p className="text-xs font-bold text-foreground">{medicalLabel} medical care</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {health.waterSafe ? '✅' : '⚠️'} {health.waterNote}
                </p>
              </div>
            </div>
            {health.vaccines.length > 0 && (
              <div className="mb-2">
                <p className="text-[9px] font-semibold text-muted-foreground mb-1">RECOMMENDED VACCINES</p>
                <div className="flex gap-1.5 flex-wrap">
                  {health.vaccines.map(v => (
                    <span key={v} className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full px-2 py-0.5">{v}</span>
                  ))}
                </div>
              </div>
            )}
            {health.risks.length > 0 && (
              <div className="space-y-1">
                {health.risks.map(r => (
                  <div key={r} className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span className="w-1 h-1 rounded-full bg-amber-500 flex-shrink-0" />
                    {r}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Scam Alerts */}
        {scams.length > 0 && (
          <div className="bg-card border border-border rounded-kipita p-4">
            <button
              onClick={() => setExpandScams(v => !v)}
              className="flex items-center justify-between w-full"
            >
              <p className="text-[10px] font-semibold text-amber-400 tracking-widest">⚠️ KNOWN SCAMS ({scams.length})</p>
              <span className="ms text-sm text-muted-foreground">{expandScams ? 'expand_less' : 'expand_more'}</span>
            </button>
            {expandScams && (
              <div className="mt-3 space-y-3">
                {scams.map((s, i) => (
                  <div key={i} className="flex gap-3">
                    <span className={`flex-shrink-0 w-1.5 h-1.5 rounded-full mt-1.5 ${s.severity === 'high' ? 'bg-red-500' : s.severity === 'medium' ? 'bg-amber-500' : 'bg-blue-400'}`} />
                    <div>
                      <p className="text-xs font-bold text-foreground">{s.title}</p>
                      <p className="text-[10px] text-muted-foreground leading-relaxed mt-0.5">{s.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {!expandScams && (
              <p className="text-[10px] text-muted-foreground mt-2">
                Tap to see {scams.length} known scam{scams.length > 1 ? 's' : ''} in {countryCode}
              </p>
            )}
          </div>
        )}

        {/* Risk Breakdown */}
        <div className="bg-card border border-border rounded-kipita p-4">
          <p className="text-[10px] font-semibold text-muted-foreground tracking-widest mb-1">TOP RISK FACTORS</p>
          <p className="text-[9px] text-muted-foreground mb-3">
            For <span className="font-bold" style={{ color: sl.color }}>
              {CONTEXTS.find(c => c.id === context)?.label}
            </span> — higher bars = greater relative risk
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
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
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
          <div className="flex gap-2 mt-3 flex-wrap">
            {Object.entries(TIER_COLORS).map(([t, c]) => (
              <span key={t} className="text-[9px] font-medium rounded-md px-1.5 py-0.5"
                style={{ color: c, backgroundColor: `${c}18` }}>
                ● {TIER_LABELS[t] ?? t}
              </span>
            ))}
          </div>
        </div>

        {/* Safety Trend */}
        <div className="bg-card border border-border rounded-kipita p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-semibold text-muted-foreground tracking-widest">14-DAY TREND</p>
            <span className="text-[10px] font-bold" style={{ color: trendColor }}>
              {delta > 0 ? `▲ +${delta}` : delta < 0 ? `▼ ${delta}` : '— 0'}
            </span>
          </div>
          <p className="text-xs text-foreground mb-2">{trendLabel}</p>
          {history.length > 1 ? (
            <svg width="100%" height={spH} viewBox={`0 0 ${spW} ${spH}`} preserveAspectRatio="none">
              <defs>
                <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={sl.color} stopOpacity="0.3" />
                  <stop offset="100%" stopColor={sl.color} stopOpacity="0.02" />
                </linearGradient>
              </defs>
              <path d={spAreaPath} fill="url(#sparkGrad)" />
              <path d={spPath} fill="none" stroke={sl.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <p className="text-[10px] text-muted-foreground italic">
              Visit on different days to build a trend for {locationName}.
            </p>
          )}
          <p className="text-[9px] text-muted-foreground/70 mt-1">
            {history.length} reading{history.length !== 1 ? 's' : ''} · {locationName} · {CONTEXTS.find(c => c.id === context)?.label}
          </p>
        </div>

        {/* Footer */}
        <div className="text-center text-[9px] text-muted-foreground/50 pb-4">
          Kipita Safety Engine v3.0 · travel-advisory.info + contextual weighting + live data
        </div>
      </div>
    </div>
  );
}
