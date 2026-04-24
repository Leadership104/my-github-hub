import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LOVABLE_API_KEY = () => Deno.env.get("LOVABLE_API_KEY") || "";
const GOOGLE_PLACES_API_KEY = () => Deno.env.get("GOOGLE_PLACES_API_KEY") || "";
const NASA_FIRMS_MAP_KEY = () => Deno.env.get("NASA_FIRMS_MAP_KEY") || "";
const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

// ── Emergency contacts by ISO-2 country code ─────────────────────────────────
const EMERGENCY_NUMBERS: Record<string, { police: string; ambulance: string; fire: string; tourist?: string }> = {
  US: { police: "911", ambulance: "911", fire: "911" },
  CA: { police: "911", ambulance: "911", fire: "911" },
  GB: { police: "999", ambulance: "999", fire: "999" },
  AU: { police: "000", ambulance: "000", fire: "000" },
  NZ: { police: "111", ambulance: "111", fire: "111" },
  FR: { police: "17", ambulance: "15", fire: "18" },
  DE: { police: "110", ambulance: "112", fire: "112" },
  IT: { police: "113", ambulance: "118", fire: "115" },
  ES: { police: "091", ambulance: "112", fire: "080" },
  PT: { police: "112", ambulance: "112", fire: "112" },
  NL: { police: "112", ambulance: "112", fire: "112" },
  BE: { police: "101", ambulance: "100", fire: "100" },
  CH: { police: "117", ambulance: "144", fire: "118" },
  AT: { police: "133", ambulance: "144", fire: "122" },
  SE: { police: "112", ambulance: "112", fire: "112" },
  NO: { police: "112", ambulance: "113", fire: "110" },
  DK: { police: "112", ambulance: "112", fire: "112" },
  GR: { police: "100", ambulance: "166", fire: "199" },
  TR: { police: "155", ambulance: "112", fire: "110" },
  TH: { police: "191", ambulance: "1669", fire: "199", tourist: "1155" },
  JP: { police: "110", ambulance: "119", fire: "119" },
  KR: { police: "112", ambulance: "119", fire: "119" },
  CN: { police: "110", ambulance: "120", fire: "119" },
  HK: { police: "999", ambulance: "999", fire: "999" },
  SG: { police: "999", ambulance: "995", fire: "995" },
  MY: { police: "999", ambulance: "999", fire: "994", tourist: "+603-2149-6590" },
  ID: { police: "110", ambulance: "118", fire: "113", tourist: "1500-600" },
  PH: { police: "911", ambulance: "911", fire: "911" },
  VN: { police: "113", ambulance: "115", fire: "114" },
  IN: { police: "100", ambulance: "102", fire: "101" },
  AE: { police: "999", ambulance: "998", fire: "997" },
  EG: { police: "122", ambulance: "123", fire: "180" },
  ZA: { police: "10111", ambulance: "10177", fire: "10177" },
  MA: { police: "190", ambulance: "150", fire: "150" },
  BR: { police: "190", ambulance: "192", fire: "193" },
  MX: { police: "911", ambulance: "911", fire: "911", tourist: "078" },
  AR: { police: "911", ambulance: "107", fire: "100" },
  CL: { police: "133", ambulance: "131", fire: "132" },
  CO: { police: "112", ambulance: "125", fire: "119" },
  PE: { police: "105", ambulance: "116", fire: "116" },
  RU: { police: "102", ambulance: "103", fire: "101" },
  IL: { police: "100", ambulance: "101", fire: "102" },
};

// ── Scam alerts by country code ───────────────────────────────────────────────
const SCAM_ALERTS: Record<string, string[]> = {
  TH: ["Tuk-tuk 'gem store' scam — driver earns commission taking you there", "'Temple closed' scam — always check Google before believing a stranger", "Overly friendly strangers leading to card game or bar scams"],
  EG: ["Perfume shop pressure near attractions", "Camel/horse ride price disputes — always agree price first", "Fake 'tourist office' selling overpriced tours"],
  IN: ["Auto-rickshaw 'meter is broken' — insist on meter or Ola/Uber", "Gem export scam promising huge profits reselling abroad", "Fake tourist offices near popular sites"],
  MA: ["False friendly locals offering 'free' tours to carpet shops", "Henna tattoo artists grabbing hands and demanding payment", "Mint tea pressure sales"],
  ID: ["Taxi meters 'not working' in Bali — use Grab app", "Money changers with hidden fees — use official banks or ATMs", "'White money' currency swap scam"],
  VN: ["Cyclo and taxi drivers quoting prices in 'millions' to confuse", "Shoe polish scam — unsolicited shoe shining demanding large fee", "Fake charity students selling overpriced books"],
  MX: ["Express kidnapping via unofficial taxis — only use Uber/InDrive", "ATM card skimming — use ATMs inside banks only", "Timeshare sales pressure at airports"],
  BR: ["'Good Samaritan' distraction theft in crowded areas", "Express kidnapping in São Paulo — avoid ATMs at night", "Friendly stranger befriending then robbing tourists"],
  TH_EXTRA: ["Jet ski damage scam in Phuket — photograph before renting", "Ladyboy pick-pocket groups near Khao San Road"],
  ZA: ["Smash-and-grab car theft at traffic lights — lock doors, keep valuables hidden", "'Friendship bracelet' forceful street vendors"],
  TR: ["Shoe shine scam — 'accidental' drop requires you to pay for shine", "Tea house overpricing in tourist areas", "Carpet shop 'special offer' pressure"],
  FR: ["Petition signing groups then demanding donations", "Ring scam near Eiffel Tower", "Friendship bracelet scam at Sacré-Cœur"],
  IT: ["Bracelet scam near Colosseum and Trevi", "Overpriced tourist restaurants — walk one block for real prices", "Fake police asking to inspect your wallet"],
  ES: ["Las Ramblas pickpocket gangs — wear bag on front", "'Look, bird poop!' distraction theft", "Overpriced drinks at clubs with hidden minimums"],
};

