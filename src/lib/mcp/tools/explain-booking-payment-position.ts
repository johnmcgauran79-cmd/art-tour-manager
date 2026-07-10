import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";
import { assertFinancialAccess, assertBookingAccess, auditXeroCall, toolError } from "./_financial";
import { getXeroAuth } from "./_xero";
import { PAYMENT_RULES_VERSION, classifyBookingPaymentException } from "./_paymentReport";
import { summarizeBookingXero, type MappingRow } from "./_paymentXero";
import { createXeroFetchContext } from "./_paymentXero";

export default defineTool({
  name: "explain_booking_payment_position",
  title: "Explain a booking's payment position",
  description:
    "Explain one booking's payment position: the ART classification (primary + all applicable exceptions with expected amounts and source labels), the live Xero position (active invoices only; voided/deleted excluded, credit notes respected), a conservative status comparison (only 'fully paid' when ALL active linked invoices have no amount due), duplicate-link findings, and informational date differences. Never asserts a discrepancy from stale cache alone or from aggregate-total comparisons. Does NOT change any data. Restricted to admin/manager.",
  inputSchema: {
    booking_id: z.string().uuid().describe("The ART booking id (uuid)."),
    as_of_date: z.string().optional().describe("Optional as-of date (YYYY-MM-DD). Defaults to today."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ booking_id, as_of_date }, ctx) => {
    const started = Date.now();
    const fin = await assertFinancialAccess(ctx);
    if (!fin.ok) return fin.error;

    const acc = await assertBookingAccess(ctx, booking_id);
    if (!acc.ok) {
      await auditXeroCall(ctx, { tool: "explain_booking_payment_position", recordId: booking_id, success: false, errorCategory: acc.code, durationMs: Date.now() - started });
      return acc.error;
    }
    if (as_of_date && !/^\d{4}-\d{2}-\d{2}$/.test(as_of_date)) {
      return toolError("INVALID_INPUT", "as_of_date must be YYYY-MM-DD.");
    }
    const booking = acc.value;
    const asOf = as_of_date ? new Date(as_of_date + "T00:00:00Z") : new Date();
    const supabase = supabaseForUser(ctx);

    // Full classification inputs (booking created_at + tour fields).
    const { data: bk } = await supabase
      .from("bookings")
      .select("id, status, created_at, passenger_count")
      .eq("id", booking_id)
      .maybeSingle();
    let tour: any = null;
    if (booking.tour_id) {
      const { data } = await supabase
        .from("tours")
        .select("instalment_required, instalment_date, final_payment_date, deposit_required, instalment_amount")
        .eq("id", booking.tour_id)
        .maybeSingle();
      tour = data;
    }

    const cls = classifyBookingPaymentException(
      {
        id: booking_id,
        status: bk?.status ?? booking.status,
        created_at: bk?.created_at ?? new Date().toISOString(),
        passenger_count: bk?.passenger_count ?? booking.passenger_count,
      },
      tour ?? {},
      asOf,
    );

    const { data: mappings, error: mapErr } = await supabase
      .from("xero_invoice_mappings")
      .select("xero_invoice_id, xero_invoice_number, amount_due, amount_paid, total_amount, xero_status, updated_at, booking_id")
      .eq("booking_id", booking_id);
    if (mapErr) {
      await auditXeroCall(ctx, { tool: "explain_booking_payment_position", recordId: booking_id, success: false, errorCategory: "INTERNAL_ERROR", durationMs: Date.now() - started });
      return toolError("INTERNAL_ERROR");
    }

    const auth = await getXeroAuth();
    const fctx = createXeroFetchContext();
    const xero = await summarizeBookingXero(auth, booking_id, (mappings ?? []) as MappingRow[], Date.now(), fctx);

    // ---- Conservative status comparison ----
    // Only assert a status discrepancy when live verification is complete.
    const artFullyPaid = booking.status === "fully_paid";
    let statusFinding: any = {
      art_status: booking.status,
      xero_fully_paid: xero.xero_fully_paid,
      discrepancy_type: null as string | null,
      discrepancy_confirmed: false,
      review_note: null as string | null,
    };
    if (!xero.live_verification_completed) {
      statusFinding.review_note =
        "Live Xero verification incomplete; no status discrepancy asserted from cached data.";
    } else if (xero.active_invoice_count === 0) {
      statusFinding.review_note = "No active linked invoices to compare against.";
    } else if (artFullyPaid && xero.xero_fully_paid === false) {
      statusFinding.discrepancy_type = "ART_PAID_XERO_OUTSTANDING";
      statusFinding.discrepancy_confirmed = true;
      statusFinding.review_note =
        "Booking is fully_paid in ART but at least one active Xero invoice still has an amount due.";
    } else if (!artFullyPaid && xero.xero_fully_paid === true) {
      statusFinding.discrepancy_type = "ART_OUTSTANDING_XERO_PAID";
      statusFinding.discrepancy_confirmed = true;
      statusFinding.review_note =
        "All active Xero invoices are paid but the booking is not marked fully_paid in ART.";
    } else {
      statusFinding.review_note = "ART status is consistent with the live Xero position.";
    }

    // ---- Amount comparison (suppressed unless reliably matchable) ----
    // We do not compare an expected stage amount against the aggregate of all
    // invoices. A reliable match requires exactly one active invoice.
    const primary = cls.primary_exception_type;
    const expected = primary ? cls.details[primary] : null;
    let amountComparison: any = {
      discrepancy_type: "INSUFFICIENT_DATA",
      comparison_available: false,
      comparison_unavailable_reason: "No exception or no authoritative expected amount.",
    };
    if (expected && expected.expected_amount != null) {
      const active = xero.invoice_summaries.filter((s) => s.is_active);
      if (!xero.live_verification_completed) {
        amountComparison = {
          discrepancy_type: "INSUFFICIENT_DATA",
          comparison_available: false,
          comparison_unavailable_reason: "Live Xero verification incomplete; amounts not confirmed.",
        };
      } else if (active.length === 1) {
        const inv = active[0];
        const diff = Math.round((inv.total - expected.expected_amount) * 100) / 100;
        amountComparison = {
          comparison_available: true,
          expected_amount: expected.expected_amount,
          expected_amount_source: expected.expected_amount_source,
          matched_invoice_number: inv.invoice_number,
          matched_invoice_total: inv.total,
          matched_invoice_total_source: inv.data_source,
          difference: diff,
          discrepancy_type: Math.abs(diff) > 0.005 ? "PAYMENT_AMOUNT_MISMATCH" : null,
          match_basis: "exactly_one_active_invoice",
        };
      } else {
        amountComparison = {
          discrepancy_type: "INSUFFICIENT_DATA",
          comparison_available: false,
          comparison_unavailable_reason:
            active.length === 0
              ? "No active invoice to compare the expected amount against."
              : "Multiple active invoices; expected stage amount cannot be reliably matched to a single invoice.",
        };
      }
    }

    // ---- Date information (informational only) ----
    const dueDates = Array.from(
      new Set(xero.invoice_summaries.map((s) => s.due_date).filter(Boolean) as string[]),
    );
    const artExpectedDue = expected?.expected_due_date ?? null;
    const dateInfo = {
      art_expected_due_date: artExpectedDue,
      xero_invoice_due_dates: dueDates,
      dates_differ: artExpectedDue != null && dueDates.length > 0 && !dueDates.includes(artExpectedDue),
      discrepancy_confirmed: false,
      review_note:
        "ART expected dates and Xero invoice due dates may legitimately differ; no PAYMENT_DATE_MISMATCH asserted without an established rule.",
    };

    const result = {
      booking_id,
      client: booking.lead_name,
      tour: booking.tour_name,
      rules_version: PAYMENT_RULES_VERSION,
      as_of_date: asOf.toISOString().split("T")[0],
      coverage_scope: "single_booking",
      classification: {
        is_exception: cls.is_exception,
        primary_exception_type: cls.primary_exception_type,
        all_applicable_exception_types: cls.all_applicable_exception_types,
        expected_due_date: expected?.expected_due_date ?? null,
        expected_amount: expected?.expected_amount ?? null,
        expected_amount_source: expected?.expected_amount_source ?? "unavailable",
        explanation: cls.classification_explanation,
      },
      xero_position: {
        linked_invoice_numbers: xero.linked_invoice_numbers,
        active_invoice_count: xero.active_invoice_count,
        received_amount: xero.received_amount,
        received_amount_source: xero.received_amount_source,
        outstanding_amount: xero.outstanding_amount,
        outstanding_amount_source: xero.outstanding_amount_source,
        invoices: xero.invoice_summaries,
      },
      status_comparison: statusFinding,
      amount_comparison: amountComparison,
      date_information: dateInfo,
      duplicate_link: xero.duplicate_link,
      data_source: xero.data_source,
      live_verification_completed: xero.live_verification_completed,
      partial_results: xero.partial_results || !auth.ok,
      stale_warning: xero.stale_warning,
      xero_connected: auth.ok,
    };

    await auditXeroCall(ctx, { tool: "explain_booking_payment_position", recordId: booking_id, success: true, durationMs: Date.now() - started, resultCount: xero.active_invoice_count, metrics: {
      unique_invoice_ids: fctx.metrics.unique_invoice_ids,
      invoice_fetch_count: fctx.metrics.invoice_fetch_count,
      invoice_cache_hits: fctx.metrics.invoice_cache_hits,
      retry_count: fctx.metrics.retry_count,
    } });
    return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result };
  },
});