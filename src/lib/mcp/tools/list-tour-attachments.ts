import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";
import { requireAdminOrManager } from "./_perms";

export default defineTool({
  name: "list_tour_attachments",
  title: "List tour attachments",
  description: "List all file attachments (guest docs, ops docs, etc.) uploaded against a tour.",
  inputSchema: { tour_id: z.string().describe("The tour id (uuid).") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ tour_id }, ctx) => {
    const denied = await requireAdminOrManager(ctx);
    if (denied) return denied;
    const { data, error } = await supabaseForUser(ctx)
      .from("tour_attachments")
      .select("*")
      .eq("tour_id", tour_id)
      .order("uploaded_at", { ascending: false });
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { attachments: data ?? [] },
    };
  },
});