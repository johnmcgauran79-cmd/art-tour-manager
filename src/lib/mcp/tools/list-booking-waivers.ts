import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";
import { requireAdminOrManager } from "./_perms";

export default defineTool({
  name: "list_booking_waivers",
  title: "List booking waivers",
  description:
    "List signed / requested waivers for a booking or for all bookings on a tour.",
  inputSchema: {
    booking_id: z.string().optional(),
    tour_id: z.string().optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ booking_id, tour_id }, ctx) => {
    const denied = await requireAdminOrManager(ctx);
    if (denied) return denied;
    if (!booking_id && !tour_id)
      return { content: [{ type: "text", text: "Provide booking_id or tour_id" }], isError: true };
    let q = supabaseForUser(ctx).from("booking_waivers").select("*, bookings!inner(id, tour_id)");
    if (booking_id) q = q.eq("booking_id", booking_id);
    if (tour_id) q = q.eq("bookings.tour_id", tour_id);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { waivers: data ?? [] },
    };
  },
});