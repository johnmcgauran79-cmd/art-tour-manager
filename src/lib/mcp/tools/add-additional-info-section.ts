import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";

export default defineTool({
  name: "add_additional_info_section",
  title: "Add additional info section",
  description:
    "Add an Additional Information section to a tour. Provide the tour_id, a name, and the content (HTML or plain text). icon_name defaults to 'Info'.",
  inputSchema: {
    tour_id: z.string().describe("The tour id (uuid)."),
    name: z.string().describe("Section title."),
    content: z.string().optional().describe("Section body content."),
    icon_name: z.string().optional().describe("Lucide icon name, defaults to 'Info'."),
    sort_order: z.number().int().optional().describe("Display order."),
    is_visible: z.boolean().optional().describe("Whether the section is shown, default true."),
    include_in_email_rules: z
      .array(z.string())
      .optional()
      .describe(
        "Automated email rule ids this section should be injected into (as an info block). Use `list_email_rules` to find ids.",
      ),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ tour_id, name, content, icon_name, sort_order, is_visible, include_in_email_rules }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };

    const supabase = supabaseForUser(ctx);
    let order = sort_order;
    if (order === undefined) {
      const { count } = await supabase
        .from("tour_additional_info_sections")
        .select("id", { count: "exact", head: true })
        .eq("tour_id", tour_id);
      order = count ?? 0;
    }

    const { data, error } = await supabase
      .from("tour_additional_info_sections")
      .insert({
        tour_id,
        name,
        content: content ?? null,
        icon_name: icon_name ?? "Info",
        sort_order: order,
        is_visible: is_visible ?? true,
        include_in_email_rules: include_in_email_rules ?? [],
        created_by: ctx.getUserId(),
      })
      .select("id, name")
      .single();
    if (error)
      return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Added section "${data.name}" (${data.id}).` }],
      structuredContent: { section: data },
    };
  },
});