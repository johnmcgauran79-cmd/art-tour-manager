import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";
import { auditReadCall } from "./_audit";

const ORG_TIMEZONE = "Australia/Sydney";

/** Current calendar date (YYYY-MM-DD) in the given IANA timezone. */
function todayInTimezone(tz: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

interface CandidateTour {
  id: string;
  name: string;
  start_date: string;
  end_date?: string | null;
  status: string;
  location?: string | null;
  created_at?: string | null;
  is_test_tour?: boolean | null;
}

/**
 * Deterministic selection mirroring the DB filters. Pure so the logic is
 * unit-testable (see supabase/functions tests). Ordering:
 * start_date asc, name asc, created_at asc, id asc.
 */
export function selectNextDepartingTour(
  rows: CandidateTour[],
  opts: { asOf: string; includeTestTours?: boolean; includeCancelled?: boolean },
): CandidateTour | null {
  const excluded = new Set<string>(["archived", ...(opts.includeCancelled ? [] : ["cancelled"])]);
  const filtered = rows.filter((t) => {
    if (t.start_date < opts.asOf) return false;
    if (excluded.has(t.status)) return false;
    if (!opts.includeTestTours && t.is_test_tour) return false;
    return true;
  });
  filtered.sort((a, b) => {
    if (a.start_date !== b.start_date) return a.start_date < b.start_date ? -1 : 1;
    if (a.name !== b.name) return a.name < b.name ? -1 : 1;
    const ac = a.created_at ?? "", bc = b.created_at ?? "";
    if (ac !== bc) return ac < bc ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  return filtered[0] ?? null;
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
      .order("start_date", { ascending: true })
      .order("name", { ascending: true })
      .order("created_at", { ascending: true })
      .order("id", { ascending: true });

    if (!include_test_tours) query = query.eq("is_test_tour", false);

    // Fetch a small deterministic window; pick the winner with the shared
    // selector so the pick is identical regardless of DB ordering quirks.
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

    const next = selectNextDepartingTour((data ?? []) as CandidateTour[], {
      asOf,
      includeTestTours: !!include_test_tours,
      includeCancelled: !!include_cancelled,
    });

    const result = {
      as_of_date: asOf,
      timezone: ORG_TIMEZONE,
      tour: next
        ? {
            tour_id: next.id,
            name: next.name,
            start_date: next.start_date,
            end_date: next.end_date ?? null,
            status: next.status,
            location: next.location ?? null,
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
