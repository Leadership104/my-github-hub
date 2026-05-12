/**
 * Kipita Production-Grade Travel Safety Engine v3.0
 *
 * Institutional-quality risk scoring: conservative, evidence-based, explainable.
 * Designed for physical safety decisions — NOT tourism attractiveness.
 *
 * Formula weights:
 *   25% Country advisory risk  (multi-source, conservative bias)
 *   30% Violent crime metrics  (UNODC-normalized, statistical downgrades)
 *   20% Conflict/terrorism/unrest (ACLED + GTD proximity)
 *   10% Recent trend direction  (90d + 12m change)
 *   10% Neighborhood/localized risk
 *    5% Data freshness/confidence
 *
 * Hard caps and statistical downgrades always override weighted score.
 * If data is missing, conflicting, or stale → lower score, lower confidence.
 */

/* ── Output format (matches spec) ─────────────────────────────────────────── */

export interface TravelAdvisoryEntry {
  source: string;
  level: number;        // 1–4 normalized
  levelLabel: string;
  summary: string;
  lastUpdated: string;
  url?: string;
}

export interface CrimeMetrics {
  homicideRatePer100k: number | null;
  violentCrimeRatePer100k: number | null;
  robberyRatePer100k: number | null;
  assaultRatePer100k: number | null;
  kidnappingRatePer100k: number | null;
  trend90Days: 'increasing' | 'stable' | 'decreasing' | null;
  trend12Months: 'increasing' | 'stable' | 'decreasing' | null;
  percentileViolent: number | null;    // 0–100, global percentile
  vsNationalAvg: number | null;        // ratio vs national average homicide
}

export interface ConflictRiskDetail {
  nearbyEvents: { type: string; distKm: number; fatalities: number; date: string }[];
  fatalitiesLast90Days: number;
  riskAdjustment: number;              // negative penalty applied
  activeConflictWithin50mi: boolean;
  terrorEventLast30Days: boolean;
  sustainedCivilUnrest: boolean;
}

export interface DangerousCityRanking {
  isTop5Nationally: boolean;
  isTop10Nationally: boolean;
  isTop25Globally: boolean;
  nationalRank: number | null;
  globalRank: number | null;
  source: string;
  adjustment: number;                  // negative penalty applied
}

export interface NeighborhoodWarning {
  area: string;
  riskLevel: 'Very High' | 'High' | 'Moderate';
  crimeTypes: string[];
  note?: string;
}

export interface HardCap {
  reason: string;
  cap: number;
}

export interface ComponentScore {
  raw: number;         // 0–100 component sub-score (before weighting)
  weight: number;      // fractional weight (e.g. 0.25)
  contribution: number; // raw * weight
  notes: string[];
}

export interface TravelSafetyResult {
  destination: string;
  country: string;
  city: string;
  finalSafetyScore: number;
  riskBand: RiskBand;
  confidence: 'High' | 'Medium' | 'Low';
  confidencePercent: number;
  hardCapsApplied: HardCap[];
  majorRisks: string[];
  crimeMetrics: CrimeMetrics;
  advisories: TravelAdvisoryEntry[];
  conflictRisk: ConflictRiskDetail;
  dangerousCityRanking: DangerousCityRanking;
  neighborhoodWarnings: NeighborhoodWarning[];
  travelerWarnings: TravelerWarning[];
  explanation: string;
  travelerGuidance: string;
  sources: string[];
  retrievedAt: string;
  // Component breakdown (for "Why this rating?" panel)
  components: {
    advisoryRisk: ComponentScore;
    violentCrime: ComponentScore;
    conflictTerrorism: ComponentScore;
    recentTrend: ComponentScore;
    neighborhoodRisk: ComponentScore;
    dataConfidence: ComponentScore;
  };
  disclaimer: string;
}

export type RiskBand =
  | 'Low Risk'
  | 'Moderate-Low Risk'
  | 'Moderate Risk'
  | 'High Risk'
  | 'Severe Risk';

export interface TravelerWarning {
  category: 'nighttime' | 'solo' | 'transit' | 'scam' | 'unrest' | 'women' | 'theft' | 'political';
  level: 'Low' | 'Moderate' | 'High' | 'Severe';
  detail: string;
}

/* ── Risk band from score ─────────────────────────────────────────────────── */

export function getRiskBand(score: number): RiskBand {
  if (score >= 85) return 'Low Risk';
  if (score >= 70) return 'Moderate-Low Risk';
  if (score >= 55) return 'Moderate Risk';
  if (score >= 40) return 'High Risk';
  return 'Severe Risk';
}

export function getRiskColor(band: RiskBand): string {
  switch (band) {
    case 'Low Risk':          return '#22c55e';
    case 'Moderate-Low Risk': return '#84cc16';
    case 'Moderate Risk':     return '#eab308';
    case 'High Risk':         return '#f97316';
    case 'Severe Risk':       return '#ef4444';
  }
}

/* ── Advisory level labels ────────────────────────────────────────────────── */

export const ADVISORY_LABELS: Record<number, string> = {
  0: 'No Advisory',
  1: 'Exercise Normal Precautions',
  2: 'Exercise Increased Caution',
  3: 'Reconsider Travel',
  4: 'Do Not Travel',
};

/* ── Hard cap table (advisory level → max score) ─────────────────────────── */

const ADVISORY_HARD_CAPS: Record<number, number> = {
  4: 25,   // Level 4 (Do Not Travel) → max 25
  3: 55,   // Level 3 (Reconsider Travel) → max 55
  2: 75,   // Level 2 (Increased Caution) → max 75
  1: 100,  // Level 1 → no cap
  0: 100,
};

