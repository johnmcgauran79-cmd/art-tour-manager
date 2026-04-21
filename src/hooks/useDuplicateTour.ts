
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const shiftDateOneYear = (dateStr: string | null): string | null => {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return new Date(d.getFullYear() + 1, d.getMonth(), d.getDate()).toISOString().split('T')[0];
};

export const useDuplicateTour = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ originalTourId, newName }: { originalTourId: string; newName?: string }) => {
      console.log('Duplicating tour:', originalTourId);

      // Fetch the original tour
      const { data: originalTour, error: tourError } = await supabase
        .from('tours')
        .select('*')
        .eq('id', originalTourId)
        .single();

      if (tourError) throw tourError;

      const newStartDate = shiftDateOneYear(originalTour.start_date)!;
      const newEndDate = shiftDateOneYear(originalTour.end_date)!;
      const tourName = newName || `${originalTour.name} ${new Date(newStartDate).getFullYear()}`;

      // Create new tour
      const newTourData = {
        name: tourName,
        tour_host: 'TBC',
        start_date: newStartDate,
        end_date: newEndDate,
        days: originalTour.days,
        nights: originalTour.nights,
        location: originalTour.location,
        pickup_point: originalTour.pickup_point,
        status: 'pending' as const,
        notes: originalTour.notes,
        inclusions: originalTour.inclusions,
        exclusions: originalTour.exclusions,
        price_single: originalTour.price_single,
        price_double: originalTour.price_double,
        price_twin: originalTour.price_twin,
        deposit_required: originalTour.deposit_required,
        instalment_amount: originalTour.instalment_amount,
        instalment_required: originalTour.instalment_required,
        instalment_date: shiftDateOneYear(originalTour.instalment_date),
        final_payment_date: shiftDateOneYear(originalTour.final_payment_date),
        capacity: originalTour.capacity,
        minimum_passengers_required: originalTour.minimum_passengers_required,
        travel_documents_required: originalTour.travel_documents_required,
        tour_type: originalTour.tour_type,
        url_reference: null,
        ops_notes: null,
        ops_accomm_notes: null,
        ops_races_notes: null,
        ops_transport_notes: null,
        ops_dinner_notes: null,
        ops_activities_notes: null,
        ops_other_notes: null,
        tour_hosts_notes: null,
        host_flights_status: 'not_booked',
        outbound_flight_number: null,
        outbound_flight_date: null,
        return_flight_number: null,
        return_flight_date: null,
      };

      const { data: newTour, error: createError } = await supabase
        .from('tours')
        .insert(newTourData)
        .select()
        .single();

      if (createError) throw createError;

      // Run all sub-duplications in parallel where possible
      await Promise.all([
        duplicateHotels(originalTourId, newTour.id),
        duplicateActivities(originalTourId, newTour.id),
        duplicateAdditionalInfo(originalTourId, newTour.id),
        duplicateItineraries(originalTourId, newTour.id),
        duplicateCustomForms(originalTourId, newTour.id),
      ]);

      return newTour;
    },
    onSuccess: (newTour) => {
      queryClient.invalidateQueries({ queryKey: ['tours'] });
      queryClient.invalidateQueries({ queryKey: ['hotels'] });
      queryClient.invalidateQueries({ queryKey: ['activities'] });
      queryClient.invalidateQueries({ queryKey: ['tour-additional-info'] });
      queryClient.invalidateQueries({ queryKey: ['itineraries'] });
      queryClient.invalidateQueries({ queryKey: ['custom-forms'] });
      toast({
        title: "Tour Duplicated Successfully",
        description: `"${newTour.name}" has been created with updated dates and copied hotels, activities, itineraries, forms & additional info.`,
      });
    },
    onError: (error) => {
      console.error('Error duplicating tour:', error);
      toast({
        title: "Error Duplicating Tour",
        description: "Failed to duplicate the tour. Please try again.",
        variant: "destructive",
      });
    },
  });
};

async function duplicateHotels(originalTourId: string, newTourId: string) {
  const { data: hotels, error } = await supabase
    .from('hotels')
    .select('*')
    .eq('tour_id', originalTourId);
  if (error) throw error;
  if (!hotels?.length) return;

  const newHotels = hotels.map(hotel => ({
    tour_id: newTourId,
    name: hotel.name,
    address: hotel.address,
    contact_name: hotel.contact_name,
    contact_phone: hotel.contact_phone,
    contact_email: hotel.contact_email,
    rooms_reserved: 0,
    booking_status: 'pending' as const,
    default_room_type: hotel.default_room_type,
    default_check_in: null,
    default_check_out: null,
    extra_night_price: null,
    operations_notes: null,
    upgrade_options: null,
    cancellation_policy: null,
    initial_rooms_cutoff_date: shiftDateOneYear(hotel.initial_rooms_cutoff_date),
    final_rooms_cutoff_date: shiftDateOneYear(hotel.final_rooms_cutoff_date),
  }));

  const { error: insertError } = await supabase.from('hotels').insert(newHotels);
  if (insertError) throw insertError;
}

