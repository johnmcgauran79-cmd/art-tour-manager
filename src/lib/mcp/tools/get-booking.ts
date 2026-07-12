import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "./_supabase";
import { toolError } from "./_financial";
import { isUuid } from "./_xeroLogic";
import { auditReadCall } from "./_audit";

export default defineTool({
  name: "get_booking",
  title: "Get a booking overview",
  description:
    "Fetch a minimised, non-sensitive operational overview of one booking by id: status, dates, passenger count, room/bedding type, accommodation dates, linked customer ids and operational flags. Excludes all passport, medical, emergency-contact and dietary data. Read-only; access is RLS-scoped to the signed-in user.",
  inputSchema: {
    booking_id: z.string().uuid().describe("The ART booking id (uuid)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ booking_id }, ctx) => {
    const started = Date.now();
    if (!ctx.isAuthenticated()) return toolError("UNAUTHENTICATED");
    if (!isUuid(booking_id))
      return toolError("INVALID_INPUT", "booking_id must be a UUID.");

    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("bookings")
      .select(
        "id, tour_id, lead_passenger_id, passenger_2_id, passenger_3_id, secondary_contact_id, status, created_at, passenger_count, accommodation_required, check_in_date, check_out_date, total_nights, whatsapp_group_comms, split_invoice, passport_not_required, cancelled_at, tours!bookings_tour_id_fkey(name)",
      )
      .eq("id", booking_id)
      .maybeSingle();

    if (error) {
      await auditReadCall(ctx, { tool: "get_booking", recordId: booking_id, success: false, errorCategory: "INTERNAL_ERROR", durationMs: Date.now() - started });
      return toolError("INTERNAL_ERROR");
    }
    if (!data) {
      await auditReadCall(ctx, { tool: "get_booking", recordId: booking_id, success: false, errorCategory: "BOOKING_ACCESS_DENIED", durationMs: Date.now() - started });
      return toolError("BOOKING_ACCESS_DENIED");
    }

    // Distinct bedding / room types across the booking's hotel allocations.
    const { data: hotelRows } = await supabase
      .from("hotel_bookings")
      .select("bedding, room_type")
      .eq("booking_id", booking_id);
    const beddingTypes = Array.from(
      new Set((hotelRows ?? []).map((h: any) => h.bedding).filter(Boolean)),
    );
    const roomTypes = Array.from(
      new Set((hotelRows ?? []).map((h: any) => h.room_type).filter(Boolean)),
    );

    const status = (data as any).status ?? null;
    const linkedCustomerIds = [
      (data as any).lead_passenger_id,
      (data as any).passenger_2_id,
      (data as any).passenger_3_id,
      (data as any).secondary_contact_id,
    ].filter(Boolean);

    const result = {
      booking_id: (data as any).id,
      tour_id: (data as any).tour_id ?? null,
      tour_name: (data as any).tours?.name ?? null,
      lead_customer_id: (data as any).lead_passenger_id ?? null,
      linked_customer_ids: linkedCustomerIds,
      status,
      booking_date: (data as any).created_at ?? null,
      passenger_count: (data as any).passenger_count ?? null,
      bedding_types: beddingTypes,
      room_types: roomTypes,
      accommodation: {
        required: !!(data as any).accommodation_required,
        check_in_date: (data as any).check_in_date ?? null,
        check_out_date: (data as any).check_out_date ?? null,
        total_nights: (data as any).total_nights ?? null,
      },
      indicators: {
        is_host: status === "host",
        is_complimentary: status === "complimentary",
        is_cancelled: !!(data as any).cancelled_at,
      },
      operational_flags: {
        whatsapp_group_comms: !!(data as any).whatsapp_group_comms,
        split_invoice: !!(data as any).split_invoice,
        passport_not_required: !!(data as any).passport_not_required,
      },
    };

    await auditReadCall(ctx, { tool: "get_booking", recordId: booking_id, success: true, durationMs: Date.now() - started });
    return {
      content: [{ type: "text", text: JSON.stringify(result) }],
      structuredContent: { booking: result },
    };
  },
});