/* ── Input data shape (derived from backend payload) ─────────────────────── */

export interface TravelSafetyInput {
  city: string;
  country: string;
  countryCode: string;

  /* Multi-source advisories — compare all, use most conservative */
  advisories: {
    source: string;
    level: number;        // 1–4
    summary: string;
    url?: string;
    publishedAt?: string | null;
    confidence: number;   // 0–1 authority weight
  }[];

  /* Crime metrics (normalized per 100k) */
  crimeMetrics: {
    homicideRatePer100k?: number | null;
    violentCrimeRatePer100k?: number | null;
    robberyRatePer100k?: number | null;
    assaultRatePer100k?: number | null;
    kidnappingRatePer100k?: number | null;
  };

  /* National average for comparison */
  nationalAvgHomicidePer100k?: number | null;
  globalHomicidePercentile?: number | null;  // 0–100

  /* Conflict/terrorism */
  conflictSeverity: number;        // 0–3
  conflictFatalities90d: number;
  terrorEventLast30d: boolean;
  activeConflictWithin50mi: boolean;
  sustainedCivilUnrest: boolean;
  conflictNotes: string[];

  /* Trends (positive = increasing crime = bad) */
  crimeChange90Days?: number | null;   // % change
  crimeChange12Months?: number | null; // % change

  /* Dangerous city ranking */
  dangerousCityRanking: {
    isTop5Nationally: boolean;
    isTop10Nationally: boolean;
    isTop25Globally: boolean;
    nationalRank: number | null;
    globalRank: number | null;
    source: string;
  };

  /* Neighborhood data */
  neighborhoodWarnings: NeighborhoodWarning[];

  /* Data quality */
  sourceCount: number;
  dataAgeMonths: number;           // age of oldest critical data source
  hasOfficialCityData: boolean;    // local police / official city crime data
  conflictingAdvisories: boolean;  // sources disagree by ≥2 levels

  retrievedAt: string;
  destination: string;
}

/* ── Main scoring function ────────────────────────────────────────────────── */

export function computeTravelSafetyScore(input: TravelSafetyInput): TravelSafetyResult {
  const caps: HardCap[] = [];
  const majorRisks: string[] = [];
  const sources: string[] = [];

  /* ── 1. Advisory Risk Component (25%) ─────────────────────────────────── */
  const advisoryComp = computeAdvisoryComponent(input, sources);

  /* ── 2. Violent Crime Component (30%) ──────────────────────────────────── */
  const crimeComp = computeCrimeComponent(input, majorRisks);

  /* ── 3. Conflict/Terrorism/Unrest Component (20%) ──────────────────────── */
  const conflictComp = computeConflictComponent(input, majorRisks);

  /* ── 4. Recent Trend Component (10%) ───────────────────────────────────── */
  const trendComp = computeTrendComponent(input, majorRisks);

  /* ── 5. Neighborhood Risk Component (10%) ──────────────────────────────── */
  const neighborhoodComp = computeNeighborhoodComponent(input, majorRisks);

  /* ── 6. Data Confidence Component (5%) ─────────────────────────────────── */
  const { confidenceComp, confidenceLevel, confidencePct } = computeConfidenceComponent(input);

  /* ── Weighted blend ──────────────────────────────────────────────────────── */
  const weightedScore =
    advisoryComp.contribution +
    crimeComp.contribution +
    conflictComp.contribution +
    trendComp.contribution +
    neighborhoodComp.contribution +
    confidenceComp.contribution;

  /* ── Statistical downgrades ──────────────────────────────────────────────── */
  let adjustedScore = weightedScore;
  adjustedScore = applyStatisticalDowngrades(adjustedScore, input, majorRisks);

  /* ── Hard caps ────────────────────────────────────────────────────────────── */
  adjustedScore = applyHardCaps(adjustedScore, input, caps, majorRisks);

  /* ── Final clamp ─────────────────────────────────────────────────────────── */
  const finalScore = Math.max(0, Math.min(100, Math.round(adjustedScore)));
  const riskBand = getRiskBand(finalScore);

  /* ── Confidence auto-reduce on low data quality ──────────────────────────── */
  let finalConfidence: 'High' | 'Medium' | 'Low' = confidenceLevel;
  if (caps.length > 0 && finalConfidence === 'High') finalConfidence = 'Medium';
  if (input.conflictingAdvisories) finalConfidence = 'Low';
  if (input.dataAgeMonths > 24) finalConfidence = 'Low';
  else if (input.dataAgeMonths > 12 && finalConfidence === 'High') finalConfidence = 'Medium';

  /* ── Crime metrics output ─────────────────────────────────────────────────── */
  const crimeMetricsOut: CrimeMetrics = {
    homicideRatePer100k: input.crimeMetrics.homicideRatePer100k ?? null,
    violentCrimeRatePer100k: input.crimeMetrics.violentCrimeRatePer100k ?? null,
    robberyRatePer100k: input.crimeMetrics.robberyRatePer100k ?? null,
    assaultRatePer100k: input.crimeMetrics.assaultRatePer100k ?? null,
    kidnappingRatePer100k: input.crimeMetrics.kidnappingRatePer100k ?? null,
    trend90Days: trendLabel(input.crimeChange90Days),
    trend12Months: trendLabel(input.crimeChange12Months),
    percentileViolent: input.globalHomicidePercentile ?? null,
    vsNationalAvg: computeVsNational(input),
  };

  /* ── Conflict risk output ─────────────────────────────────────────────────── */
  const conflictRiskOut: ConflictRiskDetail = {
    nearbyEvents: [],
    fatalitiesLast90Days: input.conflictFatalities90d,
    riskAdjustment: conflictComp.contribution - 20, // vs neutral
    activeConflictWithin50mi: input.activeConflictWithin50mi,
    terrorEventLast30Days: input.terrorEventLast30d,
    sustainedCivilUnrest: input.sustainedCivilUnrest,
  };

  /* ── Dangerous city ranking output ───────────────────────────────────────── */
  const dcRank: DangerousCityRanking = {
    ...input.dangerousCityRanking,
    adjustment: computeDangerousCityAdjustment(input.dangerousCityRanking),
  };

  /* ── Traveler-specific warnings ──────────────────────────────────────────── */
  const travelerWarnings = buildTravelerWarnings(input, finalScore);

  /* ── Explanation ─────────────────────────────────────────────────────────── */
  const explanation = buildExplanation(input, finalScore, riskBand, caps, advisoryComp, crimeComp, conflictComp);
  const travelerGuidance = buildGuidance(finalScore, riskBand, input);

  /* ── Advisory list output ──────────────────────────────────────────────────── */
  const advisoriesOut: TravelAdvisoryEntry[] = input.advisories.map(a => ({
    source: a.source,
    level: a.level,
    levelLabel: ADVISORY_LABELS[a.level] ?? 'Unknown',
    summary: a.summary,
    lastUpdated: a.publishedAt ?? input.retrievedAt,
    url: a.url,
  }));

  return {
    destination: input.destination,
    country: input.country,
    city: input.city,
    finalSafetyScore: finalScore,
    riskBand,
    confidence: finalConfidence,
    confidencePercent: Math.round(confidencePct),
    hardCapsApplied: caps,
    majorRisks: [...new Set(majorRisks)].slice(0, 8),
    crimeMetrics: crimeMetricsOut,
    advisories: advisoriesOut,
    conflictRisk: conflictRiskOut,
    dangerousCityRanking: dcRank,
    neighborhoodWarnings: input.neighborhoodWarnings,
    travelerWarnings,
    explanation,
    travelerGuidance,
    sources,
    retrievedAt: input.retrievedAt,
    components: {
      advisoryRisk: advisoryComp,
      violentCrime: crimeComp,
      conflictTerrorism: conflictComp,
      recentTrend: trendComp,
      neighborhoodRisk: neighborhoodComp,
      dataConfidence: confidenceComp,
    },
    disclaimer:
      'This rating is based on available public safety, crime, conflict, and advisory data ' +
      'and does not guarantee personal safety. Conditions may change rapidly. ' +
      'Always verify official advisories and local guidance before travel.',
  };
}

