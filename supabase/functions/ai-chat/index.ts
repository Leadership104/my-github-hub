import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LOVABLE_API_KEY = () => Deno.env.get("LOVABLE_API_KEY") || "";
const GOOGLE_PLACES_API_KEY = () => Deno.env.get("GOOGLE_PLACES_API_KEY") || "";
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

// ── Ultimate Travel Expert System Prompt ──────────────────────────────────────
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

EXTERNAL TRAVEL LINKS (use only when actually booking-related):
• Hotels: [Hotels.com](https://www.hotels.com/affiliate/RrZ7bmg)
• Flights + Hotels: [Expedia](https://expedia.com/affiliate/eA2cKky)
• Bitcoin: [Swan Bitcoin](https://www.swanbitcoin.com/kipita/) — $10 free BTC
• BTC Rewards Card: [Fold Card](https://use.foldapp.com/r/MAJL4MYU)
• Gold/Silver: [Kinesis](https://kms.kinesis.money/signup/KM00083150)
• Cashback Gas/Groceries: [Upside](https://upside.com/)

WATER & HEALTH SOURCING — when discussing water safety, vaccines, or disease risk, cite the CDC:
• [CDC Travelers' Health](https://wwwnc.cdc.gov/travel) — and when possible link the country page directly: https://wwwnc.cdc.gov/travel/destinations/traveler/none/<country-slug>

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
        const [restaurants, cafes, attractions, bars, hospitals, health] = await Promise.all([
          fetchNearbyPlaces(context.lat, context.lng, "restaurant", 6),
          fetchNearbyPlaces(context.lat, context.lng, "cafe", 4),
          fetchNearbyPlaces(context.lat, context.lng, "tourist_attraction", 5),
          fetchNearbyPlaces(context.lat, context.lng, "bar", 3),
          fetchNearbyPlaces(context.lat, context.lng, "hospital", 2),
          fetchLiveHealth(context.lat, context.lng),
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
          liveDataBlock += `\n\n=== LIVE HEALTH DATA (real-time, from Open-Meteo Air Quality API) ===`;
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
    const reply =
      data.choices?.[0]?.message?.content ||
      "I'm sorry, I couldn't generate a response. Please try again.";

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
    return [`What's the best neighborhood to stay in?`, "What's a realistic daily budget?", "Is [Hotels.com](https://www.hotels.com/affiliate/RrZ7bmg) the best option here?"];
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

  // Default: general discovery prompts
  return [`What's the vibe in ${loc} right now?`, "What do most tourists get wrong about this place?", "What's the hidden gem most visitors miss?"];
}
