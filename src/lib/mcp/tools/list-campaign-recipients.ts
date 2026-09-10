import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";
import { requireAdminOrManager } from "./_perms";

export default defineTool({
  name: "list_campaign_recipients",
  title: "List campaign recipients (who opened or clicked)",
  description:
    "Per-contact results for a campaign: status, sent/opened/clicked timestamps and counts. Filter to only openers, only clickers, only failures, or a status.",
  inputSchema: {
    campaign_id: z.string(),
    engagement: z.enum(["all", "opened", "clicked", "not_opened", "failed"]).optional(),
    status: z.string().optional(),
    limit: z.number().int().min(1).max(500).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ campaign_id, engagement, status, limit }, ctx) => {
    const denied = await requireAdminOrManager(ctx);
    if (denied) return denied;
    let q = supabaseForUser(ctx)
      .from("campaign_recipients")
      .select(
        "id, customer_id, email, first_name, last_name, status, sent_at, opened_at, clicked_at, open_count, click_count, error_message",
      )
      .eq("campaign_id", campaign_id)
      .order("clicked_at", { ascending: false, nullsFirst: false })
      .limit(limit ?? 200);
    if (status) q = q.eq("status", status);
    if (engagement === "opened") q = q.not("opened_at", "is", null);
    if (engagement === "clicked") q = q.not("clicked_at", "is", null);
    if (engagement === "not_opened") q = q.is("opened_at", null);
    if (engagement === "failed") q = q.eq("status", "failed");
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Found ${data?.length ?? 0} recipient(s).` }],
      structuredContent: { recipients: data ?? [] },
    };
  },
});
