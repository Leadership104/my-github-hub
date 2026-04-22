import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LOVABLE_API_KEY = () => Deno.env.get("LOVABLE_API_KEY") || "";
const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

// ── Teleport: city quality-of-life scores (free, no auth) ────────────────────
const TELEPORT_SLUGS: Record<string, string> = {
  "bangkok": "bangkok", "chiang mai": "chiang-mai", "chiang-mai": "chiang-mai",
  "bali": "bali", "canggu": "bali", "ubud": "bali", "seminyak": "bali",
  "medellin": "medellin", "medellín": "medellin", "bogota": "bogota", "bogotá": "bogota",
  "lisbon": "lisbon", "porto": "porto", "tbilisi": "tbilisi",
  "mexico city": "mexico-city", "cdmx": "mexico-city",
  "da nang": "da-nang", "danang": "da-nang", "budapest": "budapest",
  "cape town": "cape-town", "dubai": "dubai", "singapore": "singapore",
  "tokyo": "tokyo", "osaka": "osaka", "seoul": "seoul", "taipei": "taipei",
  "berlin": "berlin", "barcelona": "barcelona", "amsterdam": "amsterdam",
  "prague": "prague", "warsaw": "warsaw", "istanbul": "istanbul",
  "new york": "new-york-city", "nyc": "new-york-city",
  "london": "london", "paris": "paris", "miami": "miami",
  "los angeles": "los-angeles", "san francisco": "san-francisco",
  "austin": "austin", "chicago": "chicago",
  "lima": "lima", "buenos aires": "buenos-aires", "santiago": "santiago",
  "ho chi minh": "ho-chi-minh-city", "saigon": "ho-chi-minh-city", "hcmc": "ho-chi-minh-city",
  "hanoi": "hanoi", "kuala lumpur": "kuala-lumpur",
  "nairobi": "nairobi", "lagos": "lagos", "accra": "accra",
  "cairo": "cairo", "johannesburg": "johannesburg",
  "toronto": "toronto", "vancouver": "vancouver", "montreal": "montreal",
  "sydney": "sydney", "melbourne": "melbourne", "auckland": "auckland",
  "mumbai": "mumbai", "delhi": "new-delhi", "new delhi": "new-delhi",
  "bangalore": "bangalore", "bengaluru": "bangalore",
  "hong kong": "hong-kong", "manila": "manila", "jakarta": "jakarta",
  "tel aviv": "tel-aviv", "rio de janeiro": "rio-de-janeiro",
  "sao paulo": "sao-paulo", "são paulo": "sao-paulo",
};

function extractCitySlug(text: string): string | null {
  const lower = text.toLowerCase();
  for (const [name, slug] of Object.entries(TELEPORT_SLUGS)) {
    if (lower.includes(name)) return slug;
  }
  return null;
}

