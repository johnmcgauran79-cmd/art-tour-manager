import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";
import { requireAdminOrManager } from "./_perms";

export default defineTool({
  name: "list_tour_email_rule_overrides",
  title: "List tour-specific email rule overrides",
  description:
    "List automated-email rule overrides configured for a specific tour (custom templates, disabled rules, etc.).",
  inputSchema: { tour_id: z.string() },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ tour_id }, ctx) => {
    const denied = await requireAdminOrManager(ctx);
    if (denied) return denied;
    const { data, error } = await supabaseForUser(ctx)
      .from("tour_email_rule_overrides")
      .select("*")
      .eq("tour_id", tour_id);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { overrides: data ?? [] },
    };
  },
});