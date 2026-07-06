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
        "id, title, description, is_required, due_days_before_tour, tour_custom_form_fields (id, label, field_type, is_required, sort_order), tour_custom_form_responses (id, booking_id, submitted_at, responses)",
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
