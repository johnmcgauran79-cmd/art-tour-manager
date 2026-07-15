import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";
import { requireAdminOrManager } from "./_perms";

export default defineTool({
  name: "list_scheduled_emails",
  title: "List scheduled emails",
  description:
    "List emails scheduled for future delivery. Filter by tour_id or booking_id.",
  inputSchema: {
    tour_id: z.string().optional(),
    booking_id: z.string().optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ tour_id, booking_id }, ctx) => {
    const denied = await requireAdminOrManager(ctx);
    if (denied) return denied;
    let q = supabaseForUser(ctx)
      .from("scheduled_emails")
      .select("*")
      .order("send_at", { ascending: true });
    if (tour_id) q = q.eq("tour_id", tour_id);
    if (booking_id) q = q.eq("booking_id", booking_id);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { scheduled: data ?? [] },
    };
  },
});