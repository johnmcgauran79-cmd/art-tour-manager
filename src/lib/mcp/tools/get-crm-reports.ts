import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";
import { requireAdminOrManager } from "./_perms";

const REPORTS = [
  "pipeline_summary",
  "funnel",
  "response_performance",
  "attribution_performance",
  "tour_sales",
  "action_board",
  "data_quality",
] as const;

export default defineTool({
  name: "get_crm_report",
  title: "Get CRM sales report",
  description:
    "Run one of the CRM's own reports and return its real figures: pipeline_summary, funnel, response_performance, attribution_performance, tour_sales, action_board, data_quality. Date range applies where the report supports it.",
  inputSchema: {
    report: z.enum(REPORTS),
    from: z.string().optional().describe("YYYY-MM-DD, defaults to 90 days ago where supported."),
    to: z.string().optional().describe("YYYY-MM-DD, defaults to today where supported."),
    tour_id: z.string().optional().describe("Funnel only: limit to one tour."),
    include_past: z.boolean().optional().describe("tour_sales only: include departed tours."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ report, from, to, tour_id, include_past }, ctx) => {
    const denied = await requireAdminOrManager(ctx);
    if (denied) return denied;
    const supabase = supabaseForUser(ctx);
    const today = new Date();
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const _to = to ?? iso(today);
    const _from = from ?? iso(new Date(today.getTime() - 90 * 86400000));

    let rpc: string = `crm_${report}`;
    let args: Record<string, unknown> = { _from, _to };
    if (report === "funnel") args = { _from, _to, _tour_id: tour_id ?? null };
    if (report === "tour_sales") args = { _from, _to, _include_past: include_past ?? false };
    if (report === "action_board" || report === "data_quality") args = {};
    if (report === "pipeline_summary") rpc = "crm_pipeline_summary";

    const { data, error } = await supabase.rpc(rpc as never, args as never);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? null) }],
      structuredContent: { report, from: _from, to: _to, result: data ?? null },
    };
  },
});
