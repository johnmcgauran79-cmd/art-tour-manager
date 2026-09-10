import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";
import { requireAdminOrManager } from "./_perms";

export default defineTool({
  name: "list_lead_activities",
  title: "List CRM activity",
  description:
    "Timeline of CRM activity (calls, emails, notes, stage changes, marketing signals) for a lead or a contact. Filter by activity_type, meaningful-only, and date range.",
  inputSchema: {
    lead_id: z.string().optional(),
    customer_id: z.string().optional(),
    activity_type: z.string().optional(),
    meaningful_only: z.boolean().optional(),
    from: z.string().optional().describe("YYYY-MM-DD"),
    to: z.string().optional().describe("YYYY-MM-DD"),
    limit: z.number().int().min(1).max(200).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (input, ctx) => {
    const denied = await requireAdminOrManager(ctx);
    if (denied) return denied;
    if (!input.lead_id && !input.customer_id)
      return { content: [{ type: "text", text: "lead_id or customer_id is required" }], isError: true };
    let q = supabaseForUser(ctx)
      .from("crm_activities")
      .select("*")
      .order("occurred_at", { ascending: false })
      .limit(input.limit ?? 100);
    if (input.lead_id) q = q.eq("lead_id", input.lead_id);
    if (input.customer_id) q = q.eq("customer_id", input.customer_id);
    if (input.activity_type) q = q.eq("activity_type", input.activity_type);
    if (input.meaningful_only) q = q.eq("is_meaningful", true);
    if (input.from) q = q.gte("occurred_at", input.from);
    if (input.to) q = q.lte("occurred_at", `${input.to}T23:59:59Z`);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Found ${data?.length ?? 0} activity record(s).` }],
      structuredContent: { activities: data ?? [] },
    };
  },
});
