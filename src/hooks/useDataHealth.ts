import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { isPlaceholderBooking } from "@/lib/placeholderBookings";

/**
 * Data Health engine.
 *
 * Computes, for every upcoming tour in scope, the operational gaps that would
 * stop us running the tour cleanly (missing passports, unallocated hotels,
 * unsigned waivers, ...) and turns them into a 0-100 readiness score.
 *
 * Egress rules: every query is scoped to the in-scope tour/booking id set —
 * no global table scans.
 */

export type DataHealthCheckId =
  | "passports"
  | "phones"
  | "emergency"
  | "hotel"
  | "activities"
  | "waivers"
  | "forms"
  | "pickups"
  | "payments"
  | "ops"
  | "website";

export interface DataHealthCheckMeta {
  id: DataHealthCheckId;
  label: string;
  /** Points deducted per open item (before the urgency multiplier). */
  weight: number;
  description: string;
}

export const DATA_HEALTH_CHECKS: DataHealthCheckMeta[] = [
  { id: "passports", label: "Passport details", weight: 4, description: "Passengers with no passport details recorded" },
  { id: "phones", label: "Phone numbers", weight: 3, description: "Lead passengers with no phone number" },
  { id: "emergency", label: "Emergency contacts", weight: 2, description: "Lead passengers with no emergency contact" },
  { id: "hotel", label: "Hotel allocation", weight: 5, description: "Confirmed bookings with no hotel room allocated" },
  { id: "activities", label: "Activity allocation", weight: 4, description: "Bookings not allocated to a tour activity" },
  { id: "waivers", label: "Waivers", weight: 3, description: "Bookings with no signed waiver from the lead booker" },
  { id: "forms", label: "Custom forms", weight: 2, description: "Outstanding responses to a published tour form" },
  { id: "pickups", label: "Pickups", weight: 2, description: "Bookings with no pickup option selected" },
  { id: "payments", label: "Payments", weight: 5, description: "Bookings not yet paid close to departure" },
  { id: "ops", label: "Ops readiness", weight: 4, description: "Missing host, itinerary, guest document or capacity" },
  { id: "website", label: "Website", weight: 2, description: "Not linked to WordPress, or changes awaiting publish" },
];

export const CHECK_LABELS: Record<DataHealthCheckId, string> = DATA_HEALTH_CHECKS.reduce(
  (acc, c) => ({ ...acc, [c.id]: c.label }),
  {} as Record<DataHealthCheckId, string>
);

export interface DataHealthItem {
  checkId: DataHealthCheckId;
  tourId: string;
  tourName: string;
  startDate: string | null;
  /** Booking the gap belongs to (absent for tour-level ops/website gaps). */
  bookingId?: string;
  /** Who / what the gap is about, e.g. "John Smith (Pax 2)". */
  subject: string;
  detail: string;
  acknowledged?: boolean;
}

export interface TourHealth {
  tourId: string;
  tourName: string;
  startDate: string | null;
  daysOut: number | null;
  pax: number;
  bookings: number;
  score: number;
  items: DataHealthItem[];
  acknowledged: DataHealthItem[];
  byCheck: Record<string, number>;
}

export interface DataHealthResult {
  tours: TourHealth[];
  allItems: DataHealthItem[];
  portfolioScore: number;
  atRisk: number;
  warning: number;
}

export type DataHealthWindow = 30 | 60 | 120 | 0; // 0 = all upcoming

const EXCLUDED_TOUR_STATUSES = ["cancelled", "archived", "past"];
const NON_COUNTING_BOOKING_STATUSES = ["cancelled", "waitlisted"];

const todayIso = () => new Date().toISOString().split("T")[0];

const addDaysIso = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
};

const daysBetween = (iso: string | null) => {
  if (!iso) return null;
  const start = new Date(`${iso}T00:00:00`);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((start.getTime() - now.getTime()) / 86400000);
};

/** Issues cost more the closer the tour is to departure. */
const urgencyMultiplier = (daysOut: number | null) => {
  if (daysOut === null) return 1;
  if (daysOut <= 14) return 2;
  if (daysOut <= 30) return 1.5;
  if (daysOut <= 60) return 1.2;
  return 1;
};

