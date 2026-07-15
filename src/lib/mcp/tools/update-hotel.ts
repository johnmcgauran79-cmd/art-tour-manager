import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";
import { requireAdminOrManager } from "./_perms";

export default defineTool({
  name: "update_hotel",
  title: "Update hotel",
  description: "Update fields on an existing hotel by id. Only supplied fields are changed.",
  inputSchema: {
    hotel_id: z.string(),
    name: z.string().optional(),
    address: z.string().optional(),
    contact_name: z.string().optional(),
    contact_phone: z.string().optional(),
    contact_email: z.string().optional(),
    default_check_in: z.string().optional(),
    default_check_out: z.string().optional(),
    default_room_type: z.string().optional(),
    rooms_reserved: z.number().int().optional(),
    operations_notes: z.string().optional(),
    booking_status: z.string().optional(),
    payment_status: z.string().optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ hotel_id, ...updates }, ctx) => {
    const denied = await requireAdminOrManager(ctx);
    if (denied) return denied;
    const clean = Object.fromEntries(
      Object.entries(updates).filter(([, v]) => v !== undefined),
    );
    if (Object.keys(clean).length === 0)
      return { content: [{ type: "text", text: "No fields to update" }], isError: true };
    const { data, error } = await supabaseForUser(ctx)
      .from("hotels")
      .update(clean)
      .eq("id", hotel_id)
      .select("*")
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data) return { content: [{ type: "text", text: "Hotel not found or not permitted" }], isError: true };
    return {
      content: [{ type: "text", text: `Updated hotel ${data.name}` }],
      structuredContent: { hotel: data },
    };
  },
});