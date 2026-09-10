import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";
import { requireAdminOrManager } from "./_perms";

export default defineTool({
  name: "list_tour_interests",
  title: "List tour interests",
  description:
    "Contacts who have registered interest in a tour (or the tours one contact is interested in), with interest level, status and source.",
  inputSchema: {
    tour_id: z.string().optional(),
    customer_id: z.string().optional(),
    status: z.string().optional(),
    limit: z.number().int().min(1).max(500).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (input, ctx) => {
    const denied = await requireAdminOrManager(ctx);
    if (denied) return denied;
    if (!input.tour_id && !input.customer_id)
      return { content: [{ type: "text", text: "tour_id or customer_id is required" }], isError: true };
    let q = supabaseForUser(ctx)
      .from("tour_interests")
      .select(
        "id, customer_id, tour_id, lead_id, interest_level, status, source, notes, created_at, customers(first_name, last_name, email, mobile, state)",
      )
      .order("created_at", { ascending: false })
      .limit(input.limit ?? 200);
    if (input.tour_id) q = q.eq("tour_id", input.tour_id);
    if (input.customer_id) q = q.eq("customer_id", input.customer_id);
    if (input.status) q = q.eq("status", input.status);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Found ${data?.length ?? 0} interest record(s).` }],
      structuredContent: { interests: data ?? [] },
    };
  },
});
