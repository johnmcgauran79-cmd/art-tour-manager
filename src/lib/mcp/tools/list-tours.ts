import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";

export default defineTool({
  name: "list_tours",
  title: "List tours",
  description:
    "List tours the signed-in user can access. By default returns SOONEST start date first (ascending), which is what you want for questions about the 'next departing tour' — the FIRST row is the next tour to depart. To reliably answer 'next departing tour', set `upcoming_only: true` (excludes tours that already started) and read the first row. Returns up to 200 tours by default (raise `limit` up to 500). Optionally filter by name/location search term, status, or upcoming-only. Set `sort: 'desc'` for most-recent-first.",
  inputSchema: {
    search: z
      .string()
      .optional()
      .describe("Case-insensitive match against tour name or location."),
    status: z
      .string()
      .optional()
      .describe(
        "Filter by exact tour status. Valid values: pending, available, limited_availability, sold_out, closed, past, cancelled, archived. Omit to return tours of every status.",
      ),
    upcoming_only: z
      .boolean()
      .optional()
      .describe(
        "When true, only return tours whose start_date is today or later (excludes past departures). Use this to find the next departing tour.",
      ),
    sort: z
      .enum(["asc", "desc"])
      .optional()
      .describe(
        "Sort order by start_date. 'asc' (default) = soonest first (next departing at top); 'desc' = furthest future first.",
      ),
    limit: z
      .number()
      .int()
      .optional()
      .describe("Maximum number of tours to return (default 200, max 500)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ search, status, upcoming_only, sort, limit }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };

    const capped = Math.min(Math.max(limit ?? 200, 1), 500);
    const ascending = sort !== "desc";
    const today = new Date().toISOString().split("T")[0];
    let query = supabaseForUser(ctx)
      .from("tours")
      .select(
        "id, name, location, start_date, end_date, status, capacity, tour_host, tour_type",
      )
      .order("start_date", { ascending })
      .limit(capped);

    if (status) query = query.eq("status", status);
    if (upcoming_only) query = query.gte("start_date", today);
    if (search) query = query.or(`name.ilike.%${search}%,location.ilike.%${search}%`);

    const { data, error } = await query;
    if (error)
      return { content: [{ type: "text", text: error.message }], isError: true };

    const tours = data ?? [];
    const truncated = tours.length === capped;
    const result = {
      today,
      sort_order: ascending ? "asc" : "desc",
      upcoming_only: !!upcoming_only,
      count: tours.length,
      truncated,
      truncation_note: truncated
        ? `Showing the first ${capped} tours — there may be more. Raise 'limit' (max 500) or add a status/search filter to see the rest.`
        : null,
      tours,
    };
    return {
      content: [{ type: "text", text: JSON.stringify(result) }],
      structuredContent: result,
    };
  },
});