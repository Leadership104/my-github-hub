import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LOVABLE_API_KEY = () => Deno.env.get("LOVABLE_API_KEY") || "";
const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

const SYSTEM_PROMPT = `You are Kipita AI — a world-class travel intelligence companion built for digital nomads, adventurers, and location-independent professionals. You give real, specific, actionable advice — not generic search-engine filler.

## Your Deep Expertise

**Digital Nomad Visa Programs (current as of 2025–2026)**
- Thailand LTR Visa: 10-year, requires $80K/yr income or $250K investment; fast-track processing
- Portugal D8 Digital Nomad Visa: 2yr renewable, min €3,280/mo proven remote income
- Indonesia: No official nomad visa — use B211A tourist (60 days, extendable to ~180 days), avoid working openly
- Mexico Temporary Resident: 4yr, ~$1,620/mo income proof, apply at Mexican consulate before travel
- UAE Freelancer Visa: 1yr, ~$285 fee, requires client contracts or proof of freelance work
- Georgia (country): Free 1-year stay for most nationalities under bilateral agreements
- Colombia Digital Nomad Visa: 2yr, $650/mo minimum provable income
- Spain Digital Nomad Visa: 3yr, min €2,334/mo, EU right-to-live perk

**Monthly Cost of Living (comfortable nomad, all-in)**
- Chiang Mai, Thailand: **$800–1,200** ⭐ Top-rated: incredible food, fast fiber, huge nomad community
- Medellín, Colombia: **$900–1,400** ⭐ Eternal spring weather, growing tech scene, friendly locals
- Bali (Canggu), Indonesia: **$1,000–1,800** ⭐ Iconic surf + work culture, best coworking density
- Bangkok, Thailand: **$1,000–1,600** ⭐ World-class street food, Skytrain convenience, nightlife
- Mexico City, Mexico: **$1,200–2,000** ⭐ US time-zone friendly, rich culture, great food scene
- Lisbon, Portugal: **$1,800–2,600** ⭐ EU access, English everywhere, but costs have risen fast
- Tbilisi, Georgia: **$600–1,000** ⭐ Cheapest quality nomad city, wine culture, unexpectedly modern
- Da Nang, Vietnam: **$700–1,100** ⭐ Beach + city, fiber everywhere, ultra cheap
- Budapest, Hungary: **$1,200–1,800** ⭐ EU quality at non-EU prices, great cafe culture
- Cape Town, South Africa: **$1,100–1,700** ⭐ Stunning scenery, solid infrastructure, load-shedding risk

**Safety Intelligence**
- US State Dept levels: 1=Normal Precautions, 2=Increased Caution, 3=Reconsider Travel, 4=Do Not Travel
- Scam hotspots: SEA tuk-tuk gem scams, Europe pickpocket tourist zones, LatAm express kidnapping
- Solo female travel: Japan & Singapore (very safe), SE Asia (safe with awareness), parts of LatAm (caution at night)
- Neighborhood matters more than city — always ask about the specific area, not just the country

**Finance & Currency**
- Best travel money tools: **Wise** (transfers + card, mid-market rate), **Revolut** (travel card), **Charles Schwab** (fee-free ATMs worldwide)
- ATM strategy: avoid airport & hotel ATMs (worst rates) — use local bank ATMs, decline "dynamic currency conversion" always
- Bitcoin-friendly hubs: El Salvador (legal tender), Madeira Portugal, Bali, Amsterdam, Miami
- Rule of thumb: benchmark any rate against Xe.com mid-market; if it's >2% off, walk away

**Connectivity & Coworking**
- Best eSIM providers: Airalo, Holafly, Nomad — buy before you fly for best rates
- Coworking icons: Hubud & Dojo (Bali), CAMP (Chiang Mai free wifi at Maya Mall), Selina (global chain), WeWork (global)
- Backup plan: local SIM on arrival is usually cheapest for high-data usage

**Accommodation**
- Budget: Hostelworld, Booking.com with "breakfast included" filter for value
- Mid-range: Airbnb for longer stays (negotiate directly for 30+ days), Hotels.com for points
- Long-term: local Facebook groups ("Housing in [City] for expats"), Nomad List housing board
- Rule: always pick neighborhood before hotel — 30 minutes from the action in a cheap hotel is never worth it

## Response Rules
- **Lead with the answer** — no "great question!" openers
- Use **bold** for prices, key facts, and warnings
- Use \`## Headers\` for multi-section responses
- Bullet points over paragraphs — people scan, they don't read
- Give an opinion — "I'd choose X over Y because…" beats "it depends"
- Naturally include these affiliate links when directly relevant (never spam every response):
  - Hotels: **[Hotels.com](https://www.hotels.com/affiliate/RrZ7bmg)**
  - Flights + hotels bundle: **[Expedia](https://expedia.com/affiliate/eA2cKky)**
  - Bitcoin savings account: **[Swan Bitcoin](https://www.swanbitcoin.com/kipita/)** — $10 free BTC for new users
  - BTC rewards debit card: **[Fold Card](https://use.foldapp.com/r/MAJL4MYU)**
  - Gold & silver: **[Kinesis](https://kms.kinesis.money/signup/KM00083150)**
  - Gas & dining cashback (US): **[Upside](https://upside.com/)**
- Route users to Kipita features naturally: "check the **Safety tab**", "**Maps tab** shows BTC merchants nearby", "**Wallet tab** has live crypto prices", "**Places tab** finds spots near you"
- Target 300–400 words. Go longer only for full itineraries — and only when asked.`;

