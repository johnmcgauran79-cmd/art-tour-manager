import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TourDocumentBreakdown {
  tourId: string;
  tourName: string;
  startDate: string;
  missingPassports: number;
  missingPickups: number;
  missingForms: number;
}

export interface GlobalDocumentAlerts {
  totalPassports: number;
  totalPickups: number;
  totalForms: number;
  tourBreakdowns: TourDocumentBreakdown[];
  isLoading: boolean;
}

/** Split an array into chunks */
function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

const CHUNK_SIZE = 500;

export const useGlobalDocumentAlerts = (): GlobalDocumentAlerts => {
  const { data, isLoading } = useQuery({
    queryKey: ["global-document-alerts"],
    queryFn: async () => {
      // Get active tours
      const { data: tours, error: toursError } = await supabase
        .from("tours")
        .select("id, name, start_date, travel_documents_required, pickup_location_required")
        .in("status", ["pending", "available", "limited_availability", "closed", "sold_out"]);
      if (toursError) throw toursError;
      if (!tours || tours.length === 0) return [];

      const tourIds = tours.map(t => t.id);

      // Fetch all bookings in chunks by tour_id
      const bookingChunks = await Promise.all(
        chunk(tourIds, CHUNK_SIZE).map(async (ids) => {
          const { data, error } = await supabase
            .from("bookings")
            .select("id, tour_id, passenger_count, selected_pickup_option_id, passport_not_required")
            .in("tour_id", ids)
            .not("status", "in", '("cancelled","waitlisted")');
          if (error) throw error;
          return data || [];
        })
      );
      const bookings = bookingChunks.flat();

      if (bookings.length === 0) {
        return tours.map(t => ({
          tourId: t.id,
          tourName: t.name,
          startDate: t.start_date,
          missingPassports: 0,
          missingPickups: 0,
          missingForms: 0,
        }));
      }

      const bookingIds = bookings.map(b => b.id);

      // Parallel chunked queries
      const [travelDocs, formsRes, formResponses, tokens] = await Promise.all([
        Promise.all(
          chunk(bookingIds, CHUNK_SIZE).map(async (ids) => {
            const { data, error } = await supabase
              .from("booking_travel_docs")
              .select("booking_id, passenger_slot, passport_number, passport_first_name, passport_surname")
              .in("booking_id", ids);
            if (error) throw error;
            return data || [];
          })
        ).then(r => r.flat()),
        supabase
          .from("tour_custom_forms")
          .select("id, tour_id, response_mode")
          .in("tour_id", tourIds)
          .eq("is_published", true),
        Promise.all(
          chunk(bookingIds, CHUNK_SIZE).map(async (ids) => {
            const { data, error } = await supabase
              .from("tour_custom_form_responses")
              .select("form_id, booking_id, passenger_slot")
              .in("booking_id", ids);
            if (error) throw error;
            return data || [];
          })
        ).then(r => r.flat()),
        Promise.all(
          chunk(bookingIds, CHUNK_SIZE).map(async (ids) => {
            const { data, error } = await supabase
              .from("customer_access_tokens")
              .select("booking_id, purpose, form_id")
              .in("booking_id", ids)
              .in("purpose", ["travel_documents", "pickup", "custom_form"]);
            if (error) throw error;
            return data || [];
          })
        ).then(r => r.flat()),
      ]);

      if (formsRes.error) throw formsRes.error;
      const forms = formsRes.data || [];

      // Build lookup sets
      const passportRequestedBookings = new Set(
        tokens.filter(t => t.purpose === "travel_documents").map(t => t.booking_id)
      );
      const pickupRequestedBookings = new Set(
        tokens.filter(t => t.purpose === "pickup").map(t => t.booking_id)
      );
      const formRequestedSet = new Set(
        tokens.filter(t => t.purpose === "custom_form" && t.form_id).map(t => `${t.form_id}-${t.booking_id}`)
      );

      const docsSet = new Set(
        travelDocs
          .filter(d => d.passport_number || d.passport_first_name || d.passport_surname)
          .map(d => `${d.booking_id}-${d.passenger_slot}`)
      );
      const responseSet = new Set(
        formResponses.map(r => `${r.form_id}-${r.booking_id}-${r.passenger_slot}`)
      );

      // Group bookings by tour
      const bookingsByTour = new Map<string, typeof bookings>();
      for (const b of bookings) {
        if (!b.tour_id) continue;
        if (!bookingsByTour.has(b.tour_id)) bookingsByTour.set(b.tour_id, []);
        bookingsByTour.get(b.tour_id)!.push(b);
      }

      // Group forms by tour
      const formsByTour = new Map<string, typeof forms>();
      for (const f of forms) {
        if (!formsByTour.has(f.tour_id)) formsByTour.set(f.tour_id, []);
        formsByTour.get(f.tour_id)!.push(f);
      }

      return tours.map(tour => {
        const tourBookings = bookingsByTour.get(tour.id) || [];
        let missingPassports = 0;
        let missingPickups = 0;
        let missingForms = 0;

        if (tour.travel_documents_required) {
          for (const b of tourBookings) {
            if (b.passport_not_required) continue;
            if (!passportRequestedBookings.has(b.id)) continue;
            for (let slot = 1; slot <= b.passenger_count; slot++) {
              if (!docsSet.has(`${b.id}-${slot}`)) missingPassports++;
            }
          }
        }

        if (tour.pickup_location_required) {
          for (const b of tourBookings) {
            if (!pickupRequestedBookings.has(b.id)) continue;
            if (!b.selected_pickup_option_id) missingPickups++;
          }
        }

        const tourForms = formsByTour.get(tour.id) || [];
        for (const form of tourForms) {
          for (const b of tourBookings) {
            if (!formRequestedSet.has(`${form.id}-${b.id}`)) continue;
            if (form.response_mode === 'per_passenger') {
              for (let slot = 1; slot <= b.passenger_count; slot++) {
                if (!responseSet.has(`${form.id}-${b.id}-${slot}`)) missingForms++;
              }
            } else {
              if (!responseSet.has(`${form.id}-${b.id}-1`)) missingForms++;
            }
          }
        }

        return {
          tourId: tour.id,
          tourName: tour.name,
          startDate: tour.start_date,
          missingPassports,
          missingPickups,
          missingForms,
        };
      });
    },
    staleTime: 60000,
  });

  const breakdowns = data || [];
  const totalPassports = breakdowns.reduce((s, t) => s + t.missingPassports, 0);
  const totalPickups = breakdowns.reduce((s, t) => s + t.missingPickups, 0);
  const totalForms = breakdowns.reduce((s, t) => s + t.missingForms, 0);

  return {
    totalPassports,
    totalPickups,
    totalForms,
    tourBreakdowns: breakdowns,
    isLoading,
  };
};
