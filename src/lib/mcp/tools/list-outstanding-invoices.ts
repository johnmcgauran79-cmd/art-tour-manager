import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";
import { assertFinancialAccess, assertTourAccess, auditXeroCall, toolError } from "./_financial";
import { getXeroAuth, fetchInvoiceById } from "./_xero";
import { computeStaleWarning, daysOverdue, normalizeInvoice } from "./_xeroLogic";

export default defineTool({
  name: "list_outstanding_invoices",
  title: "List outstanding invoices",
  description:
    "List bookings with outstanding Xero balances (amount due > 0), optionally scoped to a tour. Returns booking, primary client, tour, invoice number, due date, total, amount paid, amount due and days overdue. Candidate invoices come from the canonical mapping cache; each is refreshed against live Xero for the current due date and amounts. Restricted to admin/manager.",
  inputSchema: {
    tour_id: z.string().uuid().optional().describe("Optional tour id to scope results."),
    overdue_only: z.boolean().optional().describe("Only include invoices past their due date."),
    due_before: z.string().optional().describe("Only include invoices due before this date (YYYY-MM-DD)."),
    limit: z.number().int().optional().describe("Max invoices to inspect (default 25, max 100)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ tour_id, overdue_only, due_before, limit }, ctx) => {
    const started = Date.now();
    const fin = await assertFinancialAccess(ctx);
    if (!fin.ok) return fin.error;

    if (tour_id) {
      const tourAcc = await assertTourAccess(ctx, tour_id);
      if (!tourAcc.ok) {
        await auditXeroCall(ctx, { tool: "list_outstanding_invoices", recordId: tour_id, success: false, errorCategory: tourAcc.code, durationMs: Date.now() - started });
        return tourAcc.error;
      }
    }
    if (due_before && !/^\d{4}-\d{2}-\d{2}$/.test(due_before)) {
      return toolError("INVALID_INPUT", "due_before must be YYYY-MM-DD.");
    }

    const capped = Math.min(Math.max(limit ?? 25, 1), 100);
    const supabase = supabaseForUser(ctx);

    // Candidate outstanding invoices from the canonical mapping cache (RLS applied).
    let query = supabase
      .from("xero_invoice_mappings")
      .select("xero_invoice_id, xero_invoice_number, amount_due, amount_paid, total_amount, currency_code, xero_status, updated_at, booking_id")
      .gt("amount_due", 0);

    // Scope by tour by first resolving bookings for the tour.
    if (tour_id) {
      const { data: tourBookings } = await supabase
        .from("bookings")
        .select("id")
        .eq("tour_id", tour_id);
      const ids = (tourBookings ?? []).map((b: any) => b.id);
      if (ids.length === 0) {
        const empty = { count: 0, invoices: [], data_source: "mapping_cache", partial_results: false };
        await auditXeroCall(ctx, { tool: "list_outstanding_invoices", recordId: tour_id, success: true, durationMs: Date.now() - started, resultCount: 0 });
        return { content: [{ type: "text", text: JSON.stringify(empty) }], structuredContent: empty };
      }
      query = query.in("booking_id", ids);
    }

    const { data: mappings, error: mapErr } = await query.limit(capped);
    if (mapErr) {
      await auditXeroCall(ctx, { tool: "list_outstanding_invoices", recordId: tour_id ?? null, success: false, errorCategory: "INTERNAL_ERROR", durationMs: Date.now() - started });
      return toolError("INTERNAL_ERROR");
    }

    const unique = Array.from(
      new Map((mappings ?? []).map((m: any) => [m.xero_invoice_id, m])).values(),
    ) as any[];

    // Load booking context (client + tour name) via user-token client.
    const bookingIds = Array.from(new Set(unique.map((m) => m.booking_id).filter(Boolean)));
    const bookingMap = new Map<string, any>();
    if (bookingIds.length) {
      const { data: bookings } = await supabase
        .from("bookings")
        .select("id, group_name, tour_id, tours!bookings_tour_id_fkey(name), customers!bookings_lead_passenger_id_fkey(first_name, last_name)")
        .in("id", bookingIds);
      for (const b of bookings ?? []) bookingMap.set(b.id, b);
    }

    const auth = await getXeroAuth();
    const now = Date.now();
    let partial = false;
    let anyLive = false;
    const rows: any[] = [];

    for (const m of unique) {
      let due_date: string | null = null;
      let total = Number(m.total_amount) || 0;
      let paid = Number(m.amount_paid) || 0;
      let due = Number(m.amount_due) || 0;
      let dataSource: "live_xero" | "mapping_cache" = "mapping_cache";
      let stale = computeStaleWarning(m.updated_at, now);

      if (auth.ok && m.xero_invoice_id) {
        const live = await fetchInvoiceById(auth.data, m.xero_invoice_id);
        if (live.ok) {
          anyLive = true;
          const n = normalizeInvoice(live.data);
          due_date = n.due_date;
          total = n.total;
          paid = n.amount_paid;
          due = n.amount_due;
          dataSource = "live_xero";
          stale = false;
          if (due <= 0) continue; // no longer outstanding per live data
        } else {
          partial = true; // could not confirm against live Xero
        }
      } else if (!auth.ok) {
        partial = true;
      }

      if (due_before && due_date && due_date >= due_before) continue;
      const overdue = daysOverdue(due_date);
      if (overdue_only && overdue <= 0) continue;

      const b = bookingMap.get(m.booking_id);
      const cust = b?.customers;
      rows.push({
        booking_id: m.booking_id ?? null,
        primary_client: cust ? `${cust.first_name ?? ""} ${cust.last_name ?? ""}`.trim() : b?.group_name ?? null,
        tour: b?.tours?.name ?? null,
        invoice_number: m.xero_invoice_number ?? null,
        xero_invoice_id: m.xero_invoice_id,
        due_date,
        currency: m.currency_code ?? null,
        total,
        amount_paid: paid,
        amount_due: due,
        days_overdue: overdue,
        linkage_type: m.booking_id ? "mapping" : "unlinked",
        data_source: dataSource,
        stale_warning: stale,
      });
    }

    const result = {
      count: rows.length,
      data_source: anyLive ? (rows.some((r) => r.data_source === "mapping_cache") ? "mixed" : "live_xero") : "mapping_cache",
      xero_connected: auth.ok,
      partial_results: partial,
      partial_results_reason: partial
        ? (auth.ok ? "Some invoices could not be refreshed from live Xero." : "Xero is not connected; amounts and due dates are from cached mappings.")
        : null,
      invoices: rows,
    };

    await auditXeroCall(ctx, { tool: "list_outstanding_invoices", recordId: tour_id ?? null, success: true, durationMs: Date.now() - started, resultCount: rows.length });
    return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result };
  },
});