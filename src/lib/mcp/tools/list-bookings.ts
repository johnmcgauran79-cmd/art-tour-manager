import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";

export default defineTool({
  name: "list_bookings",
  title: "List bookings for a tour",
  description:
    "List bookings for a given tour id, including passenger counts, status and accommodation dates.",
  inputSchema: {
    tour_id: z.string().describe("The tour id (uuid) to list bookings for."),
    status: z
      .string()
      .optional()
      .describe("Optional booking status filter (e.g. paid, deposited, waitlist)."),
    limit: z
      .number()
      .int()
      .optional()
      .describe("Maximum number of bookings to return (default 100, max 500)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ tour_id, status, limit }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };

    const capped = Math.min(Math.max(limit ?? 100, 1), 500);
    let query = supabaseForUser(ctx)
      .from("bookings")
      .select(
        "id, tour_id, group_name, passenger_count, passenger_2_name, passenger_3_name, status, accommodation_required, check_in_date, check_out_date, total_nights, booking_agent",
      )
      .eq("tour_id", tour_id)
      .order("created_at", { ascending: false })
      .limit(capped);

    if (status) query = query.eq("status", status);

    const { data, error } = await query;
    if (error)
      return { content: [{ type: "text", text: error.message }], isError: true };

    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { bookings: data ?? [] },
    };
  },
});