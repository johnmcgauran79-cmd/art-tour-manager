import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "./_supabase";
import { requireAdminOrManager } from "./_perms";

export default defineTool({
  name: "list_mailboxes",
  title: "List connected mailboxes",
  description:
    "Microsoft 365 mailboxes connected to the communications hub, with sync status, last successful sync, history depth and any error. Only mailboxes the signed-in user may read are returned.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    const denied = await requireAdminOrManager(ctx);
    if (denied) return denied;
    const { data, error } = await supabaseForUser(ctx)
      .from("email_mailboxes")
      .select(
        "id, address, display_name, kind, is_enabled, sync_enabled, history_months, last_sync_at, last_success_at, last_sync_status, last_error, connected_at, notes",
      )
      .order("address");
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Found ${data?.length ?? 0} mailbox(es).` }],
      structuredContent: { mailboxes: data ?? [] },
    };
  },
});
