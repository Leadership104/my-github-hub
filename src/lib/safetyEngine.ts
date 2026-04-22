/**
 * Kipita Safety Engine v3.0 — Context-Aware Travel Safety
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

  const sitMulRaw =
    (SITUATIONAL_MULTIPLIERS.TIME[timeKey] ?? 1) *
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
  const riskLevel =
    score >= 80 ? 'LOW RISK' :
    score >= 60 ? 'MODERATE' :
    score >= 40 ? 'ELEVATED' :
    score >= 20 ? 'HIGH RISK' : 'CRITICAL';
  const riskColor =
    score >= 80 ? '#22c55e' :
    score >= 60 ? '#eab308' :
    score >= 40 ? '#f97316' : '#ef4444';
  const confidence = hasLive ? (incidents.length >= 10 ? 'HIGH' : 'MEDIUM') : 'LOW';

  return { score, riskLevel, riskColor, context, breakdown, sitMul: +sitMul.toFixed(2), hasLive, confidence };
}

export function detectTimeOfDay(): string {
  const h = new Date().getHours();
  if (h >= 6 && h < 18) return 'daytime';
  if (h >= 18 && h < 22) return 'evening';
  return 'nighttime';
}

export function advisoryToBaseRates(rawScore: number): Record<string, number> {
  const factor = rawScore / 5;
  return {
    robbery:          Math.round(40  + factor * 300),
    assault:          Math.round(50  + factor * 280),
    sexual_offense:   Math.round(15  + factor * 100),
    kidnapping:       Math.round(2   + factor * 60),
    burglary:         Math.round(80  + factor * 350),
    home_invasion:    Math.round(20  + factor * 120),
    vandalism:        Math.round(40  + factor * 200),
    larceny_home:     Math.round(60  + factor * 300),
    vehicle_theft:    Math.round(50  + factor * 250),
    carjacking:       Math.round(5   + factor * 80),
    vehicle_break_in: Math.round(70  + factor * 300),
    traffic_incident: Math.round(30  + factor * 200),
    drug_activity:    Math.round(30  + factor * 180),
    public_disorder:  Math.round(20  + factor * 150),
    weapons_offense:  Math.round(15  + factor * 120),
  };
}

export function safetyLevel(score: number): { level: number; label: string; color: string } {
  if (score >= 80) return { level: 4, label: 'Safe',     color: '#22c55e' };
  if (score >= 60) return { level: 3, label: 'Safer',    color: '#84cc16' };
  if (score >= 40) return { level: 2, label: 'Moderate', color: '#eab308' };
  if (score >= 20) return { level: 1, label: 'Risky',    color: '#f97316' };
  return               { level: 0, label: 'Unsafe',   color: '#ef4444' };
}

// ── Emergency contacts database ───────────────────────────────────────────────
export interface EmergencyContacts {
  police: string;
  ambulance: string;
  fire: string;
  tourist?: string;
  general?: string; // EU/universal 112
}

export const EMERGENCY_CONTACTS: Record<string, EmergencyContacts> = {
  US: { police: '911', ambulance: '911', fire: '911' },
  CA: { police: '911', ambulance: '911', fire: '911' },
  GB: { police: '999', ambulance: '999', fire: '999' },
  AU: { police: '000', ambulance: '000', fire: '000' },
  NZ: { police: '111', ambulance: '111', fire: '111' },
  FR: { police: '17',  ambulance: '15',  fire: '18',  general: '112' },
  DE: { police: '110', ambulance: '112', fire: '112' },
  IT: { police: '113', ambulance: '118', fire: '115', general: '112' },
  ES: { police: '091', ambulance: '112', fire: '080', general: '112' },
  PT: { police: '112', ambulance: '112', fire: '112' },
  NL: { police: '112', ambulance: '112', fire: '112' },
  BE: { police: '101', ambulance: '100', fire: '100', general: '112' },
  CH: { police: '117', ambulance: '144', fire: '118' },
  AT: { police: '133', ambulance: '144', fire: '122' },
  SE: { police: '112', ambulance: '112', fire: '112' },
  NO: { police: '112', ambulance: '113', fire: '110' },
  DK: { police: '112', ambulance: '112', fire: '112' },
  GR: { police: '100', ambulance: '166', fire: '199', general: '112' },
  TR: { police: '155', ambulance: '112', fire: '110' },
  TH: { police: '191', ambulance: '1669', fire: '199', tourist: '1155' },
  JP: { police: '110', ambulance: '119', fire: '119' },
  KR: { police: '112', ambulance: '119', fire: '119' },
  CN: { police: '110', ambulance: '120', fire: '119' },
  HK: { police: '999', ambulance: '999', fire: '999' },
  TW: { police: '110', ambulance: '119', fire: '119' },
  SG: { police: '999', ambulance: '995', fire: '995' },
  MY: { police: '999', ambulance: '999', fire: '994', tourist: '+603-2149-6590' },
  ID: { police: '110', ambulance: '118', fire: '113', tourist: '1500-600' },
  PH: { police: '911', ambulance: '911', fire: '911' },
  VN: { police: '113', ambulance: '115', fire: '114' },
  KH: { police: '117', ambulance: '119', fire: '118', tourist: '012-942-484' },
  TH_MM: { police: '199', ambulance: '192', fire: '191' },
  IN: { police: '100', ambulance: '102', fire: '101' },
  LK: { police: '119', ambulance: '110', fire: '111' },
  NP: { police: '100', ambulance: '102', fire: '101', tourist: '+977-1-4226359' },
  AE: { police: '999', ambulance: '998', fire: '997' },
  SA: { police: '999', ambulance: '911', fire: '998' },
  IL: { police: '100', ambulance: '101', fire: '102' },
  JO: { police: '911', ambulance: '911', fire: '911' },
  EG: { police: '122', ambulance: '123', fire: '180' },
  MA: { police: '190', ambulance: '150', fire: '150' },
  ZA: { police: '10111', ambulance: '10177', fire: '10177' },
  KE: { police: '999', ambulance: '999', fire: '999' },
  NG: { police: '199', ambulance: '199', fire: '199' },
  BR: { police: '190', ambulance: '192', fire: '193' },
  MX: { police: '911', ambulance: '911', fire: '911', tourist: '078' },
  AR: { police: '911', ambulance: '107', fire: '100' },
  CL: { police: '133', ambulance: '131', fire: '132' },
  CO: { police: '112', ambulance: '125', fire: '119' },
  PE: { police: '105', ambulance: '116', fire: '116' },
  RU: { police: '102', ambulance: '103', fire: '101' },
  PL: { police: '997', ambulance: '999', fire: '998', general: '112' },
  CZ: { police: '158', ambulance: '155', fire: '150', general: '112' },
};

// ── Scam alerts by country ────────────────────────────────────────────────────
export interface ScamAlert {
  title: string;
  detail: string;
  severity: 'low' | 'medium' | 'high';
}

export const SCAM_ALERTS: Record<string, ScamAlert[]> = {
  TH: [
    { title: 'Tuk-tuk gem store',        detail: "Driver says temple is closed, offers a 'sightseeing tour' — really a gem shop commission run.", severity: 'high' },
    { title: 'Temple closed scam',        detail: "Stranger says your planned temple is closed today. It's not. They want to take you somewhere else.", severity: 'high' },
    { title: 'Jet ski damage scam',       detail: "Renter claims pre-existing damage is yours in Phuket. Always photograph before taking.", severity: 'medium' },
  ],
  EG: [
    { title: 'Perfume / papyrus pressure', detail: "Near pyramids and Luxor: 'free gift' leads to aggressive sales. Walk away firmly.", severity: 'medium' },
    { title: 'Fake guides',               detail: "Unofficial guides at sites often overcharge and won't leave. Buy official tickets only.", severity: 'medium' },
  ],
  IN: [
    { title: 'Meter broken (auto/taxi)',  detail: "Driver claims meter is broken — always insist on meter or use Ola/Uber app.", severity: 'high' },
    { title: 'Gem export scheme',         detail: "Friendly local says you can resell gems at huge profit back home. Classic scam.", severity: 'high' },
    { title: 'Fake tourist offices',      detail: "Unofficial 'tourism offices' near monuments sell fake/overpriced tours.", severity: 'medium' },
  ],
  MA: [
    { title: 'False friendly guide',      detail: "Stranger in medina offers to help — takes you to carpet shop and demands payment.", severity: 'high' },
    { title: 'Henna trap',               detail: "Artist grabs your hand and starts — then demands large fee to remove.", severity: 'medium' },
  ],
  MX: [
    { title: 'Unofficial taxis',          detail: "Never take street taxis in Mexico City — use Uber/InDrive only. Express kidnapping risk.", severity: 'high' },
    { title: 'ATM card skimming',         detail: "Use ATMs inside bank branches only, not standalone machines.", severity: 'high' },
  ],
  FR: [
    { title: 'Petition / bracelet gangs', detail: "Near Eiffel Tower and Sacré-Cœur: clipboard petitions end in aggressive donation demands.", severity: 'medium' },
    { title: 'Ring scam',                 detail: "'Did you drop this ring?' — leads to demand for finder's fee.", severity: 'low' },
  ],
  IT: [
    { title: 'Bracelet scam',            detail: "Men tie bracelets on wrist near Colosseum and Trevi then demand payment.", severity: 'medium' },
    { title: 'Fake police',              detail: "Men claiming to be police ask to 'inspect' your wallet. Real police never do this.", severity: 'high' },
  ],
  ES: [
    { title: 'Las Ramblas pickpockets',  detail: "Highest pickpocket density in Europe. Keep bags in front, wallet in front pocket.", severity: 'high' },
    { title: 'Bird poop distraction',    detail: "'Look, something landed on you!' — accomplice robs you while you're distracted.", severity: 'medium' },
  ],
  TR: [
    { title: 'Shoe shine drop',          detail: "Shoe shiner 'accidentally' drops brush. You pick it up — they insist on shining your shoes.", severity: 'low' },
    { title: 'Tea house overcharge',     detail: "Being invited for tea near Grand Bazaar often ends with inflated bill.", severity: 'medium' },
  ],
  VN: [
    { title: 'Millions confusion',       detail: "Prices quoted in millions of dong — easy to miscount zeros and overpay significantly.", severity: 'medium' },
    { title: 'Cyclo overcharge',         detail: "Always agree price before riding — quote per person, not per ride.", severity: 'medium' },
  ],
  ID: [
    { title: 'Bali taxi meters',         detail: "Most Bali taxis won't use meters — use Grab app for transparent pricing.", severity: 'medium' },
    { title: 'Money changer tricks',     detail: "Some changers use sleight of hand. Use ATMs or official bank changers.", severity: 'high' },
  ],
  ZA: [
    { title: 'Smash-and-grab',          detail: "At traffic lights: lock doors, keep valuables out of sight, close windows.", severity: 'high' },
    { title: 'Distraction theft',        detail: "Someone drops something near you — accomplice takes bag while you look away.", severity: 'medium' },
  ],
  BR: [
    { title: 'Express kidnapping',       detail: "In São Paulo: avoid ATMs at night. Criminals force victims to withdraw cash.", severity: 'high' },
    { title: 'Good Samaritan setup',     detail: "Friendly stranger befriends you then accomplices rob you later in the evening.", severity: 'high' },
  ],
};

// ── Health risk data by country ───────────────────────────────────────────────
export interface HealthInfo {
  waterSafe: boolean;
  waterNote: string;
  vaccines: string[];
  risks: string[];
  medicalQuality: 'excellent' | 'good' | 'fair' | 'limited';
}

export const HEALTH_DATA: Record<string, HealthInfo> = {
  US: { waterSafe: true,  waterNote: 'Tap water safe nationwide', vaccines: [],                          risks: [],                              medicalQuality: 'excellent' },
  GB: { waterSafe: true,  waterNote: 'Tap water safe',            vaccines: [],                          risks: [],                              medicalQuality: 'excellent' },
  AU: { waterSafe: true,  waterNote: 'Tap water safe',            vaccines: [],                          risks: ['UV exposure extreme'],         medicalQuality: 'excellent' },
  JP: { waterSafe: true,  waterNote: 'Tap water safe',            vaccines: [],                          risks: [],                              medicalQuality: 'excellent' },
  SG: { waterSafe: true,  waterNote: 'Tap water safe',            vaccines: [],                          risks: ['Dengue year-round'],           medicalQuality: 'excellent' },
  TH: { waterSafe: false, waterNote: 'Bottled water only',        vaccines: ['Hep A', 'Typhoid'],        risks: ['Dengue in rainy season', 'Malaria in border areas'], medicalQuality: 'good' },
  IN: { waterSafe: false, waterNote: 'Bottled water essential',   vaccines: ['Hep A', 'Typhoid'],        risks: ['Traveler\'s diarrhea', 'Malaria in some regions'],   medicalQuality: 'fair' },
  VN: { waterSafe: false, waterNote: 'Bottled water only',        vaccines: ['Hep A', 'Typhoid'],        risks: ['Air quality poor in cities'],  medicalQuality: 'fair' },
  ID: { waterSafe: false, waterNote: 'Bottled water only',        vaccines: ['Hep A', 'Typhoid', 'Rabies if trekking'], risks: ['Dengue', 'Rabies from monkeys at temples'], medicalQuality: 'fair' },
  MX: { waterSafe: false, waterNote: 'Bottled water recommended', vaccines: ['Hep A', 'Typhoid'],        risks: ['Altitude sickness in Mexico City (2240m)'],           medicalQuality: 'good' },
  EG: { waterSafe: false, waterNote: 'Bottled water only',        vaccines: ['Hep A', 'Typhoid'],        risks: ['Heatstroke Apr–Oct', 'Nile water unsafe'],            medicalQuality: 'fair' },
  MA: { waterSafe: false, waterNote: 'Bottled water recommended', vaccines: ['Hep A', 'Typhoid'],        risks: ['Heatstroke in summer'],        medicalQuality: 'fair' },
  ZA: { waterSafe: true,  waterNote: 'Tap water safe in cities',  vaccines: ['Hep A'],                   risks: ['Malaria in Kruger/Limpopo'],   medicalQuality: 'good' },
  BR: { waterSafe: true,  waterNote: 'Safe in major cities',      vaccines: ['Yellow Fever', 'Hep A'],   risks: ['Dengue', 'Zika', 'High UV'],  medicalQuality: 'good' },
  PE: { waterSafe: false, waterNote: 'Bottled water only',        vaccines: ['Hep A', 'Typhoid'],        risks: ['Altitude sickness in Cusco/Machu Picchu'],            medicalQuality: 'fair' },
  TR: { waterSafe: false, waterNote: 'Bottled water recommended', vaccines: ['Hep A', 'Typhoid'],        risks: [],                              medicalQuality: 'good' },
  FR: { waterSafe: true,  waterNote: 'Tap water safe',            vaccines: [],                          risks: [],                              medicalQuality: 'excellent' },
  DE: { waterSafe: true,  waterNote: 'Tap water safe',            vaccines: [],                          risks: [],                              medicalQuality: 'excellent' },
  IT: { waterSafe: true,  waterNote: 'Tap water safe — look for "acqua potabile"', vaccines: [], risks: [], medicalQuality: 'excellent' },
  ES: { waterSafe: true,  waterNote: 'Tap water safe in most cities', vaccines: [],                      risks: [],                              medicalQuality: 'excellent' },
};

export function getEmergencyContacts(countryCode?: string): EmergencyContacts | null {
  if (!countryCode) return null;
  return EMERGENCY_CONTACTS[countryCode.toUpperCase()] ?? null;
}

export function getScamAlerts(countryCode?: string): ScamAlert[] {
  if (!countryCode) return [];
  return SCAM_ALERTS[countryCode.toUpperCase()] ?? [];
}

export function getHealthInfo(countryCode?: string): HealthInfo | null {
  if (!countryCode) return null;
  return HEALTH_DATA[countryCode.toUpperCase()] ?? null;
}
