/**
 * Kipita Live Travel Safety Screen — v3.0
 * Institutional-grade safety intelligence UI.
 * Conservative language, hard caps, multi-source advisories, neighborhood risk.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../integrations/supabase/client';
import {
  computeTravelSafetyScore, getRiskColor, adaptBackendPayload,
  type TravelSafetyResult, type TravelerWarning, type NeighborhoodWarning,
  type RiskBand, type BackendPayload as EngineBackendPayload, ADVISORY_LABELS,
} from '../lib/travelSafetyEngine';

/* ── Types from backend ─────────────────────────────────────────────────── */
interface BackendPayload {
  source: 'LIVE_AGGREGATE' | 'FALLBACK';
  coords?: { lat: number; lon: number } | null;
  rates?: Record<string, number>;
  signals?: {
    conflict?: {
      severity: number; tier: string; events30d: number; fatalities30d: number;
      sanctioned?: boolean; sanctionsTier?: number; travelAdvisory?: number; notes?: string[];
    };
    quakes?: { count: number; maxMag: number };
    weatherAlerts?: { count: number; severe: number };
    gdacsAlerts?: { count: number; maxScore: number };
    windKph?: number; precipMm?: number;
    policeNearby?: number; hospitalsNearby?: number;
    wildfires?: { activeFires: number; maxConfidence: number; nearestKm: number };
    eonet?: { activeEvents: number; categories: string[]; wildfiresNearby?: number; stormNearby?: boolean; volcanoNearby?: boolean };
  } | null;
  headlines?: { title: string; link: string; source: string; pubDate?: string }[];
  stateDept?: { level: number; levelLabel: string; countryName: string; title: string; summary: string; publishedAt: string | null; url: string } | null;
  fbi?: { agency: string; year: number; population: number } | null;
  cdcNotices?: { title: string; level: number; link: string; summary?: string; pubDate?: string }[];
  whoOutbreaks?: { title: string; link: string; pubDate?: string }[];
  reliefwebAlerts?: { name: string; type: string }[];
  advisorySources?: Array<{
    id: string; name: string; icon: string; level: number; confidence: number;
    summary?: string; url?: string; publishedAt?: string | null;
    domain: 'travel' | 'health' | 'conflict' | 'disaster';
  }>;
  reconciliation?: {
    finalLevel: number; weightedLevel: number;
    agreement: 'HIGH' | 'MEDIUM' | 'LOW'; overallConfidence: number;
    sources: BackendPayload['advisorySources'];
  };
  unodc?: {
    cityHomicidePer100k: number | null; countryHomicidePer100k: number | null;
    nationalAvgPer100k: number | null; globalPercentile: number | null; yearOfData: number;
  };
  dangerousRanking?: {
    isTop5Nationally: boolean; isTop10Nationally: boolean; isTop25Globally: boolean;
    nationalRank: number | null; globalRank: number | null; source: string;
  };
  neighborhoodWarnings?: NeighborhoodWarning[];
  neighborhoodSafeAreas?: string[];
  cityMultiplier?: number | null;
  fetchedAt?: string;
  city?: string; state?: string; country?: string;
}

/* ── Props ─────────────────────────────────────────────────────────────── */
interface Props {
  locationName: string;
  countryCode?: string;
  advisoryScore?: number;
  lat?: number;
  lng?: number;
  onBack: () => void;
}

