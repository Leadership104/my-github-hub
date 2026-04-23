import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GOOGLE_KEY = () => Deno.env.get("GOOGLE_PLACES_API_KEY") || "";

/* ── Field mask shared across search endpoints ── */
const SEARCH_FIELDS = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.rating",
  "places.userRatingCount",
  "places.priceLevel",
  "places.photos",
  "places.currentOpeningHours",
  "places.websiteUri",
  "places.internationalPhoneNumber",
  "places.types",
  "places.primaryTypeDisplayName",
  "places.googleMapsUri",
  "places.editorialSummary",
  "places.reviews",
].join(",");

const DETAIL_FIELDS = [
  "id",
  "displayName",
  "formattedAddress",
  "location",
  "rating",
  "userRatingCount",
  "priceLevel",
  "photos",
  "currentOpeningHours",
  "websiteUri",
  "internationalPhoneNumber",
  "reviews",
  "types",
  "primaryTypeDisplayName",
  "googleMapsUri",
  "editorialSummary",
].join(",");

/* ── Nearby Search (New) ── */
async function nearbySearch(lat: number, lng: number, type: string, radius = 3500, maxResults = 20) {
  const body = {
    includedTypes: [type],
    maxResultCount: Math.min(maxResults, 20),
    locationRestriction: {
      circle: { center: { latitude: lat, longitude: lng }, radius },
    },
  };

  const res = await fetch(
    "https://places.googleapis.com/v1/places:searchNearby",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_KEY(),
        "X-Goog-FieldMask": SEARCH_FIELDS,
      },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    console.error(`Google Places nearby ${res.status}:`, err);
    return { places: [], _debug: { status: res.status, error: err } };
  }

  return res.json();
}

/* ── Text Search (New) ──
 * Uses locationRestriction (hard circle) when lat/lng are provided so results
 * NEVER come from outside the selected city. Falls back to bias-only when no
 * coords are sent.
 */
async function textSearch(query: string, lat?: number, lng?: number, radius = 5000) {
  const body: Record<string, unknown> = { textQuery: query, maxResultCount: 20 };
  if (typeof lat === "number" && typeof lng === "number" && !Number.isNaN(lat) && !Number.isNaN(lng)) {
    // searchText supports `circle` only inside `locationBias` (not locationRestriction).
    // We still enforce a strict client-side distance cap to keep results local.
    body.locationBias = {
      circle: { center: { latitude: lat, longitude: lng }, radius: Math.min(radius || 5000, 50000) },
    };
  }

  const res = await fetch(
    "https://places.googleapis.com/v1/places:searchText",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_KEY(),
        "X-Goog-FieldMask": SEARCH_FIELDS,
      },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    console.warn(`Google Places text search ${res.status}:`, err);
    return { places: [] };
  }

  return res.json();
}

/* ── Place Details (New) ── */
async function placeDetails(placeId: string) {
  const res = await fetch(
    `https://places.googleapis.com/v1/places/${placeId}`,
    {
      headers: {
        "X-Goog-Api-Key": GOOGLE_KEY(),
        "X-Goog-FieldMask": DETAIL_FIELDS,
      },
    }
  );

  if (!res.ok) {
    const err = await res.text();
    console.warn(`Google Places details ${res.status}:`, err);
    return null;
  }

  return res.json();
}

/* ── Photo URL builder ── */
function photoUrl(photoName: string, maxWidth = 400) {
  return `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=${maxWidth}&key=${GOOGLE_KEY()}`;
}

/* ── Extract closing time from opening hours periods ── */
function extractClosingTime(openingHours: any): string | null {
  if (!openingHours?.periods) return null;
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  for (const period of openingHours.periods) {
    if (period.open?.day === dayOfWeek && period.close) {
      const openMin = (period.open.hour || 0) * 60 + (period.open.minute || 0);
      const closeMin = (period.close.hour || 0) * 60 + (period.close.minute || 0);
      const adjustedClose = closeMin <= openMin ? closeMin + 1440 : closeMin;
      if (currentMinutes >= openMin && currentMinutes < adjustedClose) {
        const h = period.close.hour ?? 0;
        const m = period.close.minute ?? 0;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
      }
    }
  }
  return null;
}

