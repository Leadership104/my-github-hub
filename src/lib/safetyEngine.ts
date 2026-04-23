/**
 * Kipita Safety Score Engine v2.0 — TypeScript
 * Context-Aware: HOME / AWAY / TRANSIT
 * Formula: SafetyScore = 100 - Σ(NormalizedRate × ContextWeight × RecencyFactor) × SitMultiplier
 */

export type SafetyContext = 'HOME' | 'AWAY' | 'TRANSIT';

export interface CrimeCategory {
  label: string;
  tier: 'personal' | 'property' | 'transit' | 'environ';
  icon: string;
}

export const CRIME_CATEGORIES: Record<string, CrimeCategory> = {
  robbery:          { label: 'Robbery / Mugging',     tier: 'personal', icon: '🫳' },
  assault:          { label: 'Assault / Battery',     tier: 'personal', icon: '⚡' },
  sexual_offense:   { label: 'Sexual Offense',        tier: 'personal', icon: '⚠️' },
  kidnapping:       { label: 'Kidnapping',            tier: 'personal', icon: '🚨' },
  burglary:         { label: 'Burglary / Break-In',   tier: 'property', icon: '🔓' },
  home_invasion:    { label: 'Home Invasion',         tier: 'property', icon: '🏚️' },
  vandalism:        { label: 'Vandalism',             tier: 'property', icon: '🪣' },
  larceny_home:     { label: 'Larceny (Residential)', tier: 'property', icon: '📦' },
  vehicle_theft:    { label: 'Vehicle Theft',         tier: 'transit',  icon: '🚗' },
  carjacking:       { label: 'Carjacking',            tier: 'transit',  icon: '🔑' },
  vehicle_break_in: { label: 'Vehicle Break-In',      tier: 'transit',  icon: '🪟' },
  traffic_incident: { label: 'Traffic Incident',      tier: 'transit',  icon: '🚦' },
  drug_activity:    { label: 'Drug Activity',         tier: 'environ',  icon: '💊' },
  public_disorder:  { label: 'Public Disorder',       tier: 'environ',  icon: '📢' },
  weapons_offense:  { label: 'Weapons Offense',       tier: 'environ',  icon: '🔫' },
};

export const CONTEXT_WEIGHTS: Record<SafetyContext, Record<string, number>> = {
  HOME: {
    robbery: 0.30, assault: 0.25, sexual_offense: 0.20, kidnapping: 0.15,
    burglary: 1.00, home_invasion: 1.00, vandalism: 0.80, larceny_home: 0.70,
    vehicle_theft: 0.50, carjacking: 0.10, vehicle_break_in: 0.50, traffic_incident: 0.10,
    drug_activity: 0.60, public_disorder: 0.40, weapons_offense: 0.55,
  },
  AWAY: {
    robbery: 1.00, assault: 1.00, sexual_offense: 0.90, kidnapping: 0.85,
    burglary: 0.20, home_invasion: 0.10, vandalism: 0.30, larceny_home: 0.20,
    vehicle_theft: 0.60, carjacking: 0.70, vehicle_break_in: 0.80, traffic_incident: 0.50,
    drug_activity: 0.70, public_disorder: 0.80, weapons_offense: 0.90,
  },
  TRANSIT: {
    robbery: 0.70, assault: 0.65, sexual_offense: 0.55, kidnapping: 0.40,
    burglary: 0.10, home_invasion: 0.05, vandalism: 0.20, larceny_home: 0.10,
    vehicle_theft: 1.00, carjacking: 1.00, vehicle_break_in: 0.90, traffic_incident: 1.00,
    drug_activity: 0.40, public_disorder: 0.60, weapons_offense: 0.60,
  },
};

export const SITUATIONAL_MULTIPLIERS = {
  TIME: { daytime: 1.00, evening: 1.25, nighttime: 1.60 } as Record<string, number>,
  DENSITY: { tourist_heavy: 1.20, residential: 1.00, commercial: 0.90, rural: 0.75 } as Record<string, number>,
  EVENTS: { large_event: 1.30, protest: 1.40, parade: 1.10, none: 1.00 } as Record<string, number>,
  WEATHER: { extreme: 1.20, normal: 1.00, clear: 0.95 } as Record<string, number>,
};

const RATE_CAP = 1500;
const SIT_MUL_CAP = 1.80;
const DECAY_LAMBDA = 0.05;

function recencyDecay(ts: string): number {
  const hrs = (Date.now() - new Date(ts).getTime()) / 3_600_000;
  return Math.exp(-DECAY_LAMBDA * hrs);
}

export interface Incident {
  crimeType: string;
  timestamp: string;
  rateEquivalent?: number;
}

export interface SituationalParams {
  timeOfDay: string;
  density: string;
  events: string;
  weather: string;
}

export interface RiskBreakdown {
  label: string;
  tier: string;
  icon: string;
  contextWeight: number;
  pts: number;
}

export interface SafetyResult {
  score: number;
  riskLevel: string;
  riskColor: string;
  context: SafetyContext;
  breakdown: Record<string, RiskBreakdown>;
  sitMul: number;
  hasLive: boolean;
  confidence: string;
}

