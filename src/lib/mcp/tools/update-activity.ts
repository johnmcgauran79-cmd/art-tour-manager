import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";
import { requireAdminOrManager } from "./_perms";

export default defineTool({
  name: "update_activity",
  title: "Update activity",
  description: "Update fields on an existing activity. Only supplied fields are changed.",
  inputSchema: {
    activity_id: z.string(),
    name: z.string().optional(),
    activity_date: z.string().optional(),
    start_time: z.string().optional(),
    end_time: z.string().optional(),
    depart_for_activity: z.string().optional(),
    location: z.string().optional(),
    contact_name: z.string().optional(),
    contact_phone: z.string().optional(),
    contact_email: z.string().optional(),
    dress_code: z.string().optional(),
    hospitality_inclusions: z.string().optional(),
    notes: z.string().optional(),
    operations_notes: z.string().optional(),
    transport_mode: z.string().optional(),
    transport_company: z.string().optional(),
    transport_contact_name: z.string().optional(),
    transport_phone: z.string().optional(),
    transport_email: z.string().optional(),
    transport_notes: z.string().optional(),
    transport_status: z.string().optional(),
    booking_status: z.string().optional(),
    payment_status: z.string().optional(),
    cancellation_status: z.string().optional(),
    cancellation_details: z.string().optional(),
    cancellation_terms: z.string().optional(),
    driver_name: z.string().optional(),
    driver_phone: z.string().optional(),
    pickup_location_transport: z.string().optional(),
    spots_available: z.number().int().optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ activity_id, ...updates }, ctx) => {
    const denied = await requireAdminOrManager(ctx);
    if (denied) return denied;
    const clean = Object.fromEntries(
      Object.entries(updates).filter(([, v]) => v !== undefined),
    );
    if (Object.keys(clean).length === 0)
      return { content: [{ type: "text", text: "No fields to update" }], isError: true };
    const { data, error } = await supabaseForUser(ctx)
      .from("activities")
      .update(clean)
      .eq("id", activity_id)
      .select("*")
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data) return { content: [{ type: "text", text: "Activity not found or not permitted" }], isError: true };
    return {
      content: [{ type: "text", text: `Updated activity ${data.name}` }],
      structuredContent: { activity: data },
    };
  },
});