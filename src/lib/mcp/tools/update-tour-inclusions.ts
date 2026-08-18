import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAdminOrManager } from "./_perms";
import { supabaseForUser } from "./_supabase";
import { sanitiseInlineHtml } from "../wordpress/inclusions";

export default defineTool({
  name: "update_tour_inclusions",
  title: "Replace tour inclusions or exclusions",
  description:
    "Replace the full inclusion OR exclusion list for a tour with the supplied items, in the order given. Each item is one bullet on the website; light inline HTML (<b>, <i>, <a href>) is kept, block markup is stripped. This replaces the existing list for that kind — read it with `get_tour_inclusions` first. Nothing is published to the website until `wordpress_push_tour_inclusions` is called. Admin/manager only.",
  inputSchema: {
    tour_id: z.string().describe("The ART tour id (uuid)."),
    kind: z.enum(["inclusion", "exclusion"]).describe("Which list to replace."),
    items: z.array(z.string().min(1)).describe("The full list of items, in display order."),
  },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ tour_id, kind, items }, ctx) => {
    const denied = await requireAdminOrManager(ctx);
    if (denied) return denied;
    const supabase = supabaseForUser(ctx);

    const cleaned = items.map((s) => sanitiseInlineHtml(s)).filter((s) => s.length > 0);
    const del = await supabase.from("tour_inclusion_items").delete().eq("tour_id", tour_id).eq("kind", kind);
    if (del.error) return { content: [{ type: "text", text: del.error.message }], isError: true };

    if (cleaned.length > 0) {
      const { error } = await supabase.from("tour_inclusion_items").insert(
        cleaned.map((content_html, i) => ({ tour_id, kind, content_html, sort_order: i })),
      );
      if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    }
    const out = { tour_id, kind, item_count: cleaned.length, items: cleaned };
    return {
      content: [{ type: "text", text: `Saved ${cleaned.length} ${kind} item(s) in ART. Not yet published to the website.` }],
      structuredContent: out,
    };
  },
});
