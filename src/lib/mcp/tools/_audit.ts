import type { ToolContext } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "./_supabase";
import { isUuid } from "./_xeroLogic";

/**
 * Fetch the signed-in user's roles via the USER-TOKEN client (RLS enforced).
 * Never uses service-role. Returns [] on error (fail closed).
 */
export async function getUserRoles(ctx: ToolContext): Promise<string[]> {
  try {
    const { data, error } = await supabaseForUser(ctx)
      .from("user_roles")
      .select("role")
      .eq("user_id", ctx.getUserId());
    if (error) return [];
    return (data ?? []).map((r: { role: string }) => r.role);
  } catch {
    return [];
  }
}

export function hasFinancialRole(roles: string[]): boolean {
  return roles.includes("admin") || roles.includes("manager");
}

export interface ReadAuditFields {
  tool: string;
  recordId?: string | null;
  success: boolean;
  errorCategory?: string | null;
  durationMs: number;
  resultCount?: number | null;
}

/**
 * Minimal audit record for read-only MCP tools, written via the user-token
 * client. Records ONLY whitelisted numeric/enum fields — never PII, record
 * payloads, tokens or headers. Failures never surface to the caller.
 */
export async function auditReadCall(ctx: ToolContext, f: ReadAuditFields): Promise<void> {
  try {
    await supabaseForUser(ctx)
      .from("audit_log")
      .insert({
        user_id: ctx.getUserId(),
        operation_type: f.success ? "mcp_read" : "mcp_read_error",
        table_name: f.tool,
        record_id: f.recordId && isUuid(f.recordId) ? f.recordId : null,
        details: {
          tool: f.tool,
          success: f.success,
          error_category: f.errorCategory ?? null,
          duration_ms: f.durationMs,
          result_count: f.resultCount ?? null,
        },
      });
  } catch (_) {
    // audit must never break the tool
  }
}