/* ── Helpers ────────────────────────────────────────────────────────────── */
function relativeTime(iso?: string | null): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  if (isNaN(diff)) return '—';
  const sec = Math.max(0, Math.round(diff / 1000));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.round(hr / 24)}d ago`;
}

function parseCityState(name: string): { city: string; state: string | null } {
  if (!name) return { city: '', state: null };
  // Strip trailing "USA" or "US" country suffix before parsing
  const cleaned = name.replace(/,\s*(USA|US)\s*$/i, '');
  const parts = cleaned.split(',').map(s => s.trim()).filter(Boolean);
  const city = parts[0] ?? '';
  let state: string | null = null;
  for (const p of parts.slice(1)) {
    const m = p.match(/^([A-Z]{2})(?:\s+\d{5})?$/);
    if (m) { state = m[1]; break; }
  }
  return { city, state };
}

const COUNTRY_NAMES: Record<string, string> = {
  US: 'United States', CA: 'Canada', GB: 'United Kingdom', AU: 'Australia',
  FR: 'France', DE: 'Germany', IT: 'Italy', ES: 'Spain', PT: 'Portugal',
  MX: 'Mexico', BR: 'Brazil', CO: 'Colombia', AR: 'Argentina', PE: 'Peru',
  CL: 'Chile', EC: 'Ecuador', VE: 'Venezuela', HT: 'Haiti', HN: 'Honduras',
  ZA: 'South Africa', NG: 'Nigeria', KE: 'Kenya', EG: 'Egypt', MA: 'Morocco',
  JP: 'Japan', KR: 'South Korea', SG: 'Singapore', TH: 'Thailand',
  IN: 'India', PH: 'Philippines', ID: 'Indonesia', MY: 'Malaysia',
  AE: 'United Arab Emirates', SA: 'Saudi Arabia', TR: 'Turkey',
  UA: 'Ukraine', RU: 'Russia', PK: 'Pakistan', AF: 'Afghanistan',
  SY: 'Syria', IQ: 'Iraq', LB: 'Lebanon', YE: 'Yemen', SO: 'Somalia',
  SD: 'Sudan', ML: 'Mali', BF: 'Burkina Faso', IL: 'Israel', JO: 'Jordan',
  MM: 'Myanmar', CD: 'DR Congo', SS: 'South Sudan', CF: 'Central African Republic',
  LY: 'Libya', BY: 'Belarus', NL: 'Netherlands', BE: 'Belgium', CH: 'Switzerland',
  SE: 'Sweden', NO: 'Norway', DK: 'Denmark', FI: 'Finland', NZ: 'New Zealand',
};

/* ── Gauge geometry ─────────────────────────────────────────────────────── */
const GR = 88, GCX = 120, GCY = 108;
const GAUGE_BANDS = [
  { from: 0,  to: 40,  color: '#ef4444' },
  { from: 40, to: 55,  color: '#f97316' },
  { from: 55, to: 70,  color: '#eab308' },
  { from: 70, to: 85,  color: '#84cc16' },
  { from: 85, to: 100, color: '#22c55e' },
];
const scoreAngle = (s: number) => Math.PI + (s / 100) * Math.PI;
const gx = (s: number) => GCX + GR * Math.cos(scoreAngle(s));
const gy = (s: number) => GCY + GR * Math.sin(scoreAngle(s));
const bandArc = (from: number, to: number) =>
  `M ${gx(from).toFixed(1)} ${gy(from).toFixed(1)} A ${GR} ${GR} 0 0 1 ${gx(to).toFixed(1)} ${gy(to).toFixed(1)}`;

/* ── Warning category metadata ──────────────────────────────────────────── */
const TRAVELER_WARNING_META: Record<TravelerWarning['category'], { label: string; icon: string }> = {
  nighttime: { label: 'Nighttime Risk',       icon: '🌙' },
  solo:       { label: 'Solo Traveler Risk',  icon: '🚶' },
  transit:    { label: 'Public Transit Risk', icon: '🚍' },
  scam:       { label: 'Scam / Theft Risk',   icon: '💳' },
  unrest:     { label: 'Civil Unrest',        icon: '⚠️' },
  women:      { label: 'Women Traveler',      icon: '👩' },
  theft:      { label: 'Robbery / Theft',     icon: '🎒' },
  political:  { label: 'Political Instability', icon: '🏛️' },
};

const LEVEL_COLOR: Record<TravelerWarning['level'], string> = {
  Low:    '#22c55e',
  Moderate: '#eab308',
  High:   '#f97316',
  Severe: '#ef4444',
};

/* ── Main component ─────────────────────────────────────────────────────── */
export default function SafetyScreen({ locationName, countryCode, advisoryScore, lat, lng, onBack }: Props) {
  const [backend, setBackend] = useState<BackendPayload | null>(null);
  const [result, setResult] = useState<TravelSafetyResult | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'advisories' | 'crime' | 'neighborhood' | 'sources'>('overview');
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const country = (countryCode || 'US').toUpperCase();
  const countryName = COUNTRY_NAMES[country] ?? country;
  const { city } = parseCityState(locationName);
  const isLive = backend?.source === 'LIVE_AGGREGATE';

  // Fetch backend data
  useEffect(() => {
    let cancelled = false;
    setBackend(null);
    if (!city) return;

    const load = async () => {
      try {
        const base = (import.meta.env.VITE_SUPABASE_URL as string).replace(/\/$/, '');
        const { state } = parseCityState(locationName);
        const qs = new URLSearchParams({ city, state: state ?? '', country });
        if (Number.isFinite(lat)) qs.set('lat', String(lat));
        if (Number.isFinite(lng)) qs.set('lon', String(lng));
        const r = await fetch(`${base}/functions/v1/crime-data?${qs}`, {
          headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string },
        });
        if (!r.ok) throw new Error(String(r.status));
        const j = await r.json();
        if (!cancelled) setBackend(j as BackendPayload);
      } catch {
        if (!cancelled) setBackend((prev: BackendPayload | null) => prev ?? { source: 'FALLBACK', rates: {} });
      }
    };

    load();
    const id = window.setInterval(load, 10 * 60 * 1000);
    return () => { cancelled = true; window.clearInterval(id); };
  }, [locationName, countryCode, lat, lng]);

  // Compute travel safety score from backend data
  const compute = useCallback(() => {
    if (!backend) return;
    const unodc = backend.unodc;
    const dangerousRanking = backend.dangerousRanking ?? {
      isTop5Nationally: false, isTop10Nationally: false, isTop25Globally: false,
      nationalRank: null, globalRank: null, source: 'No ranking data',
    };
    const neighborhoodWarnings = (backend.neighborhoodWarnings ?? []) as NeighborhoodWarning[];
    const enginePayload: EngineBackendPayload = { ...backend, signals: backend.signals ?? undefined };
    const input = adaptBackendPayload(
      city, country, countryName, enginePayload,
      neighborhoodWarnings,
      {
        cityHomicidePer100k: unodc?.cityHomicidePer100k ?? null,
        countryHomicidePer100k: unodc?.countryHomicidePer100k ?? null,
        nationalAvgPer100k: unodc?.nationalAvgPer100k ?? null,
        globalPercentile: unodc?.globalPercentile ?? null,
        yearOfData: unodc?.yearOfData ?? 2022,
      },
      dangerousRanking,
    );
    setResult(computeTravelSafetyScore(input));
  }, [backend, city, country, countryName]);

  useEffect(() => { compute(); }, [compute]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [result?.finalSafetyScore]);

  if (!result) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="bg-gradient-to-br from-kipita-navy to-[#16213e] px-4 py-3 flex items-center gap-3 flex-shrink-0">
          <button onClick={onBack} className="text-white/70 hover:text-white">
            <span className="ms text-xl">arrow_back</span>
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-bold truncate">Safety — {locationName}</p>
            <p className="text-white/50 text-[10px]">Loading safety intelligence…</p>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-2">
            <div className="w-8 h-8 border-2 border-kipita-red border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-muted-foreground">Querying {isLive ? '17' : '—'} live data sources…</p>
          </div>
        </div>
      </div>
    );
  }

  const scoreColor = getRiskColor(result.riskBand);
  const needleX = (GCX + (GR - 8) * Math.cos(scoreAngle(result.finalSafetyScore))).toFixed(1);
  const needleY = (GCY + (GR - 8) * Math.sin(scoreAngle(result.finalSafetyScore))).toFixed(1);
  const sourceCount = (backend?.advisorySources?.length ?? 0) + 6;

  return (
    <div className="flex flex-col h-full overflow-hidden screen-enter">
      {/* Header */}
      <div className="bg-gradient-to-br from-kipita-navy to-[#16213e] px-4 py-3 flex items-center gap-3 flex-shrink-0">
        <button onClick={onBack} className="text-white/70 hover:text-white">
          <span className="ms text-xl">arrow_back</span>
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-bold truncate">Safety — {locationName}</p>
          <p className="text-white/50 text-[10px]">
            {isLive
              ? `Live · ${sourceCount} sources · US State Dept · UK FCDO · Canada · Australia · ACLED · UNODC`
              : backend ? 'Connecting to live sources…' : 'Calibrated baseline'}
          </p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: isLive ? '#22c55e' : '#94a3b8' }}
          />
          <span className="text-[9px] text-white/50">{relativeTime(backend?.fetchedAt)}</span>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-border bg-card flex-shrink-0 overflow-x-auto">
        {(['overview', 'advisories', 'crime', 'neighborhood', 'sources'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-shrink-0 px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider border-b-2 transition-colors ${
              activeTab === tab ? 'border-kipita-red text-kipita-red' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab === 'neighborhood' ? 'Areas' : tab}
          </button>
        ))}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 pb-24 space-y-4">
        {/* ── OVERVIEW TAB ─────────────────────────────────────────────── */}
        {activeTab === 'overview' && (
          <>
            {/* Score Gauge */}
            <div className="bg-card border border-border rounded-kipita p-4 flex flex-col items-center">
              <p className="text-[10px] font-semibold text-muted-foreground tracking-widest mb-1">
                LIVE TRAVEL SAFETY SCORE
              </p>
              <svg viewBox="0 0 240 132" width="240" height="132">
                {GAUGE_BANDS.map(b => (
                  <path key={b.color} d={bandArc(b.from, b.to)}
                    fill="none" stroke={b.color} strokeWidth={18} opacity={0.18} />
                ))}
                {GAUGE_BANDS.map(b => {
                  if (result.finalSafetyScore <= b.from) return null;
                  const to = Math.min(result.finalSafetyScore, b.to);
                  return (
                    <path key={`a-${b.color}`} d={bandArc(b.from, to)}
                      fill="none" stroke={b.color} strokeWidth={18}
                      style={{ filter: `drop-shadow(0 0 5px ${b.color}88)`, transition: 'all 0.6s' }} />
                  );
                })}
                <line x1={GCX} y1={GCY} x2={needleX} y2={needleY}
                  stroke="white" strokeWidth={2.5} strokeLinecap="round"
                  style={{ transition: 'all 0.6s' }} />
                <circle cx={GCX} cy={GCY} r={5} fill="hsl(var(--card))" stroke="white" strokeWidth={2} />
                <text x={GCX} y={GCY - 14} textAnchor="middle" fill="currentColor"
                  fontSize="38" fontWeight="900">{result.finalSafetyScore}</text>
                <text x={GCX} y={GCY + 4} textAnchor="middle" fill={scoreColor}
                  fontSize="9" fontWeight="700" letterSpacing="2">{result.riskBand.toUpperCase()}</text>
                <text x="26" y={GCY + 22} textAnchor="middle" fontSize="9" fill="#64748b">0</text>
                <text x="214" y={GCY + 22} textAnchor="middle" fontSize="9" fill="#64748b">100</text>
              </svg>

              {/* Metadata chips */}
              <div className="flex gap-2 mt-1 flex-wrap justify-center">
                {[
                  ['Confidence', `${result.confidence} (${result.confidencePercent}%)`],
                  ['Sources', `${(backend?.advisorySources?.length ?? 0) + 6} verified`],
                  ['Updated', relativeTime(backend?.fetchedAt)],
                ].map(([k, v]) => (
                  <div key={k} className="bg-muted rounded-lg px-2.5 py-1 text-center">
                    <div className="text-[8px] text-muted-foreground uppercase tracking-wider">{k}</div>
                    <div className="text-xs font-bold text-foreground">{v}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top 20 Safest in the US badge */}
            {result.usSafestRank != null && (
              <div className="flex justify-center">
                <div className="flex items-center gap-2 px-4 py-2 rounded-full border border-green-500/60 bg-green-500/10">
                  <span className="text-green-400 text-base">🏅</span>
                  <span className="text-xs font-bold text-green-400 tracking-wide">
                    Top 20 Safest in the US
                  </span>
                  <span className="text-[10px] text-green-600 font-semibold">
                    #{result.usSafestRank}
                  </span>
                </div>
              </div>
            )}

            {/* Risk band legend */}
            <RiskBandLegend score={result.finalSafetyScore} />

            {/* Hard caps warning */}
            {result.hardCapsApplied.length > 0 && (
              <div className="p-3 rounded-kipita border border-destructive/50 bg-destructive/10">
                <p className="text-[10px] font-bold uppercase tracking-widest text-destructive mb-2">
                  ⛔ Safety Caps Applied
                </p>
                <ul className="space-y-1">
                  {result.hardCapsApplied.map((c, i) => (
                    <li key={i} className="text-[11px] text-foreground leading-snug">
                      <span className="font-semibold">{c.reason}</span>
                      <span className="text-muted-foreground"> — maximum score: {c.cap}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Major risks */}
            {result.majorRisks.length > 0 && (
              <div className="bg-card border border-border rounded-kipita p-4">
                <p className="text-[10px] font-semibold text-muted-foreground tracking-widest mb-3">
                  MAJOR RISK FACTORS
                </p>
                <ul className="space-y-1.5">
                  {result.majorRisks.map((r, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-foreground">
                      <span className="text-destructive mt-0.5 flex-shrink-0">▲</span>
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Traveler-specific warnings */}
            <TravelerWarningsPanel warnings={result.travelerWarnings} />

            {/* Why this rating */}
            <ExplanationPanel result={result} />

            {/* Traveler guidance */}
            <div className="rounded-kipita p-3 border"
              style={{ borderColor: `${scoreColor}40`, backgroundColor: `${scoreColor}10` }}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-1"
                style={{ color: scoreColor }}>TRAVELER GUIDANCE</p>
              <p className="text-xs text-foreground leading-relaxed">{result.travelerGuidance}</p>
            </div>

            {/* Conflict alerts */}
            {(backend?.signals?.conflict?.notes?.length ?? 0) > 0 && (
              <div className="p-3 rounded-kipita border border-destructive/40 bg-destructive/10">
                <p className="text-[10px] font-bold uppercase tracking-widest text-destructive mb-2">
                  ⚠ Active Conflict / Geopolitical Alerts
                </p>
                <ul className="space-y-1">
                  {backend!.signals!.conflict!.notes!.slice(0, 5).map((n, i) => (
                    <li key={i} className="text-[11px] text-foreground leading-snug">• {n}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Recent headlines */}
            <HeadlinesPanel headlines={backend?.headlines ?? []} />

            {/* Disclaimer */}
            <button
              onClick={() => setShowDisclaimer(v => !v)}
              className="w-full text-left rounded-kipita border border-border/50 p-3 bg-muted/30"
            >
              <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
                ⓘ Disclaimer {showDisclaimer ? '▲' : '▼'}
              </p>
              {showDisclaimer && (
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  {result.disclaimer}
                </p>
              )}
            </button>
          </>
        )}

        {/* ── ADVISORIES TAB ───────────────────────────────────────────── */}
        {activeTab === 'advisories' && (
          <>
            <AdvisoryComparisonPanel result={result} backend={backend} />
            <ReconciliationPanel backend={backend} />
          </>
        )}

        {/* ── CRIME TAB ────────────────────────────────────────────────── */}
        {activeTab === 'crime' && (
          <CrimeMetricsPanel result={result} backend={backend} />
        )}

        {/* ── NEIGHBORHOOD TAB ─────────────────────────────────────────── */}
        {activeTab === 'neighborhood' && (
          <NeighborhoodPanel
            warnings={result.neighborhoodWarnings}
            safeAreas={backend?.neighborhoodSafeAreas ?? []}
            city={city}
          />
        )}

        {/* ── SOURCES TAB ──────────────────────────────────────────────── */}
        {activeTab === 'sources' && (
          <LiveFeedsPanel backend={backend} isLive={isLive} />
        )}
      </div>
    </div>
  );
}

/* ── Risk Band Legend ────────────────────────────────────────────────────── */
function RiskBandLegend({ score }: { score: number }) {
  const bands: { label: RiskBand; range: string; color: string; min: number }[] = [
    { label: 'Severe Risk',       range: '0–39',   color: '#ef4444', min: 0  },
    { label: 'High Risk',         range: '40–54',  color: '#f97316', min: 40 },
    { label: 'Moderate Risk',     range: '55–69',  color: '#eab308', min: 55 },
    { label: 'Moderate-Low Risk', range: '70–84',  color: '#84cc16', min: 70 },
    { label: 'Low Risk',          range: '85–100', color: '#22c55e', min: 85 },
  ];
  return (
    <div className="bg-card border border-border rounded-kipita p-3">
      <p className="text-[10px] font-semibold text-muted-foreground tracking-widest mb-2">RISK SCALE</p>
      <div className="space-y-1.5">
        {bands.map(b => {
          const active = score >= b.min && score < (b.min + (b.label === 'Low Risk' ? 16 : b.label === 'Moderate-Low Risk' ? 15 : b.label === 'Moderate Risk' ? 15 : b.label === 'High Risk' ? 15 : 40));
          return (
            <div key={b.label}
              className={`flex items-center gap-2 rounded px-2 py-1 transition-all ${active ? 'ring-1' : ''}`}
              style={{ backgroundColor: active ? `${b.color}18` : undefined, boxShadow: active ? `0 0 0 1px ${b.color}` : undefined }}>
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: b.color }} />
              <span className="text-[10px] font-semibold text-foreground flex-1">{b.label}</span>
              <span className="text-[9px] text-muted-foreground">{b.range}</span>
              {active && <span className="text-[8px] font-bold" style={{ color: b.color }}>◀ CURRENT</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Traveler Warnings Panel ─────────────────────────────────────────────── */
function TravelerWarningsPanel({ warnings }: { warnings: TravelerWarning[] }) {
  if (!warnings.length) return null;
  return (
    <div className="bg-card border border-border rounded-kipita p-4">
      <p className="text-[10px] font-semibold text-muted-foreground tracking-widest mb-3">
        TRAVELER RISK CATEGORIES
      </p>
      <div className="space-y-2.5">
        {warnings.map(w => {
          const meta = TRAVELER_WARNING_META[w.category];
          const color = LEVEL_COLOR[w.level];
          return (
            <div key={w.category}>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-sm w-5 flex-shrink-0">{meta.icon}</span>
                <span className="text-xs font-semibold text-foreground flex-1">{meta.label}</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: `${color}20`, color }}>
                  {w.level}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground leading-snug pl-7">{w.detail}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Explanation Panel ───────────────────────────────────────────────────── */
function ExplanationPanel({ result }: { result: TravelSafetyResult }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-card border border-border rounded-kipita p-4">
      <button
        className="w-full flex items-center justify-between"
        onClick={() => setOpen(v => !v)}
      >
        <p className="text-[10px] font-semibold text-muted-foreground tracking-widest">
          WHY THIS RATING?
        </p>
        <span className="text-muted-foreground text-xs">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="mt-3 space-y-3">
          <p className="text-[11px] text-foreground leading-relaxed">{result.explanation}</p>
          <div className="space-y-2">
            {Object.entries(result.components).map(([key, comp]) => {
              const labels: Record<string, string> = {
                advisoryRisk: 'Advisory Risk (25%)',
                violentCrime: 'Violent Crime (30%)',
                conflictTerrorism: 'Conflict / Terrorism (20%)',
                recentTrend: 'Recent Trend (10%)',
                neighborhoodRisk: 'Neighborhood Risk (10%)',
                dataConfidence: 'Data Confidence (5%)',
              };
              const pct = Math.round(comp.raw);
              const barColor = pct >= 70 ? '#22c55e' : pct >= 50 ? '#eab308' : '#ef4444';
              return (
                <div key={key}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[10px] text-muted-foreground">{labels[key] ?? key}</span>
                    <span className="text-[10px] font-bold text-foreground">{pct}/100</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, backgroundColor: barColor }} />
                  </div>
                  {comp.notes.length > 0 && (
                    <p className="text-[9px] text-muted-foreground mt-0.5 truncate">{comp.notes[0]}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Advisory Comparison Panel ───────────────────────────────────────────── */
const ADVISORY_LEVEL_COLORS = ['#94a3b8', '#22c55e', '#eab308', '#f97316', '#ef4444'];

function AdvisoryComparisonPanel({ result, backend }: { result: TravelSafetyResult; backend: BackendPayload | null }) {
  const advisories = result.advisories;
  if (!advisories.length) {
    return (
      <div className="bg-card border border-border rounded-kipita p-4">
        <p className="text-[10px] font-semibold text-muted-foreground tracking-widest mb-2">
          GOVERNMENT TRAVEL ADVISORIES
        </p>
        <p className="text-xs text-muted-foreground">No advisory data retrieved. Exercise caution.</p>
      </div>
    );
  }

  const maxLevel = Math.max(...advisories.map(a => a.level));
  const minLevel = Math.min(...advisories.map(a => a.level));
  const spread = maxLevel - minLevel;
  const agreementColor = spread === 0 ? '#22c55e' : spread === 1 ? '#eab308' : '#ef4444';
  const agreementLabel = spread === 0 ? 'FULL AGREEMENT' : spread === 1 ? 'MINOR DISAGREEMENT' : 'SOURCES CONFLICT';

  return (
    <div className="bg-card border border-border rounded-kipita p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-semibold text-muted-foreground tracking-widest">
          GOVERNMENT TRAVEL ADVISORIES
        </p>
        <div className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: agreementColor }} />
          <span className="text-[9px] font-bold" style={{ color: agreementColor }}>{agreementLabel}</span>
        </div>
      </div>

      {spread >= 2 && (
        <div className="mb-3 p-2.5 rounded-kipita border border-amber-500/40 bg-amber-500/10">
          <p className="text-[10px] font-semibold text-amber-500">
            ⚠ Advisory sources disagree significantly. Using most conservative rating per protocol.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {advisories.map((a, i) => {
          const color = ADVISORY_LEVEL_COLORS[Math.min(4, a.level)];
          return (
            <div key={i} className="border border-border/60 rounded-kipita p-3">
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground">{a.source}</p>
                  <p className="text-[9px] text-muted-foreground">{relativeTime(a.lastUpdated)}</p>
                </div>
                <div className="flex flex-col items-end flex-shrink-0">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: `${color}20`, color }}>
                    Level {a.level}
                  </span>
                  <span className="text-[9px] mt-0.5" style={{ color }}>
                    {ADVISORY_LABELS[a.level] ?? 'Unknown'}
                  </span>
                </div>
              </div>
              {a.summary && (
                <p className="text-[10px] text-muted-foreground leading-snug">{a.summary}</p>
              )}
              {/* Level indicator dots */}
              <div className="flex gap-1 mt-2">
                {[1, 2, 3, 4].map(lvl => (
                  <div key={lvl}
                    className="h-1.5 flex-1 rounded-full"
                    style={{ backgroundColor: lvl <= a.level ? color : `${color}25` }}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Conservative note */}
      <p className="text-[9px] text-muted-foreground/60 text-center mt-3 pt-2 border-t border-border/40">
        When sources disagree, the most conservative (highest) advisory level is used.
      </p>
    </div>
  );
}

/* ── Reconciliation panel ────────────────────────────────────────────────── */
function ReconciliationPanel({ backend }: { backend: BackendPayload | null }) {
  const rec = backend?.reconciliation;
  if (!rec) return null;
  const finalColor = ADVISORY_LEVEL_COLORS[Math.min(4, rec.finalLevel)];
  const aggColor = rec.agreement === 'HIGH' ? '#22c55e' : rec.agreement === 'MEDIUM' ? '#eab308' : '#f97316';

  return (
    <div className="bg-card border border-border rounded-kipita p-4">
      <p className="text-[10px] font-semibold text-muted-foreground tracking-widest mb-3">
        RECONCILED ADVISORY LEVEL
      </p>
      <div className="grid grid-cols-3 gap-3 mb-3">
        <div className="text-center p-2 bg-muted rounded-kipita">
          <p className="text-[8px] text-muted-foreground uppercase mb-1">Final Level</p>
          <p className="text-lg font-black" style={{ color: finalColor }}>{rec.finalLevel}</p>
          <p className="text-[8px]" style={{ color: finalColor }}>{ADVISORY_LABELS[rec.finalLevel]}</p>
        </div>
        <div className="text-center p-2 bg-muted rounded-kipita">
          <p className="text-[8px] text-muted-foreground uppercase mb-1">Weighted Avg</p>
          <p className="text-lg font-black text-foreground">{rec.weightedLevel.toFixed(1)}</p>
          <p className="text-[8px] text-muted-foreground">of 4.0</p>
        </div>
        <div className="text-center p-2 bg-muted rounded-kipita">
          <p className="text-[8px] text-muted-foreground uppercase mb-1">Confidence</p>
          <p className="text-lg font-black text-foreground">{Math.round(rec.overallConfidence * 100)}%</p>
          <p className="text-[8px]" style={{ color: aggColor }}>{rec.agreement}</p>
        </div>
      </div>
      <p className="text-[9px] text-muted-foreground/60 text-center">
        Confidence-weighted averaging with conservative bias when sources disagree.
      </p>
    </div>
  );
}

/* ── Crime Metrics Panel ─────────────────────────────────────────────────── */
function CrimeMetricsPanel({ result, backend }: { result: TravelSafetyResult; backend: BackendPayload | null }) {
  const m = result.crimeMetrics;
  const unodc = backend?.unodc;
  const dr = result.dangerousCityRanking;

  const metricRows: { label: string; value: number | null; unit: string; benchmarkNote?: string }[] = [
    { label: 'Homicide Rate', value: m.homicideRatePer100k, unit: '/100k',
      benchmarkNote: m.homicideRatePer100k != null ? (() => {
        const globalLabel = m.homicideRatePer100k! < 2 ? 'Very Low' : m.homicideRatePer100k! < 8 ? 'Low–Moderate' : m.homicideRatePer100k! < 20 ? 'High' : 'Severe';
        const nationalLabel = m.vsNationalAvg != null
          ? (m.vsNationalAvg > 2 ? 'High' : m.vsNationalAvg > 1.2 ? 'Above avg' : 'Near avg') + ' nationally'
          : null;
        return nationalLabel ? `${globalLabel} globally · ${nationalLabel}` : `${globalLabel} by global standards`;
      })() : undefined },
    { label: 'Violent Crime Rate', value: m.violentCrimeRatePer100k, unit: '/100k' },
    { label: 'Robbery Rate', value: m.robberyRatePer100k, unit: '/100k' },
    { label: 'Assault Rate', value: m.assaultRatePer100k, unit: '/100k' },
    { label: 'Kidnapping Rate', value: m.kidnappingRatePer100k, unit: '/100k' },
  ];

  return (
    <div className="space-y-4">
      {/* UNODC source note */}
      {unodc && (
        <div className="bg-card border border-border rounded-kipita p-4">
          <p className="text-[10px] font-semibold text-muted-foreground tracking-widest mb-3">
            UNODC HOMICIDE DATA
          </p>
          <div className="grid grid-cols-2 gap-3">
            {unodc.cityHomicidePer100k != null && (
              <div className="p-2 bg-muted rounded-kipita">
                <p className="text-[8px] text-muted-foreground uppercase">City Homicide</p>
                <p className="text-xl font-black text-foreground">{unodc.cityHomicidePer100k.toFixed(1)}</p>
                <p className="text-[8px] text-muted-foreground">per 100,000 · {unodc.yearOfData}</p>
              </div>
            )}
            {unodc.countryHomicidePer100k != null && (
              <div className="p-2 bg-muted rounded-kipita">
                <p className="text-[8px] text-muted-foreground uppercase">Country Rate</p>
                <p className="text-xl font-black text-foreground">{unodc.countryHomicidePer100k.toFixed(1)}</p>
                <p className="text-[8px] text-muted-foreground">per 100,000 · {unodc.yearOfData}</p>
              </div>
            )}
            {m.vsNationalAvg != null && (
              <div className="p-2 bg-muted rounded-kipita">
                <p className="text-[8px] text-muted-foreground uppercase">vs National Avg</p>
                <p className="text-xl font-black text-foreground">{m.vsNationalAvg}×</p>
                <p className="text-[8px] text-muted-foreground">
                  {m.vsNationalAvg > 2 ? 'Significantly elevated' : m.vsNationalAvg > 1.2 ? 'Above average' : 'Near average'}
                </p>
              </div>
            )}
            {m.percentileViolent != null && (
              <div className="p-2 bg-muted rounded-kipita">
                <p className="text-[8px] text-muted-foreground uppercase">Global Percentile</p>
                <p className="text-xl font-black text-foreground">{m.percentileViolent}th</p>
                <p className="text-[8px] text-muted-foreground">
                  {m.percentileViolent >= 90 ? 'Top 10% most dangerous' : m.percentileViolent >= 75 ? 'Above 75th percentile' : 'Below 75th percentile'}
                </p>
              </div>
            )}
          </div>
          <p className="text-[9px] text-muted-foreground/60 mt-2">
            Source: UNODC Global Study on Homicide 2023–2024 · local statistical agencies
          </p>
        </div>
      )}

      {/* Crime rates table */}
      <div className="bg-card border border-border rounded-kipita p-4">
        <p className="text-[10px] font-semibold text-muted-foreground tracking-widest mb-3">
          CRIME METRICS (PER 100,000 POPULATION)
        </p>
        <div className="space-y-3">
          {metricRows.map(row => (
            <div key={row.label}>
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-xs text-foreground">{row.label}</span>
                <span className="text-xs font-bold text-foreground">
                  {row.value != null ? `${row.value.toFixed(1)}${row.unit}` : 'N/A'}
                </span>
              </div>
              {row.benchmarkNote && (
                <p className="text-[9px] text-muted-foreground">{row.benchmarkNote}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Trend */}
      <div className="bg-card border border-border rounded-kipita p-4">
        <p className="text-[10px] font-semibold text-muted-foreground tracking-widest mb-3">CRIME TRENDS</p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: '90-Day Trend', value: m.trend90Days },
            { label: '12-Month Trend', value: m.trend12Months },
          ].map(t => {
            const color = t.value === 'increasing' ? '#ef4444' : t.value === 'decreasing' ? '#22c55e' : '#94a3b8';
            const icon = t.value === 'increasing' ? '▲' : t.value === 'decreasing' ? '▼' : '—';
            return (
              <div key={t.label} className="p-2 bg-muted rounded-kipita text-center">
                <p className="text-[8px] text-muted-foreground uppercase">{t.label}</p>
                <p className="text-xl font-black" style={{ color }}>{icon}</p>
                <p className="text-[9px] font-semibold capitalize" style={{ color }}>
                  {t.value ?? 'Insufficient data'}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Dangerous city ranking */}
      {(dr.isTop25Globally || dr.isTop10Nationally) && (
        <div className="p-3 rounded-kipita border border-destructive/40 bg-destructive/10">
          <p className="text-[10px] font-bold uppercase tracking-widest text-destructive mb-2">
            ⚠ Dangerous City Ranking
          </p>
          <div className="space-y-1">
            {dr.isTop25Globally && (
              <p className="text-[11px] text-foreground">
                🌍 <strong>Ranked #{dr.globalRank}</strong> among the 25 most dangerous cities globally (homicide rate)
              </p>
            )}
            {dr.isTop5Nationally && (
              <p className="text-[11px] text-foreground">
                🚨 <strong>Ranked #{dr.nationalRank}</strong> most dangerous nationally — score capped at 50
              </p>
            )}
            {!dr.isTop5Nationally && dr.isTop10Nationally && (
              <p className="text-[11px] text-foreground">
                ⚠ <strong>Ranked #{dr.nationalRank}</strong> most dangerous nationally — score capped at 60
              </p>
            )}
            <p className="text-[9px] text-muted-foreground mt-1">Source: {dr.source}</p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Neighborhood Panel ──────────────────────────────────────────────────── */
function NeighborhoodPanel({
  warnings, safeAreas, city,
}: { warnings: NeighborhoodWarning[]; safeAreas: string[]; city: string }) {
  const RISK_COLORS = { 'Very High': '#ef4444', High: '#f97316', Moderate: '#eab308' };
  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-kipita p-4">
        <p className="text-[10px] font-semibold text-muted-foreground tracking-widest mb-1">
          NEIGHBORHOOD RISK ASSESSMENT
        </p>
        <p className="text-[10px] text-muted-foreground mb-3">
          {city} — area-specific risk based on crime density data
        </p>
        {warnings.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">
            Neighborhood-level data not available for this city. Do not interpret absence as low risk — exercise caution in all unfamiliar areas.
          </p>
        ) : (
          <div className="space-y-3">
            {warnings.map((w, i) => {
              const color = RISK_COLORS[w.riskLevel];
              return (
                <div key={i} className="border border-border/60 rounded-kipita p-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-semibold text-foreground">{w.area}</p>
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: `${color}20`, color }}>
                      {w.riskLevel}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Crime types: {w.crimeTypes.join(', ')}
                  </p>
                  {w.note && (
                    <p className="text-[10px] text-amber-500 mt-0.5">{w.note}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {safeAreas.length > 0 && (
        <div className="bg-card border border-border rounded-kipita p-4">
          <p className="text-[10px] font-semibold text-muted-foreground tracking-widest mb-2">
            RELATIVELY LOWER-RISK AREAS
          </p>
          <p className="text-[10px] text-muted-foreground mb-2">
            These areas have comparatively fewer reported incidents but are not guaranteed safe. Exercise normal precautions.
          </p>
          <div className="flex flex-wrap gap-2">
            {safeAreas.map((a, i) => (
              <span key={i} className="text-[10px] bg-green-500/10 text-green-500 border border-green-500/20 px-2 py-1 rounded-full">
                {a}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="p-3 rounded-kipita border border-amber-500/30 bg-amber-500/10">
        <p className="text-[10px] text-amber-500 leading-relaxed">
          ⚠ Neighborhood safety conditions can change rapidly. This data reflects historical crime patterns and may not reflect current conditions. Verify with local authorities and recent traveler reports before visiting any area.
        </p>
      </div>
    </div>
  );
}

/* ── Live Feeds Panel ────────────────────────────────────────────────────── */
function LiveFeedsPanel({ backend, isLive }: { backend: BackendPayload | null; isLive: boolean }) {
  const s = backend?.signals;
  type FeedStatus = 'active' | 'quiet' | 'offline';

  interface FeedRow { name: string; icon: string; status: FeedStatus; detail: string; url?: string }
  const feeds: FeedRow[] = [
    { name: 'US State Department', icon: '🇺🇸', url: 'https://travel.state.gov',
      status: backend?.stateDept ? 'active' : !isLive ? 'offline' : 'quiet',
      detail: backend?.stateDept ? `Level ${backend.stateDept.level}: ${backend.stateDept.levelLabel}` : 'No advisory found' },
    { name: 'UK FCDO Travel Advice', icon: '🇬🇧', url: 'https://gov.uk/foreign-travel-advice',
      status: !isLive ? 'offline' : (backend?.advisorySources?.some(a => a.id === 'uk-fcdo') ? 'active' : 'quiet'),
      detail: backend?.advisorySources?.find(a => a.id === 'uk-fcdo')?.summary?.slice(0, 80) ?? 'No advisory found' },
    { name: 'Canada Travel Advisories', icon: '🇨🇦', url: 'https://travel.gc.ca',
      status: !isLive ? 'offline' : (backend?.advisorySources?.some(a => a.id === 'canada-gc') ? 'active' : 'quiet'),
      detail: backend?.advisorySources?.find(a => a.id === 'canada-gc')?.summary?.slice(0, 80) ?? 'No advisory found' },
    { name: 'Australia Smartraveller', icon: '🇦🇺', url: 'https://smartraveller.gov.au',
      status: !isLive ? 'offline' : (backend?.advisorySources?.some(a => a.id === 'smartraveller') ? 'active' : 'quiet'),
      detail: backend?.advisorySources?.find(a => a.id === 'smartraveller')?.summary?.slice(0, 80) ?? 'No advisory found' },
    { name: 'ACLED Conflict Index', icon: '⚔️', url: 'https://acleddata.com',
      status: !isLive ? 'offline' : (s?.conflict && s.conflict.severity > 0 ? 'active' : 'quiet'),
      detail: s?.conflict ? `${s.conflict.tier} · ${s.conflict.events30d} events / ${s.conflict.fatalities30d} fatalities (30d)` : 'No conflict data' },
    { name: 'UNODC Homicide Statistics', icon: '📊', url: 'https://unodc.org',
      status: !isLive ? 'offline' : (backend?.unodc?.cityHomicidePer100k != null || backend?.unodc?.countryHomicidePer100k != null ? 'active' : 'quiet'),
      detail: backend?.unodc?.cityHomicidePer100k != null
        ? `City: ${backend.unodc.cityHomicidePer100k.toFixed(1)}/100k (${backend.unodc.yearOfData})`
        : backend?.unodc?.countryHomicidePer100k != null
          ? `Country: ${backend.unodc.countryHomicidePer100k.toFixed(1)}/100k (${backend.unodc.yearOfData})`
          : 'No UNODC data for this location' },
    { name: 'CDC Travel Health Notices', icon: '🏥', url: 'https://wwwnc.cdc.gov/travel',
      status: !isLive ? 'offline' : ((backend?.cdcNotices?.length ?? 0) > 0 ? 'active' : 'quiet'),
      detail: (backend?.cdcNotices?.length ?? 0) > 0 ? `${backend!.cdcNotices!.length} notice(s)` : 'No active CDC notices' },
    { name: 'WHO Disease Outbreak News', icon: '🌍', url: 'https://who.int',
      status: !isLive ? 'offline' : ((backend?.whoOutbreaks?.length ?? 0) > 0 ? 'active' : 'quiet'),
      detail: (backend?.whoOutbreaks?.length ?? 0) > 0 ? `${backend!.whoOutbreaks!.length} outbreak(s) reported` : 'No active WHO outbreaks' },
    { name: 'ReliefWeb Disasters (UN)', icon: '🆘', url: 'https://reliefweb.int',
      status: !isLive ? 'offline' : ((backend?.reliefwebAlerts?.length ?? 0) > 0 ? 'active' : 'quiet'),
      detail: (backend?.reliefwebAlerts?.length ?? 0) > 0 ? backend!.reliefwebAlerts!.slice(0, 2).map(a => a.name).join(' · ') : 'No active disaster alerts' },
    { name: 'USGS Earthquakes', icon: '🌐',
      status: !isLive ? 'offline' : (s?.quakes && s.quakes.count > 0 ? 'active' : 'quiet'),
      detail: s?.quakes ? `${s.quakes.count} nearby · max M${s.quakes.maxMag.toFixed(1)}` : 'No data' },
    { name: 'NOAA NWS Alerts', icon: '⛈️',
      status: !isLive ? 'offline' : (s?.weatherAlerts && s.weatherAlerts.count > 0 ? 'active' : 'quiet'),
      detail: s?.weatherAlerts ? `${s.weatherAlerts.count} alerts · ${s.weatherAlerts.severe} severe` : 'No data' },
    { name: 'GDACS Global Disasters', icon: '🌋',
      status: !isLive ? 'offline' : (s?.gdacsAlerts && s.gdacsAlerts.count > 0 ? 'active' : 'quiet'),
      detail: s?.gdacsAlerts ? `${s.gdacsAlerts.count} alerts · max score ${s.gdacsAlerts.maxScore.toFixed(1)}` : 'No data' },
    { name: 'NASA EONET Events', icon: '🛰️',
      status: !isLive ? 'offline' : (s?.eonet && s.eonet.activeEvents > 0 ? 'active' : 'quiet'),
      detail: s?.eonet ? `${s.eonet.activeEvents} events · ${(s.eonet.categories ?? []).slice(0, 2).join(', ') || 'various'}` : 'No data' },
    { name: 'OpenStreetMap (OSM)', icon: '🗺️',
      status: !isLive ? 'offline' : 'active',
      detail: s ? `${s.policeNearby ?? 0} police · ${s.hospitalsNearby ?? 0} hospitals nearby` : 'No data' },
    { name: 'FBI Crime Data (US)', icon: '🛡️',
      status: backend?.fbi ? 'active' : 'offline',
      detail: backend?.fbi ? `${backend.fbi.agency} · ${backend.fbi.year} · pop ${backend.fbi.population.toLocaleString()}` : 'US only — using calibrated baseline' },
    { name: 'Google News (Local Headlines)', icon: '📰',
      status: !isLive ? 'offline' : ((backend?.headlines?.length ?? 0) > 0 ? 'active' : 'quiet'),
      detail: `${backend?.headlines?.length ?? 0} safety-relevant headlines (7 days)` },
    { name: 'Open-Meteo Weather', icon: '🌬️',
      status: !isLive ? 'offline' : 'quiet',
      detail: s ? `${Math.round(s.windKph ?? 0)} km/h wind · ${(s.precipMm ?? 0).toFixed(1)} mm precip` : 'No data' },
  ];

  const statusColor = (st: FeedStatus) =>
    st === 'active' ? '#22c55e' : st === 'quiet' ? '#94a3b8' : '#ef4444';

  const activeCt = feeds.filter(f => f.status === 'active').length;
  const quietCt = feeds.filter(f => f.status === 'quiet').length;

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-kipita p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] font-semibold text-muted-foreground tracking-widest">
            LIVE DATA SOURCES ({feeds.length})
          </p>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full animate-pulse"
              style={{ backgroundColor: isLive ? '#22c55e' : '#94a3b8' }} />
            <span className="text-[9px] text-muted-foreground">
              {activeCt} active · {quietCt} quiet · {relativeTime(backend?.fetchedAt)}
            </span>
          </div>
        </div>

        <div className="space-y-2.5">
          {feeds.map(f => (
            <div key={f.name} className="flex items-center gap-2.5">
              <span className="text-sm w-5 flex-shrink-0">{f.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold text-foreground truncate">{f.name}</p>
                <p className="text-[9px] text-muted-foreground truncate">{f.detail}</p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: statusColor(f.status) }} />
                <span className="text-[8px] font-bold uppercase" style={{ color: statusColor(f.status) }}>
                  {f.status}
                </span>
              </div>
            </div>
          ))}
        </div>

        <p className="text-[9px] text-muted-foreground/60 text-center mt-4 pt-3 border-t border-border/40">
          17-source aggregation · cache 10 min · auto-refreshing · conservative bias when sources disagree
        </p>
      </div>

      <div className="p-3 rounded-kipita border border-border/50 bg-muted/20">
        <p className="text-[9px] text-muted-foreground leading-relaxed">
          <strong className="text-foreground">Data sources:</strong> US State Dept (live), UK FCDO (verified static), Canada IRCC (verified static), Australia Smartraveller (verified static), ACLED Conflict Index (semi-annual), UNODC 2023–2024, FBI CDE (US only, live), NASA USGS/EONET/FIRMS, NOAA NWS, GDACS, OpenStreetMap Overpass, Open-Meteo, CDC Travel Health, WHO DON, ReliefWeb, Google News RSS. Crowdsourced data is not used as a primary source.
        </p>
      </div>
    </div>
  );
}

/* ── Headlines Panel ─────────────────────────────────────────────────────── */
function HeadlinesPanel({ headlines }: { headlines: { title: string; link: string; source: string; pubDate?: string }[] }) {
  if (!headlines.length) return null;
  return (
    <div className="bg-card border border-border rounded-kipita p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-semibold text-muted-foreground tracking-widest">LOCAL SAFETY HEADLINES</p>
        <span className="text-[9px] text-muted-foreground">Past 7 days · Google News</span>
      </div>
      <div className="space-y-2.5">
        {headlines.map((h, i) => (
          <a key={i} href={h.link} target="_blank" rel="noopener noreferrer" className="block group">
            <p className="text-xs text-foreground leading-snug group-hover:text-kipita-red transition-colors line-clamp-2">
              {h.title}
            </p>
            <p className="text-[9px] text-muted-foreground mt-0.5">
              {h.source}{h.pubDate ? ` · ${relativeTime(h.pubDate)}` : ''}
            </p>
          </a>
        ))}
      </div>
    </div>
  );
}
