import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";
import { assertFinancialAccess, assertTourAccess, auditXeroCall, toolError } from "./_financial";
import { getXeroAuth } from "./_xero";
import {
  PAYMENT_RULES_VERSION,
  classifyBookingPaymentException,
  reportTypeFilter,
} from "./_paymentReport";
import {
  summarizeBookingXero,
  detectCrossBookingDuplicates,
  createXeroFetchContext,
  type MappingRow,
} from "./_paymentXero";

export default defineTool({
  name: "compare_art_payment_report_to_xero",
  title: "Compare ART payment exceptions to Xero",
  description:
    "For the bookings in a tour's ART payment-exception report, compare the ART position to the live Xero position and surface discrepancies (e.g. ART outstanding but Xero paid, and vice versa) using conservative rules. Scope is TOUR/REPORT SCOPED — it does NOT perform organisation-wide orphan-invoice detection; XERO_INVOICE_NOT_LINKED_TO_BOOKING is only reported for invoices encountered within this scope. Duplicate links, stale cache and incomplete live verification are flagged and never treated as confirmed financial discrepancies. Does NOT change any data. Restricted to admin/manager.",
  inputSchema: {
    tour_id: z.string().uuid().describe("Required tour id (uuid)."),
    report_type: z
      .enum([
        "missing_deposits",
        "missing_instalments",
        "overdue_final_balances",
        "all_payment_exceptions",
      ])
      .optional()
      .describe("Which exception category to compare (default all_payment_exceptions)."),
    as_of_date: z.string().optional().describe("Optional as-of date (YYYY-MM-DD). Defaults to today."),
    limit: z.number().int().optional().describe("Max bookings to compare (default 100, max 500)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ tour_id, report_type, as_of_date, limit }, ctx) => {
    const started = Date.now();
    const fin = await assertFinancialAccess(ctx);
    if (!fin.ok) return fin.error;

    const tourAcc = await assertTourAccess(ctx, tour_id);
    if (!tourAcc.ok) {
      await auditXeroCall(ctx, { tool: "compare_art_payment_report_to_xero", recordId: tour_id, success: false, errorCategory: tourAcc.code, durationMs: Date.now() - started });
      return tourAcc.error;
    }
    if (as_of_date && !/^\d{4}-\d{2}-\d{2}$/.test(as_of_date)) {
      return toolError("INVALID_INPUT", "as_of_date must be YYYY-MM-DD.");
    }
    const type = report_type ?? "all_payment_exceptions";
    const allowed = reportTypeFilter(type)!;
    const asOf = as_of_date ? new Date(as_of_date + "T00:00:00Z") : new Date();
    const capped = Math.min(Math.max(limit ?? 100, 1), 500);
    const supabase = supabaseForUser(ctx);

    const { data: tour, error: tourErr } = await supabase
      .from("tours")
      .select("id, name, instalment_required, instalment_date, final_payment_date, deposit_required, instalment_amount")
      .eq("id", tour_id)
      .maybeSingle();
    if (tourErr || !tour) {
      await auditXeroCall(ctx, { tool: "compare_art_payment_report_to_xero", recordId: tour_id, success: false, errorCategory: "INTERNAL_ERROR", durationMs: Date.now() - started });
      return toolError("INTERNAL_ERROR");
    }

    const { data: bookings, error: bkErr } = await supabase
      .from("bookings")
      .select("id, status, created_at, passenger_count, group_name, customers!bookings_lead_passenger_id_fkey(first_name, last_name)")
      .eq("tour_id", tour_id);
    if (bkErr) {
      await auditXeroCall(ctx, { tool: "compare_art_payment_report_to_xero", recordId: tour_id, success: false, errorCategory: "INTERNAL_ERROR", durationMs: Date.now() - started });
      return toolError("INTERNAL_ERROR");
    }

    const matched = (bookings ?? [])
      .map((b: any) => ({
        booking: b,
        cls: classifyBookingPaymentException(
          { id: b.id, status: b.status, created_at: b.created_at, passenger_count: b.passenger_count },
          tour as any,
          asOf,
        ),
      }))
      .filter((m) => m.cls.is_exception && m.cls.all_applicable_exception_types.some((t) => allowed.includes(t)))
      .slice(0, capped);

    const bookingIds = matched.map((m) => m.booking.id);
    const mapByBooking = new Map<string, MappingRow[]>();
    let allMappingRows: MappingRow[] = [];
    if (bookingIds.length) {
      const { data: mappings } = await supabase
        .from("xero_invoice_mappings")
        .select("xero_invoice_id, xero_invoice_number, amount_due, amount_paid, total_amount, xero_status, updated_at, booking_id")
        .in("booking_id", bookingIds);
      allMappingRows = (mappings ?? []) as MappingRow[];
      for (const m of allMappingRows) {
        const arr = mapByBooking.get(m.booking_id!) ?? [];
        arr.push(m);
        mapByBooking.set(m.booking_id!, arr);
      }
    }

    // Cross-booking duplicate detection within this scope only.
    const crossDuplicates = detectCrossBookingDuplicates(allMappingRows);

    const auth = await getXeroAuth();
    const now = Date.now();
    let anyPartial = false;
    // One request-scoped invoice cache for the whole invocation: a shared
    // InvoiceID across bookings is fetched from Xero only once.
    const fctx = createXeroFetchContext();

    const comparisons: any[] = [];
    for (const { booking, cls } of matched) {
      const rows = mapByBooking.get(booking.id) ?? [];
      const xero = await summarizeBookingXero(auth, booking.id, rows, now, fctx);
      if (xero.partial_results) anyPartial = true;

      const discrepancies: any[] = [];

      // Status-level discrepancies (only when live verification complete).
      if (xero.live_verification_completed && xero.active_invoice_count > 0) {
        const artFullyPaid = booking.status === "fully_paid";
        if (artFullyPaid && xero.xero_fully_paid === false) {
          discrepancies.push({ type: "ART_PAID_XERO_OUTSTANDING", confidence: "confirmed" });
        } else if (!artFullyPaid && xero.xero_fully_paid === true) {
          discrepancies.push({ type: "ART_OUTSTANDING_XERO_PAID", confidence: "confirmed" });
        }
      }

      // Expected-but-not-invoiced: an exception exists but no linked invoice.
      if (xero.linked_invoice_numbers.length === 0) {
        discrepancies.push({
          type: "EXPECTED_PAYMENT_NOT_INVOICED",
          confidence: "inferred",
          note: `Booking has a ${cls.primary_exception_type} exception but no linked Xero invoice was found.`,
        });
      }

      // Per-booking duplicate link.
      if (xero.duplicate_link) {
        discrepancies.push({ type: "DUPLICATE_INVOICE_LINK", confidence: "confirmed", detail: xero.duplicate_link });
      }

      // Stale/partial data-quality warning (never a confirmed discrepancy).
      if (!xero.live_verification_completed && xero.linked_invoice_numbers.length > 0) {
        discrepancies.push({
          type: "STALE_XERO_MAPPING",
          confidence: "data_quality_warning",
          note: "Live Xero verification incomplete; comparison used cached mapping data.",
        });
      }

      const cust = booking.customers;
      comparisons.push({
        booking_id: booking.id,
        client: cust ? `${cust.first_name ?? ""} ${cust.last_name ?? ""}`.trim() : booking.group_name ?? null,
        booking_status: booking.status,
        primary_exception_type: cls.primary_exception_type,
        all_applicable_exception_types: cls.all_applicable_exception_types,
        linked_invoice_numbers: xero.linked_invoice_numbers,
        received_amount: xero.received_amount,
        received_amount_source: xero.received_amount_source,
        outstanding_amount: xero.outstanding_amount,
        outstanding_amount_source: xero.outstanding_amount_source,
        xero_fully_paid: xero.xero_fully_paid,
        data_source: xero.data_source,
        live_verification_completed: xero.live_verification_completed,
        stale_warning: xero.stale_warning,
        discrepancies,
      });
    }

    const result = {
      computed_at: new Date().toISOString(),
      as_of_date: asOf.toISOString().split("T")[0],
      rules_version: PAYMENT_RULES_VERSION,
      coverage_scope: "tour_report_scoped",
      scope_note:
        "Comparison is limited to bookings appearing in this tour's payment-exception report. Organisation-wide orphan-invoice detection is out of scope.",
      tour: { id: tour.id, name: (tour as any).name ?? null },
      report_type: type,
      count: comparisons.length,
      cross_booking_duplicates: crossDuplicates,
      xero_connected: auth.ok,
      partial_results: anyPartial || !auth.ok,
      live_verification_completed: auth.ok && !anyPartial,
      partial_results_reason: !auth.ok
        ? "Xero is not connected; comparison used cached mappings only and no high-confidence discrepancy is asserted."
        : anyPartial
          ? "Some invoices could not be refreshed from live Xero; affected comparisons are marked as data-quality warnings."
          : null,
      comparisons,
    };

    await auditXeroCall(ctx, { tool: "compare_art_payment_report_to_xero", recordId: tour_id, success: true, durationMs: Date.now() - started, resultCount: comparisons.length, metrics: {
      unique_invoice_ids: fctx.metrics.unique_invoice_ids,
      invoice_fetch_count: fctx.metrics.invoice_fetch_count,
      invoice_cache_hits: fctx.metrics.invoice_cache_hits,
      retry_count: fctx.metrics.retry_count,
    } });
    return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result };
  },
});