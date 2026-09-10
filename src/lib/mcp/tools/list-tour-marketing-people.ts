import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";
import { requireAdminOrManager } from "./_perms";

const METRICS = [
  "interested",
  "interested_not_booked",
  "nurture_leads",
  "active_leads",
  "emailed",
  "opened",
  "clicked",
  "meaningful_clicks",
  "enquiries",
  "bookings",
] as const;

export default defineTool({
  name: "list_tour_marketing_people",
  title: "List the contacts behind a tour marketing number",
  description:
    "Drill into a tour marketing figure and list the actual contacts: interested, interested_not_booked, nurture_leads, active_leads, emailed, opened, clicked, meaningful_clicks, enquiries, bookings.",
  inputSchema: {
    tour_id: z.string(),
    metric: z.enum(METRICS),
    days: z.number().int().min(1).max(365).optional(),
    limit: z.number().int().min(1).max(500).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ tour_id, metric, days, limit }, ctx) => {
    const denied = await requireAdminOrManager(ctx);
    if (denied) return denied;
    const { data, error } = await supabaseForUser(ctx).rpc("crm_tour_marketing_people" as never, {
      _tour_id: tour_id,
      _metric: metric,
      _days: days ?? 30,
      _limit: limit ?? 200,
    } as never);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const people = (data as unknown[]) ?? [];
    return {
      content: [{ type: "text", text: `Found ${people.length} contact(s) for ${metric}.` }],
      structuredContent: { metric, people },
    };
  },
});
