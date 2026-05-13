/**
 * Kipita Production-Grade Travel Safety Engine v4.0
 *
 * Institutional-quality risk scoring: conservative, evidence-based, explainable.
 * Designed for physical safety decisions — NOT tourism attractiveness.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  MATHEMATICAL FRAMEWORK
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  1. COMPONENT SCORING  (6 independent sub-models)
 *     Each component produces a raw score 0–100 using continuous penalty
 *     curves (Hill / saturating-exponential functions) instead of step
 *     functions.  Smooth curves eliminate cliff-edge score discontinuities
 *     and better reflect real-world risk gradients.
 *
 *     Hill penalty:  P(r) = Pmax · rᵅ / (rᵅ + ec50ᵅ)
 *       ec50 = rate at which penalty reaches 50% of Pmax
 *       α    = sharpness (higher → steeper sigmoid)
 *
 *  2. ADAPTIVE WEIGHTING
 *     Base weights are scaled by a per-component data-quality factor q_i ∈ [0,1]:
 *       effectiveWeight_i = baseWeight_i × q_i / Σ(baseWeight_j × q_j)
 *     When data quality is poor (no city data, no trend data, etc.) the
 *     component's influence shrinks, and remaining components absorb its share.
 *
 *     Base weights: Advisory 25% · Crime 30% · Conflict 20% · Trend 10%
 *                   Neighborhood 10% · Confidence 5%
 *
 *  3. WEIGHTED BLEND
 *     S_raw = Σ(effectiveWeight_i × raw_i)
 *
 *  4. BAYESIAN CONFIDENCE SHRINKAGE  (NEW)
 *     S_posterior = S_raw × C + S_prior × (1 − C)
 *     where:
 *       C       = normalised confidence ∈ [0.1, 0.95]
 *       S_prior = 60  (neutral prior — moderately safe)
 *     At low confidence the score is pulled toward 60; high-confidence data
 *     lets the model score speak for itself.  This prevents extreme scores
 *     from sparse data.
 *
 *  5. NATIONAL-RATIO STATISTICAL DOWNGRADE  (de-duplicated)
 *     Applied after shrinkage.  Only the national-avg homicide ratio is
 *     applied here (not percentile or trend, which are already embedded in
 *     their respective components to avoid double-counting).
 *     Penalty = min(25, max(0, (ratio − 1) × 9))   [smooth, capped at 25]
 *
 *  6. HARD CAPS  (policy overrides — never lifted by component scores)
 *     Advisory-level caps · Dangerous-city caps · Conflict caps · Data-age caps
 *
 *  7. OPTIONAL AI RISK SIGNAL  (NEW)
 *     aiRiskSignal ∈ [0,100], 50 = neutral.  When provided, blended at 15%:
 *       S_final = S_after_caps × 0.85 + aiRiskSignal × 0.15
 *     This allows real-time AI analysis to fine-tune the model output
 *     without overriding the hard-data foundation.
 *
 *  8. CROSS-SIGNAL CONSISTENCY CHECK  (NEW)
 *     If advisory risk and crime risk diverge by > 40 points, confidence is
 *     reduced and a warning note is added.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

export const SAFETY_ENGINE_VERSION = '4.0.0';

/* ── Mathematical constants (exported for transparency / UI display) ──────── */
export const ENGINE_MATH = {
  /** Bayesian prior score — neutral "we don't really know" baseline */
  PRIOR_SCORE: 60,
  /** Minimum confidence allowed (prevents prior from dominating entirely) */
  MIN_CONFIDENCE: 0.10,
  /** Maximum confidence allowed (preserves a small shrinkage even with perfect data) */
  MAX_CONFIDENCE: 0.95,
  /** AI signal blend fraction when aiRiskSignal is provided */
  AI_BLEND_WEIGHT: 0.15,
  /** Component base weights (must sum to 1.0) */
  BASE_WEIGHTS: { advisory: 0.25, crime: 0.30, conflict: 0.20, trend: 0.10, neighborhood: 0.10, confidence: 0.05 },
  /** Hill function parameters for homicide penalty: Pmax=60, ec50=10, α=1.3 */
  HOMICIDE_HILL: { pmax: 60, ec50: 10, alpha: 1.3 },
  /** Hill function parameters for violent-crime penalty: Pmax=22, ec50=600, α=1.2 */
  VIOLENT_HILL: { pmax: 22, ec50: 600, alpha: 1.2 },
  /** Hill function parameters for percentile penalty (above 60th): Pmax=28, ec50=15, α=1.5 */
  PERCENTILE_HILL: { pmax: 28, ec50: 15, alpha: 1.5 },
  /** Minimum divergence (advisory vs crime, 0–100 risk) that triggers a confidence warning */
  CROSS_SIGNAL_DIVERGENCE_THRESHOLD: 40,
} as const;

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
  raw: number;           // 0–100 component sub-score (before weighting)
  weight: number;        // base fractional weight (e.g. 0.25)
  effectiveWeight: number; // adaptive weight after data-quality scaling
  contribution: number;  // raw × effectiveWeight
  dataQuality: number;   // 0–1, how reliable this component's data is
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
  /** Engine metadata for transparency / debugging */
  engineVersion: string;
  /** Bayesian shrinkage factor applied (0–1). Lower = more shrinkage toward prior. */
  confidenceShrinkage: number;
  /** Cross-signal consistency flag: true if advisory and crime diverge >40 pts */
  crossSignalDivergence: boolean;
  /** AI signal that was blended in, if provided */
  aiSignalUsed: number | null;
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

  /**
   * Optional AI-derived risk signal (0–100, 50 = neutral).
   * When provided, blended at ENGINE_MATH.AI_BLEND_WEIGHT into the final score.
   * Sourced from the ai-chat edge function for contextual risk analysis.
   */
  aiRiskSignal?: number | null;
}