export function computeSafetyScore(params: {
  context: SafetyContext;
  incidents?: Incident[];
  situational?: Partial<SituationalParams>;
  baseRates?: Record<string, number>;
}): SafetyResult {
  const { context = 'AWAY', incidents = [], situational = {}, baseRates = {} } = params;
  const w = CONTEXT_WEIGHTS[context];

  const timeKey = situational.timeOfDay ?? 'daytime';
  const densityKey = situational.density ?? 'residential';
  const eventKey = situational.events ?? 'none';
  const weatherKey = situational.weather ?? 'normal';

  const sitMulRaw = (SITUATIONAL_MULTIPLIERS.TIME[timeKey] ?? 1) *
    (SITUATIONAL_MULTIPLIERS.DENSITY[densityKey] ?? 1) *
    (SITUATIONAL_MULTIPLIERS.EVENTS[eventKey] ?? 1) *
    (SITUATIONAL_MULTIPLIERS.WEATHER[weatherKey] ?? 1);
  const sitMul = Math.min(sitMulRaw, SIT_MUL_CAP);

  const rtContrib: Record<string, number> = {};
  for (const inc of incidents) {
    if (!w[inc.crimeType]) continue;
    const d = recencyDecay(inc.timestamp);
    const n = Math.min((inc.rateEquivalent ?? 50) / RATE_CAP, 1);
    rtContrib[inc.crimeType] = (rtContrib[inc.crimeType] ?? 0) + n * w[inc.crimeType] * d;
  }

  const hasLive = incidents.length > 0;
  const lr = hasLive ? 0.70 : 0.00;
  const br = hasLive ? 0.30 : 1.00;

  const allKeys = new Set([...Object.keys(rtContrib), ...Object.keys(baseRates)]);
  let riskSum = 0;
  const breakdown: Record<string, RiskBreakdown> = {};

  for (const k of allKeys) {
    const rv = (rtContrib[k] ?? 0) * lr;
    const bv = (Math.min((baseRates[k] ?? 0) / RATE_CAP, 1) * (w[k] ?? 0)) * br;
    const combined = (rv + bv) * sitMul;
    riskSum += combined;
    const cat = CRIME_CATEGORIES[k];
    breakdown[k] = {
      label: cat?.label ?? k,
      tier: cat?.tier ?? 'unknown',
      icon: cat?.icon ?? '•',
      contextWeight: w[k] ?? 0,
      pts: +(combined * 100).toFixed(1),
    };
  }

  const score = Math.max(0, Math.round(100 - Math.min(riskSum * 100, 100)));
  const riskLevel = score >= 80 ? 'LOW RISK' : score >= 60 ? 'MODERATE' : score >= 40 ? 'ELEVATED' : score >= 20 ? 'HIGH RISK' : 'CRITICAL';
  const riskColor = score >= 80 ? '#22c55e' : score >= 60 ? '#eab308' : score >= 40 ? '#f97316' : '#ef4444';
  const confidence = hasLive ? (incidents.length >= 10 ? 'HIGH' : 'MEDIUM') : 'LOW';

  return { score, riskLevel, riskColor, context, breakdown, sitMul: +sitMul.toFixed(2), hasLive, confidence };
}

/** Detect time-of-day key based on current hour */
export function detectTimeOfDay(): string {
  const h = new Date().getHours();
  if (h >= 6 && h < 18) return 'daytime';
  if (h >= 18 && h < 22) return 'evening';
  return 'nighttime';
}

/** Convert travel-advisory.info score (0-5, 5=danger) to base crime rates */
export function advisoryToBaseRates(rawScore: number): Record<string, number> {
  // rawScore 0=safe, 5=war zone. Scale each crime category proportionally.
  const factor = rawScore / 5; // 0-1
  return {
    robbery: Math.round(40 + factor * 300),
    assault: Math.round(50 + factor * 280),
    sexual_offense: Math.round(15 + factor * 100),
    kidnapping: Math.round(2 + factor * 60),
    burglary: Math.round(80 + factor * 350),
    home_invasion: Math.round(20 + factor * 120),
    vandalism: Math.round(40 + factor * 200),
    larceny_home: Math.round(60 + factor * 300),
    vehicle_theft: Math.round(50 + factor * 250),
    carjacking: Math.round(5 + factor * 80),
    vehicle_break_in: Math.round(70 + factor * 300),
    traffic_incident: Math.round(30 + factor * 200),
    drug_activity: Math.round(30 + factor * 180),
    public_disorder: Math.round(20 + factor * 150),
    weapons_offense: Math.round(15 + factor * 120),
  };
}

/** Convert a category's pts value to a 5-level risk rating label */
export function categoryRating(pts: number): { label: string; level: number; color: string } {
  if (pts < 1)  return { label: 'Very Low', level: 0, color: '#22c55e' };
  if (pts < 3)  return { label: 'Low',      level: 1, color: '#84cc16' };
  if (pts < 6)  return { label: 'Medium',   level: 2, color: '#eab308' };
  if (pts < 10) return { label: 'High',     level: 3, color: '#f97316' };
  return         { label: 'Very High',      level: 4, color: '#ef4444' };
}

/** 5-level safety band from score (0-100) */
export function safetyLevel(score: number): { level: number; label: string; color: string } {
  if (score >= 80) return { level: 4, label: 'Safe', color: '#22c55e' };
  if (score >= 60) return { level: 3, label: 'Safer', color: '#84cc16' };
  if (score >= 40) return { level: 2, label: 'Moderate', color: '#eab308' };
  if (score >= 20) return { level: 1, label: 'Risky', color: '#f97316' };
  return { level: 0, label: 'Unsafe', color: '#ef4444' };
}
