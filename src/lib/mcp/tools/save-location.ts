import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "save_location",
  title: "Save a location",
  description: "Save a location (name, address, coordinates) to the signed-in user's saved locations in the app.",
  inputSchema: {
    name: z.string().trim().describe("Short label for the location, e.g. 'Home' or 'Le Chene'."),
    lat: z.number().describe("Latitude."),
    lng: z.number().describe("Longitude."),
    full_address: z.string().optional().describe("Full street address, when known."),
    country_code: z.string().optional().describe("Two-letter country code, e.g. US."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  needsApproval: true,
  handler: async ({ name, lat, lng, full_address, country_code }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    if (!name.trim()) {
      return { content: [{ type: "text", text: "A location name is required." }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("saved_locations")
      .insert({
        user_id: ctx.getUserId(),
        name: name.trim(),
        lat,
        lng,
        full_address: full_address ?? null,
        country_code: country_code ? country_code.toUpperCase().slice(0, 2) : null,
      })
      .select()
      .single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Saved "${data.name}".` }],
      structuredContent: { location: data },
    };
  },
});
