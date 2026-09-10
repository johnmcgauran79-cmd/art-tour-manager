import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";
import { requireAdminOrManager } from "./_perms";

export default defineTool({
  name: "get_lead",
  title: "Get lead",
  description:
    "Full detail for one lead/enquiry: the lead record, the linked contact, tour interests, stage history and recent CRM activity.",
  inputSchema: { lead_id: z.string() },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ lead_id }, ctx) => {
    const denied = await requireAdminOrManager(ctx);
    if (denied) return denied;
    const supabase = supabaseForUser(ctx);
    const { data: lead, error } = await supabase.from("leads").select("*").eq("id", lead_id).maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!lead) return { content: [{ type: "text", text: "Lead not found" }], isError: true };

    const [customer, interests, history, activities] = await Promise.all([
      lead.customer_id
        ? supabase
            .from("customers")
            .select("id, first_name, last_name, email, mobile, state, latest_tour_name, latest_tour_end_date")
            .eq("id", lead.customer_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from("tour_interests").select("*").eq("lead_id", lead_id),
      supabase.from("lead_stage_history").select("*").eq("lead_id", lead_id).order("changed_at", { ascending: false }),
      supabase
        .from("crm_activities")
        .select("id, activity_type, direction, outcome, subject, occurred_at, is_meaningful, is_automated, task_id")
        .eq("lead_id", lead_id)
        .order("occurred_at", { ascending: false })
        .limit(50),
    ]);

    const payload = {
      lead,
      customer: (customer as { data: unknown }).data ?? null,
      tour_interests: interests.data ?? [],
      stage_history: history.data ?? [],
      recent_activity: activities.data ?? [],
    };
    return {
      content: [{ type: "text", text: JSON.stringify(payload) }],
      structuredContent: payload,
    };
  },
});
