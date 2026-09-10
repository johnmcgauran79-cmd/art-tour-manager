import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";
import { requireAdminOrManager } from "./_perms";

export default defineTool({
  name: "search_correspondence",
  title: "Search individual correspondence",
  description:
    "Search synced Microsoft 365 correspondence by text, contact, lead, tour, booking, mailbox, direction or date range. Returns subject, participants and a preview; set include_body for full text. Mailbox access rules apply.",
  inputSchema: {
    search: z.string().optional().describe("Case-insensitive text in subject, preview or body."),
    customer_id: z.string().optional(),
    lead_id: z.string().optional(),
    tour_id: z.string().optional(),
    booking_id: z.string().optional(),
    mailbox_id: z.string().optional(),
    direction: z.enum(["inbound", "outbound"]).optional(),
    from: z.string().optional().describe("YYYY-MM-DD"),
    to: z.string().optional().describe("YYYY-MM-DD"),
    include_body: z.boolean().optional(),
    limit: z.number().int().min(1).max(100).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (input, ctx) => {
    const denied = await requireAdminOrManager(ctx);
    if (denied) return denied;
    const supabase = supabaseForUser(ctx);

    let ids: string[] | null = null;
    if (input.customer_id) {
      const { data } = await supabase.from("crm_email_contacts").select("email_id").eq("customer_id", input.customer_id);
      ids = (data ?? []).map((r) => r.email_id as string);
    }
    if (input.lead_id || input.tour_id || input.booking_id) {
      let lq = supabase.from("crm_email_links").select("email_id");
      if (input.lead_id) lq = lq.eq("lead_id", input.lead_id);
      if (input.tour_id) lq = lq.eq("tour_id", input.tour_id);
      if (input.booking_id) lq = lq.eq("booking_id", input.booking_id);
      const { data } = await lq;
      const linked = (data ?? []).map((r) => r.email_id as string);
      ids = ids ? ids.filter((id) => linked.includes(id)) : linked;
    }
    if (ids && ids.length === 0)
      return { content: [{ type: "text", text: "No correspondence matched those links." }], structuredContent: { emails: [] } };

    const cols = input.include_body
      ? "id, mailbox_id, subject, preview, body_text, from_name, from_address, to_recipients, cc_recipients, occurred_at, direction, folder, has_attachments, conversation_id, web_link"
      : "id, mailbox_id, subject, preview, from_name, from_address, to_recipients, occurred_at, direction, folder, has_attachments, conversation_id, web_link";

    let q = supabase
      .from("crm_emails")
      .select(cols)
      .order("occurred_at", { ascending: false })
      .limit(input.limit ?? 25);
    if (ids) q = q.in("id", ids);
    if (input.mailbox_id) q = q.eq("mailbox_id", input.mailbox_id);
    if (input.direction) q = q.eq("direction", input.direction);
    if (input.from) q = q.gte("occurred_at", input.from);
    if (input.to) q = q.lte("occurred_at", `${input.to}T23:59:59Z`);
    if (input.search) {
      const s = input.search.replace(/[%,]/g, " ");
      q = q.or(`subject.ilike.%${s}%,preview.ilike.%${s}%,body_text.ilike.%${s}%`);
    }
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Found ${data?.length ?? 0} message(s).` }],
      structuredContent: { emails: data ?? [] },
    };
  },
});