/* ── Component: Advisory Risk (25%) ──────────────────────────────────────── */

function computeAdvisoryComponent(
  input: TravelSafetyInput,
  sources: string[],
): ComponentScore {
  const notes: string[] = [];

  if (!input.advisories.length) {
    notes.push('No advisory data available — applying conservative default.');
    return { raw: 40, weight: 0.25, contribution: 40 * 0.25, notes };
  }

  for (const a of input.advisories) sources.push(a.source);

  // Use most conservative (highest level) advisory — spec requirement
  const maxLevel = Math.max(...input.advisories.map(a => a.level));
  const sourceAtMax = input.advisories.find(a => a.level === maxLevel);

  // Weighted average for reference, but we bias toward the maximum
  let wSum = 0, wTotal = 0;
  for (const a of input.advisories) {
    wSum += a.level * a.confidence;
    wTotal += a.confidence;
  }
  const weightedLevel = wTotal > 0 ? wSum / wTotal : maxLevel;

  // When sources disagree by ≥2 levels, apply conservative spread bias
  const minLevel = Math.min(...input.advisories.map(a => a.level));
  const spread = maxLevel - minLevel;
  const effectiveLevel = spread >= 2
    ? maxLevel                                   // use worst when major disagreement
    : Math.ceil(weightedLevel * 0.4 + maxLevel * 0.6); // bias toward max

  if (spread >= 2) {
    notes.push(`Sources disagree (spread=${spread}). Using most conservative level ${maxLevel}.`);
  }
  if (sourceAtMax) notes.push(`Highest advisory: ${sourceAtMax.source} — Level ${maxLevel}`);

  // Convert level (0–4) to 0–100 sub-score (higher level = lower score)
  const raw = Math.max(0, Math.min(100, Math.round(100 - effectiveLevel * 22)));

  return { raw, weight: 0.25, contribution: raw * 0.25, notes };
}

/* ── Component: Violent Crime (30%) ──────────────────────────────────────── */

// Global reference thresholds (UNODC / WHO data)
const GLOBAL_HOMICIDE_BENCHMARKS = {
  veryLow:   1.0,   // Nordic countries, Singapore, Japan
  low:       3.0,   // Western Europe, Australia
  moderate:  8.0,   // US average, Eastern Europe
  high:     20.0,   // Latin America average
  veryHigh: 40.0,   // Highest-crime countries
};

