import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "./_supabase";
import { requireAdminOrManager } from "./_perms";

export default defineTool({
  name: "list_crm_settings",
  title: "List CRM configuration",
  description:
    "The CRM's configuration: lead stages (open/won/lost, cold thresholds), lead sources, lead types, lost reasons and the sales settings (response targets, escalation days).",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    const denied = await requireAdminOrManager(ctx);
    if (denied) return denied;
    const supabase = supabaseForUser(ctx);
    const [stages, sources, types, lost, settings] = await Promise.all([
      supabase.from("crm_lead_stages").select("*").order("sort_order"),
      supabase.from("crm_lead_sources").select("*").order("sort_order"),
      supabase.from("crm_lead_types").select("*").order("sort_order"),
      supabase.from("crm_lost_reasons").select("*").order("sort_order"),
      supabase.from("crm_settings").select("*"),
    ]);
    const payload = {
      stages: stages.data ?? [],
      sources: sources.data ?? [],
      lead_types: types.data ?? [],
      lost_reasons: lost.data ?? [],
      settings: settings.data ?? [],
    };
    return { content: [{ type: "text", text: JSON.stringify(payload) }], structuredContent: payload };
  },
});
