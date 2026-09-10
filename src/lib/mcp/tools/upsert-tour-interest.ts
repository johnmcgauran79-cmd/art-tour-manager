import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";
import { requireAdminOrManager } from "./_perms";

export default defineTool({
  name: "upsert_tour_interest",
  title: "Record or update a tour interest",
  description:
    "Record that a contact is interested in a tour, or update the interest level/status/notes on an existing interest record.",
  inputSchema: {
    customer_id: z.string(),
    tour_id: z.string(),
    lead_id: z.string().optional(),
    interest_level: z.string().optional(),
    status: z.string().optional(),
    source: z.string().optional(),
    notes: z.string().optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    const denied = await requireAdminOrManager(ctx);
    if (denied) return denied;
    const supabase = supabaseForUser(ctx);
    const { data: existing } = await supabase
      .from("tour_interests")
      .select("id")
      .eq("customer_id", input.customer_id)
      .eq("tour_id", input.tour_id)
      .maybeSingle();

    const fields: Record<string, unknown> = {
      lead_id: input.lead_id ?? undefined,
      interest_level: input.interest_level ?? undefined,
      status: input.status ?? undefined,
      source: input.source ?? undefined,
      notes: input.notes ?? undefined,
    };
    const clean = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));

    if (existing) {
      const { data, error } = await supabase
        .from("tour_interests")
        .update(clean)
        .eq("id", existing.id)
        .select("*")
        .maybeSingle();
      if (error) return { content: [{ type: "text", text: error.message }], isError: true };
      return { content: [{ type: "text", text: "Tour interest updated." }], structuredContent: { interest: data } };
    }
    const { data, error } = await supabase
      .from("tour_interests")
      .insert({
        customer_id: input.customer_id,
        tour_id: input.tour_id,
        created_by: ctx.getUserId(),
        ...clean,
      })
      .select("*")
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return { content: [{ type: "text", text: "Tour interest recorded." }], structuredContent: { interest: data } };
  },
});
