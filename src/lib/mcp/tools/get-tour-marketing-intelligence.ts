import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";
import { requireAdminOrManager } from "./_perms";

export default defineTool({
  name: "get_tour_marketing_intelligence",
  title: "Get tour marketing and sales intelligence",
  description:
    "Per-tour marketing funnel: interested contacts, marketing-eligible, active and nurture leads, booked passengers, contacts emailed, opens, clicks, meaningful tour clicks, enquiries and bookings attributed, plus the previous comparable period. Unique-contact and event figures are labelled separately.",
  inputSchema: {
    tour_id: z.string(),
    days: z.number().int().min(1).max(365).optional().describe("Window length, default 30."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ tour_id, days }, ctx) => {
    const denied = await requireAdminOrManager(ctx);
    if (denied) return denied;
    const { data, error } = await supabaseForUser(ctx).rpc("crm_tour_marketing_intelligence" as never, {
      _tour_id: tour_id,
      _days: days ?? 30,
    } as never);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? null) }],
      structuredContent: { intelligence: data ?? null },
    };
  },
});
