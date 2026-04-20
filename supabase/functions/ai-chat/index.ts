import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LOVABLE_API_KEY = () => Deno.env.get("LOVABLE_API_KEY") || "";
const GOOGLE_PLACES_API_KEY = () => Deno.env.get("GOOGLE_PLACES_API_KEY") || "";
const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

const SYSTEM_PROMPT = `You are Kipita AI — a world-class travel expert and personal concierge for digital nomads and travelers. Think and act like a smart local friend who knows the area inside-out.

Your job is to be AGENTIC and PROACTIVE: don't just answer — recommend specific places, things to do RIGHT NOW (based on time of day, weather, season), warn of pitfalls, and surface hidden gems.

When given live data (nearby places, weather, BTC price, advisories), USE IT. Reference real venue names, real distances, real conditions. Never give generic answers when specific data is available.

Tone: warm, direct, useful. No filler. Use markdown bold and emojis for scanability.

Booking links to weave in naturally when relevant:
- Hotels: [Hotels.com](https://www.hotels.com/affiliate/RrZ7bmg)
- Flights+Hotels: [Expedia](https://expedia.com/affiliate/eA2cKky)
- Bitcoin: [Swan Bitcoin](https://www.swanbitcoin.com/kipita/) — $10 free BTC
- BTC card: [Fold Card](https://use.foldapp.com/r/MAJL4MYU)
- Gold/silver: [Kinesis](https://kms.kinesis.money/signup/KM00083150)
- Cashback: [Upside](https://upside.com/)

Forbidden affiliates (NEVER mention): Strike, River, Skyscanner, Booking.com, Airbnb.

Keep replies under 400 words unless asked for depth.`;

// Pull nearby live places via Google Places (New) v1
async function fetchNearbyPlaces(lat: number, lng: number, type: string, max: number = 5) {
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
      type: p.primaryTypeDisplayName?.text,
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
        const fmt = (label: string, arr: any[]) => arr.length
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

    // For agentic briefings, override the user message with a structured instruction
    let userMessage = message;
    if (agenticBriefing && context?.location) {
      userMessage = `Generate an AGENTIC area briefing for **${context.location}**. The user just opened the AI tab — surprise them with how local and specific you are.

Use the LIVE CONTEXT above (real nearby places, weather, time of day). Format EXACTLY:

**📍 ${context.location} — Right Now**

**🛡️ Safety vibe:** 1 sentence, reference actual advisory level.

**🌤️ Conditions:** weather + what it means for plans (e.g. "perfect patio weather, hit a rooftop bar").

**🍽️ Eat now:** Pick the BEST 1-2 spots from the nearby restaurants list above, name them, say why (rating, vibe, what to order). If a great spot is closed, say so and suggest an alternative.

**☕ Or grab coffee:** 1 specific cafe from the list.

**✨ Do this today:** 2 concrete things — pull from nearby attractions or suggest activities matching the weather/time. Name real places.

**⚠️ Heads up:** 1 hyper-local insider tip — a scam, etiquette nuance, neighborhood to avoid, or hidden gem most travelers miss.

**💬 Ask me:** 2 short follow-up questions tailored to this exact city + time of day.

Keep under 220 words. Be SPECIFIC. Use real names from the live data. No generic filler.`;
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
        temperature: 0.75,
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

    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("ai-chat error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