async function duplicateActivities(originalTourId: string, newTourId: string) {
  const { data: activities, error } = await supabase
    .from('activities')
    .select('*, activity_journeys(*)')
    .eq('tour_id', originalTourId);
  if (error) throw error;
  if (!activities?.length) return;

  for (const activity of activities) {
    const { data: newActivity, error: insertErr } = await supabase
      .from('activities')
      .insert({
        tour_id: newTourId,
        name: activity.name,
        location: activity.location,
        activity_date: shiftDateOneYear(activity.activity_date),
        start_time: activity.start_time,
        end_time: activity.end_time,
        depart_for_activity: activity.depart_for_activity,
        spots_available: null, // Reset - no bookings yet for new tour year
        activity_status: 'pending' as const,
        transport_status: 'pending' as const,
        transport_mode: activity.transport_mode,
        contact_name: activity.contact_name,
        contact_phone: activity.contact_phone,
        contact_email: activity.contact_email,
        transport_company: activity.transport_company,
        transport_contact_name: activity.transport_contact_name,
        transport_phone: activity.transport_phone,
        transport_email: activity.transport_email,
        driver_name: null, // Clear - changes yearly
        driver_phone: null, // Clear - changes yearly
        hospitality_inclusions: activity.hospitality_inclusions,
        notes: activity.notes,
        operations_notes: null,
        transport_notes: activity.transport_notes,
        dress_code: activity.dress_code, // Copy across
      })
      .select('id')
      .single();

    if (insertErr) throw insertErr;

    // Duplicate journeys
    const journeys = (activity as any).activity_journeys || [];
    if (newActivity && journeys.length > 0) {
      const newJourneys = journeys.map((j: any) => ({
        activity_id: newActivity.id,
        journey_number: j.journey_number,
        pickup_time: j.pickup_time,
        pickup_location: j.pickup_location,
        destination: j.destination,
        sort_order: j.sort_order,
      }));
      await supabase.from('activity_journeys').insert(newJourneys);
    }
  }
}

async function duplicateAdditionalInfo(originalTourId: string, newTourId: string) {
  const { data: sections, error } = await supabase
    .from('tour_additional_info_sections')
    .select('*')
    .eq('tour_id', originalTourId);
  if (error) throw error;
  if (!sections?.length) return;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const newSections = sections.map(s => ({
    tour_id: newTourId,
    template_id: s.template_id,
    name: s.name,
    icon_name: s.icon_name,
    content: s.content,
    sort_order: s.sort_order,
    is_visible: s.is_visible,
    include_in_email_rules: s.include_in_email_rules,
    created_by: user.id,
  }));

  const { error: insertErr } = await supabase
    .from('tour_additional_info_sections')
    .insert(newSections);
  if (insertErr) throw insertErr;
}

async function duplicateItineraries(originalTourId: string, newTourId: string) {
  const { data: itineraries, error } = await supabase
    .from('tour_itineraries')
    .select('*')
    .eq('tour_id', originalTourId);
  if (error) throw error;
  if (!itineraries?.length) return;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  for (const itin of itineraries) {
    const { data: newItin, error: itinErr } = await supabase
      .from('tour_itineraries')
      .insert({
        tour_id: newTourId,
        title: itin.title,
        notes: itin.notes,
        version: itin.version,
        is_current: itin.is_current,
        created_by: user.id,
      })
      .select('id')
      .single();

    if (itinErr) throw itinErr;
    if (!newItin) continue;

    // Copy itinerary days
    const { data: days, error: daysErr } = await supabase
      .from('tour_itinerary_days')
      .select('*')
      .eq('itinerary_id', itin.id)
      .order('day_number');

    if (daysErr) throw daysErr;
    if (!days?.length) continue;

    for (const day of days) {
      const { data: newDay, error: newDayErr } = await supabase
        .from('tour_itinerary_days')
        .insert({
          itinerary_id: newItin.id,
          day_number: day.day_number,
          activity_date: shiftDateOneYear(day.activity_date) || day.activity_date,
        })
        .select('id')
        .single();

      if (newDayErr) throw newDayErr;
      if (!newDay) continue;

      // Copy entries for this day
      const { data: entries, error: entriesErr } = await supabase
        .from('tour_itinerary_entries')
        .select('*')
        .eq('day_id', day.id)
        .order('sort_order');

      if (entriesErr) throw entriesErr;
      if (entries?.length) {
        const newEntries = entries.map(e => ({
          day_id: newDay.id,
          subject: e.subject,
          content: e.content,
          time_slot: e.time_slot,
          sort_order: e.sort_order,
        }));
        await supabase.from('tour_itinerary_entries').insert(newEntries);
      }
    }
  }
}

async function duplicateCustomForms(originalTourId: string, newTourId: string) {
  const { data: forms, error } = await supabase
    .from('tour_custom_forms' as any)
    .select('*')
    .eq('tour_id', originalTourId);
  if (error) throw error;
  if (!forms?.length) return;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  for (const form of forms as any[]) {
    const { data: newForm, error: formErr } = await supabase
      .from('tour_custom_forms' as any)
      .insert({
        tour_id: newTourId,
        form_title: form.form_title,
        form_description: form.form_description,
        response_mode: form.response_mode,
        is_published: false, // Start unpublished
        created_by: user.id,
      } as any)
      .select('id')
      .single();

    if (formErr) throw formErr;
    if (!newForm) continue;

    // Copy form fields
    const { data: fields, error: fieldsErr } = await supabase
      .from('tour_custom_form_fields' as any)
      .select('*')
      .eq('form_id', form.id)
      .order('sort_order');

    if (fieldsErr) throw fieldsErr;
    if (fields?.length) {
      const newFields = (fields as any[]).map(f => ({
        form_id: (newForm as any).id,
        field_label: f.field_label,
        field_type: f.field_type,
        field_options: f.field_options,
        is_required: f.is_required,
        sort_order: f.sort_order,
        placeholder: f.placeholder,
      }));
      await supabase.from('tour_custom_form_fields' as any).insert(newFields as any);
    }
  }
}
