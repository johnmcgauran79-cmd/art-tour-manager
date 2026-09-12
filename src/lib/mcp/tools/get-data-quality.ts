import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";
import { requireAdminOrManager } from "./_perms";

const AREAS = ["contacts", "leads", "finance"] as const;

const RPC: Record<(typeof AREAS)[number], string> = {
  contacts: "dq_contact_issues",
  leads: "dq_lead_issues",
  finance: "dq_finance_issues",
};

export default defineTool({
  name: "get_data_quality",
  title: "Get data quality issues",
  description:
    "List the data problems that distort reports and AI answers. Areas: contacts (duplicate contacts by email or name, missing phone on upcoming travellers, missing/invalid email, missing state/country), leads (active enquiries with no owner, no tour or unknown passenger numbers; lost without reason; won without booking; no lead source) and finance (Xero invoice links that are deleted/voided, invoice reference mismatches, invoiced bookings with no Xero link). Items staff marked 'not a problem' are excluded unless include_dismissed is true. Read-only; changes nothing. Restricted to admin/manager.",
  inputSchema: {
    area: z.enum(AREAS).optional().describe("Limit to one area. Defaults to all three."),
    issue_type: z.string().optional().describe("Limit to one issue type, e.g. duplicate_email."),
    include_dismissed: z.boolean().optional().describe("Include items marked as not a problem."),
    limit: z.number().int().optional().describe("Max rows per area (default 200, max 1000)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ area, issue_type, include_dismissed, limit }, ctx) => {
    const denied = await requireAdminOrManager(ctx);
    if (denied) return denied;
    const supabase = supabaseForUser(ctx);
    const capped = Math.min(Math.max(limit ?? 200, 1), 1000);
    const areas = area ? [area] : [...AREAS];

    const { data: dismissals } = await supabase.from("data_quality_dismissals").select("issue_key");
    const dismissed = new Set((dismissals ?? []).map((d: any) => d.issue_key));

    const result: Record<string, unknown> = { areas: {}, dismissed_count: dismissed.size };
    for (const a of areas) {
      const { data, error } = await supabase.rpc(RPC[a] as never);
      if (error) return { content: [{ type: "text", text: error.message }], isError: true };
      let rows = (data as any[]) ?? [];
      if (!include_dismissed) rows = rows.filter((r) => !dismissed.has(r.issue_key));
      if (issue_type) rows = rows.filter((r) => r.issue_type === issue_type);
      const truncated = rows.length > capped;
      (result.areas as any)[a] = {
        count: rows.length,
        truncated,
        by_issue_type: rows.reduce((acc: Record<string, number>, r: any) => {
          acc[r.issue_type] = (acc[r.issue_type] ?? 0) + 1;
          return acc;
        }, {}),
        issues: rows.slice(0, capped).map((r: any) => ({
          issue_key: r.issue_key,
          issue_type: r.issue_type,
          entity_id: r.entity_id,
          subject: r.subject,
          detail: r.detail,
          extra: r.extra,
          dismissed: dismissed.has(r.issue_key),
        })),
      };
    }

    return {
      content: [{ type: "text", text: JSON.stringify(result) }],
      structuredContent: result as any,
    };
  },
});
