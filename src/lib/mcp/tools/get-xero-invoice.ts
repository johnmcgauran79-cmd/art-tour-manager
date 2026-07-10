import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";
import { assertFinancialAccess, auditXeroCall, toolError } from "./_financial";
import { getXeroAuth, fetchInvoiceById, fetchInvoiceByNumber } from "./_xero";
import { isUuid, normalizeInvoice, normalizeLineItems, normalizePayments } from "./_xeroLogic";

export default defineTool({
  name: "get_xero_invoice",
  title: "Get a Xero invoice",
  description:
    "Fetch full LIVE detail for a single Xero invoice by invoice_id (Xero InvoiceID/GUID) or invoice_number: summary, line items, payments, contact and reference, plus the linked ART booking and its payment status. Restricted to admin/manager.",
  inputSchema: {
    invoice_id: z.string().optional().describe("Xero InvoiceID (GUID)."),
    invoice_number: z.string().optional().describe("Xero invoice number, e.g. INV-1234."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ invoice_id, invoice_number }, ctx) => {
    const started = Date.now();
    const fin = await assertFinancialAccess(ctx);
    if (!fin.ok) return fin.error;

    if ((!invoice_id && !invoice_number) || (invoice_id && invoice_number)) {
      return toolError("INVALID_INPUT", "Provide exactly one of invoice_id or invoice_number.");
    }
    if (invoice_id && !isUuid(invoice_id)) {
      return toolError("INVALID_INPUT", "invoice_id must be a Xero GUID.");
    }

    const auth = await getXeroAuth();
    if (!auth.ok) {
      await auditXeroCall(ctx, { tool: "get_xero_invoice", invoiceRef: invoice_id ?? invoice_number, success: false, errorCategory: auth.code, durationMs: Date.now() - started });
      return toolError(auth.code);
    }

    const res = invoice_id
      ? await fetchInvoiceById(auth.data, invoice_id)
      : await fetchInvoiceByNumber(auth.data, invoice_number!);
    if (!res.ok) {
      await auditXeroCall(ctx, { tool: "get_xero_invoice", invoiceRef: invoice_id ?? invoice_number, success: false, errorCategory: res.code, durationMs: Date.now() - started });
      return toolError(res.code);
    }

    const summary = normalizeInvoice(res.data);
    const line_items = normalizeLineItems(res.data);
    const payments = normalizePayments(res.data);

    // Resolve linked booking. Canonical: xero_invoice_mappings by InvoiceID.
    const supabase = supabaseForUser(ctx);
    let linkage_type: "mapping" | "reference_match" | "unlinked" = "unlinked";
    let booking: any = null;

    const { data: mapRow } = await supabase
      .from("xero_invoice_mappings")
      .select("booking_id")
      .eq("xero_invoice_id", summary.xero_invoice_id)
      .maybeSingle();

    if (mapRow?.booking_id) {
      linkage_type = "mapping";
      const { data: b } = await supabase
        .from("bookings")
        .select("id, status, tour_id, group_name")
        .eq("id", mapRow.booking_id)
        .maybeSingle();
      booking = b ?? null;
    } else if (summary.invoice_number || summary.reference) {
      // Fallback: inferred match on booking.invoice_reference (not confirmed).
      const candidates = [summary.invoice_number, summary.reference].filter(Boolean) as string[];
      for (const c of candidates) {
        const { data: b } = await supabase
          .from("bookings")
          .select("id, status, tour_id, group_name, invoice_reference")
          .ilike("invoice_reference", `%${c.replace(/^INV-/i, "")}%`)
          .limit(1)
          .maybeSingle();
        if (b) {
          linkage_type = "reference_match";
          booking = b;
          break;
        }
      }
    }

    const result = {
      data_source: "live_xero" as const,
      summary,
      line_items,
      payments,
      contact: { contact_id: summary.contact_id, name: summary.contact_name },
      reference: summary.reference,
      linkage_type,
      booking: booking
        ? { id: booking.id, status: booking.status, tour_id: booking.tour_id, group_name: booking.group_name }
        : null,
      booking_payment_status: booking?.status ?? null,
    };

    await auditXeroCall(ctx, { tool: "get_xero_invoice", recordId: booking?.id ?? null, invoiceRef: summary.invoice_number ?? summary.xero_invoice_id, success: true, durationMs: Date.now() - started, resultCount: 1 });
    return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result };
  },
});