// ── Health risk notes by country ──────────────────────────────────────────────
const HEALTH_NOTES: Record<string, string> = {
  TH: "Tap water unsafe — drink bottled. Dengue risk in rainy season. Malaria risk in border areas. Recommended vaccines: Hep A, Typhoid.",
  IN: "Tap water unsafe. High Delhi Belly risk — eat at busy restaurants. Recommended: Hep A, Typhoid, possibly Malaria prophylaxis.",
  VN: "Tap water unsafe. Air quality often poor in Hanoi/HCMC. Food from busy stalls generally safe.",
  ID: "Tap water unsafe. Dengue risk. Bali belly common — cautious with street food. Rabies risk from monkeys at temples.",
  MX: "Tap water unsafe in most cities. Altitude sickness risk in Mexico City (2,240m). Food safety varies — eat where locals eat.",
  EG: "Tap water unsafe. Heat exhaustion risk Apr–Oct. Nile contact not recommended. Bilharzia risk in freshwater.",
  MA: "Tap water unsafe outside major cities. Heatstroke risk in summer. Bottled water everywhere.",
  KE: "Malaria risk outside Nairobi. Yellow fever vaccine required from some countries. Tap water quality varies.",
  ZA: "Malaria risk in Kruger/Limpopo. Good medical facilities in major cities. Tap water safe in Cape Town/Johannesburg.",
  BR: "Yellow fever vaccine recommended. Dengue and Zika risk. Tap water safe in major cities. High UV index.",
  PE: "Altitude sickness risk in Cusco/Machu Picchu — acclimatize slowly. Tap water unsafe. Malaria in Amazon region.",
  US: "Medical care excellent but very expensive — travel insurance critical. Tap water safe.",
  GB: "Excellent medical care (NHS). Tap water safe. No major health risks.",
  JP: "Excellent medical care. Tap water safe. Language barrier in hospitals.",
  AU: "Excellent medical care. Sun intensity extreme — SPF 50+ essential. Tap water safe.",
  SG: "World-class medical care. Dengue risk year-round. Tap water safe.",
};

interface PlaceChip {
  name: string;
  type: string;
  rating?: number;
  reviews?: number;
  openNow?: boolean;
  summary?: string;
  distanceMi?: number;
}

function haversineMi(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 3958.8; // miles
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

async function fetchNearbyPlaces(lat: number, lng: number, type: string, max = 5): Promise<PlaceChip[]> {
  const key = GOOGLE_PLACES_API_KEY();
  if (!key) return [];
  try {
    const resp = await fetch("https://places.googleapis.com/v1/places:searchNearby", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask":
          "places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.primaryTypeDisplayName,places.currentOpeningHours.openNow,places.editorialSummary,places.location",
      },
      body: JSON.stringify({
        includedTypes: [type],
        maxResultCount: max,
        locationRestriction: { circle: { center: { latitude: lat, longitude: lng }, radius: 3500 } },
        rankPreference: "POPULARITY",
      }),
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    return (data.places || []).map((p: any) => {
      const plat = p.location?.latitude;
      const plng = p.location?.longitude;
      const distanceMi =
        typeof plat === "number" && typeof plng === "number"
          ? Math.round(haversineMi(lat, lng, plat, plng) * 10) / 10
          : undefined;
      return {
        name: p.displayName?.text,
        type: p.primaryTypeDisplayName?.text || type,
        rating: p.rating,
        reviews: p.userRatingCount,
        openNow: p.currentOpeningHours?.openNow,
        summary: p.editorialSummary?.text,
        distanceMi,
      };
    });
  } catch {
    return [];
  }
}

async function fetchCountryInfo(countryCode: string): Promise<string> {
  try {
    const resp = await fetch(`https://restcountries.com/v3.1/alpha/${countryCode}?fields=name,currencies,languages,capital,region`);
    if (!resp.ok) return "";
    const data = await resp.json();
    const currency = Object.entries(data.currencies || {}).map(([code, c]: any) => `${c.name} (${c.symbol || code})`).join(", ");
    const languages = Object.values(data.languages || {}).slice(0, 2).join(", ");
    const capital = data.capital?.[0] || "";
    return `Country: ${data.name?.common || countryCode} | Capital: ${capital} | Currency: ${currency} | Languages: ${languages}`;
  } catch {
    return "";
  }
}

// ── Live health: air quality + UV from Open-Meteo (no key required) ──────────
interface LiveHealth {
  pm25?: number;
  pm10?: number;
  ozone?: number;
  no2?: number;
  usAqi?: number;
  uvIndex?: number;
  pollen?: { grass?: number; tree?: number; weed?: number };
}

function aqiCategory(aqi?: number): string {
  if (aqi == null) return "unknown";
  if (aqi <= 50) return "Good";
  if (aqi <= 100) return "Moderate";
  if (aqi <= 150) return "Unhealthy for sensitive groups";
  if (aqi <= 200) return "Unhealthy";
  if (aqi <= 300) return "Very unhealthy";
  return "Hazardous";
}

async function fetchLiveHealth(lat: number, lng: number): Promise<LiveHealth | null> {
  try {
    const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lng}&current=pm10,pm2_5,ozone,nitrogen_dioxide,us_aqi,uv_index,grass_pollen,birch_pollen,ragweed_pollen&timezone=auto`;
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const data = await resp.json();
    const c = data.current || {};
    return {
      pm25: c.pm2_5,
      pm10: c.pm10,
      ozone: c.ozone,
      no2: c.nitrogen_dioxide,
      usAqi: c.us_aqi,
      uvIndex: c.uv_index,
      pollen: {
        grass: c.grass_pollen,
        tree: c.birch_pollen,
        weed: c.ragweed_pollen,
      },
    };
  } catch {
    return null;
  }
}

// ── Wildfires (NASA FIRMS — VIIRS NOAA-20 NRT, last 24h) ──────────────────────
interface WildfireHit {
  lat: number;
  lng: number;
  distanceMi: number;
  brightness?: number;   // brightness temp (K)
  frp?: number;          // fire radiative power (MW)
  confidence?: string;   // l/n/h or numeric 0-100
  acqDate?: string;
  acqTime?: string;
  daynight?: string;
}

interface WildfireSummary {
  count: number;
  nearestMi?: number;
  highConfidence: number;
  totalFrpMw: number;
  source: string;
  hits: WildfireHit[];
}

async function fetchWildfires(lat: number, lng: number, radiusMi = 100): Promise<WildfireSummary | null> {
  const key = NASA_FIRMS_MAP_KEY();
  if (!key) return null;
  // Approx 1° lat ≈ 69 mi. Build a small bbox around the point.
  const dLat = radiusMi / 69;
  const dLng = radiusMi / (69 * Math.max(0.1, Math.cos((lat * Math.PI) / 180)));
  const minLng = (lng - dLng).toFixed(4);
  const minLat = (lat - dLat).toFixed(4);
  const maxLng = (lng + dLng).toFixed(4);
  const maxLat = (lat + dLat).toFixed(4);
  // FIRMS area CSV: /api/area/csv/{KEY}/{SOURCE}/{W,S,E,N}/{DAY_RANGE}
  const source = "VIIRS_NOAA20_NRT";
  const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${key}/${source}/${minLng},${minLat},${maxLng},${maxLat}/1`;
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const text = await resp.text();
    if (!text || text.startsWith("Invalid") || text.startsWith("No fire")) {
      return { count: 0, highConfidence: 0, totalFrpMw: 0, source: "NASA FIRMS (VIIRS NOAA-20 NRT)", hits: [] };
    }
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) {
      return { count: 0, highConfidence: 0, totalFrpMw: 0, source: "NASA FIRMS (VIIRS NOAA-20 NRT)", hits: [] };
    }
    const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const idx = (name: string) => header.indexOf(name);
    const iLat = idx("latitude");
    const iLng = idx("longitude");
    const iBright = idx("bright_ti4");
    const iFrp = idx("frp");
    const iConf = idx("confidence");
    const iDate = idx("acq_date");
    const iTime = idx("acq_time");
    const iDN = idx("daynight");

    const hits: WildfireHit[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",");
      if (cols.length < 4) continue;
      const fLat = parseFloat(cols[iLat]);
      const fLng = parseFloat(cols[iLng]);
      if (!isFinite(fLat) || !isFinite(fLng)) continue;
      const distanceMi = Math.round(haversineMi(lat, lng, fLat, fLng) * 10) / 10;
      if (distanceMi > radiusMi) continue;
      hits.push({
        lat: fLat,
        lng: fLng,
        distanceMi,
        brightness: iBright >= 0 ? parseFloat(cols[iBright]) : undefined,
        frp: iFrp >= 0 ? parseFloat(cols[iFrp]) : undefined,
        confidence: iConf >= 0 ? cols[iConf] : undefined,
        acqDate: iDate >= 0 ? cols[iDate] : undefined,
        acqTime: iTime >= 0 ? cols[iTime] : undefined,
        daynight: iDN >= 0 ? cols[iDN] : undefined,
      });
    }
    hits.sort((a, b) => a.distanceMi - b.distanceMi);
    const highConfidence = hits.filter((h) => {
      const c = (h.confidence || "").toLowerCase();
      if (c === "h" || c === "high") return true;
      const n = parseFloat(c);
      return isFinite(n) && n >= 80;
    }).length;
    const totalFrpMw = Math.round(hits.reduce((s, h) => s + (h.frp || 0), 0));
    return {
      count: hits.length,
      nearestMi: hits[0]?.distanceMi,
      highConfidence,
      totalFrpMw,
      source: "NASA FIRMS (VIIRS NOAA-20 NRT)",
      hits: hits.slice(0, 5),
    };
  } catch {
    return null;
  }
}

