import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";
import { requireAdminOrManager } from "./_perms";

export default defineTool({
  name: "get_correspondence_message",
  title: "Get one message in full",
  description:
    "Full content of one synced message (body text and HTML, recipients, attachments) plus the contacts, leads, tours and bookings it is matched to. Optionally include the whole conversation thread.",
  inputSchema: {
    email_id: z.string(),
    include_thread: z.boolean().optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ email_id, include_thread }, ctx) => {
    const denied = await requireAdminOrManager(ctx);
    if (denied) return denied;
    const supabase = supabaseForUser(ctx);
    const { data: email, error } = await supabase.from("crm_emails").select("*").eq("id", email_id).maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!email)
      return { content: [{ type: "text", text: "Message not found, or you do not have access to that mailbox." }], isError: true };

    const [contacts, links] = await Promise.all([
      supabase.from("crm_email_contacts").select("customer_id, role, link_source").eq("email_id", email_id),
      supabase.from("crm_email_links").select("lead_id, tour_id, booking_id, link_source, confidence").eq("email_id", email_id),
    ]);

    let thread: unknown[] = [];
    if (include_thread && email.conversation_id) {
      const { data } = await supabase
        .from("crm_emails")
        .select("id, subject, from_address, from_name, occurred_at, direction, preview, body_text")
        .eq("conversation_id", email.conversation_id)
        .order("occurred_at", { ascending: true })
        .limit(50);
      thread = data ?? [];
    }
    const payload = { email, contacts: contacts.data ?? [], links: links.data ?? [], thread };
    return { content: [{ type: "text", text: JSON.stringify(payload) }], structuredContent: payload };
  },
});
