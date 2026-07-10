import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";
import { assertFinancialAccess, assertBookingAccess, auditXeroCall, toolError } from "./_financial";
import { getXeroAuth, fetchInvoiceById } from "./_xero";
import {
  computeStaleWarning,
  mapXeroStatusToBookingStatus,
  normalizeInvoice,
  pickLowestProposedStatus,
} from "./_xeroLogic";

export default defineTool({
  name: "get_booking_payment_summary",
  title: "Get a booking's payment summary",
  description:
    "Summarise a booking's financial position from its linked Xero invoices: total invoiced, total paid, total outstanding, current ART status and the expected status inferred from Xero payments (with a discrepancy flag). booking_contract_total is returned as null unless an authoritative stored total exists; a mismatch is never asserted without one. Restricted to admin/manager.",
  inputSchema: {
    booking_id: z.string().uuid().describe("The ART booking id (uuid)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ booking_id }, ctx) => {
    const started = Date.now();
    const fin = await assertFinancialAccess(ctx);
    if (!fin.ok) return fin.error;

    const acc = await assertBookingAccess(ctx, booking_id);
    if (!acc.ok) {
      await auditXeroCall(ctx, { tool: "get_booking_payment_summary", recordId: booking_id, success: false, errorCategory: acc.code, durationMs: Date.now() - started });
      return acc.error;
    }
    const booking = acc.value;

    const supabase = supabaseForUser(ctx);
    const { data: mappings, error: mapErr } = await supabase
      .from("xero_invoice_mappings")
      .select("xero_invoice_id, xero_invoice_number, amount_due, amount_paid, total_amount, xero_status, updated_at")
      .eq("booking_id", booking_id);
    if (mapErr) {
      await auditXeroCall(ctx, { tool: "get_booking_payment_summary", recordId: booking_id, success: false, errorCategory: "INTERNAL_ERROR", durationMs: Date.now() - started });
      return toolError("INTERNAL_ERROR");
    }

    const unique = Array.from(
      new Map((mappings ?? []).map((m: any) => [m.xero_invoice_id, m])).values(),
    ) as any[];

    const auth = await getXeroAuth();
    let total_invoiced = 0;
    let total_paid = 0;
    let total_outstanding = 0;
    let credit_notes = 0;
    let anyLive = false;
    let anyStale = false;
    const now = Date.now();
    const proposals: (string | null)[] = [];

    for (const m of unique) {
      let total = Number(m.total_amount) || 0;
      let paid = Number(m.amount_paid) || 0;
      let due = Number(m.amount_due) || 0;
      let xeroStatus = m.xero_status || "";
      let cn = 0;

      if (auth.ok && m.xero_invoice_id) {
        const live = await fetchInvoiceById(auth.data, m.xero_invoice_id);
        if (live.ok) {
          anyLive = true;
          const n = normalizeInvoice(live.data);
          if (Math.abs((Number(m.amount_paid) || 0) - n.amount_paid) > 0.005) anyStale = true;
          total = n.total;
          paid = n.amount_paid;
          due = n.amount_due;
          xeroStatus = n.status || "";
          cn = n.credit_notes_applied;
        } else {
          anyStale = anyStale || computeStaleWarning(m.updated_at, now);
        }
      } else {
        anyStale = anyStale || computeStaleWarning(m.updated_at, now);
      }

      total_invoiced += total;
      total_paid += paid;
      total_outstanding += due;
      credit_notes += cn;

      proposals.push(
        mapXeroStatusToBookingStatus(
          xeroStatus,
          due,
          paid,
          booking.instalment_required,
          booking.status,
          booking.passenger_count ?? 1,
          booking.deposit_required,
        ),
      );
    }

    const proposed = pickLowestProposedStatus(proposals);
    const expected_status = proposed ?? booking.status;
    const discrepancy = !!proposed && proposed !== booking.status;

    const result = {
      booking_id,
      current_status: booking.status,
      expected_status,
      discrepancy,
      discrepancy_explanation: discrepancy
        ? `Xero payments indicate the booking should be "${expected_status}" but it is currently "${booking.status}".`
        : null,
      booking_contract_total: null,
      booking_price_source: unique.length > 0 ? "invoice_total_only" : "unavailable",
      total_invoiced,
      total_paid,
      total_outstanding,
      credit_notes: auth.ok ? credit_notes : null,
      invoice_count: unique.length,
      data_source: anyLive ? (auth.ok && unique.length ? "live_xero" : "mapping_cache") : "mapping_cache",
      stale_warning: anyStale,
      xero_connected: auth.ok,
    };

    await auditXeroCall(ctx, { tool: "get_booking_payment_summary", recordId: booking_id, success: true, durationMs: Date.now() - started, resultCount: unique.length });
    return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result };
  },
});