// ── Recent earthquakes (USGS, no key required) ────────────────────────────────
interface QuakeHit {
  mag: number;
  place: string;
  time: number;
  distanceMi: number;
}
async function fetchEarthquakes(lat: number, lng: number, radiusMi = 200, minMag = 2.5): Promise<QuakeHit[]> {
  const radiusKm = Math.round(radiusMi * 1.60934);
  const url = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&latitude=${lat}&longitude=${lng}&maxradiuskm=${radiusKm}&minmagnitude=${minMag}&orderby=time&limit=8`;
  try {
    const resp = await fetch(url);
    if (!resp.ok) return [];
    const data = await resp.json();
    return (data.features || []).map((f: any) => {
      const [qLng, qLat] = f.geometry?.coordinates || [];
      return {
        mag: f.properties?.mag,
        place: f.properties?.place || "Unknown",
        time: f.properties?.time,
        distanceMi: typeof qLat === "number" ? Math.round(haversineMi(lat, lng, qLat, qLng) * 10) / 10 : 0,
      };
    }).filter((q: QuakeHit) => isFinite(q.mag));
  } catch {
    return [];
  }
}

// ── ReliefWeb disaster alerts (no key required) ───────────────────────────────
// We bucket every ReliefWeb disaster type into one of three quick-filter categories so the AI
// can prioritize incidents that match what the user actually asked about.
//   • safety     — conflict, civil unrest, crime spillover, terrorism, mass-casualty events
//   • healthcare — disease outbreaks, epidemics, food/water emergencies
//   • weather    — storms, floods, fires, earthquakes, droughts, volcanic, extreme temps
export type DisasterCategory = "safety" | "healthcare" | "weather" | "other";

interface DisasterHit {
  name: string;
  type: string;
  category: DisasterCategory;
  date?: string;
  status?: string;
}

function classifyDisasterType(typeName: string): DisasterCategory {
  const t = (typeName || "").toLowerCase();
  // Healthcare / disease
  if (/(epidemic|outbreak|disease|cholera|ebola|covid|measles|polio|dengue|malaria|virus|infect|health|food insecurity|famine|nutrition)/.test(t)) {
    return "healthcare";
  }
  // Safety / human-caused
  if (/(conflict|war|violence|unrest|terror|attack|displace|refugee|complex emergency|mine action|insecurity)/.test(t)) {
    return "safety";
  }
  // Weather / natural
  if (/(flood|storm|cyclone|hurricane|typhoon|tornado|wind|fire|wildfire|drought|earthquake|tsunami|volcan|landslide|mud|snow|cold wave|heat wave|extreme temp|severe local storm|surge|tropical)/.test(t)) {
    return "weather";
  }
  return "other";
}

async function fetchDisasters(countryCode: string): Promise<DisasterHit[]> {
  if (!countryCode) return [];
  try {
    // Pull more results so we have enough to filter by category client-side.
    const url = `https://api.reliefweb.int/v1/disasters?appname=kipita-ai&filter[field]=country.iso3&limit=20&sort[]=date:desc&fields[include][]=name&fields[include][]=type.name&fields[include][]=status&fields[include][]=date`;
    const iso3Map: Record<string, string> = {
      US:"USA",CA:"CAN",MX:"MEX",GB:"GBR",FR:"FRA",DE:"DEU",IT:"ITA",ES:"ESP",PT:"PRT",NL:"NLD",BE:"BEL",CH:"CHE",AT:"AUT",SE:"SWE",NO:"NOR",DK:"DNK",GR:"GRC",TR:"TUR",
      TH:"THA",JP:"JPN",KR:"KOR",CN:"CHN",HK:"HKG",SG:"SGP",MY:"MYS",ID:"IDN",PH:"PHL",VN:"VNM",IN:"IND",AE:"ARE",EG:"EGY",ZA:"ZAF",MA:"MAR",
      BR:"BRA",AR:"ARG",CL:"CHL",CO:"COL",PE:"PER",RU:"RUS",IL:"ISR",AU:"AUS",NZ:"NZL",
    };
    const iso3 = iso3Map[countryCode.toUpperCase()];
    if (!iso3) return [];
    const resp = await fetch(`${url}&filter[value]=${iso3}`);
    if (!resp.ok) return [];
    const data = await resp.json();
    return (data.data || []).map((d: any) => {
      const typeName = d.fields?.type?.[0]?.name || "Disaster";
      return {
        name: d.fields?.name,
        type: typeName,
        category: classifyDisasterType(typeName),
        date: d.fields?.date?.created,
        status: d.fields?.status,
      };
    }).filter((x: DisasterHit) => x.name);
  } catch {
    return [];
  }
}