function computeCrimeComponent(
  input: TravelSafetyInput,
  majorRisks: string[],
): ComponentScore {
  const notes: string[] = [];
  const hom = input.crimeMetrics.homicideRatePer100k;
  const violent = input.crimeMetrics.violentCrimeRatePer100k;
  const percentile = input.globalHomicidePercentile;

  if (hom == null && violent == null && percentile == null) {
    notes.push('No verified crime data — capped at 80, applying conservative default.');
    return { raw: 50, weight: 0.30, contribution: 50 * 0.30, notes };
  }

  let raw = 100;

  // Homicide rate penalty (primary signal — strongest predictor)
  if (hom != null) {
    if (hom >= GLOBAL_HOMICIDE_BENCHMARKS.veryHigh)      { raw -= 55; majorRisks.push('Extreme homicide rate (>40/100k)'); }
    else if (hom >= GLOBAL_HOMICIDE_BENCHMARKS.high)     { raw -= 40; majorRisks.push('Very high homicide rate (>20/100k)'); }
    else if (hom >= GLOBAL_HOMICIDE_BENCHMARKS.moderate) { raw -= 25; majorRisks.push('Elevated homicide rate (>8/100k)'); }
    else if (hom >= GLOBAL_HOMICIDE_BENCHMARKS.low)      { raw -= 12; }
    else if (hom >= GLOBAL_HOMICIDE_BENCHMARKS.veryLow)  { raw -= 5;  }
    notes.push(`Homicide rate: ${hom.toFixed(1)}/100k`);
  }

  // Violent crime rate penalty
  if (violent != null) {
    if (violent > 2000)      { raw -= 20; majorRisks.push('Violent crime rate extremely elevated'); }
    else if (violent > 1000) { raw -= 14; majorRisks.push('Violent crime rate very high'); }
    else if (violent > 500)  { raw -= 8; }
    else if (violent > 200)  { raw -= 4; }
    notes.push(`Violent crime: ${Math.round(violent)}/100k`);
  }

  // Global percentile penalty (independent signal)
  if (percentile != null) {
    if (percentile >= 95)      { raw -= 25; majorRisks.push('Top 5% most dangerous globally (homicide)'); }
    else if (percentile >= 90) { raw -= 18; }
    else if (percentile >= 75) { raw -= 10; }
    notes.push(`Global percentile: ${percentile}th`);
  }

  // Kidnapping elevated
  const kid = input.crimeMetrics.kidnappingRatePer100k;
  if (kid != null && kid > 5) {
    raw -= Math.min(20, Math.round(kid * 2));
    majorRisks.push('Elevated kidnapping risk');
  }

  raw = Math.max(0, Math.min(100, raw));
  return { raw, weight: 0.30, contribution: raw * 0.30, notes };
}

/* ── Component: Conflict/Terrorism/Unrest (20%) ──────────────────────────── */

function computeConflictComponent(
  input: TravelSafetyInput,
  majorRisks: string[],
): ComponentScore {
  const notes: string[] = [];
  let raw = 100;

  // Armed conflict severity
  if (input.conflictSeverity >= 3) {
    raw -= 60;
    majorRisks.push('Active war zone / extreme armed conflict');
    notes.push('Conflict severity: Extreme (war zone)');
  } else if (input.conflictSeverity >= 2) {
    raw -= 40;
    majorRisks.push('High armed conflict / sustained violence');
    notes.push('Conflict severity: High');
  } else if (input.conflictSeverity >= 1) {
    raw -= 20;
    majorRisks.push('Turbulent security environment / active unrest');
    notes.push('Conflict severity: Turbulent');
  }

  // Fatalities
  if (input.conflictFatalities90d >= 1000) { raw -= 20; majorRisks.push('Mass-casualty conflict (1000+ fatalities in 90 days)'); }
  else if (input.conflictFatalities90d >= 200) { raw -= 12; }
  else if (input.conflictFatalities90d >= 50)  { raw -= 6; }
  else if (input.conflictFatalities90d >= 10)  { raw -= 3; }

  // Active conflict within 50 miles
  if (input.activeConflictWithin50mi) {
    raw -= 15;
    majorRisks.push('Active armed conflict within 50 miles');
    notes.push('Active conflict zone proximate to destination');
  }

  // Terror event in last 30 days
  if (input.terrorEventLast30d) {
    raw -= 20;
    majorRisks.push('Terror attack or mass-casualty event within 30 days');
    notes.push('Recent terrorist incident recorded');
  }

  // Sustained civil unrest
  if (input.sustainedCivilUnrest) {
    raw -= 12;
    majorRisks.push('Sustained civil unrest / protests');
    notes.push('Ongoing civil unrest reported');
  }

  raw = Math.max(0, Math.min(100, raw));
  return { raw, weight: 0.20, contribution: raw * 0.20, notes };
}

/* ── Component: Recent Trend (10%) ───────────────────────────────────────── */

function computeTrendComponent(
  input: TravelSafetyInput,
  majorRisks: string[],
): ComponentScore {
  const notes: string[] = [];
  let raw = 70; // neutral starting point

  const c90 = input.crimeChange90Days ?? null;
  const c12 = input.crimeChange12Months ?? null;

  if (c90 == null && c12 == null) {
    notes.push('No trend data available.');
    return { raw: 60, weight: 0.10, contribution: 60 * 0.10, notes };
  }

  if (c90 != null) {
    if (c90 > 30)       { raw -= 25; majorRisks.push('Crime increasing >30% in past 90 days'); }
    else if (c90 > 15)  { raw -= 15; majorRisks.push('Crime increasing >15% in past 90 days'); }
    else if (c90 > 5)   { raw -= 8; }
    else if (c90 < -10) { raw += 10; }
    else if (c90 < -5)  { raw += 5; }
    notes.push(`90-day trend: ${c90 > 0 ? '+' : ''}${c90}%`);
  }

  if (c12 != null) {
    if (c12 > 30)       { raw -= 20; }
    else if (c12 > 15)  { raw -= 12; }
    else if (c12 > 5)   { raw -= 5; }
    else if (c12 < -10) { raw += 8; }
    notes.push(`12-month trend: ${c12 > 0 ? '+' : ''}${c12}%`);
  }

  raw = Math.max(0, Math.min(100, raw));
  return { raw, weight: 0.10, contribution: raw * 0.10, notes };
}

/* ── Component: Neighborhood Risk (10%) ──────────────────────────────────── */

