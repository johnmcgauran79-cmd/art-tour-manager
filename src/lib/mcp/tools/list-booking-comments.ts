import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";
import { requireAdminOrManager } from "./_perms";

export default defineTool({
  name: "list_booking_comments",
  title: "List booking comments",
  description: "List internal staff comments on a booking.",
  inputSchema: { booking_id: z.string() },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ booking_id }, ctx) => {
    const denied = await requireAdminOrManager(ctx);
    if (denied) return denied;
    const { data, error } = await supabaseForUser(ctx)
      .from("booking_comments")
      .select("*")
      .eq("booking_id", booking_id)
      .order("created_at", { ascending: true });
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { comments: data ?? [] },
    };
  },
});