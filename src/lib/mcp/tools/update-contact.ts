import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAdminOrManager } from "./_perms";
import { updateRowFields } from "./_fieldUpdate";

const fieldValue = z.union([z.string(), z.number(), z.boolean(), z.null()]);
const CONFIRM_FIELDS = ["first_name", "last_name", "preferred_name", "email", "phone"];

export default defineTool({
  name: "update_contact",
  title: "Update contact details",
  description:
    "Change any editable field on a contact (title, address, date of birth, emergency contact, dietary, medical, accessibility, notes, spouse, etc.). Changes to name, email or phone are NOT saved on the first call: the tool returns the before/after values — show them to the user, and only after they confirm call again with confirm=true. Marketing consent and system fields are locked. Admin/manager only.",
  inputSchema: {
    customer_id: z.string().describe("The contact id (uuid)."),
    fields: z.record(fieldValue).describe("Map of column name (as returned by get_contact_details) to new value. Use null to clear."),
    confirm: z.boolean().optional().describe("Set true only after the user has approved name/email/phone changes."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ customer_id, fields, confirm }, ctx) => {
    const denied = await requireAdminOrManager(ctx);
    if (denied) return denied;
    if (typeof fields.email === "string") fields.email = fields.email.trim().toLowerCase();
    return updateRowFields(ctx, "customers", customer_id, fields, { confirmFields: CONFIRM_FIELDS, confirm });
  },
});
