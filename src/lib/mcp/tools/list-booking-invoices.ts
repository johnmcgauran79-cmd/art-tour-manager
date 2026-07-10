import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";
import { assertFinancialAccess, assertBookingAccess, auditXeroCall, toolError } from "./_financial";
import { getXeroAuth, fetchInvoiceById } from "./_xero";
import { computeStaleWarning, normalizeInvoice } from "./_xeroLogic";

export default defineTool({
  name: "list_booking_invoices",
  title: "List a booking's Xero invoices",
  description:
    "List all Xero invoices linked to an ART booking, with totals, payments received, outstanding balance, invoice statuses and the ART booking payment status. Uses the canonical mapping for linkage and live Xero data for current amounts (falls back to cached mapping data with a stale warning if Xero is unavailable). Restricted to admin/manager.",
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
      await auditXeroCall(ctx, { tool: "list_booking_invoices", recordId: booking_id, success: false, errorCategory: acc.code, durationMs: Date.now() - started });
      return acc.error;
    }
    const booking = acc.value;

    // Canonical linkage: xero_invoice_mappings (user-token client, RLS applies).
    const supabase = supabaseForUser(ctx);
    const { data: mappings, error: mapErr } = await supabase
      .from("xero_invoice_mappings")
      .select("xero_invoice_id, xero_invoice_number, invoice_reference, amount_due, amount_paid, total_amount, currency_code, xero_status, last_payment_date, updated_at")
      .eq("booking_id", booking_id);
    if (mapErr) {
      await auditXeroCall(ctx, { tool: "list_booking_invoices", recordId: booking_id, success: false, errorCategory: "INTERNAL_ERROR", durationMs: Date.now() - started });
      return toolError("INTERNAL_ERROR");
    }

    // Deduplicate by xero_invoice_id.
    const uniqueMappings = Array.from(
      new Map((mappings ?? []).map((m: any) => [m.xero_invoice_id, m])).values(),
    );

    const auth = await getXeroAuth();
    const invoices: any[] = [];
    let anyLive = false;
    let anyStale = false;
    const now = Date.now();

    for (const m of uniqueMappings as any[]) {
      if (auth.ok && m.xero_invoice_id) {
        const live = await fetchInvoiceById(auth.data, m.xero_invoice_id);
        if (live.ok) {
          anyLive = true;
          const n = normalizeInvoice(live.data);
          const cachedPaid = Number(m.amount_paid) || 0;
          const stale = Math.abs(cachedPaid - n.amount_paid) > 0.005;
          if (stale) anyStale = true;
          invoices.push({
            ...n,
            linkage_type: "mapping",
            data_source: "live_xero",
            last_synced_at: m.updated_at ?? null,
            stale_warning: stale,
          });
          continue;
        }
      }
      // Fallback: cached mapping data.
      const stale = computeStaleWarning(m.updated_at, now);
      anyStale = anyStale || stale;
      invoices.push({
        xero_invoice_id: m.xero_invoice_id,
        invoice_number: m.xero_invoice_number ?? null,
        reference: m.invoice_reference ?? null,
        currency: m.currency_code ?? null,
        total: Number(m.total_amount) || 0,
        amount_paid: Number(m.amount_paid) || 0,
        amount_due: Number(m.amount_due) || 0,
        status: m.xero_status ?? null,
        linkage_type: "mapping",
        data_source: "mapping_cache",
        last_synced_at: m.updated_at ?? null,
        stale_warning: stale,
      });
    }

    const invoice_totals = invoices.reduce((s, i) => s + (Number(i.total) || 0), 0);
    const payments_received = invoices.reduce((s, i) => s + (Number(i.amount_paid) || 0), 0);
    const outstanding_balance = invoices.reduce((s, i) => s + (Number(i.amount_due) || 0), 0);

    const result = {
      booking_id,
      booking_status: booking.status,
      invoice_count: invoices.length,
      invoice_totals,
      payments_received,
      outstanding_balance,
      statuses: invoices.map((i) => i.status),
      data_source: anyLive ? (invoices.some((i) => i.data_source === "mapping_cache") ? "mixed" : "live_xero") : "mapping_cache",
      stale_warning: anyStale,
      xero_connected: auth.ok,
      invoices,
    };

    await auditXeroCall(ctx, { tool: "list_booking_invoices", recordId: booking_id, success: true, durationMs: Date.now() - started, resultCount: invoices.length });
    return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result };
  },
});