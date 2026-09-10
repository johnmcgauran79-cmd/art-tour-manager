import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAdminOrManager } from "./_perms";
import { invokeFunction, sendingDisabledResult, sendingEnabled } from "./_sending";

export default defineTool({
  name: "send_individual_email",
  title: "Send an individual email from a shared mailbox (currently switched off)",
  description:
    "Send or reply to an individual email from one of the connected Microsoft 365 mailboxes, optionally linked to a contact, lead, tour or booking. DISABLED until ART authorises AI-initiated sending; until then it returns an explanation and sends nothing.",
  inputSchema: {
    mailbox_id: z.string(),
    to: z.array(z.string().email()).optional(),
    cc: z.array(z.string().email()).optional(),
    subject: z.string().optional(),
    html: z.string().describe("Message body as HTML."),
    reply_to_email_id: z.string().optional().describe("Reply to this synced message instead of starting a new one."),
    customer_id: z.string().optional(),
    lead_id: z.string().optional(),
    tour_id: z.string().optional(),
    booking_id: z.string().optional(),
    confirm: z.literal(true),
  },
  annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: true },
  handler: async (input, ctx) => {
    const denied = await requireAdminOrManager(ctx);
    if (denied) return denied;
    if (!sendingEnabled()) return sendingDisabledResult();
    if (input.confirm !== true)
      return { content: [{ type: "text", text: "confirm must be true for a send." }], isError: true };
    if (!input.reply_to_email_id && !(input.to && input.to.length))
      return { content: [{ type: "text", text: "Provide to addresses or a reply_to_email_id." }], isError: true };

    const res = await invokeFunction(ctx, "ms-mail-send", {
      mailboxId: input.mailbox_id,
      mode: input.reply_to_email_id ? "reply" : "new",
      replyToEmailId: input.reply_to_email_id,
      to: input.to,
      cc: input.cc,
      subject: input.subject,
      html: input.html,
      customerId: input.customer_id ?? null,
      leadId: input.lead_id ?? null,
      tourId: input.tour_id ?? null,
      bookingId: input.booking_id ?? null,
    });
    if (!res.ok)
      return { content: [{ type: "text", text: `Send failed (${res.status}): ${JSON.stringify(res.data)}` }], isError: true };
    return { content: [{ type: "text", text: "Email sent." }], structuredContent: { result: res.data } };
  },
});
