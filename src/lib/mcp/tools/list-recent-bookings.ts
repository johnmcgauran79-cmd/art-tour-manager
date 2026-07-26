import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";
import { requireAdminOrManager } from "./_perms";

export default defineTool({
  name: "list_recent_bookings",
  title: "List recent bookings",
  description:
    "List bookings across all tours, filtered by created_at or updated_at date range. Use for questions like 'bookings in the last 7 days'. Defaults to last 7 days by created_at. Restricted to admin or manager.",
  inputSchema: {
    days: z
      .number()
      .int()
      .min(1)
      .max(365)
      .optional()
      .describe("Look back this many days from today (default 7). Ignored if start_date/end_date provided."),
    start_date: z.string().optional().describe("Start date YYYY-MM-DD (inclusive)."),
    end_date: z.string().optional().describe("End date YYYY-MM-DD (inclusive)."),
    date_field: z
      .enum(["created_at", "updated_at"])
      .optional()
      .describe("Which date column to filter on (default created_at)."),
    status: z.string().optional().describe("Optional status filter (e.g. paid, deposited, waitlist, cancelled)."),
    tour_id: z.string().optional().describe("Optional tour id (uuid) filter."),
    limit: z.number().int().min(1).max(500).optional().describe("Max rows (default 200, max 500)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ days, start_date, end_date, date_field, status, tour_id, limit }, ctx) => {
    const denied = await requireAdminOrManager(ctx);
    if (denied) return denied;

    const field = date_field ?? "created_at";
    const capped = Math.min(limit ?? 200, 500);

    let startIso: string;
    let endIso: string | null = null;
    if (start_date) {
      startIso = `${start_date}T00:00:00Z`;
      if (end_date) endIso = `${end_date}T23:59:59Z`;
    } else {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - (days ?? 7));
      startIso = d.toISOString();
    }

    let query = supabaseForUser(ctx)
      .from("bookings")
      .select(
        "id, tour_id, group_name, passenger_count, passenger_2_name, passenger_3_name, status, check_in_date, check_out_date, total_nights, booking_agent, revenue, created_at, updated_at, tours(name), customers!lead_passenger_id(id, first_name, last_name, email)",
      )
      .gte(field, startIso)
      .order(field, { ascending: false })
      .limit(capped);

    if (endIso) query = query.lte(field, endIso);
    if (status) query = query.eq("status", status);
    if (tour_id) query = query.eq("tour_id", tour_id);

    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const bookings = data ?? [];
    const truncated = bookings.length === capped;
    const result = {
      count: bookings.length,
      truncated,
      date_field: field,
      range: { start: startIso, end: endIso },
      truncation_note: truncated
        ? `Showing the first ${capped} bookings — there may be more. Narrow the date range or raise limit (max 500).`
        : null,
      bookings,
    };
    return {
      content: [{ type: "text", text: JSON.stringify(result) }],
      structuredContent: result,
    };
  },
});