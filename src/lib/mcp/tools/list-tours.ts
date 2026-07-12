import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";

export default defineTool({
  name: "list_tours",
  title: "List tours",
  description:
    "List tours the signed-in user can access, most recent start date first. Returns up to 200 tours by default (raise `limit` up to 500 for a full list). Optionally filter by a name/location search term or status.",
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
    limit: z
      .number()
      .int()
      .optional()
      .describe("Maximum number of tours to return (default 200, max 500)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ search, status, limit }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };

    const capped = Math.min(Math.max(limit ?? 200, 1), 500);
    let query = supabaseForUser(ctx)
      .from("tours")
      .select(
        "id, name, location, start_date, end_date, status, capacity, tour_host, tour_type",
      )
      .order("start_date", { ascending: false })
      .limit(capped);

    if (status) query = query.eq("status", status);
    if (search) query = query.or(`name.ilike.%${search}%,location.ilike.%${search}%`);

    const { data, error } = await query;
    if (error)
      return { content: [{ type: "text", text: error.message }], isError: true };

    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { count: (data ?? []).length, tours: data ?? [] },
    };
  },
});