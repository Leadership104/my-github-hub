import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LOVABLE_API_KEY = () => Deno.env.get("LOVABLE_API_KEY") || "";
const GOOGLE_PLACES_API_KEY = () => Deno.env.get("GOOGLE_PLACES_API_KEY") || "";
const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

const SYSTEM_PROMPT = `You are Kipita AI — a chill, well-traveled local friend who happens to know everything about wherever the user is. You talk like a friend texting travel tips, not a guidebook.

Your vibe: casual, warm, specific. Use real place names, real data. Drop insider knowledge. Be the friend who's been there and knows what's up.

When given live data (nearby places, weather, BTC price, advisories), USE IT. Reference real venue names, real distances, real conditions. Never give generic answers when specific data is available.

Tone: like texting a cool friend who knows the city. Use emoji naturally (not excessively). Bold key info. Keep it real.

Booking links to weave in naturally when relevant:
- Hotels: [Hotels.com](https://www.hotels.com/affiliate/RrZ7bmg)
- Flights+Hotels: [Expedia](https://expedia.com/affiliate/eA2cKky)
- Bitcoin: [Swan Bitcoin](https://www.swanbitcoin.com/kipita/) — $10 free BTC
- BTC card: [Fold Card](https://use.foldapp.com/r/MAJL4MYU)
- Gold/silver: [Kinesis](https://kms.kinesis.money/signup/KM00083150)
- Cashback: [Upside](https://upside.com/)

Forbidden affiliates (NEVER mention): Strike, River, Skyscanner, Booking.com, Airbnb.

Keep replies under 400 words unless asked for depth.`;

interface PlaceChip {
  name: string;
  type: string;
  rating?: number;
  reviews?: number;
  openNow?: boolean;
  summary?: string;
}

