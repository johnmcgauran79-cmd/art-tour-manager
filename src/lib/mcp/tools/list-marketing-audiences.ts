import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";
import { requireAdminOrManager } from "./_perms";

export default defineTool({
  name: "list_marketing_audiences",
  title: "List marketing audiences",
  description:
    "Saved dynamic audiences with their filter rules and last counted sizes. Audiences resolve at send time, so counts here are the last calculation.",
  inputSchema: { include_inactive: z.boolean().optional() },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ include_inactive }, ctx) => {
    const denied = await requireAdminOrManager(ctx);
    if (denied) return denied;
    let q = supabaseForUser(ctx)
      .from("marketing_audiences")
      .select("*")
      .order("updated_at", { ascending: false });
    if (!include_inactive) q = q.eq("is_active", true);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Found ${data?.length ?? 0} audience(s).` }],
      structuredContent: { audiences: data ?? [] },
    };
  },
});
