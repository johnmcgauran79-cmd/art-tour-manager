import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { isPlaceholderBooking } from "@/lib/placeholderBookings";

/**
 * Data Health engine.
 *
 * Two independent dimensions:
 *  - Ops readiness  : can we actually run this tour? (hotels, activities,
 *                     host/itinerary/guest doc/capacity, payments, website)
 *  - Guest data     : how complete is passenger-supplied information?
 *                     (passports, waivers, phones, emergency, forms, pickups)
 *
 * Guest-data gaps never drag down the headline Ops readiness score.
 *
 * Scoring: each check becomes a ratio of ready units vs total applicable units,
 * so one recurring gap can no longer zero a tour. Category ratios are combined
 * as a weighted average, then the shortfall is amplified by departure urgency.
 *
 * Egress rules: every query is scoped to the in-scope tour/booking id set.
 */

export type DataHealthGroup = "ops" | "guest";

export type DataHealthCheckId =
  | "hotel"
  | "activities"
  | "ops"
  | "payments"
  | "website"
  | "passports"
  | "phones"
  | "emergency"
  | "waivers"
  | "forms"
  | "pickups";

export interface DataHealthCheckMeta {
  id: DataHealthCheckId;
  label: string;
  group: DataHealthGroup;
  /** Relative importance of this category within its group. */
  weight: number;
  description: string;
}

export const DATA_HEALTH_CHECKS: DataHealthCheckMeta[] = [
  { id: "hotel", label: "Hotels", group: "ops", weight: 30, description: "Hotel contract status, terms, contract file and room allocation" },
  { id: "activities", label: "Activities", group: "ops", weight: 30, description: "Activity booking and payment status, capacity and supplier details" },
  { id: "ops", label: "Tour setup", group: "ops", weight: 25, description: "Host, itinerary, guest document and capacity" },
  { id: "payments", label: "Payments", group: "ops", weight: 10, description: "Bookings not yet settled close to departure" },
  { id: "website", label: "Website", group: "ops", weight: 5, description: "Not linked to WordPress, or changes awaiting publish" },
  { id: "passports", label: "Passport details", group: "guest", weight: 25, description: "Passengers with no passport details recorded" },
  { id: "waivers", label: "Waivers", group: "guest", weight: 25, description: "Bookings with no signed waiver from the lead booker" },
  { id: "phones", label: "Phone numbers", group: "guest", weight: 20, description: "Lead passengers with no phone number" },
  { id: "emergency", label: "Emergency contacts", group: "guest", weight: 15, description: "Lead passengers with no emergency contact" },
  { id: "forms", label: "Custom forms", group: "guest", weight: 10, description: "Outstanding responses to a published tour form" },
  { id: "pickups", label: "Pickups", group: "guest", weight: 5, description: "Bookings with no pickup option selected" },
];

export const CHECK_LABELS: Record<DataHealthCheckId, string> = DATA_HEALTH_CHECKS.reduce(
  (acc, c) => ({ ...acc, [c.id]: c.label }),
  {} as Record<DataHealthCheckId, string>
);

export const CHECK_GROUP: Record<DataHealthCheckId, DataHealthGroup> = DATA_HEALTH_CHECKS.reduce(
  (acc, c) => ({ ...acc, [c.id]: c.group }),
  {} as Record<DataHealthCheckId, DataHealthGroup>
);

export interface DataHealthItem {
  checkId: DataHealthCheckId;
  group: DataHealthGroup;
  tourId: string;
  tourName: string;
  startDate: string | null;
  /** Booking the gap belongs to (absent for tour-level gaps). */
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
  /** Headline score = operational readiness. */
  score: number;
  opsScore: number;
  guestScore: number;
  items: DataHealthItem[];
  opsItems: DataHealthItem[];
  guestItems: DataHealthItem[];
  acknowledged: DataHealthItem[];
  byCheck: Record<string, number>;
  /** 0-100 readiness per category (only categories that applied). */
  categoryScores: Partial<Record<DataHealthCheckId, number>>;
  /** Tour is run by an outside DMC — supplier-level checks are relaxed. */
  dmcManaged?: boolean;
}