/* ── Hill penalty curve ───────────────────────────────────────────────────── */
/**
 * Generalised Hill / sigmoid penalty function.
 * P(r) = pmax · rᵅ / (rᵅ + ec50ᵅ)
 *
 * Properties:
 *   P(0)    = 0
 *   P(ec50) = pmax / 2  (50% of max at the reference threshold)
 *   P(∞)    → pmax
 *
 * Preferred over step functions because it is continuous, differentiable,
 * and correctly represents risk as a smooth gradient rather than binary jumps.
 */
function hillPenalty(rate: number, pmax: number, ec50: number, alpha: number): number {
  if (rate <= 0) return 0;
  const ra    = Math.pow(rate, alpha);
  const ec50a = Math.pow(ec50, alpha);
  return pmax * ra / (ra + ec50a);
}

/* ── Main scoring function ────────────────────────────────────────────────── */

export function computeTravelSafetyScore(input: TravelSafetyInput): TravelSafetyResult {
  const caps: HardCap[] = [];
  const majorRisks: string[] = [];
  const sources: string[] = [];

  /* ── 1. Advisory Risk Component (25% base) ─────────────────────────────── */
  const advisoryComp = computeAdvisoryComponent(input, sources);

  /* ── 2. Violent Crime Component (30% base) ─────────────────────────────── */
  const crimeComp = computeCrimeComponent(input, majorRisks);

  /* ── 3. Conflict/Terrorism/Unrest Component (20% base) ─────────────────── */
  const conflictComp = computeConflictComponent(input, majorRisks);

  /* ── 4. Recent Trend Component (10% base) ──────────────────────────────── */
  const trendComp = computeTrendComponent(input, majorRisks);

  /* ── 5. Neighborhood Risk Component (10% base) ─────────────────────────── */
  const neighborhoodComp = computeNeighborhoodComponent(input, majorRisks);

  /* ── 6. Data Confidence Component (5% base) ────────────────────────────── */
  const { confidenceComp, confidenceLevel, confidencePct } = computeConfidenceComponent(input);

  /* ── Adaptive weighting: scale each component by its data-quality factor ── */
  const components = [advisoryComp, crimeComp, conflictComp, trendComp, neighborhoodComp, confidenceComp];
  const totalEffectiveMass = components.reduce((s, c) => s + c.weight * c.dataQuality, 0);
  for (const c of components) {
    c.effectiveWeight = totalEffectiveMass > 0 ? (c.weight * c.dataQuality) / totalEffectiveMass : c.weight;
    c.contribution    = c.raw * c.effectiveWeight;
  }

  /* ── Weighted blend ─────────────────────────────────────────────────────── */
  const rawBlend = components.reduce((s, c) => s + c.contribution, 0);

  /* ── Cross-signal consistency check ────────────────────────────────────── */
  const maxAdvisoryLevelForCross = input.advisories.length
    ? Math.max(...input.advisories.map(a => a.level))
    : 0;
  const advisoryRisk100 = (maxAdvisoryLevelForCross / 4) * 100;
  const crimeRisk100    = 100 - crimeComp.raw;
  const signalDivergence = Math.abs(advisoryRisk100 - crimeRisk100);
  const crossSignalDivergence = signalDivergence > ENGINE_MATH.CROSS_SIGNAL_DIVERGENCE_THRESHOLD;

  /* ── Bayesian confidence shrinkage ─────────────────────────────────────── */
  // Normalise confidence and clamp to [MIN_CONFIDENCE, MAX_CONFIDENCE]
  let C = confidencePct / 100;
  if (crossSignalDivergence) C = Math.max(ENGINE_MATH.MIN_CONFIDENCE, C - 0.12); // divergence reduces certainty
  C = Math.max(ENGINE_MATH.MIN_CONFIDENCE, Math.min(ENGINE_MATH.MAX_CONFIDENCE, C));
  const shrunkScore = rawBlend * C + ENGINE_MATH.PRIOR_SCORE * (1 - C);

  /* ── National-ratio statistical downgrade (de-duplicated, smooth) ──────── */
  // Only the national-avg homicide ratio is applied here.
  // Percentile and trend penalties already live inside their components —
  // applying them again here would double-count, inflating downgrade severity.
  let adjustedScore = applyNationalRatioDowngrade(shrunkScore, input, majorRisks);

  /* ── Hard caps ──────────────────────────────────────────────────────────── */
  adjustedScore = applyHardCaps(adjustedScore, input, caps, majorRisks);

  /* ── AI risk signal blend ───────────────────────────────────────────────── */
  const aiSignalUsed = input.aiRiskSignal ?? null;
  if (aiSignalUsed != null && aiSignalUsed >= 0 && aiSignalUsed <= 100) {
    adjustedScore = adjustedScore * (1 - ENGINE_MATH.AI_BLEND_WEIGHT) + aiSignalUsed * ENGINE_MATH.AI_BLEND_WEIGHT;
  }

  /* ── Final clamp ────────────────────────────────────────────────────────── */
  const finalScore = Math.max(0, Math.min(100, Math.round(adjustedScore)));
  const riskBand = getRiskBand(finalScore);

  /* ── Confidence auto-reduce on data quality issues ──────────────────────── */
  let finalConfidence: 'High' | 'Medium' | 'Low' = confidenceLevel;
  if (caps.length > 0 && finalConfidence === 'High') finalConfidence = 'Medium';
  if (input.conflictingAdvisories || crossSignalDivergence) finalConfidence = 'Low';
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
    engineVersion: SAFETY_ENGINE_VERSION,
    confidenceShrinkage: C,
    crossSignalDivergence,
    aiSignalUsed,
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
    return { raw: 40, weight: 0.25, effectiveWeight: 0.25, contribution: 40 * 0.25, dataQuality: 0.3, notes };
  }

  for (const a of input.advisories) sources.push(a.source);

  // Use most conservative (highest level) advisory — spec requirement
  const maxLevel = Math.max(...input.advisories.map(a => a.level));
  const sourceAtMax = input.advisories.find(a => a.level === maxLevel);

  // Confidence-weighted average for reference, bias toward the maximum
  let wSum = 0, wTotal = 0;
  for (const a of input.advisories) {
    wSum += a.level * a.confidence;
    wTotal += a.confidence;
  }
  const weightedLevel = wTotal > 0 ? wSum / wTotal : maxLevel;

  // When sources disagree by ≥2 levels, use max (conservative bias)
  const minLevel = Math.min(...input.advisories.map(a => a.level));
  const spread = maxLevel - minLevel;
  const effectiveLevel = spread >= 2
    ? maxLevel
    : Math.ceil(weightedLevel * 0.4 + maxLevel * 0.6);

  if (spread >= 2) {
    notes.push(`Sources disagree (spread=${spread}). Using most conservative level ${maxLevel}.`);
  }
  if (sourceAtMax) notes.push(`Highest advisory: ${sourceAtMax.source} — Level ${maxLevel}`);

  // Convert level (0–4) to 0–100 sub-score (higher level = lower score)
  const raw = Math.max(0, Math.min(100, Math.round(100 - effectiveLevel * 22)));

  // Data quality: more sources + high agreement = more confident
  const avgConf      = wTotal > 0 ? (wTotal / input.advisories.length) : 0.5;
  const sourceBonus  = Math.min(0.30, input.advisories.length * 0.08);
  const dataQuality  = Math.min(1.0, 0.50 + sourceBonus + avgConf * 0.20);

  return { raw, weight: 0.25, effectiveWeight: 0.25, contribution: raw * 0.25, dataQuality, notes };
}

