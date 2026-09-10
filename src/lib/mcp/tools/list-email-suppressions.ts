import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";
import { requireAdminOrManager } from "./_perms";

export default defineTool({
  name: "list_email_suppressions",
  title: "List email suppressions (bounces and complaints)",
  description:
    "Suppressed email addresses with type, reason and bounce counts. These addresses are always excluded from sending regardless of audience rules.",
  inputSchema: {
    suppression_type: z.string().optional(),
    active_only: z.boolean().optional(),
    search: z.string().optional().describe("Substring of the email address."),
    limit: z.number().int().min(1).max(500).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ suppression_type, active_only, search, limit }, ctx) => {
    const denied = await requireAdminOrManager(ctx);
    if (denied) return denied;
    let q = supabaseForUser(ctx)
      .from("email_suppressions")
      .select("*")
      .order("last_bounced_at", { ascending: false, nullsFirst: false })
      .limit(limit ?? 100);
    if (suppression_type) q = q.eq("suppression_type", suppression_type);
    if (active_only !== false) q = q.eq("is_active", true);
    if (search) q = q.ilike("email_address", `%${search}%`);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Found ${data?.length ?? 0} suppression(s).` }],
      structuredContent: { suppressions: data ?? [] },
    };
  },
});
