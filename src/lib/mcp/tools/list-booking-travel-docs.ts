import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";
import { requireAdminOrManager } from "./_perms";

export default defineTool({
  name: "list_booking_travel_docs",
  title: "List booking travel documents",
  description:
    "List travel documents (passports, visas, etc.) recorded against a booking, including full passport numbers, DOB and nationality (admin/manager only).",
  inputSchema: { booking_id: z.string() },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ booking_id }, ctx) => {
    const denied = await requireAdminOrManager(ctx);
    if (denied) return denied;
    const { data, error } = await supabaseForUser(ctx)
      .from("booking_travel_docs")
      .select("*")
      .eq("booking_id", booking_id);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { travel_docs: data ?? [] },
    };
  },
});