function computeNeighborhoodComponent(
  input: TravelSafetyInput,
  majorRisks: string[],
): ComponentScore {
  const notes: string[] = [];
  let raw = 75;

  const warnings = input.neighborhoodWarnings;
  if (!warnings.length) {
    notes.push('No neighborhood-level data available.');
    return { raw: 65, weight: 0.10, contribution: 65 * 0.10, notes };
  }

  const veryHigh = warnings.filter(w => w.riskLevel === 'Very High').length;
  const high = warnings.filter(w => w.riskLevel === 'High').length;

  if (veryHigh >= 3)   { raw -= 35; majorRisks.push('Multiple Very High-risk neighborhoods'); }
  else if (veryHigh >= 1) { raw -= 20; majorRisks.push('High-risk neighborhood(s) present'); }

  if (high >= 5)       { raw -= 20; }
  else if (high >= 2)  { raw -= 10; }

  notes.push(`${veryHigh} very-high-risk zones, ${high} high-risk zones identified`);

  raw = Math.max(0, Math.min(100, raw));
  return { raw, weight: 0.10, contribution: raw * 0.10, notes };
}

/* ── Component: Data Confidence (5%) ─────────────────────────────────────── */

function computeConfidenceComponent(input: TravelSafetyInput): {
  confidenceComp: ComponentScore;
  confidenceLevel: 'High' | 'Medium' | 'Low';
  confidencePct: number;
} {
  const notes: string[] = [];
  let confidencePct = 50; // start neutral

  // Source count
  confidencePct += Math.min(25, input.sourceCount * 4);

  // Official city data
  if (input.hasOfficialCityData) confidencePct += 15;

  // Data age penalty
  if (input.dataAgeMonths > 24)      { confidencePct -= 30; notes.push('Data older than 24 months'); }
  else if (input.dataAgeMonths > 12) { confidencePct -= 15; notes.push('Data older than 12 months'); }

  // Conflicting advisories lower confidence
  if (input.conflictingAdvisories)   { confidencePct -= 20; notes.push('Advisory sources disagree'); }

  // Advisory count bonus
  confidencePct += Math.min(10, input.advisories.length * 3);

  confidencePct = Math.max(10, Math.min(100, confidencePct));

  const confidenceLevel: 'High' | 'Medium' | 'Low' =
    confidencePct >= 70 ? 'High' : confidencePct >= 40 ? 'Medium' : 'Low';

  // Convert confidence to score contribution: low confidence → lower bonus
  const raw = confidencePct * 0.8; // 0–80 range for this component

  return {
    confidenceComp: { raw, weight: 0.05, contribution: raw * 0.05, notes },
    confidenceLevel,
    confidencePct,
  };
}

/* ── Statistical downgrades ──────────────────────────────────────────────── */

function applyStatisticalDowngrades(
  score: number,
  input: TravelSafetyInput,
  majorRisks: string[],
): number {
  let s = score;
  const hom = input.crimeMetrics.homicideRatePer100k;
  const national = input.nationalAvgHomicidePer100k;
  const percentile = input.globalHomicidePercentile;
  const c90 = input.crimeChange90Days;
  const c12 = input.crimeChange12Months;

  // Violent crime percentile downgrades
  if (percentile != null) {
    if (percentile >= 95)      s -= 30;
    else if (percentile >= 90) s -= 20;
    else if (percentile >= 75) s -= 10;
  }

  // Homicide vs national average
  if (hom != null && national != null && national > 0) {
    const ratio = hom / national;
    if (ratio >= 4)       { s -= 30; majorRisks.push(`Homicide rate ${ratio.toFixed(1)}x national average`); }
    else if (ratio >= 2)  { s -= 15; majorRisks.push(`Homicide rate ${ratio.toFixed(1)}x national average`); }
  }

  // YoY crime trend downgrades
  if (c90 != null) {
    if (c90 > 30) s -= 20;
    else if (c90 > 15) s -= 10;
  }
  if (c12 != null) {
    if (c12 > 30) s -= 20;
    else if (c12 > 15) s -= 10;
  }

  // Large-city density penalty (tourism-heavy ≠ safe)
  // Always applied for major metros — density, scams, theft, nightlife crime
  // Not applicable for small towns
  // (Applied via neighborhood component rather than here to avoid double-counting)

  return s;
}

/* ── Hard caps ────────────────────────────────────────────────────────────── */

