import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_my_business_listings",
  title: "List my business listings",
  description: "List the business listings owned by the signed-in user, including verification status.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("business_listings")
      .select("id,name,category,address,phone,website,status,description,created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const rows = data ?? [];
    const text = rows.length
      ? rows.map((r) => `${r.name} (${r.category}) — ${r.address} · status: ${r.status}`).join("\n")
      : "No business listings yet.";
    return { content: [{ type: "text", text }], structuredContent: { listings: rows } };
  },
});
