import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";
import { toolError } from "./_financial";
import { isUuid } from "./_xeroLogic";
import { auditReadCall, getUserRoles, hasFinancialRole } from "./_audit";

function classify(startDate: string | null, endDate: string | null, today: string): "upcoming" | "current" | "past" | "unknown" {
  if (!startDate && !endDate) return "unknown";
  const start = startDate ?? endDate!;
  const end = endDate ?? startDate!;
  if (today < start) return "upcoming";
  if (today > end) return "past";
  return "current";
}

export default defineTool({
  name: "list_customer_bookings",
  title: "List a customer's bookings",
  description:
    "List every booking a customer is linked to (as lead, secondary or passenger 2/3), with tour name, dates, status, passenger count, room/bedding type and a current/upcoming/past classification. Includes a financial-summary availability flag but no financial figures and no sensitive passenger data. Read-only; RLS-scoped to the signed-in user.",
  inputSchema: {
    customer_id: z.string().uuid().describe("The ART customer/contact id (uuid)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ customer_id }, ctx) => {
    const started = Date.now();
    if (!ctx.isAuthenticated()) return toolError("UNAUTHENTICATED");
    if (!isUuid(customer_id))
      return toolError("INVALID_INPUT", "customer_id must be a UUID.");

    const supabase = supabaseForUser(ctx);
    const financialAvailable = hasFinancialRole(await getUserRoles(ctx));

    const { data, error } = await supabase
      .from("bookings")
      .select(
        "id, tour_id, status, passenger_count, check_in_date, check_out_date, lead_passenger_id, passenger_2_id, passenger_3_id, secondary_contact_id, tours!bookings_tour_id_fkey(name, start_date, end_date)",
      )
      .or(
        `lead_passenger_id.eq.${customer_id},passenger_2_id.eq.${customer_id},passenger_3_id.eq.${customer_id},secondary_contact_id.eq.${customer_id}`,
      )
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      await auditReadCall(ctx, { tool: "list_customer_bookings", recordId: customer_id, success: false, errorCategory: "INTERNAL_ERROR", durationMs: Date.now() - started });
      return toolError("INTERNAL_ERROR");
    }

    const rows = data ?? [];
    // Bedding types per booking (single grouped query).
    const bookingIds = rows.map((r: any) => r.id);
    const beddingByBooking = new Map<string, Set<string>>();
    if (bookingIds.length > 0) {
      const { data: hb } = await supabase
        .from("hotel_bookings")
        .select("booking_id, bedding")
        .in("booking_id", bookingIds);
      for (const h of hb ?? []) {
        if (!(h as any).bedding) continue;
        const set = beddingByBooking.get((h as any).booking_id) ?? new Set<string>();
        set.add((h as any).bedding);
        beddingByBooking.set((h as any).booking_id, set);
      }
    }

    const today = new Date().toISOString().split("T")[0];
    const bookings = rows.map((r: any) => {
      const tour = r.tours;
      return {
        booking_id: r.id,
        tour_id: r.tour_id ?? null,
        tour_name: tour?.name ?? null,
        start_date: tour?.start_date ?? null,
        end_date: tour?.end_date ?? null,
        status: r.status ?? null,
        passenger_count: r.passenger_count ?? null,
        bedding_types: Array.from(beddingByBooking.get(r.id) ?? []),
        timeline: classify(tour?.start_date ?? null, tour?.end_date ?? null, today),
        financial_summary_available: financialAvailable,
      };
    });

    const result = {
      customer_id,
      count: bookings.length,
      financial_summary_available: financialAvailable,
      bookings,
    };

    await auditReadCall(ctx, { tool: "list_customer_bookings", recordId: customer_id, success: true, resultCount: bookings.length, durationMs: Date.now() - started });
    return {
      content: [{ type: "text", text: JSON.stringify(result) }],
      structuredContent: result,
    };
  },
});