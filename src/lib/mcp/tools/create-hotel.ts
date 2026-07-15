import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";
import { requireAdminOrManager } from "./_perms";

export default defineTool({
  name: "create_hotel",
  title: "Create hotel",
  description: "Add a new hotel to a tour.",
  inputSchema: {
    tour_id: z.string(),
    name: z.string(),
    address: z.string().optional(),
    contact_name: z.string().optional(),
    contact_phone: z.string().optional(),
    contact_email: z.string().optional(),
    default_check_in: z.string().optional().describe("YYYY-MM-DD."),
    default_check_out: z.string().optional().describe("YYYY-MM-DD."),
    default_room_type: z.string().optional(),
    rooms_reserved: z.number().int().optional(),
    operations_notes: z.string().optional(),
    booking_status: z.string().optional(),
    payment_status: z.string().optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    const denied = await requireAdminOrManager(ctx);
    if (denied) return denied;
    const { data, error } = await supabaseForUser(ctx)
      .from("hotels")
      .insert(input)
      .select("*")
      .single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Created hotel ${data.name} (${data.id})` }],
      structuredContent: { hotel: data },
    };
  },
});