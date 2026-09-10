import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";
import { requireAdminOrManager } from "./_perms";

export default defineTool({
  name: "list_lead_forms",
  title: "List public lead-capture forms",
  description:
    "The public forms (Register Interest, Booking) including slug, form type, tour choices, field configuration, submission count and follow-up settings.",
  inputSchema: { include_inactive: z.boolean().optional() },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ include_inactive }, ctx) => {
    const denied = await requireAdminOrManager(ctx);
    if (denied) return denied;
    let q = supabaseForUser(ctx)
      .from("landing_pages")
      .select(
        "id, slug, title, form_type, tour_id, tour_ids, extra_tour_options, room_type_options, field_config, lead_source, lead_type, lead_owner_id, followup_due_days, default_priority, ack_enabled, ack_template_id, is_active, submission_count, created_at, updated_at",
      )
      .order("created_at", { ascending: false });
    if (!include_inactive) q = q.eq("is_active", true);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Found ${data?.length ?? 0} form(s).` }],
      structuredContent: { forms: data ?? [] },
    };
  },
});
