import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";
import { requireAdminOrManager } from "./_perms";

export default defineTool({
  name: "create_activity",
  title: "Create activity",
  description: "Add a new activity to a tour.",
  inputSchema: {
    tour_id: z.string(),
    name: z.string(),
    activity_date: z.string().optional().describe("YYYY-MM-DD."),
    start_time: z.string().optional().describe("HH:MM."),
    end_time: z.string().optional().describe("HH:MM."),
    location: z.string().optional(),
    dress_code: z.string().optional(),
    hospitality_inclusions: z.string().optional(),
    notes: z.string().optional(),
    operations_notes: z.string().optional(),
    transport_mode: z.string().optional(),
    transport_company: z.string().optional(),
    transport_status: z.string().optional(),
    booking_status: z.string().optional(),
    payment_status: z.string().optional(),
    spots_available: z.number().int().optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    const denied = await requireAdminOrManager(ctx);
    if (denied) return denied;
    const { data, error } = await supabaseForUser(ctx)
      .from("activities")
      .insert(input)
      .select("*")
      .single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Created activity ${data.name} (${data.id})` }],
      structuredContent: { activity: data },
    };
  },
});