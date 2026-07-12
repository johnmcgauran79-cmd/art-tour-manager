import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";
import { auditReadCall } from "./_audit";

const ORG_TIMEZONE = "Australia/Sydney";

/** Current calendar date (YYYY-MM-DD) in the given IANA timezone. */
function todayInTimezone(tz: string): string {
  // en-CA yields ISO-style YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export default defineTool({
  name: "get_next_departing_tour",
  title: "Get next departing tour",
  description:
    "Deterministically return the SINGLE next departing tour the signed-in user is authorised to see: the earliest tour whose start_date is on or after the as-of date. Use this instead of list_tours whenever you need the 'next', 'upcoming' or 'soonest' tour — do NOT infer it from the order of list_tours. If as_of_date is omitted, the organisation's current date (Australia/Sydney) is used. Excludes archived tours always, cancelled tours unless include_cancelled, and test tours unless include_test_tours. Read-only.",
  inputSchema: {
    as_of_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .describe("Optional as-of date (YYYY-MM-DD). Defaults to today in Australia/Sydney."),
    include_test_tours: z
      .boolean()
      .optional()
      .describe("Include tours flagged as test tours. Default false."),
    include_cancelled: z
      .boolean()
      .optional()
      .describe("Include cancelled tours. Default false."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ as_of_date, include_test_tours, include_cancelled }, ctx) => {
    const started = Date.now();
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };

    const asOf = as_of_date ?? todayInTimezone(ORG_TIMEZONE);
    const excludedStatuses = ["archived", ...(include_cancelled ? [] : ["cancelled"])];

    let query = supabaseForUser(ctx)
      .from("tours")
      .select("id, name, location, start_date, end_date, status, created_at, is_test_tour")
      .gte("start_date", asOf)
      .not("status", "in", `(${excludedStatuses.join(",")})`)
      // Deterministic ordering: earliest start, then name, then created_at, then id.
      .order("start_date", { ascending: true })
      .order("name", { ascending: true })
      .order("created_at", { ascending: true })
      .order("id", { ascending: true });

    if (!include_test_tours) query = query.eq("is_test_tour", false);

    // Fetch a small deterministic window and pick the first — never rely on a
    // single-row limit interacting with ordering surprises.
    const { data, error } = await query.limit(5);

    if (error) {
      await auditReadCall(ctx, {
        tool: "get_next_departing_tour",
        success: false,
        errorCategory: "INTERNAL_ERROR",
        durationMs: Date.now() - started,
      });
      return { content: [{ type: "text", text: "Could not load tours." }], isError: true };
    }

    const rows = data ?? [];
    const next = rows[0] ?? null;
    const result = {
      as_of_date: asOf,
      timezone: ORG_TIMEZONE,
      tour: next
        ? {
            tour_id: next.id,
            name: next.name,
            start_date: next.start_date,
            end_date: next.end_date,
            status: next.status,
            location: next.location,
          }
        : null,
      selection_rule: "earliest_authorised_future_start_date",
      excluded_statuses: excludedStatuses,
      include_test_tours: !!include_test_tours,
      data_source: "art_database",
    };

    await auditReadCall(ctx, {
      tool: "get_next_departing_tour",
      recordId: next?.id ?? null,
      success: true,
      durationMs: Date.now() - started,
      resultCount: next ? 1 : 0,
    });

    return {
      content: [{ type: "text", text: JSON.stringify(result) }],
      structuredContent: result,
    };
  },
});
