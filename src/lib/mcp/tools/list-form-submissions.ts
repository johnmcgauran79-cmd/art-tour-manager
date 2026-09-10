import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";
import { requireAdminOrManager } from "./_perms";

export default defineTool({
  name: "list_form_submissions",
  title: "List website form submissions",
  description:
    "Register-Interest and Booking form submissions exactly as submitted, with processing status, matched contact/lead, tour(s) and campaign attribution (utm fields).",
  inputSchema: {
    form_type: z.string().optional().describe("e.g. register_interest, booking"),
    landing_page_id: z.string().optional(),
    tour_id: z.string().optional(),
    processing_status: z.string().optional(),
    needs_review: z.boolean().optional(),
    from: z.string().optional().describe("YYYY-MM-DD"),
    to: z.string().optional().describe("YYYY-MM-DD"),
    limit: z.number().int().min(1).max(200).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (input, ctx) => {
    const denied = await requireAdminOrManager(ctx);
    if (denied) return denied;
    let q = supabaseForUser(ctx)
      .from("landing_page_submissions")
      .select(
        "id, landing_page_id, form_type, customer_id, lead_id, task_id, tour_id, tour_ids, first_name, last_name, email, phone, state, country, travellers, previous_traveller, preferred_contact, message, consent_given, processing_status, processing_error, needs_review, match_method, ack_email_status, source_channel, external_source, utm_source, utm_medium, utm_campaign, utm_content, utm_term, referrer, landing_page_url, created_at, processed_at",
      )
      .order("created_at", { ascending: false })
      .limit(input.limit ?? 50);
    if (input.form_type) q = q.eq("form_type", input.form_type);
    if (input.landing_page_id) q = q.eq("landing_page_id", input.landing_page_id);
    if (input.tour_id) q = q.eq("tour_id", input.tour_id);
    if (input.processing_status) q = q.eq("processing_status", input.processing_status);
    if (input.needs_review !== undefined) q = q.eq("needs_review", input.needs_review);
    if (input.from) q = q.gte("created_at", input.from);
    if (input.to) q = q.lte("created_at", `${input.to}T23:59:59Z`);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Found ${data?.length ?? 0} submission(s).` }],
      structuredContent: { submissions: data ?? [] },
    };
  },
});
