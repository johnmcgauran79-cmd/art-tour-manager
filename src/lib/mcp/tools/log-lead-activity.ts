import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";
import { requireAdminOrManager } from "./_perms";

export default defineTool({
  name: "log_lead_activity",
  title: "Log CRM activity on a lead",
  description:
    "Record a call, note, meeting or other activity on a lead or contact's timeline. This only writes history — it never sends anything.",
  inputSchema: {
    lead_id: z.string().optional(),
    customer_id: z.string().optional(),
    activity_type: z.string().describe("e.g. call, note, meeting, email_manual"),
    subject: z.string().optional(),
    body: z.string().optional(),
    direction: z.enum(["inbound", "outbound"]).optional(),
    outcome: z.string().optional(),
    occurred_at: z.string().optional().describe("ISO timestamp; defaults to now."),
    is_meaningful: z.boolean().optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    const denied = await requireAdminOrManager(ctx);
    if (denied) return denied;
    if (!input.lead_id && !input.customer_id)
      return { content: [{ type: "text", text: "lead_id or customer_id is required" }], isError: true };
    const supabase = supabaseForUser(ctx);
    const userId = ctx.getUserId();
    const { data, error } = await supabase
      .from("crm_activities")
      .insert({
        lead_id: input.lead_id ?? null,
        customer_id: input.customer_id ?? null,
        activity_type: input.activity_type,
        subject: input.subject ?? null,
        body: input.body ?? null,
        direction: input.direction ?? null,
        outcome: input.outcome ?? null,
        occurred_at: input.occurred_at ?? new Date().toISOString(),
        is_meaningful: input.is_meaningful ?? true,
        is_automated: false,
        staff_id: userId,
        created_by: userId,
      })
      .select("*")
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (input.lead_id)
      await supabase
        .from("leads")
        .update({ last_activity_at: new Date().toISOString() })
        .eq("id", input.lead_id);
    return {
      content: [{ type: "text", text: "Activity logged." }],
      structuredContent: { activity: data },
    };
  },
});