export interface DataHealthResult {
  tours: TourHealth[];
  allItems: DataHealthItem[];
  portfolioScore: number;
  guestPortfolioScore: number;
  atRisk: number;
  warning: number;
}

export type DataHealthWindow = 30 | 60 | 120 | 0; // 0 = all upcoming

const EXCLUDED_TOUR_STATUSES = ["cancelled", "archived", "past"];
const NON_COUNTING_BOOKING_STATUSES = ["cancelled", "waitlisted"];
const SETTLED_BOOKING_STATUSES = ["fully_paid", "complimentary", "host", "racing_breaks_invoice"];

/** Hotel is contractually locked in (booking_workflow_status values that are "good"). */
const HOTEL_READY_STATUSES = ["booked", "contract_signed", "contracted", "confirmed", "paid", "finalised"];
/** Activity is locked in with the supplier. */
const ACTIVITY_READY_STATUSES = ["booked", "contract_signed", "confirmed", "finalised", "fully_paid", "paid_deposit"];
const PAYMENT_READY_STATUSES = ["fully_paid", "partially_paid", "not_required", "pay_on_the_day"];
const TRANSPORT_READY_STATUSES = ["booked", "contract_signed", "confirmed", "finalised", "paid_deposit", "fully_paid", "not_required"];

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

