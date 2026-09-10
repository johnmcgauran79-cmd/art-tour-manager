import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";
import { requireAdminOrManager } from "./_perms";

export default defineTool({
  name: "count_marketing_audience",
  title: "Count a marketing audience now",
  description:
    "Resolve an audience live and return its size, using the saved audience (audience_id) or ad-hoc rules JSON in the same shape the audience builder uses. Consent, unsubscribes, bounces and suppressions always apply.",
  inputSchema: {
    audience_id: z.string().optional(),
    rules: z.any().optional().describe("Audience rules JSON, same shape as marketing_audiences.filters."),
    sample: z.boolean().optional().describe("Also return up to 25 matching contacts."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ audience_id, rules, sample }, ctx) => {
    const denied = await requireAdminOrManager(ctx);
    if (denied) return denied;
    const supabase = supabaseForUser(ctx);
    let filters: unknown = rules;
    if (audience_id) {
      const { data, error } = await supabase
        .from("marketing_audiences")
        .select("filters")
        .eq("id", audience_id)
        .maybeSingle();
      if (error) return { content: [{ type: "text", text: error.message }], isError: true };
      if (!data) return { content: [{ type: "text", text: "Audience not found" }], isError: true };
      filters = data.filters;
    }
    if (!filters) return { content: [{ type: "text", text: "audience_id or rules is required" }], isError: true };

    const { data: summary, error: sErr } = await supabase.rpc("crm_audience_summary" as never, {
      _rules: filters,
    } as never);
    if (sErr) return { content: [{ type: "text", text: sErr.message }], isError: true };

    let contacts: unknown[] = [];
    if (sample) {
      const { data } = await supabase.rpc("crm_audience_match" as never, {
        _rules: filters,
        _only_sendable: true,
        _limit: 25,
      } as never);
      contacts = (data as unknown[]) ?? [];
    }
    const payload = { summary, sample_contacts: contacts };
    return { content: [{ type: "text", text: JSON.stringify(payload) }], structuredContent: payload };
  },
});