const nameOf = (c: any) => [c?.first_name, c?.last_name].filter(Boolean).join(" ").trim() || "Unnamed passenger";

const blank = (v: any) => !v || String(v).trim() === "";

export const useDataHealth = (windowDays: DataHealthWindow = 120) => {
  const query = useQuery({
    queryKey: ["data-health", windowDays],
    staleTime: 2 * 60 * 1000,
    queryFn: async (): Promise<DataHealthResult> => {
      const today = todayIso();

      // --- 1. In-scope tours -------------------------------------------------
      let tourQuery = supabase
        .from("tours")
        .select(
          "id, name, start_date, end_date, status, capacity, tour_host, travel_documents_required, pickup_location_required, is_test_tour"
        )
        .gte("start_date", today)
        .order("start_date", { ascending: true });

      if (windowDays > 0) tourQuery = tourQuery.lte("start_date", addDaysIso(windowDays));

      const { data: tourRows, error: tourError } = await tourQuery;
      if (tourError) throw tourError;

      const tours = (tourRows || []).filter(
        (t: any) => !t.is_test_tour && !EXCLUDED_TOUR_STATUSES.includes(t.status)
      );
      const tourIds = tours.map((t: any) => t.id);

      if (tourIds.length === 0) {
        return { tours: [], allItems: [], portfolioScore: 100, atRisk: 0, warning: 0 };
      }

      // --- 2. Bookings for those tours --------------------------------------
      const { data: bookingRows, error: bookingError } = await supabase
        .from("bookings")
        .select(
          `id, tour_id, status, passenger_count, passport_not_required, selected_pickup_option_id,
           group_name, lead_passenger_id, passenger_2_id, passenger_3_id, passenger_2_name, passenger_3_name,
           customers!bookings_lead_passenger_id_fkey(id, first_name, last_name, phone, phone_missing_acknowledged_at, emergency_contact_name, emergency_contact_phone)`
        )
        .in("tour_id", tourIds);
      if (bookingError) throw bookingError;

      const bookings = (bookingRows || []).filter((b: any) => {
        if (NON_COUNTING_BOOKING_STATUSES.includes(b.status)) return false;
        const c = b.customers;
        return !isPlaceholderBooking(b.status, c?.first_name, c?.last_name);
      });
      const bookingIds = bookings.map((b: any) => b.id);

      // --- 3. Related records (all scoped by the id sets above) -------------
      const chunk = <T,>(rows: T[]) => rows; // ids come from a bounded tour window

      const [
        hotelRes,
        waiverRes,
        docsRes,
        pickupRes,
        formRes,
        formResponseRes,
        formExemptionRes,
        itineraryRes,
        attachmentRes,
        wpLinkRes,
        websiteChangeRes,
        allocationRes,
        allocationAckRes,
        invoiceRes,
      ] = await Promise.all([
        bookingIds.length
          ? supabase.from("hotel_bookings").select("id, booking_id, hotel_id, allocated, required, cancelled_at").in("booking_id", chunk(bookingIds))
          : Promise.resolve({ data: [], error: null } as any),
        bookingIds.length
          ? supabase.from("booking_waivers").select("booking_id, passenger_slot, signed_at").in("booking_id", chunk(bookingIds))
          : Promise.resolve({ data: [], error: null } as any),
        bookingIds.length
          ? supabase.from("booking_travel_docs").select("booking_id, passenger_slot, passport_number").in("booking_id", chunk(bookingIds))
          : Promise.resolve({ data: [], error: null } as any),
        supabase.from("tour_pickup_options").select("id, tour_id").in("tour_id", tourIds),
        supabase.from("tour_custom_forms").select("id, tour_id, form_title, is_published, response_mode").in("tour_id", tourIds),
        bookingIds.length
          ? supabase.from("tour_custom_form_responses").select("form_id, booking_id, passenger_slot").in("booking_id", chunk(bookingIds))
          : Promise.resolve({ data: [], error: null } as any),
        bookingIds.length
          ? supabase.from("tour_custom_form_exemptions").select("form_id, booking_id, passenger_slot").in("booking_id", chunk(bookingIds))
          : Promise.resolve({ data: [], error: null } as any),
        supabase
          .from("tour_itineraries")
          .select("id, tour_id, is_current, guest_document_file_path, tour_itinerary_days(id)")
          .in("tour_id", tourIds),
        supabase.from("tour_attachments").select("id, tour_id").in("tour_id", tourIds),
        supabase.from("wordpress_tour_links").select("tour_id, wp_tour_id").in("tour_id", tourIds),
        supabase.from("website_change_requests").select("tour_id, section, status").in("tour_id", tourIds).in("status", ["pending", "approved"]),
        supabase.rpc("get_activity_allocation_discrepancies"),
        supabase.from("activity_discrepancy_acknowledgments").select("booking_id, activity_id").in("tour_id", tourIds),
        bookingIds.length
          ? supabase.from("xero_invoice_mappings").select("booking_id, amount_due, xero_status").in("booking_id", chunk(bookingIds))
          : Promise.resolve({ data: [], error: null } as any),
      ]);

      const firstError = [
        hotelRes, waiverRes, docsRes, pickupRes, formRes, formResponseRes,
        formExemptionRes, itineraryRes, attachmentRes, wpLinkRes, websiteChangeRes,
        allocationRes, allocationAckRes, invoiceRes,
      ].find((r: any) => r?.error)?.error;
      if (firstError) throw firstError;

      const hotelByBooking = new Map<string, any[]>();
      (hotelRes.data || []).forEach((h: any) => {
        if (h.cancelled_at) return;
        const list = hotelByBooking.get(h.booking_id) || [];
        list.push(h);
        hotelByBooking.set(h.booking_id, list);
      });

      // Waivers are per booking: one signature from the lead booker covers everyone.
      const signedWaiverBookings = new Set(
        (waiverRes.data || []).filter((w: any) => w.signed_at).map((w: any) => w.booking_id)
      );
      const docKeys = new Set(
        (docsRes.data || []).filter((d: any) => !blank(d.passport_number)).map((d: any) => `${d.booking_id}:${d.passenger_slot}`)
      );

      const pickupCountByTour = new Map<string, number>();
      (pickupRes.data || []).forEach((p: any) =>
        pickupCountByTour.set(p.tour_id, (pickupCountByTour.get(p.tour_id) || 0) + 1)
      );

      const formsByTour = new Map<string, any[]>();
      (formRes.data || []).filter((f: any) => f.is_published).forEach((f: any) => {
        const list = formsByTour.get(f.tour_id) || [];
        list.push(f);
        formsByTour.set(f.tour_id, list);
      });
      const responseKeys = new Set((formResponseRes.data || []).map((r: any) => `${r.form_id}:${r.booking_id}`));
      const exemptionKeys = new Set((formExemptionRes.data || []).map((r: any) => `${r.form_id}:${r.booking_id}`));

      const itineraryByTour = new Map<string, any>();
      (itineraryRes.data || []).forEach((it: any) => {
        const existing = itineraryByTour.get(it.tour_id);
        if (!existing || it.is_current) itineraryByTour.set(it.tour_id, it);
      });

      const attachmentCountByTour = new Map<string, number>();
      (attachmentRes.data || []).forEach((a: any) =>
        attachmentCountByTour.set(a.tour_id, (attachmentCountByTour.get(a.tour_id) || 0) + 1)
      );

      const wpLinked = new Set((wpLinkRes.data || []).filter((l: any) => l.wp_tour_id).map((l: any) => l.tour_id));
      const websiteChangesByTour = new Map<string, any[]>();
      (websiteChangeRes.data || []).forEach((c: any) => {
        const list = websiteChangesByTour.get(c.tour_id) || [];
        list.push(c);
        websiteChangesByTour.set(c.tour_id, list);
      });

      const allocationAckKeys = new Set(
        (allocationAckRes.data || []).map((a: any) => `${a.booking_id}:${a.activity_id}`)
      );
      const allocationRows = ((allocationRes.data as any[]) || []).filter((r: any) => tourIds.includes(r.tour_id));

      const invoiceByBooking = new Map<string, any>();
      (invoiceRes.data || []).forEach((m: any) => invoiceByBooking.set(m.booking_id, m));

      // --- 4. Build per-tour health ----------------------------------------
      const bookingsByTour = new Map<string, any[]>();
      bookings.forEach((b: any) => {
        const list = bookingsByTour.get(b.tour_id) || [];
        list.push(b);
        bookingsByTour.set(b.tour_id, list);
      });

      const tourHealth: TourHealth[] = tours.map((tour: any) => {
        const tourBookings = bookingsByTour.get(tour.id) || [];
        const items: DataHealthItem[] = [];
        const acknowledged: DataHealthItem[] = [];
        const daysOut = daysBetween(tour.start_date);

        const base = (checkId: DataHealthCheckId, subject: string, detail: string, bookingId?: string): DataHealthItem => ({
          checkId,
          tourId: tour.id,
          tourName: tour.name,
          startDate: tour.start_date,
          bookingId,
          subject,
          detail,
        });

        tourBookings.forEach((b: any) => {
          const lead = b.customers;
          const leadName = nameOf(lead);
          const paxCount = b.passenger_count || 1;

          // Phone / emergency / profile — lead passenger record.
          if (blank(lead?.phone)) {
            const item = base("phones", leadName, "No phone number on the contact record", b.id);
            if (lead?.phone_missing_acknowledged_at) acknowledged.push({ ...item, acknowledged: true });
            else items.push(item);
          }
          if (blank(lead?.emergency_contact_name) || blank(lead?.emergency_contact_phone)) {
            items.push(base("emergency", leadName, "No emergency contact name or phone", b.id));
          }
          // Passports.
          if (tour.travel_documents_required && !b.passport_not_required) {
            for (let slot = 1; slot <= Math.min(paxCount, 3); slot++) {
              if (!docKeys.has(`${b.id}:${slot}`)) {
                const who = slot === 1 ? leadName : b[`passenger_${slot}_name`] || `Passenger ${slot}`;
                items.push(base("passports", who, `No passport details recorded (Pax ${slot})`, b.id));
              }
            }
          }

          // Waivers — one per booking, signed by the lead booker for everyone.
          if (!signedWaiverBookings.has(b.id)) {
            items.push(
              base("waivers", leadName, "No signed waiver on file for this booking", b.id)
            );
          }

          // Hotel allocation.
          const hotels = hotelByBooking.get(b.id) || [];
          const needsHotel = hotels.length === 0 || hotels.some((h: any) => h.required !== false && !h.hotel_id);
          if (needsHotel) {
            items.push(base("hotel", leadName, "No hotel room allocated", b.id));
          }

          // Pickups.
          if ((pickupCountByTour.get(tour.id) || 0) > 0 && !b.selected_pickup_option_id) {
            items.push(base("pickups", leadName, "No pickup option selected", b.id));
          }

          // Custom forms.
          (formsByTour.get(tour.id) || []).forEach((form: any) => {
            const key = `${form.id}:${b.id}`;
            if (!responseKeys.has(key) && !exemptionKeys.has(key)) {
              items.push(base("forms", leadName, `No response to "${form.form_title}"`, b.id));
            }
          });

          // Payments — anything not fully settled inside 30 days of departure.
          if (daysOut !== null && daysOut <= 30) {
            const settledStatuses = ["fully_paid", "complimentary", "host", "racing_breaks_invoice"];
            const isSettled = settledStatuses.includes(b.status);
            const mapping = invoiceByBooking.get(b.id);
            const unpaid = mapping ? Number(mapping.amount_due || 0) > 0 : !isSettled;
            if (unpaid && !isSettled) {
              items.push(
                base("payments", leadName, `Status "${b.status}" with ${daysOut} day(s) to departure`, b.id)
              );
            }
          }
        });

        // Activity allocations (from the shared RPC).
        allocationRows
          .filter((r: any) => r.tour_id === tour.id)
          .forEach((r: any) => {
            if (NON_COUNTING_BOOKING_STATUSES.includes(r.status)) return;
            const who = [r.lead_passenger_first_name, r.lead_passenger_last_name].filter(Boolean).join(" ") || r.group_name || "Booking";
            const item = base("activities", who, `${r.activity_name}: ${r.discrepancy_type?.replace(/_/g, " ") || "allocation mismatch"}`, r.booking_id);
            if (allocationAckKeys.has(`${r.booking_id}:${r.activity_id}`)) acknowledged.push({ ...item, acknowledged: true });
            else items.push(item);
          });

        // Ops readiness (tour level).
        if (blank(tour.tour_host)) items.push(base("ops", tour.name, "No tour host assigned"));
        const itinerary = itineraryByTour.get(tour.id);
        const dayCount = itinerary?.tour_itinerary_days?.length || 0;
        if (!itinerary || dayCount === 0) items.push(base("ops", tour.name, "Itinerary has no days built"));
        if (!itinerary?.guest_document_file_path && (attachmentCountByTour.get(tour.id) || 0) === 0) {
          items.push(base("ops", tour.name, "No guest document uploaded"));
        }
        if (!tour.capacity || tour.capacity <= 0) items.push(base("ops", tour.name, "Tour capacity not set"));

        // Website.
        if (!wpLinked.has(tour.id)) items.push(base("website", tour.name, "Not linked to a WordPress tour"));
        const pendingChanges = websiteChangesByTour.get(tour.id) || [];
        const pendingReview = pendingChanges.filter((c: any) => c.status === "pending").length;
        const approvedUnpublished = pendingChanges.filter((c: any) => c.status === "approved").length;
        if (pendingReview > 0) items.push(base("website", tour.name, `${pendingReview} website change(s) awaiting review`));
        if (approvedUnpublished > 0) items.push(base("website", tour.name, `${approvedUnpublished} approved change(s) not yet published`));

        const multiplier = urgencyMultiplier(daysOut);
        const weightById = new Map(DATA_HEALTH_CHECKS.map((c) => [c.id, c.weight]));
        const deduction = items.reduce((sum, i) => sum + (weightById.get(i.checkId) || 2) * multiplier, 0);
        const score = Math.max(0, Math.round(100 - deduction));

        const byCheck = items.reduce<Record<string, number>>((acc, i) => {
          acc[i.checkId] = (acc[i.checkId] || 0) + 1;
          return acc;
        }, {});

        return {
          tourId: tour.id,
          tourName: tour.name,
          startDate: tour.start_date,
          daysOut,
          pax: tourBookings.reduce((sum: number, b: any) => sum + (b.passenger_count || 0), 0),
          bookings: tourBookings.length,
          score,
          items,
          acknowledged,
          byCheck,
        };
      });

      const allItems = tourHealth.flatMap((t) => t.items);
      const portfolioScore = tourHealth.length
        ? Math.round(tourHealth.reduce((sum, t) => sum + t.score, 0) / tourHealth.length)
        : 100;

      return {
        tours: tourHealth,
        allItems,
        portfolioScore,
        atRisk: tourHealth.filter((t) => t.score < 70).length,
        warning: tourHealth.filter((t) => t.score >= 70 && t.score < 90).length,
      };
    },
  });

  return query;
};

/** Compact summary used by the dashboard widget. */
export const useDataHealthSummary = () => {
  const { data, isLoading } = useDataHealth(60);
  return useMemo(
    () => ({
      isLoading,
      score: data?.portfolioScore ?? 100,
      atRisk: data?.atRisk ?? 0,
      warning: data?.warning ?? 0,
      openIssues: data?.allItems.length ?? 0,
      worst: (data?.tours || []).slice().sort((a, b) => a.score - b.score).slice(0, 3),
    }),
    [data, isLoading]
  );
};

export const scoreTone = (score: number) =>
  score >= 90 ? "good" : score >= 70 ? "warn" : "bad";