// Detect which disaster category the user's question is asking about. Returns priority order.
function inferDisasterCategories(message: string): DisasterCategory[] {
  const m = (message || "").toLowerCase();
  const hits: DisasterCategory[] = [];
  if (/(safety|safe|crime|conflict|war|unrest|protest|terror|violence|kidnap|civil|refugee)/.test(m)) hits.push("safety");
  if (/(health|healthcare|hospital|medical|disease|outbreak|epidemic|virus|sick|vaccine|cholera|dengue|malaria|covid|food.{0,5}safety|famine)/.test(m)) hits.push("healthcare");
  if (/(weather|storm|hurricane|typhoon|cyclone|flood|wildfire|fire|drought|earthquake|tsunami|volcan|heat|cold|snow|landslide|tornado)/.test(m)) hits.push("weather");
  return hits;
}



const SYSTEM_PROMPT = `You are Kipita — a "Know Before You Go" travel intelligence assistant. Talk like a sharp, well-traveled friend texting you back: confident, warm, useful.

KNOWLEDGE: safety, health (water/food/air/vaccines), entry & visas, money, culture, transport, food, accommodation, current conditions.

RESPONSE STYLE — BE BRIEF:
• Default length: 80–140 words. Hard cap: 200 words unless user explicitly asks for "detail" / "full" / "comprehensive".
• Use short bullets and bold labels. No filler. No throat-clearing.
• Lead with the single most useful thing for this traveler RIGHT NOW.
• When live data is provided (places, weather, AQI, UV, safety score), reference it specifically with real names/numbers.
• Use ⚠️ for real risks. Honest, not alarmist.
• End every reply with 2–3 short follow-up suggestions in italics: *Ask me: "..." · "..."*

IN-APP CTAs (USE LIBERALLY when relevant — they deep-link inside Kipita):
• Places near you: [See places near you](kipita://tab/places)
• Specific category (replace TYPE with food, coffee, atm, gas, pharmacy, hospital, attractions, shopping, nightlife, transit): [Open TYPE in Places](kipita://tab/places?hint=TYPE)
• Live map: [Open map](kipita://tab/maps)
• Plan a trip: [Plan a trip](kipita://tab/trips)
• My trips: [View my trips](kipita://tab/trips)
• Safety details: [Safety screen](kipita://tab/safety)
• Wallet / FX: [Wallet](kipita://tab/wallet)
• Perks: [Kipita Perks](kipita://tab/perks)
Always prefer an in-app CTA over an external site when the answer lives inside the app.

EXTERNAL TRAVEL LINKS — REFERENCE ONLY (do NOT include unless explicit booking intent — see strict rules below):
• Hotels: [Hotels.com](https://www.hotels.com/affiliate/RrZ7bmg)
• Flights + Hotels: [Expedia](https://expedia.com/affiliate/eA2cKky)
• Bitcoin: [Swan Bitcoin](https://www.swanbitcoin.com/kipita/) — $10 free BTC
• BTC Rewards Card: [Fold Card](https://use.foldapp.com/r/MAJL4MYU)
• Gold/Silver: [Kinesis](https://kms.kinesis.money/signup/KM00083150)
• Cashback Gas/Groceries: [Upside](https://upside.com/)

AFFILIATE CTA RULES — STRICT (default = NONE):
1. Affiliate links are OFF by default. Most replies must contain ZERO external affiliate links.
2. Only attach an affiliate CTA when the user EXPLICITLY signals booking/purchase intent for that exact category. Look for explicit verbs:
   • Hotels/lodging — only if message contains: "book", "reserve", "find a hotel", "where can I book", "cheapest hotel", "rental", "Airbnb alternative", "vacation rental".
     → Append exactly: *Book it:* [Hotels.com](https://www.hotels.com/affiliate/RrZ7bmg) · [Expedia](https://expedia.com/affiliate/eA2cKky)
   • Rental cars — only if message contains: "rent a car", "car rental", "rental car", "hire a car".
     → Append exactly: *Rentals:* [Expedia cars](https://expedia.com/affiliate/eA2cKky)
   • Fuel/gas cashback — only if message contains: "save on gas", "gas cashback", "cheapest gas", "fuel rewards".
     → Append exactly: *Save at the pump:* [Upside cashback](https://upside.com/)
   • Bitcoin/crypto — only if message contains: "buy btc", "buy bitcoin", "btc rewards card", "btc card".
     → Append exactly: [Swan Bitcoin](https://www.swanbitcoin.com/kipita/) · [Fold Card](https://use.foldapp.com/r/MAJL4MYU)
3. NEVER add affiliate links for: generic "what should I do", "where should I stay" (advice ≠ booking), neighborhoods, safety, food, health, weather, transit advice, "is it safe", "tell me about", small-talk, briefings, or follow-up suggestions.
4. If unsure → DO NOT add an affiliate link. In-app CTAs (kipita://) are always preferred.
5. Maximum ONE affiliate line per reply, on its own line at the very end, before the *Ask me:* suggestions.

WATER & HEALTH SOURCING — when discussing water safety, vaccines, or disease risk, cite the CDC:
• [CDC Travelers' Health](https://wwwnc.cdc.gov/travel) — and when possible link the country page directly: https://wwwnc.cdc.gov/travel/destinations/traveler/none/<country-slug>

EMERGENCY DATA POLICY — IMPORTANT:
• Wildfire (NASA FIRMS), earthquake (USGS), and active-disaster (ReliefWeb) data are EMERGENCY data — only used when the user explicitly asks (Safety chip follow-up, "wildfires near me", "earthquakes", "any disasters"). They are NEVER part of a default city briefing.
• If a LIVE WILDFIRE, EARTHQUAKE, or DISASTER block is present in context, lead with the specific number (e.g., "3 active fires within 60 mi · nearest 24 mi") and cite the source by name: NASA FIRMS, USGS, ReliefWeb. Add [Safety screen](kipita://tab/safety).
• ReliefWeb DISASTER quick filters: each incident is tagged [safety], [healthcare], [weather], or [other]. When the block header says "prioritized by quick filter: …", focus your reply on those tagged incidents (the ones marked 🎯) — they directly answer what the user asked about. Briefly mention any unrelated active incidents only if space allows.
• If a SAFETY-CHIP MODE block is present: give the normal safety briefing (crime, scams, areas to watch, situational awareness). DO NOT invent wildfire/quake/disaster figures. End with a single line offering a live emergency check, and include the exact follow-up suggestion the block tells you to.
• Air quality / UV / pollen (Open-Meteo) is everyday health data and IS part of normal briefings.

SAFETY CONSISTENCY GUARDRAILS — CRITICAL (no contradictions allowed):
1. Anchor every safety verdict to the LIVE TRAVEL CONTEXT advisory score. The headline tone MUST match:
   • ≤1.5 = "very safe" • ≤2.5 = "generally safe" • ≤3.5 = "stay alert / elevated risk" • ≤4.2 = "high risk" • >4.2 = "extreme risk".
   Never call a place "very safe" while listing serious crime risks, and never call it "high risk" with no specifics.
2. Pick ONE overall verdict and stick to it for the whole reply. Do not contradict yourself between sections.
3. Distinguish CONFIRMED live data (advisory score, AQI, NASA FIRMS count, USGS quakes, ReliefWeb entries) from GENERAL knowledge (typical scams, neighborhood reputations). When stating a risk, label it: "Live:" vs "Typical:".
4. If two pieces of live data appear to disagree (e.g., advisory says "generally safe" but ReliefWeb shows an active disaster), call it out explicitly — do NOT silently smooth it over.
5. If you have NO live data for a claim, say so ("no live data — using general knowledge") instead of inventing numbers.
6. Never give two different magnitudes for the same risk within the same reply (e.g., "low crime" then "very high crime").
7. If asked about emergencies and the relevant LIVE block is empty/zero, state that clearly ("No active wildfire detections within 100 mi in the last 24h — NASA FIRMS"). Do not hedge with vague "there might be fires".

NEVER MENTION: Strike, River, Skyscanner, Booking.com, Airbnb.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, history, context, agenticBriefing } = await req.json();

    if (!message || typeof message !== "string") {
      return new Response(JSON.stringify({ error: "Message is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = LOVABLE_API_KEY();
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let systemPrompt = SYSTEM_PROMPT;
    let liveDataBlock = "";
    let allPlaces: PlaceChip[] = [];
    // Per-bucket lists so we can return ONLY situationally relevant chips.
    let bucketRestaurants: PlaceChip[] = [];
    let bucketCafes: PlaceChip[] = [];
    let bucketAttractions: PlaceChip[] = [];
    let bucketBars: PlaceChip[] = [];
    let bucketHospitals: PlaceChip[] = [];

    if (context) {
      const now = new Date();
      const utcHour = now.getUTCHours();
      const dayName = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][now.getUTCDay()];
      const timeDesc = utcHour >= 5 && utcHour < 12 ? "morning" : utcHour < 17 ? "afternoon" : utcHour < 21 ? "evening" : "night";

      liveDataBlock += `\n\n=== LIVE TRAVEL CONTEXT (use this data specifically) ===`;
      liveDataBlock += `\n- Current time: ${dayName} ${timeDesc} (~${utcHour}:00 UTC)`;

      if (context.location) liveDataBlock += `\n- User location: ${context.location}`;
      if (context.weather) liveDataBlock += `\n- Live weather: ${context.weather}`;

      if (context.advisoryScore != null) {
        const safetyDesc =
          context.advisoryScore <= 1.5 ? "very safe (low advisory)" :
          context.advisoryScore <= 2.5 ? "generally safe (normal precautions)" :
          context.advisoryScore <= 3.5 ? "elevated risk (stay alert)" :
          context.advisoryScore <= 4.2 ? "high risk (serious caution)" : "extreme risk (reconsider travel)";
        liveDataBlock += `\n- Travel advisory: ${context.advisoryScore.toFixed(1)}/5 — ${safetyDesc}`;
      }

      // Only surface BTC price when the user explicitly asks about it
      const userMsg = (typeof message === "string" ? message : "").toLowerCase();
      const asksAboutBtc = /\b(btc|bitcoin|crypto|sats?|satoshis?)\b/.test(userMsg);
      if (context.btcPrice && asksAboutBtc) liveDataBlock += `\n- BTC price: $${context.btcPrice.toLocaleString()}`;

      // Country info
      if (context.countryCode) {
        const countryInfo = await fetchCountryInfo(context.countryCode);
        if (countryInfo) liveDataBlock += `\n- ${countryInfo}`;

        const emergency = EMERGENCY_NUMBERS[context.countryCode.toUpperCase()];
        if (emergency) {
          liveDataBlock += `\n- Emergency numbers: Police ${emergency.police} | Ambulance ${emergency.ambulance} | Fire ${emergency.fire}${emergency.tourist ? ` | Tourist Police ${emergency.tourist}` : ""}`;
        }

        const scams = SCAM_ALERTS[context.countryCode.toUpperCase()];
        if (scams?.length) {
          liveDataBlock += `\n- Known local scams: ${scams.slice(0, 2).join("; ")}`;
        }

        const health = HEALTH_NOTES[context.countryCode.toUpperCase()];
        if (health) liveDataBlock += `\n- Health advisory: ${health}`;
      }

      // Live nearby places + live health (air quality / UV / pollen)
      let liveHealth: LiveHealth | null = null;
      let nearestHospital: PlaceChip | null = null;
      if (typeof context.lat === "number" && typeof context.lng === "number") {
        // Detect emergency/safety intent — only THEN do we hit NASA FIRMS, USGS, ReliefWeb.
        // Wildfire, earthquake, and disaster data are NOT part of the default brief; they live behind
        // the Safety chip / explicit ask, exactly like the user requested.
        const lowerMsg = (typeof message === "string" ? message : "").toLowerCase();
        const wantsWildfires = /\b(wildfire|wild fire|fires?|smoke|evacuat|firms|burning|brush fire)\b/.test(lowerMsg);
        const wantsQuakes = /\b(earthquake|quake|seismic|tremor|aftershock|usgs)\b/.test(lowerMsg);
        const wantsDisasters = /\b(disaster|hurricane|typhoon|cyclone|flood|tsunami|volcan|emergenc|evacuat|reliefweb|outbreak|epidemic|conflict|unrest)\b/.test(lowerMsg);
        const wantsSafetyDeep = /\b(safety|safe|danger|risk|threat|warning|alert)\b/.test(lowerMsg);
        // Safety chip = normal safety brief + offer emergency follow-up. Only pull emergency feeds
        // when user explicitly asks for them OR also explicitly asks for live emergency check.
        const wantsLiveEmergencyCheck = /live emergency check|wildfires?, earthquakes?|active disasters?/.test(lowerMsg);
        // Quick-filter categories the user is asking about — drives ReliefWeb prioritization.
        const disasterCategories = inferDisasterCategories(lowerMsg);
        const includeFires = wantsWildfires || wantsLiveEmergencyCheck;
        const includeQuakes = wantsQuakes || wantsLiveEmergencyCheck;
        const includeDisasters = wantsDisasters || wantsLiveEmergencyCheck || disasterCategories.length > 0;

        const [restaurants, cafes, attractions, bars, hospitals, health, fires, quakes, disasters] = await Promise.all([
          fetchNearbyPlaces(context.lat, context.lng, "restaurant", 6),
          fetchNearbyPlaces(context.lat, context.lng, "cafe", 4),
          fetchNearbyPlaces(context.lat, context.lng, "tourist_attraction", 5),
          fetchNearbyPlaces(context.lat, context.lng, "bar", 3),
          fetchNearbyPlaces(context.lat, context.lng, "hospital", 2),
          fetchLiveHealth(context.lat, context.lng),
          includeFires ? fetchWildfires(context.lat, context.lng, 100) : Promise.resolve(null),
          includeQuakes ? fetchEarthquakes(context.lat, context.lng, 200, 2.5) : Promise.resolve([]),
          includeDisasters && context.countryCode ? fetchDisasters(context.countryCode) : Promise.resolve([]),
        ]);

        allPlaces = [...restaurants, ...cafes, ...attractions, ...bars].filter((p) => p.name);
        liveHealth = health;
        nearestHospital = hospitals[0] || null;

        const fmt = (label: string, arr: PlaceChip[]) =>
          arr.length
            ? `\n${label}:\n` + arr.map((p) => `  • ${p.name}${p.rating ? ` (★${p.rating}, ${p.reviews || 0} reviews)` : ""}${p.openNow === false ? " [CLOSED]" : p.openNow === true ? " [OPEN]" : ""}${p.summary ? ` — ${p.summary}` : ""}`).join("\n")
            : "";

        liveDataBlock += fmt("\nNearby restaurants", restaurants);
        liveDataBlock += fmt("Nearby cafes", cafes);
        liveDataBlock += fmt("Nearby attractions", attractions);
        liveDataBlock += fmt("Nearby bars", bars);
        if (hospitals.length) {
          liveDataBlock += fmt("Nearest hospitals", hospitals);
        }

        if (liveHealth) {
          liveDataBlock += `\n\n=== LIVE AIR QUALITY & UV (Open-Meteo Air Quality API, real-time) ===`;
          if (liveHealth.usAqi != null) liveDataBlock += `\n- US AQI: ${Math.round(liveHealth.usAqi)} (${aqiCategory(liveHealth.usAqi)})`;
          if (liveHealth.pm25 != null) liveDataBlock += `\n- PM2.5: ${liveHealth.pm25.toFixed(1)} µg/m³`;
          if (liveHealth.pm10 != null) liveDataBlock += `\n- PM10: ${liveHealth.pm10.toFixed(1)} µg/m³`;
          if (liveHealth.ozone != null) liveDataBlock += `\n- Ozone: ${liveHealth.ozone.toFixed(0)} µg/m³`;
          if (liveHealth.no2 != null) liveDataBlock += `\n- NO₂: ${liveHealth.no2.toFixed(0)} µg/m³`;
          if (liveHealth.uvIndex != null) liveDataBlock += `\n- UV Index: ${liveHealth.uvIndex.toFixed(1)}${liveHealth.uvIndex >= 8 ? " (very high — sun protection essential)" : liveHealth.uvIndex >= 6 ? " (high)" : liveHealth.uvIndex >= 3 ? " (moderate)" : " (low)"}`;
          const p = liveHealth.pollen || {};
          const pollenParts: string[] = [];
          if (p.grass != null && p.grass > 0) pollenParts.push(`grass ${p.grass.toFixed(1)}`);
          if (p.tree != null && p.tree > 0) pollenParts.push(`tree ${p.tree.toFixed(1)}`);
          if (p.weed != null && p.weed > 0) pollenParts.push(`weed ${p.weed.toFixed(1)}`);
          if (pollenParts.length) liveDataBlock += `\n- Pollen (grains/m³): ${pollenParts.join(", ")}`;
        }

        if (includeFires && fires) {
          liveDataBlock += `\n\n=== LIVE WILDFIRE DATA (NASA FIRMS — VIIRS NOAA-20 NRT, last 24h, 100mi radius) ===`;
          if (fires.count === 0) {
            liveDataBlock += `\n- No active fire detections within 100 mi in the last 24h.`;
          } else {
            liveDataBlock += `\n- Active fire detections: ${fires.count} (high-confidence: ${fires.highConfidence})`;
            if (fires.nearestMi != null) liveDataBlock += `\n- Nearest detection: ${fires.nearestMi} mi away`;
            if (fires.totalFrpMw > 0) liveDataBlock += `\n- Combined fire radiative power: ~${fires.totalFrpMw} MW`;
            if (fires.hits.length) {
              liveDataBlock += `\n- Top hits:\n` + fires.hits.slice(0, 5).map((h) =>
                `  • ${h.distanceMi} mi away${h.frp ? ` · ${Math.round(h.frp)} MW` : ""}${h.confidence ? ` · conf=${h.confidence}` : ""}${h.acqDate ? ` · ${h.acqDate} ${h.acqTime || ""}` : ""}`
              ).join("\n");
            }
            liveDataBlock += `\n- Map: https://firms.modaps.eosdis.nasa.gov/usfs/map/`;
          }
        }

        if (includeQuakes && quakes && quakes.length) {
          liveDataBlock += `\n\n=== RECENT EARTHQUAKES (USGS, M2.5+, 200mi radius, last 30d) ===`;
          liveDataBlock += `\n` + quakes.slice(0, 5).map((q) =>
            `  • M${q.mag.toFixed(1)} — ${q.place} (${q.distanceMi} mi away)`
          ).join("\n");
        }

        if (includeDisasters && disasters && disasters.length) {
          // Quick-filter: if the user asked about safety/healthcare/weather, surface those first.
          const filterCats = disasterCategories.length ? disasterCategories : (["safety","healthcare","weather"] as DisasterCategory[]);
          const matched = disasters.filter((d) => filterCats.includes(d.category));
          const others = disasters.filter((d) => !filterCats.includes(d.category));
          const ordered = [...matched, ...others];
          const filterLabel = disasterCategories.length
            ? ` · prioritized by quick filter: ${disasterCategories.join(", ")}`
            : "";
          liveDataBlock += `\n\n=== ACTIVE DISASTERS (ReliefWeb, country-level${filterLabel}) ===`;
          liveDataBlock += `\n` + ordered.slice(0, 6).map((d) => {
            const tag = filterCats.includes(d.category) ? ` 🎯 [${d.category}]` : ` [${d.category}]`;
            return `  • ${d.type}: ${d.name}${d.status ? ` [${d.status}]` : ""}${tag}`;
          }).join("\n");
          if (disasterCategories.length && matched.length === 0) {
            liveDataBlock += `\n- (No active incidents in country match the user's quick filter — listed are most recent of any category.)`;
          }
        }

        // Hint to the assistant: if Safety chip was tapped (wantsSafetyDeep) but we DIDN'T fetch
        // emergency feeds yet, instruct it to end with a one-line offer to run a live emergency check.
        if (wantsSafetyDeep && !includeFires && !includeQuakes && !includeDisasters) {
          liveDataBlock += `\n\n=== SAFETY-CHIP MODE ===\n- User asked the normal safety question. Give the standard briefing (crime, scams, areas to avoid, what to watch for).\n- DO NOT fabricate wildfire/earthquake/disaster numbers. End the reply with ONE follow-up offer like: *Want a live emergency check?* — and include exactly this suggestion in your *Ask me:* line: "Run a live emergency check (wildfires, earthquakes, active disasters)" so they can tap it.`;
        }
      }

      if (context.trips?.length > 0) {
        liveDataBlock += `\n- User's active trips: ${JSON.stringify(
          context.trips.map((t: any) => ({ dest: t.dest, country: t.country, start: t.start, status: t.status }))
        )}`;
      }

      systemPrompt += liveDataBlock;
    }

    let userMessage = message;

    if (agenticBriefing && context?.location) {
      const safetyVibe =
        context.advisoryScore == null ? "unknown safety data"
        : context.advisoryScore <= 1.5 ? "very safe — chill and explore freely"
        : context.advisoryScore <= 2.5 ? "generally safe — normal city awareness"
        : context.advisoryScore <= 3.5 ? "elevated risk — keep your wits about you"
        : "high risk — real precautions needed";

      const cc = context.countryCode?.toUpperCase() || "";
      const scams = SCAM_ALERTS[cc]?.slice(0, 1)?.[0] || null;
      const emergency = EMERGENCY_NUMBERS[cc];
      const health = HEALTH_NOTES[cc];

      userMessage = `Generate a SHORT "Know Before You Go" briefing for **${context.location}**.

Use the LIVE TRAVEL CONTEXT data. Be tight — every section 1–2 sentences max. Total ≤ 160 words.

**📍 ${context.location}**

**🛡️ Safety:** Calibrated take (${safetyVibe}) + ONE specific thing to watch for. End with [Safety details](kipita://tab/safety).

**🌡️ Right now:** Weather + what it means for today's plan in 1 sentence.

**🍽️ Eat:** Pick the single best open spot from live restaurants — name it. End with [More food spots](kipita://tab/places?hint=food).

**✨ Do:** 1 specific thing from live attractions. End with [Open map](kipita://tab/maps).

**🏥 Health:** State live AQI + UV in plain words (e.g., "AQI 42, UV 6 — fine, wear sunscreen"). Tap water: safe / unsafe.${health ? ` ${health}` : ""} Source: [CDC Travelers' Health](https://wwwnc.cdc.gov/travel).${scams ? `\n\n**⚠️ Watch out:** ${scams}` : ""}${emergency ? `\n\n**🆘 Emergency:** Police ${emergency.police} · Ambulance ${emergency.ambulance}` : ""}

*Ask me: "Best neighborhood to stay?" · "Is tap water safe?" · "What scams here?"*`;
    }

    const messages = [
      { role: "system", content: systemPrompt },
      ...(history || []).slice(-10).map((h: any) => ({
        role: h.role === "ai" ? "assistant" : "user",
        content: h.text,
      })),
      { role: "user", content: userMessage },
    ];

    const response = await fetch(AI_GATEWAY, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        max_tokens: 700,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`AI Gateway error ${response.status}:`, errText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit — try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Add funds in workspace settings." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "AI service temporarily unavailable" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    let reply =
      data.choices?.[0]?.message?.content ||
      "I'm sorry, I couldn't generate a response. Please try again.";

    // ── Safety consistency check ──────────────────────────────────────────────
    // Safety replies were occasionally giving conflicting verdicts ("very safe" + "high crime
    // risk" in the same answer). For any safety-flavored query, run a fast audit pass that
    // detects contradictions vs. the live advisory score and rewrites if needed. Cheap model,
    // tight prompt, only fires when triggered — adds ~600ms in the worst case.
    const lowerForAudit = (typeof message === "string" ? message : "").toLowerCase();
    const isSafetyQuery =
      /\b(safe|safety|danger|risk|crime|scam|threat|warning|alert|wildfire|earthquake|disaster|emergenc)\b/.test(
        lowerForAudit
      ) || agenticBriefing === true;

    if (isSafetyQuery && reply && reply.length > 80) {
      try {
        const advisoryLabel =
          context?.advisoryScore == null ? "unknown"
          : context.advisoryScore <= 1.5 ? "very safe"
          : context.advisoryScore <= 2.5 ? "generally safe"
          : context.advisoryScore <= 3.5 ? "stay alert / elevated risk"
          : context.advisoryScore <= 4.2 ? "high risk"
          : "extreme risk";

        const auditPrompt = `You are a strict editor checking a Kipita travel-safety reply for INTERNAL CONTRADICTIONS and misalignment with the official advisory level.

Official advisory score: ${context?.advisoryScore ?? "unknown"} → "${advisoryLabel}"
Location: ${context?.location || "unknown"}

REPLY TO AUDIT:
"""
${reply}
"""

CHECKS:
1. Does the headline verdict match the advisory label? (e.g., advisory "very safe" but reply says "extreme caution" = contradiction)
2. Does the reply contradict itself? (e.g., "low crime" then "very high crime risk")
3. Are live-data claims labeled (NASA FIRMS / USGS / ReliefWeb / AQI) vs general knowledge?
4. Does the reply invent emergency numbers that weren't in the live data?

If the reply is internally consistent and aligned, respond with EXACTLY: OK
Otherwise, respond with ONLY a corrected version of the reply (same format, same length, same in-app links/CTAs preserved). No preamble. No explanation. Just the rewritten reply.`;

        const auditResp = await fetch(AI_GATEWAY, {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [{ role: "user", content: auditPrompt }],
            max_tokens: 700,
            temperature: 0.2,
          }),
        });
        if (auditResp.ok) {
          const auditData = await auditResp.json();
          const auditOut = (auditData.choices?.[0]?.message?.content || "").trim();
          if (auditOut && auditOut !== "OK" && !/^ok[.!\s]*$/i.test(auditOut) && auditOut.length > 60) {
            console.log("Safety audit rewrote reply for consistency.");
            reply = auditOut;
          }
        }
      } catch (e) {
        console.error("Safety audit pass failed (non-fatal):", e);
      }
    }

    // Extract contextual follow-up suggestions based on what was asked
    const suggestions = buildSuggestions(message, context);

    const responseBody: Record<string, unknown> = { reply, suggestions };
    if (allPlaces.length > 0) {
      responseBody.places = allPlaces.slice(0, 12);
    }

    return new Response(JSON.stringify(responseBody), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("ai-chat error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function buildSuggestions(message: string, context: any): string[] {
  const msg = message.toLowerCase();
  const loc = context?.location || "here";

  if (msg.includes("safe") || msg.includes("safety") || msg.includes("danger")) {
    return [`What neighborhoods should I avoid in ${loc}?`, "What scams should I watch out for?", "Is it safe to walk at night?"];
  }
  if (msg.includes("eat") || msg.includes("food") || msg.includes("restaurant")) {
    return [`What's the local dish I must try?`, "Where do locals eat (not tourist traps)?", "Is the street food safe to eat?"];
  }
  if (msg.includes("hotel") || msg.includes("stay") || msg.includes("accommodation")) {
    return [`What's the best neighborhood to stay in?`, "What's a realistic daily budget?", "I want to book a hotel here"];
  }
  if (msg.includes("visa") || msg.includes("entry") || msg.includes("passport")) {
    return ["What vaccines do I need?", "Can I get visa on arrival?", "What shouldn't I bring through customs?"];
  }
  if (msg.includes("transport") || msg.includes("taxi") || msg.includes("uber") || msg.includes("get around")) {
    return ["Is Uber/Grab available here?", "What's a fair taxi fare from the airport?", "Is public transit safe?"];
  }
  if (msg.includes("money") || msg.includes("atm") || msg.includes("currency") || msg.includes("cash")) {
    return ["Do most places take credit cards?", "Where's the best place to exchange money?", "What's the daily budget for a traveler?"];
  }
  if (msg.includes("weather") || msg.includes("rain") || msg.includes("hot") || msg.includes("cold")) {
    return [`What should I pack for ${loc}?`, "What's the best time of year to visit?", "What activities work in this weather?"];
  }
  if (msg.includes("trip") || msg.includes("plan") || msg.includes("itinerary")) {
    return ["What's the one thing I absolutely can't miss?", "How many days do I really need?", "What are the best day trips from here?"];
  }
  if (msg.includes("fire") || msg.includes("wildfire") || msg.includes("smoke")) {
    return ["Is the air quality safe outside?", "Are any evacuations active nearby?", "Show me the FIRMS map"];
  }
  if (msg.includes("air") || msg.includes("aqi") || msg.includes("pollution") || msg.includes("smog")) {
    return ["Safe to exercise outside today?", "Should I wear a mask?", "What's driving the air quality?"];
  }
  if (msg.includes("earthquake") || msg.includes("quake") || msg.includes("tsunami") || msg.includes("disaster")) {
    return ["Any recent earthquakes nearby?", "Is this area quake-prone?", "What active disasters are in the country?"];
  }

  // Default: general discovery prompts
  return [`What's the vibe in ${loc} right now?`, "What do most tourists get wrong about this place?", "What's the hidden gem most visitors miss?"];
}
