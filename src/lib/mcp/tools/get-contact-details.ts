import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";
import { requireAdminOrManager } from "./_perms";

export default defineTool({
  name: "get_contact_details",
  title: "Get full contact details",
  description:
    "Fetch every field on a contact record (name, title, contact details, address, date of birth, emergency contact, dietary, medical, accessibility, notes, lead fields). Passport details are not stored here. Admin/manager only.",
  inputSchema: { customer_id: z.string().describe("The contact id (uuid).") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ customer_id }, ctx) => {
    const denied = await requireAdminOrManager(ctx);
    if (denied) return denied;
    const { data, error } = await supabaseForUser(ctx)
      .from("customers").select("*").eq("id", customer_id).maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data) return { content: [{ type: "text", text: "Contact not found or not permitted" }], isError: true };
    const { keap_contact_id: _k, keap_match_checked_at: _km, brevo_contact_id: _b, brevo_synced_at: _bs, ...contact } = data;
    return { content: [{ type: "text", text: JSON.stringify(contact) }], structuredContent: { contact } };
  },
});