function slugToTitle(slug: string): string {
  return slug.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

async function withTimeout<T>(promise: Promise<T>, ms = 4000): Promise<T | null> {
  const timeout = new Promise<null>(r => setTimeout(() => r(null), ms));
  const result = await Promise.race([promise, timeout]);
  return result;
}

// ── Tool 1: Teleport city scores ─────────────────────────────────────────────
async function fetchCityScores(slug: string): Promise<{ text: string; label: string } | null> {
  try {
    const res = await fetch(`https://api.teleport.org/api/urban_areas/slug:${slug}/scores/`, {
      headers: { "Accept": "application/vnd.teleport.v1+json" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const keep = ["Cost of Living", "Safety", "Internet Access", "Startups", "Leisure & Culture", "Outdoors", "Tolerance"];
    const scores = (data.categories || [])
      .filter((c: any) => keep.includes(c.name))
      .map((c: any) => `${c.name}: ${c.score_out_of_10.toFixed(1)}/10`)
      .join(" | ");
    const overall = data.teleport_city_score ? ` | Overall: ${data.teleport_city_score.toFixed(0)}/100` : "";
    const city = slugToTitle(slug);
    return scores
      ? { text: `Teleport quality-of-life scores for ${city}${overall} | ${scores}`, label: `City Scores: ${city}` }
      : null;
  } catch { return null; }
}

// ── Tool 2: Wikipedia destination summary ─────────────────────────────────────
async function fetchWikiSummary(slug: string): Promise<{ text: string; label: string } | null> {
  try {
    const title = encodeURIComponent(slugToTitle(slug).replace("Ho Chi Minh City", "Ho Chi Minh City").replace("New-York-City", "New York City"));
    const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${title}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.extract) return null;
    const excerpt = data.extract.split(". ").slice(0, 3).join(". ") + ".";
    return { text: `Wikipedia — ${slugToTitle(slug)}: ${excerpt}`, label: `Wikipedia: ${slugToTitle(slug)}` };
  } catch { return null; }
}

// ── Tool 3: Live exchange rates (Frankfurter, free) ───────────────────────────
async function fetchExchangeRates(): Promise<{ text: string; label: string } | null> {
  try {
    const res = await fetch("https://api.frankfurter.app/latest?from=USD&to=EUR,GBP,JPY,THB,MXN,IDR,SGD,BRL,INR,AED");
    if (!res.ok) return null;
    const { rates } = await res.json();
    const line = Object.entries(rates).map(([k, v]) => `${k} ${v}`).join(" | ");
    return { text: `Live USD exchange rates: ${line}`, label: "Live Exchange Rates" };
  } catch { return null; }
}

// ── Tool 4: RestCountries destination facts ────────────────────────────────────
async function fetchCountryInfo(code: string): Promise<{ text: string; label: string } | null> {
  if (!code || code.length !== 2) return null;
  try {
    const res = await fetch(`https://restcountries.com/v3.1/alpha/${code}?fields=name,capital,currencies,languages,timezones,region,subregion,population`);
    if (!res.ok) return null;
    const d = await res.json();
    const cur = Object.values(d.currencies || {})[0] as any;
    const langs = (Object.values(d.languages || {}) as string[]).slice(0, 3).join(", ");
    const pop = d.population ? `${(d.population / 1_000_000).toFixed(1)}M` : "";
    return {
      text: `${d.name.common} (${d.subregion || d.region}) | Capital: ${d.capital?.[0]} | Currency: ${cur?.name} (${cur?.symbol}) | Languages: ${langs} | Timezone: ${d.timezones?.[0]} | Population: ${pop}`,
      label: `Country Data: ${d.name.common}`,
    };
  } catch { return null; }
}

// ── Tool 5: Travel advisory ────────────────────────────────────────────────────
async function fetchAdvisory(code: string): Promise<{ text: string; label: string } | null> {
  if (!code) return null;
  try {
    const res = await fetch(`https://www.travel-advisory.info/api?countrycode=${code.toUpperCase()}`);
    if (!res.ok) return null;
    const data = await res.json();
    const info = data.data?.[code.toUpperCase()];
    if (!info) return null;
    const score = info.advisory?.score ? `Level ${Number(info.advisory.score).toFixed(1)}/5` : "";
    const msg = info.advisory?.message || "";
    return {
      text: `Travel advisory — ${info.name}: ${score}${msg ? ` — ${msg}` : ""}`,
      label: `Travel Advisory: ${info.name}`,
    };
  } catch { return null; }
}

// ── Tool 6: DuckDuckGo instant answers (web context, free) ────────────────────
async function fetchDDG(query: string): Promise<{ text: string; label: string } | null> {
  try {
    const res = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1&no_html=1`);
    if (!res.ok) return null;
    const data = await res.json();
    const abstract = data.AbstractText?.trim();
    const answer = data.Answer?.trim();
    const text = abstract || answer;
    if (!text || text.length < 30) return null;
    return { text: `Web context: ${text.slice(0, 500)}`, label: "Web Search" };
  } catch { return null; }
}

// ── Tool 7: Open-Meteo destination weather forecast (free) ────────────────────
async function fetchDestinationWeather(slug: string): Promise<{ text: string; label: string } | null> {
  try {
    const city = slugToTitle(slug).replace(/-/g, " ");
    const geoRes = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city)}&format=json&limit=1`,
      { headers: { "User-Agent": "KipitaAI/2.0" } }
    );
    if (!geoRes.ok) return null;
    const geo = await geoRes.json();
    if (!geo[0]) return null;
    const { lat, lon } = geo[0];
    const wRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto&forecast_days=5`
    );
    if (!wRes.ok) return null;
    const w = await wRes.json();
    const days = w.daily;
    const summary = days.time.slice(0, 5).map((date: string, i: number) =>
      `${date}: ${Math.round(days.temperature_2m_min[i])}–${Math.round(days.temperature_2m_max[i])}°C, ${days.precipitation_sum[i]}mm rain`
    ).join(" | ");
    return { text: `5-day forecast for ${city}: ${summary}`, label: `Weather Forecast: ${city}` };
  } catch { return null; }
}

// ── Intent detection ──────────────────────────────────────────────────────────
function detectIntents(msg: string) {
  const t = msg.toLowerCase();
  return {
    needsExchangeRates: /exchange|currency|convert|rate|forex|dollar|euro|baht|peso|rupiah/.test(t),
    needsWeather: /weather|climate|forecast|temperature|rain|hot|cold|season|monsoon/.test(t),
    needsSafety: /safe|crime|danger|advisory|warning|risk|scam|threat/.test(t),
    needsWebSearch: /news|current|latest|today|happening|2025|2026|recently/.test(t),
    needsCityData: /cost|budget|nomad|cowork|quality|score|live|stay|move|best city/.test(t),
  };
}

// ── System prompt ─────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are Kipita AI — an enterprise-grade travel intelligence platform for digital nomads, remote workers, and global adventurers. You have access to live data and give precise, opinionated, actionable answers. Never hedge when you have real data.

## Core Knowledge

**Digital Nomad Visas (2025–2026)**
- Thailand LTR: 10yr, $80K/yr income or $250K investment
- Portugal D8: 2yr renewable, €3,280/mo proven remote income
- Indonesia: No nomad visa; B211A tourist 60 days, extendable ~180 days
- Mexico Temporary Resident: 4yr, ~$1,620/mo income, apply at consulate
- UAE Freelancer Visa: 1yr, ~$285, needs client contracts
- Georgia: Free 1yr stay for most nationalities
- Colombia Nomad Visa: 2yr, $650/mo income proof
- Spain DNV: 3yr, €2,334/mo, EU residency pathway

**Monthly Cost of Living (nomad, all-in)**
- Chiang Mai $800–1,200 | Tbilisi $600–1,000 | Da Nang $700–1,100
- Bangkok $1,000–1,600 | Bali $1,000–1,800 | Medellín $900–1,400
- Mexico City $1,200–2,000 | Budapest $1,200–1,800 | Lisbon $1,800–2,600
- Cape Town $1,100–1,700 | Dubai $2,500–4,000 | Singapore $3,000–5,000

**Finance**
- Best travel accounts: Wise (mid-market rate), Revolut, Charles Schwab (fee-free ATMs)
- Always decline "dynamic currency conversion" at ATMs — always pay in local currency
- Bitcoin hubs: El Salvador, Madeira Portugal, Bali, Amsterdam, Miami, Zug Switzerland

**Connectivity**
- eSIM: Airalo, Holafly, Nomad — buy before flying for best rates
- Top coworking: Hubud/Dojo (Bali), CAMP at Maya Mall (Chiang Mai, free wifi), Selina (global), KoHub (Koh Lanta)

## Response Style
- Lead with the answer — no "great question!" openers
- **Bold** key facts, prices, warnings
- Use \`## Headers\` for multi-section answers
- Bullets over paragraphs — readers scan
- Give opinions: "I'd pick X over Y because…"
- When live data is provided in context, cite it explicitly
- Naturally include affiliate links when booking-relevant:
  - Hotels: **[Hotels.com](https://www.hotels.com/affiliate/RrZ7bmg)**
  - Flights+hotels: **[Expedia](https://expedia.com/affiliate/eA2cKky)**
  - BTC savings: **[Swan Bitcoin](https://www.swanbitcoin.com/kipita/)** — $10 free BTC
  - BTC rewards card: **[Fold Card](https://use.foldapp.com/r/MAJL4MYU)**
  - Gold/silver: **[Kinesis](https://kms.kinesis.money/signup/KM00083150)**
  - Gas/food cashback (US): **[Upside](https://upside.com/)**
- Route to app features: "check the **Safety tab**", "**Maps tab** for BTC merchants", "**Wallet tab** for live crypto", "**Places tab** for nearby spots"
- 300–400 words max unless asked for a full itinerary`;

// ── Main handler ──────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { message, history, context } = await req.json();
    if (!message || typeof message !== "string") {
      return new Response(JSON.stringify({ error: "Message required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const apiKey = LOVABLE_API_KEY();
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "AI service not configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const intents = detectIntents(message);
    const citySlug = extractCitySlug(message) || extractCitySlug(context?.location || "");
    const countryCode = context?.countryCode || "";

    // ── Parallel tool execution ────────────────────────────────────────────────
    const tasks: Promise<{ text: string; label: string } | null>[] = [
      withTimeout(fetchExchangeRates()),                                         // always useful
      countryCode ? withTimeout(fetchCountryInfo(countryCode)) : Promise.resolve(null),
      (intents.needsSafety && countryCode) ? withTimeout(fetchAdvisory(countryCode)) : Promise.resolve(null),
      citySlug ? withTimeout(fetchCityScores(citySlug)) : Promise.resolve(null),
      citySlug ? withTimeout(fetchWikiSummary(citySlug)) : Promise.resolve(null),
      (intents.needsWeather && citySlug) ? withTimeout(fetchDestinationWeather(citySlug)) : Promise.resolve(null),
      intents.needsWebSearch ? withTimeout(fetchDDG(message.slice(0, 120))) : Promise.resolve(null),
    ];

    const results = await Promise.all(tasks);
    const hits = results.filter(Boolean) as { text: string; label: string }[];
    const sources = hits.map(h => h.label);

    // ── Build enriched system prompt ───────────────────────────────────────────
    let systemPrompt = SYSTEM_PROMPT;
    const ctxLines: string[] = [];
    if (context?.location) ctxLines.push(`User location: ${context.location}`);
    if (context?.weather)  ctxLines.push(`Current weather: ${context.weather}`);
    if (context?.trips?.length) ctxLines.push(`User trips: ${JSON.stringify(context.trips.map((t: any) => ({ dest: t.dest, country: t.country, status: t.status })))}`);
    hits.forEach(h => ctxLines.push(h.text));

    if (ctxLines.length) {
      systemPrompt += `\n\n## Live Intelligence\n` + ctxLines.map(l => `- ${l}`).join("\n");
    }

    const messages = [
      { role: "system", content: systemPrompt },
      ...(history || []).slice(-12).map((h: any) => ({ role: h.role === "ai" ? "assistant" : "user", content: h.text })),
      { role: "user", content: message },
    ];

    const aiRes = await fetch(AI_GATEWAY, {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "google/gemini-2.5-flash", messages, max_tokens: 1500, temperature: 0.7 }),
    });

    if (!aiRes.ok) {
      const err = await aiRes.text();
      console.error(`AI Gateway ${aiRes.status}:`, err);
      return new Response(JSON.stringify({ error: "AI service temporarily unavailable" }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await aiRes.json();
    const reply = data.choices?.[0]?.message?.content || "Unable to generate a response. Please try again.";

    return new Response(
      JSON.stringify({ reply, sources }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("ai-chat error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
