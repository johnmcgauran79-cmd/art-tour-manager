import type { ToolContext } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../tools/_supabase";
import type { WordpressClientError } from "./_client";

export interface WordpressAuditRecord {
  source: "mcp" | "ui" | "edge";
  action: string;
  wordpress_object_type?: string | null;
  wordpress_object_id?: number | null;
  request_summary?: Record<string, unknown> | null;
  result_status: "success" | "error";
  response_code?: number | null;
  error_message?: string | null;
  correlation_id?: string;
  dry_run?: boolean;
  before_snapshot?: unknown;
  after_snapshot?: unknown;
}

export async function auditWordpressCall(
  ctx: ToolContext,
  rec: WordpressAuditRecord,
): Promise<void> {
  try {
    await supabaseForUser(ctx)
      .from("wordpress_integration_audit_logs")
      .insert({
        user_id: ctx.getUserId(),
        source: rec.source,
        action: rec.action,
        wordpress_object_type: rec.wordpress_object_type ?? null,
        wordpress_object_id: rec.wordpress_object_id ?? null,
        request_summary: rec.request_summary ?? null,
        result_status: rec.result_status,
        response_code: rec.response_code ?? null,
        error_message: rec.error_message ?? null,
        dry_run: rec.dry_run ?? false,
        before_snapshot: rec.before_snapshot ?? null,
        after_snapshot: rec.after_snapshot ?? null,
      });
  } catch {
    // audit failures must never break the tool
  }
}

export function categoriseError(err: unknown): {
  message: string;
  status: number;
  category: string;
} {
  const e = err as WordpressClientError | Error;
  const anyE = e as { status?: number; category?: string; message?: string };
  return {
    message: anyE?.message ?? "Unknown WordPress error",
    status: anyE?.status ?? 500,
    category: anyE?.category ?? "unknown",
  };
}