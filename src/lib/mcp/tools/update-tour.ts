import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";
import { requireAdminOrManager } from "./_perms";

export default defineTool({
  name: "update_tour",
  title: "Update tour",
  description:
    "Update fields on an existing tour by id. Only the fields you provide are changed. Useful for editing dates, pricing, status, notes and operations notes while building a tour.",
  inputSchema: {
    tour_id: z.string().describe("The tour id (uuid) to update."),
    name: z.string().optional(),
    start_date: z.string().optional().describe("YYYY-MM-DD."),
    end_date: z.string().optional().describe("YYYY-MM-DD."),
    days: z.number().int().optional(),
    nights: z.number().int().optional(),
    location: z.string().optional(),
    tour_host: z.string().optional(),
    capacity: z.number().int().optional(),
    minimum_passengers_required: z.number().int().optional(),
    status: z
      .string()
      .optional()
      .describe("One of: pending, available, closed, sold_out, past, cancelled."),
    tour_type: z.string().optional().describe("domestic or international."),
    notes: z.string().optional(),
    inclusions: z.string().optional(),
    exclusions: z.string().optional(),
    price_single: z.number().optional(),
    price_double: z.number().optional(),
    price_twin: z.number().optional(),
    deposit_required: z.number().optional(),
    ops_notes: z.string().optional(),
    ops_accomm_notes: z.string().optional(),
    ops_races_notes: z.string().optional(),
    ops_transport_notes: z.string().optional(),
    ops_dinner_notes: z.string().optional(),
    ops_activities_notes: z.string().optional(),
    ops_other_notes: z.string().optional(),
    tour_hosts_notes: z.string().optional(),
    // Extended fields — full parity with tour edit UI.
    pickup_point: z.string().optional(),
    url_reference: z.string().optional(),
    instalment_required: z.boolean().optional(),
    instalment_amount: z.number().optional(),
    instalment_date: z.string().optional().describe("YYYY-MM-DD."),
    instalment_details: z.string().optional(),
    final_payment_date: z.string().optional().describe("YYYY-MM-DD."),
    travel_documents_required: z.boolean().optional(),
    dates_not_confirmed: z
      .boolean()
      .optional()
      .describe("True when the race date is still to be confirmed by the race club."),
    pickup_location_required: z.boolean().optional(),
    is_test_tour: z.boolean().optional(),
    manual_billing: z.boolean().optional(),
    manual_emails: z.boolean().optional(),
    alerts_enabled: z.boolean().optional(),
    xero_product_id: z.string().optional(),
    xero_reference: z.string().optional(),
    keap_tag_id: z.string().optional(),
    brand_id: z.string().optional(),
    photos_videos_url: z.string().optional(),
    host_flights_status: z.string().optional(),
    outbound_flight_number: z.string().optional(),
    outbound_flight_date: z.string().optional(),
    return_flight_number: z.string().optional(),
    return_flight_date: z.string().optional(),
    cancellation_policy_enabled: z.boolean().optional(),
    cancellation_policy_override: z.string().optional(),
    welcome_message_enabled: z.boolean().optional(),
    welcome_message_heading: z.string().optional(),
    welcome_message_body: z.string().optional(),
    welcome_message_signoff: z.string().optional(),
    welcome_message_image_path: z.string().optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ tour_id, ...updates }, ctx) => {
    const denied = await requireAdminOrManager(ctx);
    if (denied) return denied;

    const clean = Object.fromEntries(
      Object.entries(updates).filter(([, v]) => v !== undefined),
    );
    if (Object.keys(clean).length === 0)
      return { content: [{ type: "text", text: "No fields to update" }], isError: true };

    const { data, error } = await supabaseForUser(ctx)
      .from("tours")
      .update(clean)
      .eq("id", tour_id)
      .select("id, name, start_date, end_date, status")
      .maybeSingle();

    if (error)
      return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data)
      return { content: [{ type: "text", text: "Tour not found or not permitted" }], isError: true };

    return {
      content: [{ type: "text", text: `Updated tour ${data.name} (${data.id})` }],
      structuredContent: { tour: data },
    };
  },
});