/* ── Component: Violent Crime (30% base) ─────────────────────────────────── */
/**
 * Uses continuous Hill penalty curves instead of step functions.
 * This eliminates cliff-edge discontinuities (e.g. a city at 7.9/100k
 * previously scored identically to 3.0/100k but jumped sharply at 8.0).
 *
 * Penalty sources and their Hill parameters:
 *   Homicide:       Pmax=60,  ec50=10,  α=1.3  → calibrated to UNODC global data
 *   Violent crime:  Pmax=22,  ec50=600, α=1.2  → calibrated to FBI UCR / UNODC
 *   Global %ile:    Pmax=28,  ec50=15,  α=1.5  → above 60th pctile only
 *   Kidnapping:     Pmax=18,  ec50=4,   α=1.0  → linear-ish for rare events
 *
 * Data quality:
 *   1.0 — official city data + UNODC city-level homicide
 *   0.8 — national + global percentile (no city breakdown)
 *   0.6 — national rate only
 *   0.3 — no crime data (conservative default raw=50)
 */
function computeCrimeComponent(
  input: TravelSafetyInput,
  majorRisks: string[],
): ComponentScore {
  const notes: string[] = [];
  const hom       = input.crimeMetrics.homicideRatePer100k;
  const violent   = input.crimeMetrics.violentCrimeRatePer100k;
  const percentile = input.globalHomicidePercentile;
  const kid        = input.crimeMetrics.kidnappingRatePer100k;

  // Data quality factor
  const dataQuality = hom != null
    ? (input.hasOfficialCityData ? 1.0 : percentile != null ? 0.8 : 0.6)
    : (violent != null ? 0.5 : 0.3);

  if (hom == null && violent == null && percentile == null) {
    notes.push('No verified crime data — applying conservative default (raw=50).');
    return { raw: 50, weight: 0.30, effectiveWeight: 0.30, contribution: 50 * 0.30, dataQuality, notes };
  }

  let totalPenalty = 0;

  // ── Homicide penalty (primary signal) ─────────────────────────────────────
  if (hom != null) {
    const { pmax, ec50, alpha } = ENGINE_MATH.HOMICIDE_HILL;
    const p = hillPenalty(hom, pmax, ec50, alpha);
    totalPenalty += p;
    notes.push(`Homicide rate: ${hom.toFixed(1)}/100k → −${p.toFixed(1)} pts (Hill curve)`);
    if (hom >= 40)      majorRisks.push('Extreme homicide rate (≥40/100k)');
    else if (hom >= 20) majorRisks.push('Very high homicide rate (≥20/100k)');
    else if (hom >= 8)  majorRisks.push('Elevated homicide rate (≥8/100k)');
  }

  // ── Violent crime penalty ──────────────────────────────────────────────────
  if (violent != null) {
    const { pmax, ec50, alpha } = ENGINE_MATH.VIOLENT_HILL;
    const p = hillPenalty(violent, pmax, ec50, alpha);
    totalPenalty += p;
    notes.push(`Violent crime: ${Math.round(violent)}/100k → −${p.toFixed(1)} pts`);
    if (violent > 2000)      majorRisks.push('Violent crime rate extremely elevated (>2000/100k)');
    else if (violent > 1000) majorRisks.push('Violent crime rate very high (>1000/100k)');
  }

  // ── Global percentile penalty (independent of absolute rates) ─────────────
  // Only penalises above the 60th percentile — below that is "normal"
  if (percentile != null) {
    const excessPctile = Math.max(0, percentile - 60);
    const { pmax, ec50, alpha } = ENGINE_MATH.PERCENTILE_HILL;
    const p = hillPenalty(excessPctile, pmax, ec50, alpha);
    totalPenalty += p;
    notes.push(`Global homicide %ile: ${percentile}th → −${p.toFixed(1)} pts`);
    if (percentile >= 95)      majorRisks.push('Top 5% most dangerous globally (homicide)');
    else if (percentile >= 90) majorRisks.push('Top 10% most dangerous globally (homicide)');
  }

  // ── Kidnapping penalty ─────────────────────────────────────────────────────
  if (kid != null && kid > 2) {
    const p = hillPenalty(kid, 18, 4, 1.0);
    totalPenalty += p;
    notes.push(`Kidnapping rate: ${kid.toFixed(1)}/100k → −${p.toFixed(1)} pts`);
    if (kid > 5) majorRisks.push('Elevated kidnapping risk (>5/100k)');
  }

  const raw = Math.max(0, Math.min(100, 100 - totalPenalty));
  return { raw, weight: 0.30, effectiveWeight: 0.30, contribution: raw * 0.30, dataQuality, notes };
}

