import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";

export default defineTool({
  name: "create_tour",
  title: "Create tour",
  description:
    "Create a new tour. Requires name, start_date, end_date (YYYY-MM-DD), and the number of days and nights. Optional fields set location, host, capacity, status and pricing.",
  inputSchema: {
    name: z.string().describe("Tour name."),
    start_date: z.string().describe("Start date, YYYY-MM-DD."),
    end_date: z.string().describe("End date, YYYY-MM-DD."),
    days: z.number().int().describe("Number of days."),
    nights: z.number().int().describe("Number of nights."),
    location: z.string().optional().describe("Tour location."),
    tour_host: z.string().optional().describe("Tour host name."),
    capacity: z.number().int().optional().describe("Maximum passengers."),
    minimum_passengers_required: z.number().int().optional(),
    status: z
      .string()
      .optional()
      .describe("One of: pending, available, closed, sold_out, past, cancelled."),
    tour_type: z.string().optional().describe("domestic or international."),
    notes: z.string().optional(),
    price_single: z.number().optional(),
    price_double: z.number().optional(),
    price_twin: z.number().optional(),
    deposit_required: z.number().optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };

    const { data, error } = await supabaseForUser(ctx)
      .from("tours")
      .insert(input)
      .select("id, name, start_date, end_date, status")
      .single();

    if (error)
      return { content: [{ type: "text", text: error.message }], isError: true };

    return {
      content: [{ type: "text", text: `Created tour ${data.name} (${data.id})` }],
      structuredContent: { tour: data },
    };
  },
});