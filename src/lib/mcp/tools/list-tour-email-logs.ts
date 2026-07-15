import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";
import { requireAdminOrManager } from "./_perms";

export default defineTool({
  name: "list_tour_email_logs",
  title: "List tour email logs",
  description:
    "List sent-email logs for a tour (subject, recipient, status, error, sent_at). Filter with booking_id or a limit.",
  inputSchema: {
    tour_id: z.string().optional(),
    booking_id: z.string().optional(),
    limit: z.number().int().optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ tour_id, booking_id, limit }, ctx) => {
    const denied = await requireAdminOrManager(ctx);
    if (denied) return denied;
    let q = supabaseForUser(ctx)
      .from("email_logs")
      .select("*")
      .order("sent_at", { ascending: false })
      .limit(Math.min(limit ?? 100, 500));
    if (tour_id) q = q.eq("tour_id", tour_id);
    if (booking_id) q = q.eq("booking_id", booking_id);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { emails: data ?? [] },
    };
  },
});