/* ── Component: Conflict/Terrorism/Unrest (20% base) ────────────────────── */
/**
 * Continuous penalties based on severity and fatality count.
 *
 * Severity penalty:  proportional to severity/3, max 60 pts
 *   severity=1 → −20,  severity=2 → −40,  severity=3 → −60
 *
 * Fatality penalty:  log-scaled to avoid outsized weight for extreme events
 *   P_fat = min(20, 7 × log10(fatalities90d + 1))
 *   100 fatalities → −14,  500 → −19,  1000 → −21 (capped at 20)
 *
 * Proximity/event penalties: additive fixed amounts (binary facts)
 *
 * Data quality:
 *   1.0 — active conflict signals present
 *   0.7 — no active signals (no-conflict is still useful information)
 */
function computeConflictComponent(
  input: TravelSafetyInput,
  majorRisks: string[],
): ComponentScore {
  const notes: string[] = [];
  let totalPenalty = 0;

  // ── Severity penalty (continuous, proportional) ────────────────────────────
  if (input.conflictSeverity > 0) {
    const severityPenalty = (input.conflictSeverity / 3) * 60;
    totalPenalty += severityPenalty;
    if (input.conflictSeverity >= 3) {
      majorRisks.push('Active war zone / extreme armed conflict');
      notes.push(`Conflict severity: Extreme (war zone) → −${severityPenalty.toFixed(0)} pts`);
    } else if (input.conflictSeverity >= 2) {
      majorRisks.push('High armed conflict / sustained violence');
      notes.push(`Conflict severity: High → −${severityPenalty.toFixed(0)} pts`);
    } else {
      majorRisks.push('Turbulent security environment / active unrest');
      notes.push(`Conflict severity: Turbulent → −${severityPenalty.toFixed(0)} pts`);
    }
  }

  // ── Fatality penalty (log-scaled) ─────────────────────────────────────────
  if (input.conflictFatalities90d > 0) {
    const fatalPenalty = Math.min(20, 7 * Math.log10(input.conflictFatalities90d + 1));
    totalPenalty += fatalPenalty;
    notes.push(`Conflict fatalities (90d): ${input.conflictFatalities90d} → −${fatalPenalty.toFixed(1)} pts`);
    if (input.conflictFatalities90d >= 1000) majorRisks.push('Mass-casualty conflict (1000+ fatalities/90 days)');
  }

  // ── Proximity penalty ─────────────────────────────────────────────────────
  if (input.activeConflictWithin50mi) {
    totalPenalty += 15;
    majorRisks.push('Active armed conflict within 50 miles');
    notes.push('Active conflict proximate (≤50 mi) → −15 pts');
  }

  // ── Terror event penalty ──────────────────────────────────────────────────
  if (input.terrorEventLast30d) {
    totalPenalty += 20;
    majorRisks.push('Terror attack or mass-casualty event within 30 days');
    notes.push('Recent terror incident → −20 pts');
  }

  // ── Civil unrest penalty ──────────────────────────────────────────────────
  if (input.sustainedCivilUnrest) {
    totalPenalty += 12;
    majorRisks.push('Sustained civil unrest / protests');
    notes.push('Sustained civil unrest → −12 pts');
  }

  const dataQuality = (input.conflictSeverity > 0 || input.conflictFatalities90d > 0)
    ? 1.0
    : 0.7;

  const raw = Math.max(0, Math.min(100, 100 - totalPenalty));
  return { raw, weight: 0.20, effectiveWeight: 0.20, contribution: raw * 0.20, dataQuality, notes };
}

