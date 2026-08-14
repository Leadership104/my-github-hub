import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseProjectUrl, supabasePublishableKey } from "../supabase";

type PlaceResult = {
  name: string;
  address: string;
  lat?: number;
  lng?: number;
  rating?: number | null;
  reviewCount?: number;
  openNow?: boolean | null;
  phone?: string | null;
  website?: string | null;
  typeLabel?: string | null;
  mapsUrl?: string | null;
};

export default defineTool({
  name: "search_places",
  title: "Search places near a location",
  description:
    "Find restaurants, cafes, ATMs, gas stations, hotels, pharmacies and other places near a latitude/longitude. Use `category` for a category sweep (ranked by distance) or `query` for a free-text search.",
  inputSchema: {
    lat: z.number().describe("Latitude of the search center."),
    lng: z.number().describe("Longitude of the search center."),
    category: z
      .string()
      .optional()
      .describe("Category keyword such as restaurant, cafe, atm, bank, gas, pharmacy, hotel, museum, park, bar."),
    query: z
      .string()
      .optional()
      .describe("Free-text search, e.g. 'French restaurant' or 'vegan brunch'. Takes precedence over category."),
    radius_meters: z
      .number()
      .optional()
      .describe("Search radius in meters. Defaults to 3500 for category search, 12000 for text search."),
  },
  annotations: { readOnlyHint: true, openWorldHint: true },
  handler: async ({ lat, lng, category, query, radius_meters }) => {
    const action = query ? "search" : "nearby";
    const body: Record<string, unknown> = {
      action,
      lat,
      lng,
      radius: radius_meters ?? (query ? 12000 : 3500),
    };
    if (query) body.query = query;
    else body.category = category ?? "restaurant";

    const key = supabasePublishableKey();
    const res = await fetch(`${supabaseProjectUrl()}/functions/v1/places-proxy`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new ToolError(`Place search failed (${res.status})`);

    const json = (await res.json()) as PlaceResult[] | { places?: PlaceResult[] };
    const raw = Array.isArray(json) ? json : json.places ?? [];
    const places = raw.slice(0, 15).map((p) => ({
      name: p.name,
      address: p.address,
      lat: p.lat,
      lng: p.lng,
      rating: p.rating ?? null,
      reviews: p.reviewCount ?? 0,
      openNow: p.openNow ?? null,
      phone: p.phone ?? null,
      website: p.website ?? null,
      type: p.typeLabel ?? null,
      mapsUrl: p.mapsUrl ?? null,
    }));

    if (places.length === 0) {
      return { content: [{ type: "text", text: "No places found for that search." }] };
    }

    const text = places
      .map(
        (p, i) =>
          `${i + 1}. ${p.name}${p.rating ? ` (${p.rating}★, ${p.reviews} reviews)` : ""} — ${p.address}` +
          `${p.openNow === true ? " · open now" : p.openNow === false ? " · closed" : ""}`,
      )
      .join("\n");

    return { content: [{ type: "text", text }], structuredContent: { places } };
  },
});
