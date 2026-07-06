import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";

export default defineTool({
  name: "list_tour_custom_forms",
  title: "List tour custom forms",
  description:
    "List custom forms attached to a tour, including their fields and submitted responses.",
  inputSchema: {
    tour_id: z.string().describe("The tour id (uuid) to list custom forms for."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ tour_id }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };

    const { data, error } = await supabaseForUser(ctx)
      .from("tour_custom_forms")
      .select(
        "id, form_title, form_description, is_published, response_mode, tour_custom_form_fields (id, field_label, field_type, field_options, is_required, sort_order), tour_custom_form_responses (id, booking_id, customer_id, passenger_slot, submitted_at, response_data)",
      )
      .eq("tour_id", tour_id)
      .order("created_at", { ascending: true });

    if (error)
      return { content: [{ type: "text", text: error.message }], isError: true };

    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { custom_forms: data ?? [] },
    };
  },
});
