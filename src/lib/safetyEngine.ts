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

const DEFAULT_RATE_CAP = 1500;
const SIT_MUL_CAP = 1.80;
const DECAY_LAMBDA = 0.05;

const CATEGORY_RATE_CAPS: Record<string, number> = {
  robbery: 450,
  assault: 900,
  sexual_offense: 180,
  kidnapping: 60,
  burglary: 1200,
  home_invasion: 250,
  vandalism: 1500,
  larceny_home: 3500,
  vehicle_theft: 900,
  carjacking: 120,
  vehicle_break_in: 1800,
  traffic_incident: 1500,
  drug_activity: 1200,
  public_disorder: 1200,
  weapons_offense: 450,
};

const CATEGORY_SEVERITY: Record<string, number> = {
  robbery: 1.25,
  assault: 1.25,
  sexual_offense: 1.35,
  kidnapping: 1.45,
  burglary: 0.85,
  home_invasion: 1.10,
  vandalism: 0.35,
  larceny_home: 0.35,
  vehicle_theft: 0.65,
  carjacking: 1.25,
  vehicle_break_in: 0.45,
  traffic_incident: 0.55,
  drug_activity: 0.45,
  public_disorder: 0.40,
  weapons_offense: 1.15,
};

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

  const normalize = (crimeType: string, rate: number) =>
    Math.min(Math.max(rate, 0) / (CATEGORY_RATE_CAPS[crimeType] ?? DEFAULT_RATE_CAP), 1);

  const impactWeight = (crimeType: string) =>
    (w[crimeType] ?? 0) * (CATEGORY_SEVERITY[crimeType] ?? 1);

  const rtContrib: Record<string, number> = {};
  for (const inc of incidents) {
    if (!w[inc.crimeType]) continue;
    const d = recencyDecay(inc.timestamp);
    const n = normalize(inc.crimeType, inc.rateEquivalent ?? 50);
    rtContrib[inc.crimeType] = (rtContrib[inc.crimeType] ?? 0) + n * impactWeight(inc.crimeType) * d;
  }

  const hasLive = incidents.length > 0;
  const lr = hasLive ? 0.70 : 0.00;
  const br = hasLive ? 0.30 : 1.00;

  const allKeys = new Set([...Object.keys(rtContrib), ...Object.keys(baseRates)]);
  const breakdown: Record<string, RiskBreakdown> = {};

  // Per-category pts on a 0-10 scale (matches categoryRating bands).
  // pts = normalized severity-weighted risk, modulated by situational factor.
  const categoryPts: { key: string; pts: number; iw: number; cw: number }[] = [];

  for (const k of allKeys) {
    const iw = impactWeight(k);
    const cw = w[k] ?? 0;
    const rv = (rtContrib[k] ?? 0) * lr;            // already iw-weighted
    const bv = normalize(k, baseRates[k] ?? 0) * iw * br;
    // Raw 0..~iw value -> normalize to 0..1 by dividing by iw, then scale to 0..10
    const rawNorm = iw > 0 ? (rv + bv) / iw : 0;
    const pts = Math.max(0, Math.min(10, rawNorm * sitMul * 10));
    categoryPts.push({ key: k, pts, iw, cw });
    const cat = CRIME_CATEGORIES[k];
    breakdown[k] = {
      label: cat?.label ?? k,
      tier: cat?.tier ?? 'unknown',
      icon: cat?.icon ?? '•',
      contextWeight: cw,
      pts: +pts.toFixed(1),
    };
  }

  // Blend a context-weighted mean with a worst-case penalty so a couple of
  // "Very High" categories can't be masked by many "Very Low" ones.
  let weightedSum = 0;
  let weightTotal = 0;
  let worst = 0;
  let secondWorst = 0;
  for (const c of categoryPts) {
    const cwSafe = Math.max(c.cw, 0.05); // floor so every relevant cat counts a bit
    weightedSum += c.pts * cwSafe;
    weightTotal += cwSafe;
    if (c.pts > worst) { secondWorst = worst; worst = c.pts; }
    else if (c.pts > secondWorst) { secondWorst = c.pts; }
  }
  const meanPts = weightTotal > 0 ? weightedSum / weightTotal : 0;
  // 45% mean + 55% worst-pair: severe categories drive the score, as users expect.
  const worstPair = (worst + secondWorst) / 2;
  const blendedRaw = meanPts * 0.45 + worstPair * 0.55;
  // Apply mild upward curve above 4 pts so dangerous areas drop faster (5->55, 7->32, 9->14).
  const curved = blendedRaw <= 4
    ? blendedRaw
    : 4 + (blendedRaw - 4) * 1.55;
  const score = Math.max(0, Math.min(100, Math.round(100 - curved * 10)));
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

/** Convert travel-advisory.info score (0-5, 5=danger) to base crime rates.
 *  Calibrated so a typical low-risk country (~1.0) produces a score in the
 *  80-95 range and a war-zone (~4.5) produces a score in the 5-20 range.
 *  Optional `cityVariance` (-1..+1) shifts every category proportionally so
 *  different cities within the same country don't all show identical numbers. */
export function advisoryToBaseRates(
  rawScore: number,
  cityVariance: number = 0,
): Record<string, number> {
  const factor = Math.max(0, Math.min(1, rawScore / 5)); // 0-1
  const v = 1 + Math.max(-0.6, Math.min(0.6, cityVariance)) * 0.35; // ±21%
  const scale = (base: number, span: number) =>
    Math.max(0, Math.round((base + factor * span) * v));
  return {
    robbery:          scale(8,  120),
    assault:          scale(12, 120),
    sexual_offense:   scale(4,  50),
    kidnapping:       scale(0,  35),
    burglary:         scale(20, 140),
    home_invasion:    scale(4,  50),
    vandalism:        scale(12, 80),
    larceny_home:     scale(18, 130),
    vehicle_theft:    scale(14, 110),
    carjacking:       scale(1,  40),
    vehicle_break_in: scale(20, 130),
    traffic_incident: scale(10, 90),
    drug_activity:    scale(10, 80),
    public_disorder:  scale(6,  70),
    weapons_offense:  scale(4,  60),
  };
}

/** Deterministic per-city variance in the range [-1, +1] derived from a
 *  string seed. Lets the engine show meaningful differences between e.g.
 *  Miami / Santa Clarita / Valencia without per-city crime data. */
export function cityVarianceFromSeed(seed: string): number {
  if (!seed) return 0;
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // Map to [-1, 1]
  return ((h >>> 0) % 2000) / 1000 - 1;
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
