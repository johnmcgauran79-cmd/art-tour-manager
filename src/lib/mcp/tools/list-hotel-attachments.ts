import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";
import { requireAdminOrManager } from "./_perms";

export default defineTool({
  name: "list_hotel_attachments",
  title: "List hotel attachments",
  description: "List file attachments (contracts, rooming confirmations) uploaded against a hotel.",
  inputSchema: { hotel_id: z.string().describe("The hotel id (uuid).") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ hotel_id }, ctx) => {
    const denied = await requireAdminOrManager(ctx);
    if (denied) return denied;
    const { data, error } = await supabaseForUser(ctx)
      .from("hotel_attachments")
      .select("*")
      .eq("hotel_id", hotel_id)
      .order("uploaded_at", { ascending: false });
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { attachments: data ?? [] },
    };
  },
});