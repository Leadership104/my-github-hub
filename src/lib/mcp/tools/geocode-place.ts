import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";

export default defineTool({
  name: "geocode_place",
  title: "Geocode a city or address",
  description:
    "Turn a city, address or landmark name into latitude/longitude plus country, so other tools can be called with coordinates.",
  inputSchema: {
    query: z.string().describe("City, address or landmark, e.g. 'Albuquerque NM' or 'Echo Beach Bali'."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async ({ query }) => {
    const url =
      "https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=3&q=" +
      encodeURIComponent(query.trim());
    const res = await fetch(url, { headers: { "User-Agent": "Kipita-MCP/1.0" } });
    if (!res.ok) throw new ToolError(`Geocoding failed (${res.status})`);
    const rows = (await res.json()) as Array<{
      display_name?: string;
      lat?: string;
      lon?: string;
      address?: { country?: string; country_code?: string };
    }>;
    const results = rows.map((r) => ({
      label: r.display_name ?? query,
      lat: Number(r.lat),
      lng: Number(r.lon),
      country: r.address?.country ?? null,
      countryCode: r.address?.country_code?.toUpperCase() ?? null,
    }));
    if (results.length === 0) {
      return { content: [{ type: "text", text: `No location found for "${query}".` }] };
    }
    const text = results
      .map((r) => `${r.label} — ${r.lat.toFixed(4)}, ${r.lng.toFixed(4)}${r.country ? ` (${r.country})` : ""}`)
      .join("\n");
    return { content: [{ type: "text", text }], structuredContent: { results } };
  },
});
