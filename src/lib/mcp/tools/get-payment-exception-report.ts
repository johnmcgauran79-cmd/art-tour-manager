import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";
import { assertFinancialAccess, assertTourAccess, auditXeroCall, toolError } from "./_financial";
import { getXeroAuth } from "./_xero";
import {
  PAYMENT_RULES_VERSION,
  classifyBookingPaymentException,
  reportTypeFilter,
  type PaymentExceptionType,
} from "./_paymentReport";
import { summarizeBookingXero, type MappingRow } from "./_paymentXero";
import { createXeroFetchContext } from "./_paymentXero";

export default defineTool({
  name: "get_payment_exception_report",
  title: "Get payment exception report",
  description:
    "Compute the ART payment-exception report for a tour using the canonical classification rules (deposit/instalment/final-balance). Returns each exception booking with its primary and all applicable exception types, expected due date, expected amount with an explicit source label, and Xero monetary values (received/outstanding) labelled by source. This RE-COMPUTES the rules; it does not fetch a previously generated report artifact. Does NOT change any data. Restricted to admin/manager.",
  inputSchema: {
    tour_id: z.string().uuid().describe("Required tour id (uuid)."),
    report_type: z
      .enum([
        "missing_deposits",
        "missing_instalments",
        "overdue_final_balances",
        "all_payment_exceptions",
      ])
      .describe("Which exception category to include."),
    as_of_date: z.string().optional().describe("Optional as-of date (YYYY-MM-DD). Defaults to today."),
    limit: z.number().int().optional().describe("Max records (default 100, max 500)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ tour_id, report_type, as_of_date, limit }, ctx) => {
    const started = Date.now();
    const fin = await assertFinancialAccess(ctx);
    if (!fin.ok) return fin.error;

    const tourAcc = await assertTourAccess(ctx, tour_id);
    if (!tourAcc.ok) {
      await auditXeroCall(ctx, { tool: "get_payment_exception_report", recordId: tour_id, success: false, errorCategory: tourAcc.code, durationMs: Date.now() - started });
      return tourAcc.error;
    }
    if (as_of_date && !/^\d{4}-\d{2}-\d{2}$/.test(as_of_date)) {
      return toolError("INVALID_INPUT", "as_of_date must be YYYY-MM-DD.");
    }
    const allowed = reportTypeFilter(report_type);
    if (!allowed) return toolError("INVALID_INPUT", "Unknown report_type.");

    const asOf = as_of_date ? new Date(as_of_date + "T00:00:00Z") : new Date();
    const capped = Math.min(Math.max(limit ?? 100, 1), 500);
    const supabase = supabaseForUser(ctx);

    // Tour classification inputs.
    const { data: tour, error: tourErr } = await supabase
      .from("tours")
      .select("id, name, instalment_required, instalment_date, final_payment_date, deposit_required, instalment_amount")
      .eq("id", tour_id)
      .maybeSingle();
    if (tourErr || !tour) {
      await auditXeroCall(ctx, { tool: "get_payment_exception_report", recordId: tour_id, success: false, errorCategory: "INTERNAL_ERROR", durationMs: Date.now() - started });
      return toolError("INTERNAL_ERROR");
    }

    const { data: bookings, error: bkErr } = await supabase
      .from("bookings")
      .select("id, status, created_at, passenger_count, group_name, tour_id, customers!bookings_lead_passenger_id_fkey(first_name, last_name)")
      .eq("tour_id", tour_id);
    if (bkErr) {
      await auditXeroCall(ctx, { tool: "get_payment_exception_report", recordId: tour_id, success: false, errorCategory: "INTERNAL_ERROR", durationMs: Date.now() - started });
      return toolError("INTERNAL_ERROR");
    }

    // Classify, keep only bookings matching the requested report_type.
    const matched: { booking: any; cls: ReturnType<typeof classifyBookingPaymentException> }[] = [];
    for (const b of bookings ?? []) {
      const cls = classifyBookingPaymentException(
        { id: b.id, status: b.status, created_at: b.created_at, passenger_count: b.passenger_count },
        tour as any,
        asOf,
      );
      if (!cls.is_exception) continue;
      const inScope = cls.all_applicable_exception_types.some((t) => allowed.includes(t));
      if (!inScope) continue;
      matched.push({ booking: b, cls });
    }

    const limited = matched.slice(0, capped);

    // Load Xero mappings for the matched bookings (money values with sources).
    const bookingIds = limited.map((m) => m.booking.id);
    const mapByBooking = new Map<string, MappingRow[]>();
    if (bookingIds.length) {
      const { data: mappings } = await supabase
        .from("xero_invoice_mappings")
        .select("xero_invoice_id, xero_invoice_number, amount_due, amount_paid, total_amount, xero_status, updated_at, booking_id")
        .in("booking_id", bookingIds);
      for (const m of mappings ?? []) {
        const arr = mapByBooking.get(m.booking_id) ?? [];
        arr.push(m as MappingRow);
        mapByBooking.set(m.booking_id, arr);
      }
    }

    const auth = await getXeroAuth();
    const now = Date.now();
    let anyPartial = false;
    // Request-scoped invoice cache shared across every booking in this report.
    const fctx = createXeroFetchContext();

    const records: any[] = [];
    for (const { booking, cls } of limited) {
      const primary = cls.primary_exception_type as PaymentExceptionType;
      const detail = cls.details[primary]!;
      const rows = mapByBooking.get(booking.id) ?? [];
      const xero = await summarizeBookingXero(auth, booking.id, rows, now, fctx);
      if (xero.partial_results) anyPartial = true;
      const cust = booking.customers;
      records.push({
        booking_id: booking.id,
        client: cust ? `${cust.first_name ?? ""} ${cust.last_name ?? ""}`.trim() : booking.group_name ?? null,
        tour_id,
        primary_exception_type: primary,
        all_applicable_exception_types: cls.all_applicable_exception_types,
        expected_payment_type: primary,
        expected_due_date: detail.expected_due_date,
        expected_amount: detail.expected_amount,
        expected_amount_source: detail.expected_amount_source,
        days_overdue: detail.days_overdue,
        booking_status: booking.status,
        passenger_count: booking.passenger_count,
        linked_invoice_numbers: xero.linked_invoice_numbers,
        received_amount: xero.received_amount,
        received_amount_source: xero.received_amount_source,
        outstanding_amount: xero.outstanding_amount,
        outstanding_amount_source: xero.outstanding_amount_source,
        data_source: xero.data_source,
        live_verification_completed: xero.live_verification_completed,
        stale_warning: xero.stale_warning,
        classification_explanation: cls.classification_explanation,
      });
    }

    const result = {
      computed_at: new Date().toISOString(),
      as_of_date: asOf.toISOString().split("T")[0],
      rules_version: PAYMENT_RULES_VERSION,
      coverage_scope: "tour_report_scoped",
      tour: { id: tour.id, name: (tour as any).name ?? null },
      report_type,
      count: records.length,
      total_matched: matched.length,
      truncated: matched.length > records.length,
      xero_connected: auth.ok,
      partial_results: anyPartial || !auth.ok,
      partial_results_reason: !auth.ok
        ? "Xero is not connected; monetary values are from cached mappings only."
        : anyPartial
          ? "Some invoices could not be refreshed from live Xero; those monetary values are from cached mappings."
          : null,
      records,
    };

    await auditXeroCall(ctx, { tool: "get_payment_exception_report", recordId: tour_id, success: true, durationMs: Date.now() - started, resultCount: records.length, metrics: {
      unique_invoice_ids: fctx.metrics.unique_invoice_ids,
      invoice_fetch_count: fctx.metrics.invoice_fetch_count,
      invoice_cache_hits: fctx.metrics.invoice_cache_hits,
      retry_count: fctx.metrics.retry_count,
    } });
    return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result };
  },
});