/** Gaps cost more the closer the tour is to departure. */
const urgencyMultiplier = (daysOut: number | null) => {
  if (daysOut === null) return 1;
  if (daysOut <= 14) return 1.6;
  if (daysOut <= 30) return 1.35;
  if (daysOut <= 60) return 1.15;
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
          "id, name, start_date, end_date, status, capacity, tour_host, travel_documents_required, pickup_location_required, is_test_tour, managed_by_dmc"
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
        return { tours: [], allItems: [], portfolioScore: 100, guestPortfolioScore: 100, atRisk: 0, warning: 0 };
      }

      // --- 2. Bookings for those tours --------------------------------------
      const { data: bookingRows, error: bookingError } = await supabase
        .from("bookings")
        .select(
          `id, tour_id, status, passenger_count, passport_not_required, accommodation_required, selected_pickup_option_id,
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
      const [
        hotelsRes,
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
        invoiceRes,
        activityRes,
      ] = await Promise.all([
        supabase
          .from("hotels")
          .select("id, tour_id, name, booking_status, payment_status, cancellation_policy, rooms_reserved, rooms_booked, default_check_in, default_check_out, contact_name, contact_phone")
          .in("tour_id", tourIds),
        bookingIds.length
          ? supabase.from("hotel_bookings").select("id, booking_id, hotel_id, allocated, required, cancelled_at").in("booking_id", bookingIds)
          : Promise.resolve({ data: [], error: null } as any),
        bookingIds.length
          ? supabase.from("booking_waivers").select("booking_id, passenger_slot, signed_at").in("booking_id", bookingIds)
          : Promise.resolve({ data: [], error: null } as any),
        bookingIds.length
          ? supabase.from("booking_travel_docs").select("booking_id, passenger_slot, passport_number").in("booking_id", bookingIds)
          : Promise.resolve({ data: [], error: null } as any),
        supabase.from("tour_pickup_options").select("id, tour_id").in("tour_id", tourIds),
        supabase.from("tour_custom_forms").select("id, tour_id, form_title, is_published, response_mode").in("tour_id", tourIds),
        bookingIds.length
          ? supabase.from("tour_custom_form_responses").select("form_id, booking_id, passenger_slot").in("booking_id", bookingIds)
          : Promise.resolve({ data: [], error: null } as any),
        bookingIds.length
          ? supabase.from("tour_custom_form_exemptions").select("form_id, booking_id, passenger_slot").in("booking_id", bookingIds)
          : Promise.resolve({ data: [], error: null } as any),
        supabase
          .from("tour_itineraries")
          .select("id, tour_id, is_current, guest_document_file_path, tour_itinerary_days(id)")
          .in("tour_id", tourIds),
        supabase.from("tour_attachments").select("id, tour_id").in("tour_id", tourIds),
        supabase.from("wordpress_tour_links").select("tour_id, wp_tour_id").in("tour_id", tourIds),
        supabase.from("website_change_requests").select("tour_id, section, status, published_at").in("tour_id", tourIds).in("status", ["pending", "approved"]),
        bookingIds.length
          ? supabase.from("xero_invoice_mappings").select("booking_id, amount_due, xero_status").in("booking_id", bookingIds)
          : Promise.resolve({ data: [], error: null } as any),
        supabase
          .from("activities")
          .select("id, tour_id, name, activity_date, start_time, location, booking_status, payment_status, transport_status, transport_mode, spots_available, spots_booked, contact_name, contact_phone")
          .in("tour_id", tourIds),
      ]);

      const firstError = [
        hotelsRes, hotelRes, waiverRes, docsRes, pickupRes, formRes, formResponseRes,
        formExemptionRes, itineraryRes, attachmentRes, wpLinkRes, websiteChangeRes,
        invoiceRes, activityRes,
      ].find((r: any) => r?.error)?.error;
      if (firstError) throw firstError;

      const tourHotels = (hotelsRes.data || []) as any[];
      const hotelIds = tourHotels.map((h) => h.id);
      const { data: hotelAttachmentRows } = hotelIds.length
        ? await supabase.from("hotel_attachments").select("hotel_id").in("hotel_id", hotelIds)
        : ({ data: [] } as any);
      const hotelsWithContract = new Set((hotelAttachmentRows || []).map((a: any) => a.hotel_id));

      const hotelsByTour = new Map<string, any[]>();
      tourHotels.forEach((h) => {
        const list = hotelsByTour.get(h.tour_id) || [];
        list.push(h);
        hotelsByTour.set(h.tour_id, list);
      });

      const activitiesByTour = new Map<string, any[]>();
      ((activityRes.data || []) as any[]).forEach((a) => {
        if (a.booking_status === "cancelled") return;
        const list = activitiesByTour.get(a.tour_id) || [];
        list.push(a);
        activitiesByTour.set(a.tour_id, list);
      });

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

        /** applicable checkpoints vs failed checkpoints, per category */
        const tally: Partial<Record<DataHealthCheckId, { total: number; failed: number }>> = {};
        const track = (checkId: DataHealthCheckId, total: number) => {
          const t = tally[checkId] || { total: 0, failed: 0 };
          t.total += total;
          tally[checkId] = t;
        };

        const flag = (
          checkId: DataHealthCheckId,
          subject: string,
          detail: string,
          bookingId?: string,
          opts?: { acknowledged?: boolean }
        ) => {
          const item: DataHealthItem = {
            checkId,
            group: CHECK_GROUP[checkId],
            tourId: tour.id,
            tourName: tour.name,
            startDate: tour.start_date,
            bookingId,
            subject,
            detail,
          };
          if (opts?.acknowledged) {
            acknowledged.push({ ...item, acknowledged: true });
            return;
          }
          const t = tally[checkId] || { total: 0, failed: 0 };
          t.failed += 1;
          tally[checkId] = t;
          items.push(item);
        };

        // Tours run by an outside DMC: supplier relationships (contracts, payment,
        // supplier contacts, transport) are handled by the DMC, so readiness only
        // scores the details we actually hold — booking/guest data plus capacity.
        const dmcManaged = !!tour.managed_by_dmc;

        // ================= OPS: HOTELS =====================================
        const hotels = hotelsByTour.get(tour.id) || [];
        if (hotels.length === 0) {
          track("hotel", 1);
          flag("hotel", tour.name, "No hotels set up for this tour");
        } else if (dmcManaged) {
          // Only the room block sanity check applies — the DMC owns the contract.
          track("hotel", hotels.length);
          hotels.forEach((h: any) => {
            if (h.rooms_reserved && (h.rooms_booked || 0) > h.rooms_reserved) {
              flag("hotel", h.name, `Oversold: ${h.rooms_booked} rooms booked against ${h.rooms_reserved} reserved`);
            }
          });
        } else {
          // 5 checkpoints per hotel: status, terms, contract file, room block, contact
          track("hotel", hotels.length * 5);
          hotels.forEach((h: any) => {
            if (!HOTEL_READY_STATUSES.includes(h.booking_status)) {
              flag("hotel", h.name, `Hotel status "${(h.booking_status || "pending").replace(/_/g, " ")}" — not contracted/confirmed`);
            }
            if (blank(h.cancellation_policy)) {
              flag("hotel", h.name, "No cancellation & attrition terms recorded");
            }
            if (!hotelsWithContract.has(h.id)) {
              flag("hotel", h.name, "No contract file uploaded");
            }
            if (!h.rooms_reserved || h.rooms_reserved <= 0) {
              flag("hotel", h.name, "No room block reserved");
            } else if ((h.rooms_booked || 0) > h.rooms_reserved) {
              flag("hotel", h.name, `Oversold: ${h.rooms_booked} rooms booked against ${h.rooms_reserved} reserved`);
            }
            if (blank(h.contact_name) || blank(h.contact_phone)) {
              flag("hotel", h.name, "Missing hotel contact name or phone");
            }
          });
        }

        // ================= OPS: ACTIVITIES =================================
        const activities = activitiesByTour.get(tour.id) || [];
        if (activities.length > 0 && dmcManaged) {
          // Guest-facing detail only: the DMC handles supplier booking, payment and transport.
          track("activities", activities.length);
          activities.forEach((a: any) => {
            const missing: string[] = [];
            if (blank(a.activity_date)) missing.push("date");
            if (blank(a.location)) missing.push("location");
            if (missing.length) {
              flag("activities", a.name, `Missing ${missing.join(", ")}`);
            }
          });
        } else if (activities.length > 0) {
          // 5 checkpoints per activity: booking status, payment, capacity, core details, transport
          track("activities", activities.length * 5);
          activities.forEach((a: any) => {
            if (!ACTIVITY_READY_STATUSES.includes(a.booking_status)) {
              flag("activities", a.name, `Activity status "${(a.booking_status || "pending").replace(/_/g, " ")}" — not booked with supplier`);
            }
            if (!PAYMENT_READY_STATUSES.includes(a.payment_status)) {
              flag("activities", a.name, `Payment status "${(a.payment_status || "unpaid").replace(/_/g, " ")}"`);
            }
            if (!a.spots_available || a.spots_available <= 0) {
              flag("activities", a.name, "No spots reserved with the supplier");
            } else if ((a.spots_booked || 0) > a.spots_available) {
              flag("activities", a.name, `Oversold: ${a.spots_booked} attending against ${a.spots_available} spots`);
            }
            const missing: string[] = [];
            if (blank(a.activity_date)) missing.push("date");
            if (blank(a.start_time)) missing.push("start time");
            if (blank(a.location)) missing.push("location");
            if (blank(a.contact_name) || blank(a.contact_phone)) missing.push("supplier contact");
            if (missing.length) {
              flag("activities", a.name, `Missing ${missing.join(", ")}`);
            }
            if (!TRANSPORT_READY_STATUSES.includes(a.transport_status)) {
              flag("activities", a.name, `Transport status "${(a.transport_status || "pending").replace(/_/g, " ")}"`);
            }
          });
        }


        // Passenger-level activity allocation gaps are tracked in the Activity Bookings
        // review screen, not in tour readiness.


        // ================= OPS: TOUR SETUP =================================
        track("ops", 4);
        if (blank(tour.tour_host)) flag("ops", tour.name, "No tour host assigned");
        const itinerary = itineraryByTour.get(tour.id);
        const dayCount = itinerary?.tour_itinerary_days?.length || 0;
        if (!itinerary || dayCount === 0) flag("ops", tour.name, "Itinerary has no days built");
        if (!itinerary?.guest_document_file_path && (attachmentCountByTour.get(tour.id) || 0) === 0) {
          flag("ops", tour.name, "No guest document uploaded");
        }
        if (!tour.capacity || tour.capacity <= 0) flag("ops", tour.name, "Tour capacity not set");

        // ================= OPS: WEBSITE ====================================
        track("website", 2);
        if (!wpLinked.has(tour.id)) flag("website", tour.name, "Not linked to a WordPress tour");
        const pendingChanges = websiteChangesByTour.get(tour.id) || [];
        const pendingReview = pendingChanges.filter((c: any) => c.status === "pending").length;
        const approvedUnpublished = pendingChanges.filter((c: any) => c.status === "approved" && !c.published_at).length;
        if (pendingReview > 0) flag("website", tour.name, `${pendingReview} website change(s) awaiting review`);
        if (approvedUnpublished > 0) flag("website", tour.name, `${approvedUnpublished} approved change(s) not yet published`);

        // ================= PER-BOOKING CHECKS ==============================
        const forms = formsByTour.get(tour.id) || [];
        const pickupsOffered = (pickupCountByTour.get(tour.id) || 0) > 0;

        tourBookings.forEach((b: any) => {
          const lead = b.customers;
          const leadName = nameOf(lead);
          const paxCount = b.passenger_count || 1;

          // --- guest data ---
          track("phones", 1);
          if (blank(lead?.phone)) {
            flag("phones", leadName, "No phone number on the contact record", b.id, {
              acknowledged: !!lead?.phone_missing_acknowledged_at,
            });
          }
          track("emergency", 1);
          if (blank(lead?.emergency_contact_name) || blank(lead?.emergency_contact_phone)) {
            flag("emergency", leadName, "No emergency contact name or phone", b.id);
          }
          if (tour.travel_documents_required && !b.passport_not_required) {
            const slots = Math.min(paxCount, 3);
            track("passports", slots);
            for (let slot = 1; slot <= slots; slot++) {
              if (!docKeys.has(`${b.id}:${slot}`)) {
                const who = slot === 1 ? leadName : b[`passenger_${slot}_name`] || `Passenger ${slot}`;
                flag("passports", who, `No passport details recorded (Pax ${slot})`, b.id);
              }
            }
          }
          track("waivers", 1);
          if (!signedWaiverBookings.has(b.id)) {
            flag("waivers", leadName, "No signed waiver on file for this booking", b.id);
          }
          if (forms.length) {
            track("forms", forms.length);
            forms.forEach((form: any) => {
              const key = `${form.id}:${b.id}`;
              if (!responseKeys.has(key) && !exemptionKeys.has(key)) {
                flag("forms", leadName, `No response to "${form.form_title}"`, b.id);
              }
            });
          }
          if (pickupsOffered) {
            track("pickups", 1);
            if (!b.selected_pickup_option_id) {
              flag("pickups", leadName, "No pickup option selected", b.id);
            }
          }

          // --- ops: hotel room allocated for this booking (skip when accommodation isn't required) ---
          if (b.accommodation_required !== false) {
            const bookingHotels = hotelByBooking.get(b.id) || [];
            track("hotel", 1);
            const needsHotel =
              bookingHotels.length === 0 || bookingHotels.some((h: any) => h.required !== false && !h.hotel_id);
            if (needsHotel) {
              flag("hotel", leadName, "No hotel room allocated", b.id);
            }
          }

          // --- ops: payments inside 30 days ---
          if (daysOut !== null && daysOut <= 30) {
            track("payments", 1);
            const isSettled = SETTLED_BOOKING_STATUSES.includes(b.status);
            const mapping = invoiceByBooking.get(b.id);
            const unpaid = mapping ? Number(mapping.amount_due || 0) > 0 : !isSettled;
            if (unpaid && !isSettled) {
              flag("payments", leadName, `Status "${b.status}" with ${daysOut} day(s) to departure`, b.id);
            }
          }
        });

        // ================= SCORING =========================================
        const multiplier = urgencyMultiplier(daysOut);
        const categoryScores: Partial<Record<DataHealthCheckId, number>> = {};
        DATA_HEALTH_CHECKS.forEach((c) => {
          const t = tally[c.id];
          if (!t || t.total === 0) return;
          const ratio = Math.max(0, 1 - t.failed / t.total);
          categoryScores[c.id] = Math.round(ratio * 100);
        });

        const groupScore = (group: DataHealthGroup) => {
          const applicable = DATA_HEALTH_CHECKS.filter((c) => c.group === group && categoryScores[c.id] !== undefined);
          if (applicable.length === 0) return 100;
          const totalWeight = applicable.reduce((s, c) => s + c.weight, 0);
          const raw = applicable.reduce((s, c) => s + (categoryScores[c.id] as number) * c.weight, 0) / totalWeight;
          const shortfall = (100 - raw) * multiplier;
          return Math.max(0, Math.round(100 - shortfall));
        };

        const opsScore = groupScore("ops");
        const guestScore = groupScore("guest");

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
          score: opsScore,
          opsScore,
          guestScore,
          items,
          opsItems: items.filter((i) => i.group === "ops"),
          guestItems: items.filter((i) => i.group === "guest"),
          acknowledged,
          byCheck,
          categoryScores,
          dmcManaged,
        };
      });

      const allItems = tourHealth.flatMap((t) => t.items);
      const avg = (nums: number[]) => (nums.length ? Math.round(nums.reduce((s, n) => s + n, 0) / nums.length) : 100);

      return {
        tours: tourHealth,
        allItems,
        portfolioScore: avg(tourHealth.map((t) => t.opsScore)),
        guestPortfolioScore: avg(tourHealth.map((t) => t.guestScore)),
        atRisk: tourHealth.filter((t) => t.opsScore < 70).length,
        warning: tourHealth.filter((t) => t.opsScore >= 70 && t.opsScore < 90).length,
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
      guestScore: data?.guestPortfolioScore ?? 100,
      atRisk: data?.atRisk ?? 0,
      warning: data?.warning ?? 0,
      openIssues: data?.allItems.filter((i) => i.group === "ops").length ?? 0,
      worst: (data?.tours || []).slice().sort((a, b) => a.opsScore - b.opsScore).slice(0, 3),
    }),
    [data, isLoading]
  );
};

export const scoreTone = (score: number) =>
  score >= 90 ? "good" : score >= 70 ? "warn" : "bad";

/**
 * Readiness for a single tour. Reuses the shared "all upcoming" query so the
 * data is fetched once and shared across Data Health, Operations and Tours.
 */
export const useTourHealth = (tourId?: string) => {
  const { data, isLoading, isFetching } = useDataHealth(0);
  const tour = useMemo(
    () => (tourId ? (data?.tours || []).find((t) => t.tourId === tourId) : undefined),
    [data, tourId]
  );
  return { tour, isLoading, isFetching };
};

/** Map of tourId -> ops readiness score for all upcoming tours. */
export const useOpsScoreMap = () => {
  const { data, isLoading } = useDataHealth(0);
  const scores = useMemo(() => {
    const map: Record<string, number> = {};
    (data?.tours || []).forEach((t) => {
      map[t.tourId] = t.opsScore;
    });
    return map;
  }, [data]);
  return { scores, isLoading };
};