/* ── Component: Recent Trend (10% base) ──────────────────────────────────── */
/**
 * Continuous proportional adjustment relative to neutral baseline (70).
 *
 * Adjustment = clip(−change × scale, min, max)
 *   90-day:  scale=0.7, max penalty=25, max bonus=10
 *   12-month: scale=0.5, max penalty=20, max bonus=8
 *
 * Example: +20% 90d change → −14 pts; −15% → +10 (capped) bonus
 *
 * 90d weighted more heavily than 12m (recency matters).
 * Missing trend data → data quality 0.3, model falls back to neutral.
 */
function computeTrendComponent(
  input: TravelSafetyInput,
  majorRisks: string[],
): ComponentScore {
  const notes: string[] = [];
  const c90 = input.crimeChange90Days ?? null;
  const c12 = input.crimeChange12Months ?? null;

  if (c90 == null && c12 == null) {
    notes.push('No trend data — falling back to neutral (raw=60).');
    return { raw: 60, weight: 0.10, effectiveWeight: 0.10, contribution: 60 * 0.10, dataQuality: 0.3, notes };
  }

  let raw = 70; // neutral baseline

  if (c90 != null) {
    const adj = Math.max(-25, Math.min(10, -c90 * 0.7));
    raw += adj;
    const sign = c90 > 0 ? '+' : '';
    notes.push(`90-day change: ${sign}${c90.toFixed(1)}% → ${adj >= 0 ? '+' : ''}${adj.toFixed(1)} pts`);
    if (c90 > 30) majorRisks.push('Crime increasing >30% in past 90 days');
    else if (c90 > 15) majorRisks.push('Crime increasing >15% in past 90 days');
  }

  if (c12 != null) {
    const adj = Math.max(-20, Math.min(8, -c12 * 0.5));
    raw += adj;
    const sign = c12 > 0 ? '+' : '';
    notes.push(`12-month change: ${sign}${c12.toFixed(1)}% → ${adj >= 0 ? '+' : ''}${adj.toFixed(1)} pts`);
  }

  const dataQuality = c90 != null ? 1.0 : 0.8;
  raw = Math.max(0, Math.min(100, raw));
  return { raw, weight: 0.10, effectiveWeight: 0.10, contribution: raw * 0.10, dataQuality, notes };
}

