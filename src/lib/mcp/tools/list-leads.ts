import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";
import { requireAdminOrManager } from "./_perms";

export default defineTool({
  name: "list_leads",
  title: "List leads (enquiries)",
  description:
    "List CRM leads/enquiries with filters: stage key, owner_id, tour_id (tour of interest), source, lead_type, needs_attention, in_nurture, created_from/created_to (YYYY-MM-DD). Ordered by most recent activity.",
  inputSchema: {
    stage: z.string().optional().describe("Stage key, e.g. new, contacted, qualified, proposal, won, lost."),
    owner_id: z.string().optional(),
    tour_id: z.string().optional(),
    source: z.string().optional(),
    lead_type: z.string().optional(),
    needs_attention: z.boolean().optional(),
    in_nurture: z.boolean().optional().describe("True returns leads with a nurture review date set."),
    created_from: z.string().optional(),
    created_to: z.string().optional(),
    limit: z.number().int().min(1).max(200).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (input, ctx) => {
    const denied = await requireAdminOrManager(ctx);
    if (denied) return denied;
    const supabase = supabaseForUser(ctx);
    let q = supabase
      .from("leads")
      .select(
        "id, customer_id, lead_type, tour_id, stage, priority, owner_id, source, source_channel, passengers, estimated_value, next_action_date, next_action_note, notes, needs_attention, attention_reasons, nurture_review_date, nurture_reason, booking_id, converted_at, first_response_at, last_activity_at, closed_at, created_at, utm_source, utm_campaign, marketing_campaign_id",
      )
      .order("last_activity_at", { ascending: false, nullsFirst: false })
      .limit(input.limit ?? 50);
    if (input.stage) q = q.eq("stage", input.stage);
    if (input.owner_id) q = q.eq("owner_id", input.owner_id);
    if (input.tour_id) q = q.eq("tour_id", input.tour_id);
    if (input.source) q = q.eq("source", input.source);
    if (input.lead_type) q = q.eq("lead_type", input.lead_type);
    if (input.needs_attention !== undefined) q = q.eq("needs_attention", input.needs_attention);
    if (input.in_nurture === true) q = q.not("nurture_review_date", "is", null);
    if (input.in_nurture === false) q = q.is("nurture_review_date", null);
    if (input.created_from) q = q.gte("created_at", input.created_from);
    if (input.created_to) q = q.lte("created_at", `${input.created_to}T23:59:59Z`);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Found ${data?.length ?? 0} lead(s).` }],
      structuredContent: { leads: data ?? [] },
    };
  },
});
