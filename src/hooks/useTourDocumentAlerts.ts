import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface DocumentAlertCounts {
  missingPassports: number;
  missingPickups: number;
  missingForms: number;
  total: number;
  isLoading: boolean;
}

/**
 * Fetch rows in chunks to avoid the Supabase 1000-row default limit.
 */
async function fetchInChunks<T>(
  table: string,
  column: string,
  ids: string[],
  select: string,
  extraFilters?: (query: any) => any,
  chunkSize = 500
): Promise<T[]> {
  if (ids.length === 0) return [];
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += chunkSize) {
    chunks.push(ids.slice(i, i + chunkSize));
  }
  const results = await Promise.all(
    chunks.map(async (chunk) => {
      let query = supabase.from(table).select(select).in(column, chunk);
      if (extraFilters) query = extraFilters(query);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as T[];
    })
  );
  return results.flat();
}

export const useTourDocumentAlerts = (tourId: string): DocumentAlertCounts => {
  // Get bookings for this tour (non-cancelled, non-waitlisted)
  const { data: bookings, isLoading: bookingsLoading } = useQuery({
    queryKey: ["tour-doc-alerts-bookings", tourId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("id, passenger_count, selected_pickup_option_id, lead_passenger_id, passenger_2_id, passenger_3_id, passport_not_required")
        .eq("tour_id", tourId)
        .not("status", "in", '("cancelled","waitlisted")');
      if (error) throw error;
      return data || [];
    },
    enabled: !!tourId,
    staleTime: 60000,
  });

  // Get tour settings
  const { data: tour, isLoading: tourLoading } = useQuery({
    queryKey: ["tour-doc-alerts-tour", tourId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tours")
        .select("travel_documents_required, pickup_location_required")
        .eq("id", tourId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!tourId,
    staleTime: 60000,
  });

  const bookingIds = (bookings || []).map(b => b.id);

  // Get travel docs submitted (chunked)
  const { data: travelDocs, isLoading: docsLoading } = useQuery({
    queryKey: ["tour-doc-alerts-traveldocs", tourId],
    queryFn: async () => {
      return fetchInChunks<{ booking_id: string; passenger_slot: number; passport_number: string | null; passport_first_name: string | null; passport_surname: string | null }>(
        "booking_travel_docs", "booking_id", bookingIds,
        "booking_id, passenger_slot, passport_number, passport_first_name, passport_surname"
      );
    },
    enabled: bookingIds.length > 0 && !!tour?.travel_documents_required,
    staleTime: 60000,
  });

  // Get custom forms for this tour
  const { data: forms, isLoading: formsLoading } = useQuery({
    queryKey: ["tour-doc-alerts-forms", tourId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tour_custom_forms")
        .select("id, response_mode")
        .eq("tour_id", tourId)
        .eq("is_published", true);
      if (error) throw error;
      return data || [];
    },
    enabled: !!tourId,
    staleTime: 60000,
  });

  // Get form responses (chunked)
  const { data: formResponses, isLoading: responsesLoading } = useQuery({
    queryKey: ["tour-doc-alerts-responses", tourId],
    queryFn: async () => {
      if (!forms || forms.length === 0) return [];
      return fetchInChunks<{ form_id: string; booking_id: string; passenger_slot: number }>(
        "tour_custom_form_responses", "booking_id", bookingIds,
        "form_id, booking_id, passenger_slot"
      );
    },
    enabled: !!forms && forms.length > 0 && bookingIds.length > 0,
    staleTime: 60000,
  });

  // Get access tokens (chunked)
  const { data: tokens, isLoading: tokensLoading } = useQuery({
    queryKey: ["tour-doc-alerts-tokens", tourId],
    queryFn: async () => {
      return fetchInChunks<{ booking_id: string; purpose: string; form_id: string | null }>(
        "customer_access_tokens", "booking_id", bookingIds,
        "booking_id, purpose, form_id",
        (q: any) => q.in("purpose", ["travel_documents", "pickup", "custom_form"])
      );
    },
    enabled: bookingIds.length > 0,
    staleTime: 60000,
  });

  const isLoading = bookingsLoading || tourLoading || docsLoading || formsLoading || responsesLoading || tokensLoading;

  if (isLoading || !bookings || !tour) {
    return { missingPassports: 0, missingPickups: 0, missingForms: 0, total: 0, isLoading };
  }

  // Build sets of bookings that have been sent requests
  const passportRequestedBookings = new Set(
    (tokens || []).filter(t => t.purpose === "travel_documents").map(t => t.booking_id)
  );
  const pickupRequestedBookings = new Set(
    (tokens || []).filter(t => t.purpose === "pickup").map(t => t.booking_id)
  );
  const formRequestedSet = new Set(
    (tokens || []).filter(t => t.purpose === "custom_form" && t.form_id).map(t => `${t.form_id}-${t.booking_id}`)
  );

  // Calculate missing passports (only where requested, excluding passport_not_required)
  let missingPassports = 0;
  if (tour.travel_documents_required) {
    const docsMap = new Set(
      (travelDocs || [])
        .filter(d => d.passport_number || d.passport_first_name || d.passport_surname)
        .map(d => `${d.booking_id}-${d.passenger_slot}`)
    );
    for (const booking of bookings) {
      if (booking.passport_not_required) continue;
      if (!passportRequestedBookings.has(booking.id)) continue;
      for (let slot = 1; slot <= booking.passenger_count; slot++) {
        if (!docsMap.has(`${booking.id}-${slot}`)) {
          missingPassports++;
        }
      }
    }
  }

  // Calculate missing pickups (only where requested)
  let missingPickups = 0;
  if (tour.pickup_location_required) {
    for (const booking of bookings) {
      if (!pickupRequestedBookings.has(booking.id)) continue;
      if (!booking.selected_pickup_option_id) {
        missingPickups++;
      }
    }
  }

  // Calculate missing form responses (only where requested)
  let missingForms = 0;
  if (forms && forms.length > 0) {
    const responseSet = new Set(
      (formResponses || []).map(r => `${r.form_id}-${r.booking_id}-${r.passenger_slot}`)
    );
    for (const form of forms) {
      for (const booking of bookings) {
        if (!formRequestedSet.has(`${form.id}-${booking.id}`)) continue;
        if (form.response_mode === 'per_passenger') {
          for (let slot = 1; slot <= booking.passenger_count; slot++) {
            if (!responseSet.has(`${form.id}-${booking.id}-${slot}`)) {
              missingForms++;
            }
          }
        } else {
          if (!responseSet.has(`${form.id}-${booking.id}-1`)) {
            missingForms++;
          }
        }
      }
    }
  }

  const total = missingPassports + missingPickups + missingForms;

  return { missingPassports, missingPickups, missingForms, total, isLoading };
};
