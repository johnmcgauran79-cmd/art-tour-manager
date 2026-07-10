import type { ToolContext } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "./_supabase";
import {
  isFinancialRole,
  isUuid,
  safeErrorMessage,
  type XeroErrorCode,
} from "./_xeroLogic";

// A tool error result shaped for MCP. Never contains tokens/secrets/payloads.
export interface ToolErrorResult {
  content: { type: "text"; text: string }[];
  structuredContent: { error: { code: XeroErrorCode; message: string } };
  isError: true;
}

export function toolError(code: XeroErrorCode, detail?: string): ToolErrorResult {
  const message = safeErrorMessage(code, detail);
  return {
    content: [{ type: "text", text: `${code}: ${message}` }],
    structuredContent: { error: { code, message } },
    isError: true,
  };
}

// NOTE: this project compiles with strictNullChecks:false, so discriminated
// unions do not narrow. Use a single shape with optional fields instead.
export interface Guard<T> {
  ok: boolean;
  value?: T;
  error?: ToolErrorResult;
  code?: XeroErrorCode;
}

/**
 * Verify the caller is authenticated AND holds an approved financial-access
 * role (admin/manager). Uses the USER-TOKEN client so RLS/identity is enforced;
 * never uses service-role to make this decision.
 */
export async function assertFinancialAccess(
  ctx: ToolContext,
): Promise<Guard<{ roles: string[] }>> {
  if (!ctx.isAuthenticated()) {
    return { ok: false, code: "UNAUTHENTICATED", error: toolError("UNAUTHENTICATED") };
  }
  const supabase = supabaseForUser(ctx);
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.getUserId());

  if (error) {
    return { ok: false, code: "INTERNAL_ERROR", error: toolError("INTERNAL_ERROR") };
  }
  const roles = (data ?? []).map((r: { role: string }) => r.role);
  if (!isFinancialRole(roles)) {
    return {
      ok: false,
      code: "FINANCIAL_ACCESS_DENIED",
      error: toolError("FINANCIAL_ACCESS_DENIED"),
    };
  }
  return { ok: true, value: { roles } };
}

export interface BookingContext {
  id: string;
  status: string | null;
  tour_id: string | null;
  invoice_reference: string | null;
  passenger_count: number | null;
  group_name: string | null;
  lead_passenger_id: string | null;
  lead_name: string | null;
  tour_name: string | null;
  instalment_required: boolean;
  deposit_required: number;
}

/**
 * Load a booking through the USER-TOKEN client so booking-level RLS is applied
 * on top of the financial-role check. Returns BOOKING_ACCESS_DENIED when the
 * row is not visible to the caller, INVALID_INPUT for a malformed id.
 */
export async function assertBookingAccess(
  ctx: ToolContext,
  bookingId: string,
): Promise<Guard<BookingContext>> {
  if (!isUuid(bookingId)) {
    return { ok: false, code: "INVALID_INPUT", error: toolError("INVALID_INPUT", "booking_id must be a UUID.") };
  }
  const supabase = supabaseForUser(ctx);
  const { data, error } = await supabase
    .from("bookings")
    .select(
      "id, status, tour_id, invoice_reference, passenger_count, group_name, lead_passenger_id, tours!bookings_tour_id_fkey(name, instalment_required, deposit_required), customers!bookings_lead_passenger_id_fkey(first_name, last_name)",
    )
    .eq("id", bookingId)
    .maybeSingle();

  if (error) {
    return { ok: false, code: "INTERNAL_ERROR", error: toolError("INTERNAL_ERROR") };
  }
  if (!data) {
    return { ok: false, code: "BOOKING_ACCESS_DENIED", error: toolError("BOOKING_ACCESS_DENIED") };
  }
  const tour = (data as any).tours;
  const cust = (data as any).customers;
  return {
    ok: true,
    value: {
      id: data.id,
      status: (data as any).status ?? null,
      tour_id: (data as any).tour_id ?? null,
      invoice_reference: (data as any).invoice_reference ?? null,
      passenger_count: (data as any).passenger_count ?? null,
      group_name: (data as any).group_name ?? null,
      lead_passenger_id: (data as any).lead_passenger_id ?? null,
      lead_name: cust ? `${cust.first_name ?? ""} ${cust.last_name ?? ""}`.trim() : null,
      tour_name: tour?.name ?? null,
      instalment_required: !!tour?.instalment_required,
      deposit_required: Number(tour?.deposit_required) || 0,
    },
  };
}

/** Verify tour visibility through the user-token client (RLS enforced). */
export async function assertTourAccess(
  ctx: ToolContext,
  tourId: string,
): Promise<Guard<{ id: string; name: string | null }>> {
  if (!isUuid(tourId)) {
    return { ok: false, code: "INVALID_INPUT", error: toolError("INVALID_INPUT", "tour_id must be a UUID.") };
  }
  const supabase = supabaseForUser(ctx);
  const { data, error } = await supabase
    .from("tours")
    .select("id, name")
    .eq("id", tourId)
    .maybeSingle();
  if (error) {
    return { ok: false, code: "INTERNAL_ERROR", error: toolError("INTERNAL_ERROR") };
  }
  if (!data) {
    return { ok: false, code: "TOUR_ACCESS_DENIED", error: toolError("TOUR_ACCESS_DENIED") };
  }
  return { ok: true, value: { id: data.id, name: (data as any).name ?? null } };
}

export interface AuditFields {
  tool: string;
  recordId?: string | null; // booking or tour uuid
  invoiceRef?: string | null; // invoice number or id (metadata only)
  success: boolean;
  errorCategory?: string | null;
  durationMs: number;
  resultCount?: number | null;
}

/**
 * Write a minimal audit record via the user-token client. Records ONLY the
 * whitelisted fields — never invoice payloads, PII, tokens or headers.
 * Failures here never surface to the caller.
 */
export async function auditXeroCall(ctx: ToolContext, f: AuditFields): Promise<void> {
  try {
    await supabaseForUser(ctx)
      .from("audit_log")
      .insert({
        user_id: ctx.getUserId(),
        operation_type: f.success ? "mcp_xero_read" : "mcp_xero_read_error",
        table_name: f.tool,
        record_id: f.recordId && isUuid(f.recordId) ? f.recordId : null,
        details: {
          tool: f.tool,
          invoice: f.invoiceRef ?? null,
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