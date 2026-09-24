import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";
import { requireAdminOrManager } from "./_perms";

const TABLES = {
  tour: { table: "tour_external_links", fk: "tour_id" },
  activity: { table: "activity_external_links", fk: "activity_id" },
  hotel: { table: "hotel_external_links", fk: "hotel_id" },
} as const;

export default defineTool({
  name: "manage_external_link",
  title: "Add or remove a link on a tour, activity or hotel",
  description:
    "Add, edit or remove a labelled link (e.g. tickets or a contract stored in SharePoint/Google Drive) on a tour, activity or hotel. action='add' needs parent_id, label and url; 'update' needs link_id; 'remove' needs link_id and confirm=true. Admin/manager only.",
  inputSchema: {
    record_type: z.enum(["tour", "activity", "hotel"]),
    action: z.enum(["add", "update", "remove"]),
    parent_id: z.string().optional().describe("Tour/activity/hotel id (for add)."),
    link_id: z.string().optional().describe("Existing link id (for update/remove)."),
    label: z.string().min(1).max(200).optional(),
    url: z.string().url().optional(),
    confirm: z.boolean().optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
  handler: async ({ record_type, action, parent_id, link_id, label, url, confirm }, ctx) => {
    const denied = await requireAdminOrManager(ctx);
    if (denied) return denied;
    const fail = (text: string) => ({ content: [{ type: "text" as const, text }], isError: true });
    const { table, fk } = TABLES[record_type];
    const supabase = supabaseForUser(ctx);

    if (action === "add") {
      if (!parent_id || !label || !url) return fail("add needs parent_id, label and url.");
      const { data, error } = await supabase.from(table)
        .insert({ [fk]: parent_id, label, url, created_by: ctx.getUserId() } as never).select().single();
      if (error) return fail(error.message);
      return { content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: { link: data } };
    }
    if (!link_id) return fail(`${action} needs link_id.`);
    if (action === "update") {
      const patch = Object.fromEntries(Object.entries({ label, url }).filter(([, v]) => v !== undefined));
      if (!Object.keys(patch).length) return fail("Nothing to update.");
      const { data, error } = await supabase.from(table).update(patch as never).eq("id", link_id).select().maybeSingle();
      if (error) return fail(error.message);
      if (!data) return fail("Link not found or not permitted.");
      return { content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: { link: data } };
    }
    if (!confirm) return fail("Removing a link needs confirm=true after the user agrees.");
    const { error } = await supabase.from(table).delete().eq("id", link_id);
    if (error) return fail(error.message);
    return { content: [{ type: "text", text: `Removed link ${link_id}.` }], structuredContent: { removed: link_id } };
  },
});