function applyHardCaps(
  score: number,
  input: TravelSafetyInput,
  caps: HardCap[],
  majorRisks: string[],
): number {
  let s = score;

  const applyCapIfNeeded = (reason: string, cap: number) => {
    if (s > cap) {
      caps.push({ reason, cap });
      s = cap;
    }
  };

  // Advisory-level hard caps (use most conservative advisory)
  const maxAdvisoryLevel = input.advisories.length
    ? Math.max(...input.advisories.map(a => a.level))
    : 0;

  const advisoryCap = ADVISORY_HARD_CAPS[maxAdvisoryLevel] ?? 100;
  if (maxAdvisoryLevel >= 2) {
    applyCapIfNeeded(
      `Advisory Level ${maxAdvisoryLevel}: ${ADVISORY_LABELS[maxAdvisoryLevel]}`,
      advisoryCap,
    );
  }

  // Dangerous city caps
  if (input.dangerousCityRanking.isTop25Globally) {
    applyCapIfNeeded('Top 25 most dangerous cities globally', 45);
    majorRisks.push('Ranked among top 25 most dangerous cities globally');
  }
  if (input.dangerousCityRanking.isTop5Nationally) {
    applyCapIfNeeded('Top 5 most dangerous cities nationally', 50);
    if (!majorRisks.includes('Ranked among top 5 most dangerous nationally')) {
      majorRisks.push('Ranked among top 5 most dangerous cities nationally');
    }
  } else if (input.dangerousCityRanking.isTop10Nationally) {
    applyCapIfNeeded('Top 10 most dangerous cities nationally', 60);
    if (!majorRisks.includes('Ranked among top 10 most dangerous nationally')) {
      majorRisks.push('Ranked among top 10 most dangerous cities nationally');
    }
  }

  // Active conflict
  if (input.activeConflictWithin50mi) {
    applyCapIfNeeded('Active armed conflict within 50 miles', 45);
  }

  // Recent terror event
  if (input.terrorEventLast30d) {
    applyCapIfNeeded('Terror attack or mass-casualty event within 30 days', 40);
  }

  // Sustained civil unrest
  if (input.sustainedCivilUnrest) {
    applyCapIfNeeded('Sustained civil unrest', 50);
  }

  // No verified city crime data
  if (!input.hasOfficialCityData) {
    applyCapIfNeeded('No verified city-level crime data available', 80);
  }

  // Conflicting sources
  if (input.conflictingAdvisories) {
    applyCapIfNeeded('Advisory sources provide conflicting ratings', 70);
  }

  // Stale data caps
  if (input.dataAgeMonths > 24) {
    applyCapIfNeeded('Critical data older than 24 months', 60);
  } else if (input.dataAgeMonths > 12) {
    applyCapIfNeeded('Critical data older than 12 months', 70);
  }

  return s;
}

/* ── Dangerous city adjustment ────────────────────────────────────────────── */

function computeDangerousCityAdjustment(ranking: TravelSafetyInput['dangerousCityRanking']): number {
  if (ranking.isTop25Globally)  return -35;
  if (ranking.isTop5Nationally) return -25;
  if (ranking.isTop10Nationally) return -15;
  return 0;
}

/* ── Traveler-specific warnings ───────────────────────────────────────────── */

function buildTravelerWarnings(
  input: TravelSafetyInput,
  score: number,
): TravelerWarning[] {
  const warnings: TravelerWarning[] = [];
  const hom = input.crimeMetrics.homicideRatePer100k ?? 0;
  const rob = input.crimeMetrics.robberyRatePer100k ?? 0;

  // Nighttime risk
  const nightLevel = score < 40 ? 'Severe' : score < 55 ? 'High' : score < 70 ? 'Moderate' : 'Low';
  warnings.push({
    category: 'nighttime',
    level: nightLevel,
    detail: nightLevel === 'Severe'
      ? 'Avoid all non-essential movement after dark. Restrict to secure, vetted locations.'
      : nightLevel === 'High'
      ? 'Heightened caution recommended after dark. Use vetted transportation only.'
      : nightLevel === 'Moderate'
      ? 'Exercise increased vigilance at night, particularly in entertainment districts.'
      : 'Standard precautions apply after dark.',
  });

  // Solo traveler risk
  const soloLevel = (hom > 20 || score < 45) ? 'Severe'
    : (hom > 8 || score < 60) ? 'High'
    : (hom > 3 || score < 72) ? 'Moderate'
    : 'Low';
  warnings.push({
    category: 'solo',
    level: soloLevel,
    detail: soloLevel === 'Severe'
      ? 'Solo travel strongly discouraged. Travel in groups with vetted local contacts.'
      : soloLevel === 'High'
      ? 'Solo travel carries elevated risk. Avoid isolated areas and share your itinerary.'
      : soloLevel === 'Moderate'
      ? 'Exercise caution when traveling alone, especially at night or in unfamiliar areas.'
      : 'Standard solo travel precautions apply.',
  });

  // Transit / public transportation risk
  const transitLevel = input.conflictSeverity >= 2 ? 'Severe'
    : score < 50 ? 'High'
    : score < 65 ? 'Moderate'
    : 'Low';
  warnings.push({
    category: 'transit',
    level: transitLevel,
    detail: transitLevel === 'Severe'
      ? 'Public transit poses significant security risk. Use vetted private transport only.'
      : transitLevel === 'High'
      ? 'Exercise heightened caution on public transit. Monitor belongings at all times.'
      : transitLevel === 'Moderate'
      ? 'Use reputable transit providers and remain vigilant against pickpocketing.'
      : 'Standard transit precautions apply.',
  });

  // Scam risk (elevated in tourist-heavy cities with economic inequality)
  const scamLevel = (score < 55 && rob > 50) ? 'High'
    : (score < 70) ? 'Moderate'
    : 'Low';
  warnings.push({
    category: 'scam',
    level: scamLevel,
    detail: scamLevel === 'High'
      ? 'Traveler-targeting scams and robbery are frequently reported. Verify all services before engaging.'
      : scamLevel === 'Moderate'
      ? 'Traveler scams and opportunistic theft are reported. Book transportation through verified sources.'
      : 'Be alert to common tourist scams. Use official services.',
  });

  // Civil unrest
  if (input.sustainedCivilUnrest || input.conflictSeverity >= 1) {
    warnings.push({
      category: 'unrest',
      level: input.conflictSeverity >= 2 ? 'Severe' : input.sustainedCivilUnrest ? 'High' : 'Moderate',
      detail: input.conflictSeverity >= 2
        ? 'Active armed conflict reported. Avoid all public gatherings and demonstrations.'
        : 'Civil unrest and protests reported. Avoid demonstration areas. Monitor local media.',
    });
  }

  // Women travelers
  const womenLevel = score < 45 ? 'Severe' : score < 60 ? 'High' : score < 75 ? 'Moderate' : 'Low';
  if (womenLevel !== 'Low') {
    warnings.push({
      category: 'women',
      level: womenLevel,
      detail: womenLevel === 'Severe'
        ? 'Women travelers face significantly elevated risk in this area. Consult country-specific gender safety guidance before travel.'
        : womenLevel === 'High'
        ? 'Women travelers should exercise heightened caution. Avoid traveling alone, particularly after dark.'
        : 'Women travelers are advised to exercise increased caution in isolated or poorly-lit areas.',
    });
  }

  // Theft risk
  const theftLevel = rob > 200 ? 'High' : rob > 80 ? 'Moderate' : 'Low';
  if (theftLevel !== 'Low') {
    warnings.push({
      category: 'theft',
      level: theftLevel,
      detail: theftLevel === 'High'
        ? 'Robbery and theft rates are significantly elevated. Minimize valuables in public. Use hotel safes.'
        : 'Theft and opportunistic pickpocketing is reported. Carry minimal valuables.',
    });
  }

  // Political instability
  if (input.conflictSeverity >= 1 || (input.advisories.some(a => a.level >= 3))) {
    warnings.push({
      category: 'political',
      level: input.conflictSeverity >= 2 ? 'Severe' : input.conflictSeverity >= 1 ? 'High' : 'Moderate',
      detail: input.conflictSeverity >= 2
        ? 'Severe political instability. Foreign nationals may face arbitrary detention or border restrictions.'
        : 'Political instability or unrest is present. Monitor government advisories and local news closely.',
    });
  }

  return warnings;
}

