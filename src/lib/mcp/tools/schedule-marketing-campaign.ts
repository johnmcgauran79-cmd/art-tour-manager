import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";
import { requireAdminOrManager } from "./_perms";
import { sendingDisabledResult, sendingEnabled } from "./_sending";

export default defineTool({
  name: "schedule_marketing_campaign",
  title: "Schedule a marketing campaign (currently switched off)",
  description:
    "Schedule a prepared campaign for a future date and time, or clear an existing schedule. DISABLED until ART authorises AI-initiated sending; until then it changes nothing.",
  inputSchema: {
    campaign_id: z.string(),
    scheduled_send_at: z.string().nullable().describe("ISO timestamp, or null to unschedule and return to draft."),
    confirm: z.literal(true),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ campaign_id, scheduled_send_at, confirm }, ctx) => {
    const denied = await requireAdminOrManager(ctx);
    if (denied) return denied;
    if (!sendingEnabled()) return sendingDisabledResult();
    if (confirm !== true)
      return { content: [{ type: "text", text: "confirm must be true." }], isError: true };
    const { data, error } = await supabaseForUser(ctx)
      .from("marketing_campaigns")
      .update({
        scheduled_send_at,
        status: scheduled_send_at ? "scheduled" : "draft",
      })
      .eq("id", campaign_id)
      .select("id, name, status, scheduled_send_at")
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data) return { content: [{ type: "text", text: "Campaign not found or not permitted" }], isError: true };
    return {
      content: [{ type: "text", text: scheduled_send_at ? "Campaign scheduled." : "Schedule cleared." }],
      structuredContent: { campaign: data },
    };
  },
});
