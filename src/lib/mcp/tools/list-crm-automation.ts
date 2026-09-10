import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";
import { requireAdminOrManager } from "./_perms";

export default defineTool({
  name: "list_crm_automation",
  title: "List CRM automation rules and runs",
  description:
    "CRM automation rules (triggers, conditions, actions, cooldowns) and, optionally, their recent run log so you can see what fired and what failed.",
  inputSchema: {
    include_runs: z.boolean().optional(),
    rule_id: z.string().optional(),
    limit: z.number().int().min(1).max(200).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ include_runs, rule_id, limit }, ctx) => {
    const denied = await requireAdminOrManager(ctx);
    if (denied) return denied;
    const supabase = supabaseForUser(ctx);
    let rq = supabase.from("crm_automation_rules").select("*").order("created_at", { ascending: false });
    if (rule_id) rq = rq.eq("id", rule_id);
    const { data: rules, error } = await rq;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    let runs: unknown[] = [];
    if (include_runs) {
      let q = supabase
        .from("crm_automation_runs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit ?? 50);
      if (rule_id) q = q.eq("rule_id", rule_id);
      const { data } = await q;
      runs = data ?? [];
    }
    const payload = { rules: rules ?? [], runs };
    return { content: [{ type: "text", text: JSON.stringify(payload) }], structuredContent: payload };
  },
});
