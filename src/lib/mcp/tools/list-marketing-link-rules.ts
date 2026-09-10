import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";
import { requireAdminOrManager } from "./_perms";

export default defineTool({
  name: "list_marketing_link_rules",
  title: "List 'what a click means' rules",
  description:
    "Link classification rules that turn clicked URLs into meaning (high intent, register interest, tour-specific), including the tour each rule maps to.",
  inputSchema: { include_inactive: z.boolean().optional() },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ include_inactive }, ctx) => {
    const denied = await requireAdminOrManager(ctx);
    if (denied) return denied;
    let q = supabaseForUser(ctx)
      .from("marketing_link_classifications")
      .select("*")
      .order("created_at", { ascending: false });
    if (!include_inactive) q = q.eq("is_active", true);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Found ${data?.length ?? 0} rule(s).` }],
      structuredContent: { rules: data ?? [] },
    };
  },
});
