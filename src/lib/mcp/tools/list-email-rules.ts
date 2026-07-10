import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";

export default defineTool({
  name: "list_email_rules",
  title: "List automated email rules",
  description:
    "List active automated email rules (email templates) and their ids. Use these ids in `include_in_email_rules` on an Additional Information section to make the section appear as an info block in those emails.",
  inputSchema: {
    include_inactive: z
      .boolean()
      .optional()
      .describe("Include inactive rules too. Defaults to false (active only)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ include_inactive }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };

    let query = supabaseForUser(ctx)
      .from("automated_email_rules")
      .select("id, rule_name, rule_type, trigger_type, days_before_tour, is_active, email_template_id")
      .order("days_before_tour", { ascending: false });
    if (!include_inactive) query = query.eq("is_active", true);

    const { data, error } = await query;
    if (error)
      return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { rules: data ?? [] },
    };
  },
});