import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";
import { requireAdminOrManager } from "./_perms";

export default defineTool({
  name: "get_marketing_campaign",
  title: "Get marketing campaign with real stats",
  description:
    "One campaign plus reconciled results: unique contacts sent/delivered/opened/clicked, event totals, and the most-clicked links. Unique-contact figures never double-count a contact.",
  inputSchema: {
    campaign_id: z.string(),
    include_html: z.boolean().optional().describe("Include the campaign HTML body (large)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ campaign_id, include_html }, ctx) => {
    const denied = await requireAdminOrManager(ctx);
    if (denied) return denied;
    const supabase = supabaseForUser(ctx);
    const { data: campaign, error } = await supabase
      .from("marketing_campaigns")
      .select("*")
      .eq("id", campaign_id)
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!campaign) return { content: [{ type: "text", text: "Campaign not found" }], isError: true };
    if (!include_html) {
      delete (campaign as Record<string, unknown>).html_body;
      delete (campaign as Record<string, unknown>).blocks;
    }

    const { data: recips } = await supabase
      .from("campaign_recipients")
      .select("customer_id, email, status, sent_at, opened_at, clicked_at, open_count, click_count")
      .eq("campaign_id", campaign_id);
    const { data: events } = await supabase
      .from("campaign_events")
      .select("event_type, link_url, email")
      .eq("campaign_id", campaign_id);

    const rows = recips ?? [];
    const uniq = (list: (string | null)[]) => new Set(list.filter(Boolean) as string[]).size;
    const key = (r: { customer_id: string | null; email: string | null }) => r.customer_id ?? r.email;
    const linkCounts = new Map<string, number>();
    for (const e of events ?? []) {
      if (e.event_type === "click" && e.link_url)
        linkCounts.set(e.link_url, (linkCounts.get(e.link_url) ?? 0) + 1);
    }

    const payload = {
      campaign,
      unique_contacts: {
        recipients: uniq(rows.map(key)),
        sent: uniq(rows.filter((r) => r.sent_at).map(key)),
        failed: uniq(rows.filter((r) => r.status === "failed").map(key)),
        opened: uniq(rows.filter((r) => r.opened_at).map(key)),
        clicked: uniq(rows.filter((r) => r.clicked_at).map(key)),
      },
      events: {
        opens: (events ?? []).filter((e) => e.event_type === "open").length,
        clicks: (events ?? []).filter((e) => e.event_type === "click").length,
      },
      top_links: [...linkCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .map(([url, clicks]) => ({ url, clicks })),
      note:
        "Tracking exists only for campaigns sent after tracking was introduced; older campaigns legitimately show no opens or clicks.",
    };
    return { content: [{ type: "text", text: JSON.stringify(payload) }], structuredContent: payload };
  },
});
