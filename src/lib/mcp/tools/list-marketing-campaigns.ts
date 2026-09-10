import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";
import { requireAdminOrManager } from "./_perms";

export default defineTool({
  name: "list_marketing_campaigns",
  title: "List marketing campaigns",
  description:
    "Marketing campaigns (EDMs) with status, schedule and headline stats: recipients, sent, failed, opens, clicks, bounces, unsubscribes. Counts are events; use list_campaign_recipients for unique contacts.",
  inputSchema: {
    status: z.string().optional().describe("draft, scheduled, sending, sent, failed"),
    from: z.string().optional().describe("YYYY-MM-DD, filters on send start / creation"),
    to: z.string().optional(),
    limit: z.number().int().min(1).max(200).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (input, ctx) => {
    const denied = await requireAdminOrManager(ctx);
    if (denied) return denied;
    let q = supabaseForUser(ctx)
      .from("marketing_campaigns")
      .select(
        "id, name, subject, preheader, status, audience_id, brand_id, from_name, from_email, reply_to, scheduled_send_at, send_started_at, send_completed_at, total_recipients, sent_count, failed_count, open_count, click_count, bounce_count, unsubscribe_count, created_at, updated_at",
      )
      .order("created_at", { ascending: false })
      .limit(input.limit ?? 50);
    if (input.status) q = q.eq("status", input.status);
    if (input.from) q = q.gte("created_at", input.from);
    if (input.to) q = q.lte("created_at", `${input.to}T23:59:59Z`);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Found ${data?.length ?? 0} campaign(s).` }],
      structuredContent: { campaigns: data ?? [] },
    };
  },
});