// Pull nearby live places via Google Places (New) v1
async function fetchNearbyPlaces(lat: number, lng: number, type: string, max: number = 5): Promise<PlaceChip[]> {
  const key = GOOGLE_PLACES_API_KEY();
  if (!key) return [];
  try {
    const resp = await fetch("https://places.googleapis.com/v1/places:searchNearby", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.primaryTypeDisplayName,places.currentOpeningHours.openNow,places.editorialSummary",
      },
      body: JSON.stringify({
        includedTypes: [type],
        maxResultCount: max,
        locationRestriction: { circle: { center: { latitude: lat, longitude: lng }, radius: 4000 } },
        rankPreference: "POPULARITY",
      }),
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    return (data.places || []).map((p: any) => ({
      name: p.displayName?.text,
      type: p.primaryTypeDisplayName?.text || type,
      rating: p.rating,
      reviews: p.userRatingCount,
      openNow: p.currentOpeningHours?.openNow,
      summary: p.editorialSummary?.text,
    }));
  } catch (e) {
    console.error(`fetchNearbyPlaces(${type}) error:`, e);
    return [];
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, history, context, agenticBriefing } = await req.json();

    if (!message || typeof message !== "string") {
      return new Response(JSON.stringify({ error: "Message is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = LOVABLE_API_KEY();
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build context-aware system prompt
    let systemPrompt = SYSTEM_PROMPT;
    let liveDataBlock = "";
    let allPlaces: PlaceChip[] = [];

    if (context) {
      const now = new Date();
      const localHour = now.getUTCHours();
      const dayOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][now.getUTCDay()];
      liveDataBlock += `\n\n=== LIVE CONTEXT (use this!) ===`;
      liveDataBlock += `\n- Time: ${dayOfWeek}, ~${localHour}:00 UTC`;
      if (context.location) liveDataBlock += `\n- User location: ${context.location}`;
      if (context.weather) liveDataBlock += `\n- Weather: ${context.weather}`;
      if (context.advisoryScore != null) liveDataBlock += `\n- Safety advisory: ${context.advisoryScore.toFixed(1)}/5 (lower=safer)`;
      if (context.btcPrice) liveDataBlock += `\n- BTC: $${context.btcPrice.toLocaleString()}`;

      // AGENTIC: fetch live nearby places when we have coordinates
      if (typeof context.lat === "number" && typeof context.lng === "number") {
        const [restaurants, cafes, attractions, bars] = await Promise.all([
          fetchNearbyPlaces(context.lat, context.lng, "restaurant", 5),
          fetchNearbyPlaces(context.lat, context.lng, "cafe", 4),
          fetchNearbyPlaces(context.lat, context.lng, "tourist_attraction", 5),
          fetchNearbyPlaces(context.lat, context.lng, "bar", 3),
        ]);
        allPlaces = [...restaurants, ...cafes, ...attractions, ...bars].filter(p => p.name);
        const fmt = (label: string, arr: PlaceChip[]) => arr.length
          ? `\n${label}:\n` + arr.map(p => `  • ${p.name}${p.rating ? ` (★${p.rating}, ${p.reviews || 0} reviews)` : ""}${p.openNow === false ? " [CLOSED NOW]" : p.openNow === true ? " [OPEN NOW]" : ""}${p.summary ? ` — ${p.summary}` : ""}`).join("\n")
          : "";
        liveDataBlock += fmt("\nNearby restaurants", restaurants);
        liveDataBlock += fmt("Nearby cafes", cafes);
        liveDataBlock += fmt("Nearby attractions", attractions);
        liveDataBlock += fmt("Nearby bars", bars);
      }

      if (context.trips?.length > 0) {
        liveDataBlock += `\n- User's trips: ${JSON.stringify(context.trips.map((t: any) => ({
          dest: t.dest, country: t.country, start: t.start, end: t.end, status: t.status,
          bookings: (t.bookings || []).length,
        })))}`;
      }
      systemPrompt += liveDataBlock;
    }

    // For agentic briefings, override the user message with a casual structured instruction
    let userMessage = message;
    if (agenticBriefing && context?.location) {
      const safetyLevel = context.advisoryScore != null
        ? (context.advisoryScore <= 1.5 ? "very safe, chill vibes" : context.advisoryScore <= 2.5 ? "pretty safe, normal precautions" : context.advisoryScore <= 3.5 ? "be aware, keep your wits about you" : "stay alert, not the safest")
        : "no data yet";

      userMessage = `Generate a casual, friendly area briefing for **${context.location}**. The user just opened the AI tab — make them feel like their well-traveled friend just texted them tips.

Use the LIVE CONTEXT above (real nearby places, weather, time of day). Format like this:

**📍 ${context.location} vibes**

**🛡️ Safety check:** Give an honest, casual safety vibe report. Current level: ${safetyLevel}. Mention what to watch for, what areas/times to be cautious about, any scams to know about. Keep it real but not scary.

**🌤️ Right now:** Weather + what that means for plans. Be specific — "perfect for…" or "skip outdoor stuff, hit up…"

**🍽️ Go eat here:** Pick the BEST 2-3 spots from the nearby restaurants. Name them, say what's good, mention if they're open. Be opinionated — "honestly the best X in the area."

**☕ Coffee spot:** 1 specific cafe, why it's worth it.

**✨ Don't miss:** 2 concrete things to do today. Pull from nearby attractions. Make it sound exciting.

**⚠️ Real talk:** 1 insider tip — a scam, etiquette thing, or hidden gem. The kind of thing only a local would tell you.

Keep under 250 words. Sound like a friend, not a travel guide. Use real names from the live data.`;
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
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        max_tokens: 1200,
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`AI Gateway error ${response.status}:`, errText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit reached. Try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Add funds in workspace settings." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "AI service temporarily unavailable" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || "I'm sorry, I couldn't generate a response. Please try again.";

    // Return places alongside reply for chip rendering
    const responseBody: Record<string, unknown> = { reply };
    if (allPlaces.length > 0) {
      responseBody.places = allPlaces.slice(0, 12);
    }

    return new Response(JSON.stringify(responseBody), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("ai-chat error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
