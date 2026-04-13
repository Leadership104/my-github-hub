import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LOVABLE_API_KEY = () => Deno.env.get("LOVABLE_API_KEY") || "";
const AI_GATEWAY = "https://ai-gateway.lovable.dev/chat/completions";

const SYSTEM_PROMPT = `You are Kipita AI — a smart, friendly travel assistant for digital nomads and travelers. You help with:

• Trip planning and itineraries
• Safety advisories and local tips
• Cost breakdowns by city
• Visa/entry requirements
• Bitcoin & crypto merchant info
• Currency exchange guidance
• Packing advice
• Local food and restaurant recommendations

Guidelines:
- Be concise but thorough. Use bullet points and emojis.
- When suggesting bookings, include these affiliate links naturally:
  - Hotels: [Hotels.com](https://www.hotels.com/affiliate/RrZ7bmg)
  - Flights & Hotels bundle: [Expedia](https://expedia.com/affiliate/eA2cKky)
  - Bitcoin savings: [Swan Bitcoin](https://www.swanbitcoin.com/kipita/) — $10 free BTC
  - BTC rewards card: [Fold Card](https://use.foldapp.com/r/MAJL4MYU)
  - Gold & silver: [Kinesis](https://kms.kinesis.money/signup/KM00083150)
  - Gas/food cashback: [Upside](https://upside.com/)
- For safety, always recommend checking official government travel advisory sites.
- For visa info, note that requirements vary by passport and always recommend verifying officially.
- Give real, accurate information. If unsure, say so.
- Format responses with markdown: **bold**, bullet points, etc.
- Keep responses under 400 words unless the user asks for detail.
- When the user mentions a specific city, provide real data you know about it.
- If the user asks about Bitcoin price or crypto, mention the live data is in the Wallet tab.
- If the user asks about nearby places, mention the Places tab has live Google Places data.`;

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

    // Build context-aware system prompt
    let systemPrompt = SYSTEM_PROMPT;
    if (context) {
      systemPrompt += `\n\nCurrent context:`;
      if (context.location) systemPrompt += `\n- User location: ${context.location}`;
      if (context.btcPrice) systemPrompt += `\n- Live BTC price: $${context.btcPrice.toLocaleString()}`;
      if (context.weather) systemPrompt += `\n- Current weather: ${context.weather}`;
      if (context.trips && context.trips.length > 0) {
        systemPrompt += `\n- User's trips: ${JSON.stringify(context.trips.map((t: any) => ({
          dest: t.dest, country: t.country, start: t.start, end: t.end, status: t.status,
          bookings: (t.bookings || []).length
        })))}`;
      }
    }

    // Build messages array
    const messages = [
      { role: "system", content: systemPrompt },
      ...(history || []).slice(-10).map((h: any) => ({
        role: h.role === "ai" ? "assistant" : "user",
        content: h.text,
      })),
      { role: "user", content: message },
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
        max_tokens: 1024,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`AI Gateway error ${response.status}:`, errText);
      return new Response(
        JSON.stringify({ error: "AI service temporarily unavailable", status: response.status }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || "I'm sorry, I couldn't generate a response. Please try again.";

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
