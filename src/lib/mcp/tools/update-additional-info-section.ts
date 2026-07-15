import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";
import { requireAdminOrManager } from "./_perms";

export default defineTool({
  name: "update_additional_info_section",
  title: "Update additional info section",
  description:
    "Edit an existing Additional Information section by its id. Only the fields you provide are changed.",
  inputSchema: {
    section_id: z.string().describe("The section id (uuid) to update."),
    name: z.string().optional(),
    content: z.string().optional(),
    icon_name: z.string().optional(),
    sort_order: z.number().int().optional(),
    is_visible: z.boolean().optional(),
    include_in_email_rules: z
      .array(z.string())
      .optional()
      .describe(
        "Automated email rule ids this section should be injected into (as an info block). Replaces the existing list. Use `list_email_rules` to find ids.",
      ),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ section_id, ...updates }, ctx) => {
    const denied = await requireAdminOrManager(ctx);
    if (denied) return denied;

    const clean = Object.fromEntries(
      Object.entries(updates).filter(([, v]) => v !== undefined),
    );
    if (Object.keys(clean).length === 0)
      return { content: [{ type: "text", text: "No fields to update" }], isError: true };

    const { data, error } = await supabaseForUser(ctx)
      .from("tour_additional_info_sections")
      .update(clean)
      .eq("id", section_id)
      .select("id, name")
      .maybeSingle();
    if (error)
      return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data)
      return { content: [{ type: "text", text: "Section not found or not permitted" }], isError: true };
    return {
      content: [{ type: "text", text: `Updated section "${data.name}" (${data.id}).` }],
      structuredContent: { section: data },
    };
  },
});