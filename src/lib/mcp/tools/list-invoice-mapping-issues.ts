import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";
import { assertFinancialAccess, assertTourAccess, auditXeroCall, toolError } from "./_financial";
import { getXeroAuth, fetchInvoiceById } from "./_xero";
import { computeStaleWarning, normalizeInvoice } from "./_xeroLogic";

// Normalise an invoice identifier for tolerant comparison: strip an "INV-"
// prefix, surrounding whitespace, and leading zeros; compare case-insensitively.
function normRef(v: string | null | undefined): string {
  if (!v) return "";
  return v
    .trim()
    .toUpperCase()
    .replace(/^INV[-\s]*/i, "")
    .replace(/^0+/, "");
}

const DEAD_STATUSES = new Set(["DELETED", "VOIDED"]);

export default defineTool({
  name: "list_invoice_mapping_issues",
  title: "List invoice mapping issues",
  description:
    "Audit bookings whose linked Xero invoice is unhealthy: the mapped invoice is DELETED or VOIDED in live Xero, or the mapped invoice number disagrees with the booking's invoice_reference field. Each mapping is refreshed against live Xero (falling back to the cached mapping with a stale_warning when Xero is unavailable). Optionally scope to a tour. Read-only; changes nothing. Restricted to admin/manager.",
  inputSchema: {
    tour_id: z.string().uuid().optional().describe("Optional tour id to scope the audit."),
    issue_types: z
      .array(z.enum(["deleted_or_voided", "reference_mismatch"]))
      .optional()
      .describe("Which issue categories to include. Defaults to both."),
    limit: z.number().int().optional().describe("Max mappings to inspect (default 300, max 500)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ tour_id, issue_types, limit }, ctx) => {
    const started = Date.now();
    const fin = await assertFinancialAccess(ctx);
    if (!fin.ok) return fin.error;

    if (tour_id) {
      const tourAcc = await assertTourAccess(ctx, tour_id);
      if (!tourAcc.ok) {
        await auditXeroCall(ctx, { tool: "list_invoice_mapping_issues", recordId: tour_id, success: false, errorCategory: tourAcc.code, durationMs: Date.now() - started });
        return tourAcc.error;
      }
    }

    const wantDeleted = !issue_types || issue_types.includes("deleted_or_voided");
    const wantMismatch = !issue_types || issue_types.includes("reference_mismatch");
    const capped = Math.min(Math.max(limit ?? 300, 1), 500);
    const supabase = supabaseForUser(ctx);

    let query = supabase
      .from("xero_invoice_mappings")
      .select("xero_invoice_id, xero_invoice_number, xero_status, updated_at, booking_id");

    if (tour_id) {
      const { data: tourBookings } = await supabase
        .from("bookings")
        .select("id")
        .eq("tour_id", tour_id);
      const ids = (tourBookings ?? []).map((b: any) => b.id);
      if (ids.length === 0) {
        const empty = { count: 0, issues: [], data_source: "mapping_cache", partial_results: false };
        await auditXeroCall(ctx, { tool: "list_invoice_mapping_issues", recordId: tour_id, success: true, durationMs: Date.now() - started, resultCount: 0 });
        return { content: [{ type: "text", text: JSON.stringify(empty) }], structuredContent: empty };
      }
      query = query.in("booking_id", ids);
    }

    const { data: mappings, error: mapErr } = await query.limit(capped);
    if (mapErr) {
      await auditXeroCall(ctx, { tool: "list_invoice_mapping_issues", recordId: tour_id ?? null, success: false, errorCategory: "INTERNAL_ERROR", durationMs: Date.now() - started });
      return toolError("INTERNAL_ERROR");
    }

    const truncated = (mappings ?? []).length === capped;

    // Load booking context (invoice_reference + client + tour name).
    const bookingIds = Array.from(new Set((mappings ?? []).map((m: any) => m.booking_id).filter(Boolean)));
    const bookingMap = new Map<string, any>();
    if (bookingIds.length) {
      const { data: bookings } = await supabase
        .from("bookings")
        .select("id, group_name, tour_id, invoice_reference, tours!bookings_tour_id_fkey(name), customers!bookings_lead_passenger_id_fkey(first_name, last_name)")
        .in("id", bookingIds);
      for (const b of bookings ?? []) bookingMap.set(b.id, b);
    }

    const auth = await getXeroAuth();
    const now = Date.now();
    let partial = false;
    let anyLive = false;
    const rows: any[] = [];

    for (const m of mappings ?? []) {
      const b = m.booking_id ? bookingMap.get(m.booking_id) : null;
      let liveStatus: string | null = null;
      let dataSource: "live_xero" | "mapping_cache" = "mapping_cache";
      let stale = computeStaleWarning(m.updated_at, now);

      if (auth.ok && m.xero_invoice_id) {
        const live = await fetchInvoiceById(auth.data, m.xero_invoice_id);
        if (live.ok) {
          anyLive = true;
          liveStatus = normalizeInvoice(live.data).status;
          dataSource = "live_xero";
          stale = false;
        } else if (live.code === "XERO_INVOICE_NOT_FOUND") {
          // Invoice no longer retrievable — treat as effectively deleted.
          anyLive = true;
          liveStatus = "NOT_FOUND";
          dataSource = "live_xero";
          stale = false;
        } else {
          partial = true;
        }
      } else if (!auth.ok) {
        partial = true;
      }

      const effectiveStatus = liveStatus ?? m.xero_status ?? null;
      const isDead =
        (liveStatus != null && (DEAD_STATUSES.has(liveStatus) || liveStatus === "NOT_FOUND")) ||
        (liveStatus == null && !!m.xero_status && DEAD_STATUSES.has(m.xero_status));

      const bookingRef = b?.invoice_reference ?? null;
      const hasBothRefs = !!bookingRef && !!m.xero_invoice_number;
      const isMismatch = hasBothRefs && normRef(bookingRef) !== normRef(m.xero_invoice_number);

      const issues: string[] = [];
      if (wantDeleted && isDead) issues.push("deleted_or_voided");
      if (wantMismatch && isMismatch) issues.push("reference_mismatch");
      if (issues.length === 0) continue;

      const cust = b?.customers;
      rows.push({
        booking_id: m.booking_id ?? null,
        primary_client: cust ? `${cust.first_name ?? ""} ${cust.last_name ?? ""}`.trim() : b?.group_name ?? null,
        tour: b?.tours?.name ?? null,
        mapped_invoice_number: m.xero_invoice_number ?? null,
        mapped_xero_invoice_id: m.xero_invoice_id ?? null,
        mapped_invoice_status: effectiveStatus,
        booking_invoice_reference: bookingRef,
        issues,
        data_source: dataSource,
        stale_warning: stale,
      });
    }

    const result = {
      count: rows.length,
      truncated,
      truncation_note: truncated
        ? `Only the first ${capped} mappings were inspected — raise 'limit' (max 500) or scope to a tour to audit the rest.`
        : null,
      issue_types_checked: [
        ...(wantDeleted ? ["deleted_or_voided"] : []),
        ...(wantMismatch ? ["reference_mismatch"] : []),
      ],
      data_source: anyLive ? (rows.some((r) => r.data_source === "mapping_cache") ? "mixed" : "live_xero") : "mapping_cache",
      xero_connected: auth.ok,
      partial_results: partial,
      partial_results_reason: partial
        ? (auth.ok ? "Some invoices could not be refreshed from live Xero; their status is from the cached mapping." : "Xero is not connected; statuses are from cached mappings only.")
        : null,
      issues: rows,
    };

    await auditXeroCall(ctx, { tool: "list_invoice_mapping_issues", recordId: tour_id ?? null, success: true, durationMs: Date.now() - started, resultCount: rows.length });
    return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result };
  },
});
