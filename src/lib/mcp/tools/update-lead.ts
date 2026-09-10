import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";
import { requireAdminOrManager } from "./_perms";

export default defineTool({
  name: "update_lead",
  title: "Update a lead",
  description:
    "Update a lead's stage, owner, priority, notes, next action, estimated value, passenger count, nurture review date or lost reason. Only supplied fields change. Stage changes are recorded in the lead's history by the system.",
  inputSchema: {
    lead_id: z.string(),
    stage: z.string().optional().describe("Stage key from list_crm_settings."),
    owner_id: z.string().nullable().optional(),
    priority: z.string().optional(),
    passengers: z.number().int().nullable().optional(),
    estimated_value: z.number().nullable().optional(),
    next_action_date: z.string().nullable().optional().describe("YYYY-MM-DD"),
    next_action_note: z.string().nullable().optional(),
    notes: z.string().optional(),
    nurture_review_date: z.string().nullable().optional().describe("YYYY-MM-DD"),
    nurture_reason: z.string().nullable().optional(),
    lost_reason: z.string().nullable().optional(),
    lost_notes: z.string().nullable().optional(),
    tour_id: z.string().nullable().optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ lead_id, ...rest }, ctx) => {
    const denied = await requireAdminOrManager(ctx);
    if (denied) return denied;
    const updates: Record<string, unknown> = Object.fromEntries(
      Object.entries(rest).filter(([, v]) => v !== undefined),
    );
    if (Object.keys(updates).length === 0)
      return { content: [{ type: "text", text: "No fields to update" }], isError: true };
    updates.last_activity_at = new Date().toISOString();
    const { data, error } = await supabaseForUser(ctx)
      .from("leads")
      .update(updates)
      .eq("id", lead_id)
      .select("id, stage, owner_id, priority, next_action_date, nurture_review_date, estimated_value, passengers")
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data) return { content: [{ type: "text", text: "Lead not found or not permitted" }], isError: true };
    return {
      content: [{ type: "text", text: `Updated lead ${lead_id}.` }],
      structuredContent: { lead: data },
    };
  },
});