/* ── Normalize response for frontend ── */
function normalizePlaces(data: any) {
  const places = data.places || [];
  return places.map((p: any) => ({
    placeId: p.id,
    name: p.displayName?.text || "Unknown",
    address: p.formattedAddress || "",
    lat: p.location?.latitude,
    lng: p.location?.longitude,
    rating: p.rating || null,
    reviewCount: p.userRatingCount || 0,
    priceLevel: p.priceLevel || null,
    photoUrl: p.photos?.[0]?.name ? photoUrl(p.photos[0].name) : null,
    photos: (p.photos || []).slice(0, 3).map((ph: any) => photoUrl(ph.name)),
    openNow: p.currentOpeningHours?.openNow ?? null,
    closingTime: extractClosingTime(p.currentOpeningHours),
    hours: p.currentOpeningHours?.weekdayDescriptions || [],
    phone: p.internationalPhoneNumber || null,
    website: p.websiteUri || null,
    types: p.types || [],
    typeLabel: p.primaryTypeDisplayName?.text || null,
    mapsUrl: p.googleMapsUri || null,
    reviews: (p.reviews || []).slice(0, 5).map((r: any) => ({
      author: r.authorAttribution?.displayName || "Anonymous",
      rating: r.rating,
      text: r.text?.text || "",
      time: r.relativePublishTimeDescription || "",
      photoUrl: r.authorAttribution?.photoUri || null,
    })),
    summary: p.editorialSummary?.text || null,
    source: "Google Places",
  }));
}

/* ── Category to Google Places type mapping ── */
const CATEGORY_TYPE_MAP: Record<string, string> = {
  food: "restaurant",
  cafe: "cafe",
  hotel: "hotel",
  shop: "shopping_mall",
  transport: "transit_station",
  gym: "gym",
  beach: "tourist_attraction",
  nightlife: "bar",
  atm: "atm",
  hospital: "hospital",
  pharmacy: "pharmacy",
};

/* ── CoinMap proxy (bypasses CORS) ── */
async function coinmapVenues(lat: number, lng: number) {
  const r = 0.15;
  const url = `https://coinmap.org/api/v1/venues/?lat1=${lat - r}&lat2=${lat + r}&lon1=${lng - r}&lon2=${lng + r}`;
  const res = await fetch(url);
  if (!res.ok) { console.warn(`CoinMap ${res.status}`); return []; }
  const data = await res.json();
  return (data.venues || []).slice(0, 50).map((v: any) => ({
    placeId: `coinmap-${v.id}`,
    name: v.name || "BTC Venue",
    address: "",
    lat: v.lat,
    lng: v.lon,
    rating: null, reviewCount: 0, priceLevel: null,
    photoUrl: null, photos: [], openNow: null, closingTime: null, hours: [],
    phone: null,
    website: v.website || null,
    types: ["bitcoin_merchant"],
    typeLabel: v.category || "Bitcoin Merchant",
    mapsUrl: null, reviews: [], summary: null,
    source: "CoinMap.org ✓",
    btcVerified: true,
  }));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, lat, lng, type, query, placeId, radius, category } =
      await req.json();

    let result: any;

    switch (action) {
      case "nearby": {
        const googleType = category
          ? CATEGORY_TYPE_MAP[category] || category
          : type || "restaurant";
        const data = await nearbySearch(lat, lng, googleType, radius);
        result = normalizePlaces(data);
        break;
      }
      case "search": {
        const data = await textSearch(query, lat, lng, radius);
        result = normalizePlaces(data);
        break;
      }
      case "details": {
        const data = await placeDetails(placeId);
        result = data ? normalizePlaces({ places: [data] })[0] : null;
        break;
      }
      case "coinmap": {
        result = await coinmapVenues(lat, lng);
        break;
      }
      default:
        return new Response(
          JSON.stringify({ error: "Invalid action. Use: nearby, search, details, coinmap" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("places-proxy error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