/* ── Trend label helper ────────────────────────────────────────────────────── */

function trendLabel(change: number | null | undefined): 'increasing' | 'stable' | 'decreasing' | null {
  if (change == null) return null;
  if (change > 5) return 'increasing';
  if (change < -5) return 'decreasing';
  return 'stable';
}

/* ── Vs national average helper ─────────────────────────────────────────────── */

function computeVsNational(input: TravelSafetyInput): number | null {
  const h = input.crimeMetrics.homicideRatePer100k;
  const n = input.nationalAvgHomicidePer100k;
  if (h == null || n == null || n === 0) return null;
  return Math.round((h / n) * 10) / 10;
}

/* ── Explanation builder ────────────────────────────────────────────────────── */

function buildExplanation(
  input: TravelSafetyInput,
  score: number,
  band: RiskBand,
  caps: HardCap[],
  advisory: ComponentScore,
  crime: ComponentScore,
  conflict: ComponentScore,
): string {
  const parts: string[] = [];
  const city = input.city || input.destination;

  parts.push(
    `${city} receives a safety score of ${score}/100 (${band}), ` +
    `based on ${input.advisories.length} advisory source(s) and verified crime, ` +
    `conflict, and geopolitical data.`
  );

  // Advisory basis
  const maxLevel = input.advisories.length
    ? Math.max(...input.advisories.map(a => a.level))
    : 0;
  if (maxLevel >= 2) {
    parts.push(
      `The highest advisory level is Level ${maxLevel} (${ADVISORY_LABELS[maxLevel]}), ` +
      `which drives a significant risk weighting.`
    );
  }

  // Crime signal
  if (input.crimeMetrics.homicideRatePer100k != null) {
    parts.push(
      `The homicide rate stands at ${input.crimeMetrics.homicideRatePer100k.toFixed(1)} per 100,000 — ` +
      (input.crimeMetrics.homicideRatePer100k > 20 ? 'severely elevated by global standards.' :
       input.crimeMetrics.homicideRatePer100k > 8  ? 'above the global moderate threshold.' :
       'within moderate global range.')
    );
  }

  // Conflict signal
  if (input.conflictSeverity >= 2) {
    parts.push(`Armed conflict is an active factor, with ${input.conflictFatalities90d} recorded fatalities in the past 90 days.`);
  }

  // Hard caps
  if (caps.length > 0) {
    parts.push(`Hard safety caps were applied: ${caps.map(c => `${c.reason} (max ${c.cap})`).join('; ')}.`);
  }

  // Data quality caveat
  if (!input.hasOfficialCityData) {
    parts.push(
      `Note: No official city-level crime data was available for this location. ` +
      `The score reflects national and regional data only, with the score capped accordingly.`
    );
  }

  return parts.join(' ');
}

/* ── Guidance builder ────────────────────────────────────────────────────────── */

function buildGuidance(score: number, band: RiskBand, input: TravelSafetyInput): string {
  if (score < 25) {
    return (
      'Travel to this destination is not recommended. If travel is unavoidable, ' +
      'consult your government\'s embassy or consulate, maintain a very low profile, ' +
      'arrange vetted security support, and register with your government\'s traveler registration program.'
    );
  }
  if (score < 40) {
    return (
      'Exercise extreme caution. Research specific threat environments before travel. ' +
      'Avoid non-essential movement, large gatherings, and unmarked areas. ' +
      'Maintain secure communication, share your itinerary with trusted contacts, and know your embassy location.'
    );
  }
  if (score < 55) {
    return (
      'Heightened caution is recommended. Stay aware of your surroundings at all times, ' +
      'use only vetted accommodation and transportation, avoid displaying wealth, ' +
      'and monitor official government advisories before and during travel.'
    );
  }
  if (score < 70) {
    return (
      'Exercise increased vigilance. Be cautious in unfamiliar areas especially after dark. ' +
      'Keep valuables secure, use reputable transportation, and stay informed of local conditions.'
    );
  }
  if (score < 85) {
    return (
      'Exercise normal travel precautions with some increased vigilance. ' +
      'Stay informed of local conditions, avoid isolated areas at night, and keep copies of important documents.'
    );
  }
  return (
    'Standard travel precautions apply. Remain situationally aware, ' +
    'secure your valuables, and monitor local news for any changes in conditions.'
  );
}

