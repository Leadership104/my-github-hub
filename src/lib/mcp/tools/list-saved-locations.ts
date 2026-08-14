import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_saved_locations",
  title: "List my saved locations",
  description: "List the locations the signed-in user has saved in the app, newest first.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("saved_locations")
      .select("id,name,full_address,lat,lng,country_code,created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const rows = data ?? [];
    const text = rows.length
      ? rows
          .map((r) => `${r.name} — ${r.full_address ?? ""} (${r.lat}, ${r.lng})`.trim())
          .join("\n")
      : "No saved locations yet.";
    return { content: [{ type: "text", text }], structuredContent: { locations: rows } };
  },
});