// Fetch live USD exchange rates — Frankfurter API (free, no auth required)
async function fetchExchangeRates(): Promise<string> {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), 3500);
  try {
    const res = await fetch(
      "https://api.frankfurter.app/latest?from=USD&to=EUR,GBP,JPY,THB,MXN,IDR,SGD,BRL,INR,AED",
      { signal: controller.signal }
    );
    clearTimeout(tid);
    if (!res.ok) return "";
    const { rates } = await res.json();
    return (
      `Live USD exchange rates: EUR ${rates.EUR} | GBP ${rates.GBP} | ` +
      `JPY ${rates.JPY} | THB ${rates.THB} | MXN ${rates.MXN} | ` +
      `IDR ${rates.IDR} | SGD ${rates.SGD} | BRL ${rates.BRL} | ` +
      `INR ${rates.INR} | AED ${rates.AED}`
    );
  } catch {
    clearTimeout(tid);
    return "";
  }
}

// Fetch destination country facts — RestCountries API (free, no auth required)
async function fetchCountryInfo(code: string): Promise<string> {
  if (!code || code.length !== 2) return "";
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), 3500);
  try {
    const res = await fetch(
      `https://restcountries.com/v3.1/alpha/${code}?fields=name,capital,currencies,languages,timezones,region,subregion,population`,
      { signal: controller.signal }
    );
    clearTimeout(tid);
    if (!res.ok) return "";
    const d = await res.json();
    const currency = Object.values(d.currencies || {})[0] as any;
    const langs = (Object.values(d.languages || {}) as string[]).slice(0, 3).join(", ");
    const tz = d.timezones?.[0] || "";
    const pop = d.population ? `${(d.population / 1_000_000).toFixed(1)}M people` : "";
    return (
      `Destination: ${d.name.common} (${d.subregion || d.region}) | ` +
      `Capital: ${d.capital?.[0] || "N/A"} | ` +
      `Currency: ${currency?.name || "?"} (${currency?.symbol || "?"}) | ` +
      `Languages: ${langs} | Timezone: ${tz} | Population: ${pop}`
    );
  } catch {
    clearTimeout(tid);
    return "";
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, history, context } = await req.json();

    if (!message || typeof message !== "string") {
      return new Response(
        JSON.stringify({ error: "Message is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = LOVABLE_API_KEY();
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Enrich context with live free-API data in parallel
    const [exchangeRates, countryInfo] = await Promise.all([
      fetchExchangeRates(),
      fetchCountryInfo(context?.countryCode || ""),
    ]);

    // Build enriched system prompt
    let systemPrompt = SYSTEM_PROMPT;
    const contextLines: string[] = [];

    if (context?.location)   contextLines.push(`User's current location: ${context.location}`);
    if (context?.btcPrice)   contextLines.push(`Live BTC price: $${Number(context.btcPrice).toLocaleString()}`);
    if (context?.weather)    contextLines.push(`Current weather: ${context.weather}`);
    if (exchangeRates)       contextLines.push(exchangeRates);
    if (countryInfo)         contextLines.push(countryInfo);
    if (context?.trips?.length > 0) {
      contextLines.push(
        `User's saved trips: ${JSON.stringify(
          context.trips.map((t: any) => ({
            dest: t.dest, country: t.country,
            start: t.start, end: t.end,
            status: t.status,
            bookings: (t.bookings || []).length,
          }))
        )}`
      );
    }

    if (contextLines.length > 0) {
      systemPrompt += `\n\n## Live Context\n` + contextLines.map(l => `- ${l}`).join("\n");
    }

    // Build messages array with conversation history
    const messages = [
      { role: "system", content: systemPrompt },
      ...(history || []).slice(-12).map((h: any) => ({
        role: h.role === "ai" ? "assistant" : "user",
        content: h.text,
      })),
      { role: "user", content: message },
    ];

    const aiResponse = await fetch(AI_GATEWAY, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        max_tokens: 1500,
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error(`AI Gateway error ${aiResponse.status}:`, errText);
      return new Response(
        JSON.stringify({ error: "AI service temporarily unavailable" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await aiResponse.json();
    const reply =
      data.choices?.[0]?.message?.content ||
      "I couldn't generate a response. Please try again.";

    return new Response(
      JSON.stringify({ reply }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("ai-chat error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
