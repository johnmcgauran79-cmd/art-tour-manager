import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";
import { requireAdminOrManager } from "./_perms";

export default defineTool({
  name: "list_campaign_events",
  title: "List campaign tracking events",
  description:
    "Raw open and click events for a campaign, including the exact link clicked. These are events, not unique contacts.",
  inputSchema: {
    campaign_id: z.string(),
    event_type: z.enum(["open", "click"]).optional(),
    limit: z.number().int().min(1).max(500).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ campaign_id, event_type, limit }, ctx) => {
    const denied = await requireAdminOrManager(ctx);
    if (denied) return denied;
    let q = supabaseForUser(ctx)
      .from("campaign_events")
      .select("*")
      .eq("campaign_id", campaign_id)
      .order("created_at", { ascending: false })
      .limit(limit ?? 200);
    if (event_type) q = q.eq("event_type", event_type);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Found ${data?.length ?? 0} event(s).` }],
      structuredContent: { events: data ?? [] },
    };
  },
});