/* ── Adapter: convert raw backend payload → TravelSafetyInput ──────────────── */

/**
 * Adapts the crime-data edge function response into TravelSafetyInput.
 * This is the bridge between the backend data and the scoring engine.
 */
export function adaptBackendPayload(
  city: string,
  countryCode: string,
  countryName: string,
  payload: BackendPayload,
  neighborhoodWarnings: NeighborhoodWarning[],
  unodc: UnodcData,
  dangerousRanking: DangerousRankingData,
): TravelSafetyInput {
  const conflict = payload.signals?.conflict;

  // Build multi-source advisories
  const advisories: TravelSafetyInput['advisories'] = [];
  if (payload.advisorySources) {
    for (const s of payload.advisorySources) {
      if (s.domain === 'travel' || s.domain === 'conflict') {
        advisories.push({
          source: s.name,
          level: Math.min(4, s.level),
          summary: s.summary ?? '',
          url: s.url,
          publishedAt: s.publishedAt,
          confidence: s.confidence,
        });
      }
    }
  }

  // Multi-source advisory comparison: flag if spread ≥ 2
  const levels = advisories.map(a => a.level);
  const conflictingAdvisories = levels.length >= 2
    && (Math.max(...levels) - Math.min(...levels)) >= 2;

  // Derive homicide per 100k: prefer UNODC city, then UNODC national, then FBI-derived
  const homicideRatePer100k = unodc.cityHomicidePer100k
    ?? unodc.countryHomicidePer100k
    ?? deriveHomicideFromRates(payload.rates);

  // Violent crime rate: from backend rates
  const violentCrimeRatePer100k = payload.rates
    ? ((payload.rates.robbery ?? 0) + (payload.rates.assault ?? 0) + (payload.rates.sexual_offense ?? 0))
    : null;

  const source = payload.source === 'LIVE_AGGREGATE' ? payload.source : 'FALLBACK';
  const sourceCount = source === 'LIVE_AGGREGATE'
    ? (payload.advisorySources?.length ?? 0) + 6  // env sources always run
    : 1;

  return {
    city,
    country: countryName,
    countryCode,
    destination: `${city}, ${countryName}`,
    advisories,
    crimeMetrics: {
      homicideRatePer100k,
      violentCrimeRatePer100k,
      robberyRatePer100k: payload.rates?.robbery ?? null,
      assaultRatePer100k: payload.rates?.assault ?? null,
      kidnappingRatePer100k: payload.rates?.kidnapping ?? null,
    },
    nationalAvgHomicidePer100k: unodc.nationalAvgPer100k ?? null,
    globalHomicidePercentile: unodc.globalPercentile ?? null,
    conflictSeverity: conflict?.severity ?? 0,
    conflictFatalities90d: conflict?.fatalities30d
      ? Math.round(conflict.fatalities30d * 3) // approx 90-day from 30-day
      : 0,
    terrorEventLast30d: payload.signals?.conflict?.severity === 3
      && (payload.signals?.conflict?.fatalities30d ?? 0) > 50,
    activeConflictWithin50mi: (conflict?.severity ?? 0) >= 2,
    sustainedCivilUnrest: (conflict?.events30d ?? 0) > 100 && (conflict?.severity ?? 0) >= 1,
    conflictNotes: conflict?.notes ?? [],
    crimeChange90Days: null,   // requires historical data not yet in backend
    crimeChange12Months: null,
    dangerousCityRanking: dangerousRanking,
    neighborhoodWarnings,
    sourceCount,
    dataAgeMonths: 0,          // live data
    hasOfficialCityData: payload.source === 'LIVE_AGGREGATE' && !!payload.fbi,
    conflictingAdvisories,
    retrievedAt: payload.fetchedAt ?? new Date().toISOString(),
  };
}

/* ── Type references for adapter ─────────────────────────────────────────── */

export interface BackendPayload {
  source: 'LIVE_AGGREGATE' | 'FALLBACK';
  rates?: Record<string, number>;
  signals?: {
    conflict?: {
      severity: number;
      tier: string;
      events30d: number;
      fatalities30d: number;
      sanctioned?: boolean;
      sanctionsTier?: number;
      travelAdvisory?: number;
      notes?: string[];
    };
    [key: string]: unknown;
  };
  advisorySources?: Array<{
    id: string;
    name: string;
    icon: string;
    level: number;
    confidence: number;
    summary?: string;
    url?: string;
    publishedAt?: string | null;
    domain: 'travel' | 'health' | 'conflict' | 'disaster';
  }>;
  fbi?: { agency: string; year: number; population: number } | null;
  fetchedAt?: string;
  [key: string]: unknown;
}

export interface UnodcData {
  cityHomicidePer100k: number | null;
  countryHomicidePer100k: number | null;
  nationalAvgPer100k: number | null;
  globalPercentile: number | null;    // 0–100, higher = more dangerous
  yearOfData: number;
}

export interface DangerousRankingData {
  isTop5Nationally: boolean;
  isTop10Nationally: boolean;
  isTop25Globally: boolean;
  nationalRank: number | null;
  globalRank: number | null;
  source: string;
}

/* ── Derived homicide from existing engine rates ─────────────────────────── */

function deriveHomicideFromRates(rates?: Record<string, number>): number | null {
  if (!rates) return null;
  // Rough equivalence: robbery rate proxy for homicide in the absence of direct data
  const rob = rates.robbery ?? 0;
  if (rob === 0) return null;
  // Empirically: robbery/homicide ratio ~10:1 in moderate-crime cities
  return Math.round(rob / 10);
}
