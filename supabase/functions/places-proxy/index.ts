import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GOOGLE_KEY = () => Deno.env.get("GOOGLE_PLACES_API_KEY") || "";

/* ── Nearby Search (New) ── */
async function nearbySearch(lat: number, lng: number, type: string, radius = 3500, maxResults = 20) {
  const body = {
    includedTypes: [type],
    maxResultCount: Math.min(maxResults, 20),
    locationRestriction: {
      circle: { center: { latitude: lat, longitude: lng }, radius },
    },
  };

  const fieldMask = [
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
  ].join(",");

  const res = await fetch(
    "https://places.googleapis.com/v1/places:searchNearby",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_KEY(),
        "X-Goog-FieldMask": fieldMask,
      },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    console.warn(`Google Places nearby ${res.status}:`, err);
    return { places: [] };
  }

  return res.json();
}

/* ── Text Search (New) ── */
async function textSearch(query: string, lat?: number, lng?: number, radius = 5000) {
  const body: Record<string, unknown> = { textQuery: query, maxResultCount: 20 };
  if (lat && lng) {
    body.locationBias = {
      circle: { center: { latitude: lat, longitude: lng }, radius },
    };
  }

  const fieldMask = [
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
    "places.reviews",
  ].join(",");

  const res = await fetch(
    "https://places.googleapis.com/v1/places:searchText",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_KEY(),
        "X-Goog-FieldMask": fieldMask,
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
  const fieldMask = [
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

  const res = await fetch(
    `https://places.googleapis.com/v1/places/${placeId}`,
    {
      headers: {
        "X-Goog-Api-Key": GOOGLE_KEY(),
        "X-Goog-FieldMask": fieldMask,
      },
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google Places details error: ${res.status} ${err}`);
  }

  return res.json();
}

/* ── Photo URL builder ── */
function photoUrl(photoName: string, maxWidth = 400) {
  return `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=${maxWidth}&key=${GOOGLE_KEY()}`;
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
    hours: p.currentOpeningHours?.weekdayDescriptions || [],
    phone: p.internationalPhoneNumber || null,
    website: p.websiteUri || null,
    types: p.types || [],
    typeLabel: p.primaryTypeDisplayName?.text || null,
    mapsUrl: p.googleMapsUri || null,
    reviews: (p.reviews || []).slice(0, 3).map((r: any) => ({
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
        result = {
          ...normalizePlaces({ places: [data] })[0],
        };
        break;
      }
      default:
        return new Response(
          JSON.stringify({ error: "Invalid action. Use: nearby, search, details" }),
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