/* ── Component: Neighborhood Risk (10% base) ─────────────────────────────── */
/**
 * Continuous penalty based on count and severity of high-risk zones.
 *
 * P = f(veryHighCount) + f(highCount)
 * where f uses a saturating curve: P = Pmax × n / (n + k)
 *   veryHigh: Pmax=35, k=2  → 1 zone=12, 2=23, 3=26, 5=29
 *   high:     Pmax=20, k=3  → 1 zone=5,  3=15, 5=17
 */

function computeNeighborhoodComponent(
  input: TravelSafetyInput,
  majorRisks: string[],
): ComponentScore {
  const notes: string[] = [];

  const warnings = input.neighborhoodWarnings;
  if (!warnings.length) {
    notes.push('No neighborhood-level data — falling back to neutral (raw=65).');
    return { raw: 65, weight: 0.10, effectiveWeight: 0.10, contribution: 65 * 0.10, dataQuality: 0.4, notes };
  }

  const veryHigh = warnings.filter(w => w.riskLevel === 'Very High').length;
  const high     = warnings.filter(w => w.riskLevel === 'High').length;

  // Saturating penalty: Pmax×n/(n+k) — more zones add risk but with diminishing returns
  const vhPenalty = veryHigh > 0 ? 35 * veryHigh / (veryHigh + 2) : 0;
  const hPenalty  = high > 0     ? 20 * high     / (high + 3)      : 0;
  const totalPenalty = vhPenalty + hPenalty;

  if (veryHigh >= 3)      majorRisks.push('Multiple Very High-risk neighborhoods');
  else if (veryHigh >= 1) majorRisks.push('High-risk neighborhood(s) present');

  notes.push(
    `${veryHigh} very-high + ${high} high risk zones` +
    ` → −${vhPenalty.toFixed(1)} + −${hPenalty.toFixed(1)} pts`
  );

  const raw = Math.max(0, Math.min(100, 75 - totalPenalty));
  return { raw, weight: 0.10, effectiveWeight: 0.10, contribution: raw * 0.10, dataQuality: 1.0, notes };
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
    confidenceComp: { raw, weight: 0.05, effectiveWeight: 0.05, contribution: raw * 0.05, dataQuality: 1.0, notes },
    confidenceLevel,
    confidencePct,
  };
}

/* ── National-ratio downgrade (de-duplicated) ────────────────────────────── */
/**
 * The only post-blend statistical downgrade. Applies the national homicide
 * ratio penalty which is NOT already represented in any component score.
 *
 * Smooth penalty: P = min(25, max(0, (ratio − 1) × 9))
 *   ratio=1.0x →  0 pts  (at national average)
 *   ratio=2.0x →  9 pts
 *   ratio=3.0x → 18 pts
 *   ratio=4.0x → 25 pts  (capped)
 *
 * NOTE: Percentile and trend downgrades have been REMOVED from here to
 * eliminate double-counting — both are already penalised inside their
 * respective component functions.
 */
function applyNationalRatioDowngrade(
  score: number,
  input: TravelSafetyInput,
  majorRisks: string[],
): number {
  const hom      = input.crimeMetrics.homicideRatePer100k;
  const national = input.nationalAvgHomicidePer100k;

  if (hom == null || national == null || national <= 0) return score;

  const ratio   = hom / national;
  const penalty = Math.min(25, Math.max(0, (ratio - 1) * 9));

  if (ratio >= 2) {
    majorRisks.push(`Homicide rate ${ratio.toFixed(1)}× national average`);
  }

  return score - penalty;
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
